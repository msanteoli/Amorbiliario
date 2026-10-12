// Contatos enviados pela Chaves na Mão (público, protegido pelo código secreto leads_token do
// portal_feeds). Cria o lead com origem Portal (ou registra o recontato num lead que já existe) com a
// mesma deduplicação do site (public_leads_create.js, copiada: goja não compartilha código).
// Limites: 120 por minuto por token; por IP só para token inválido (30 por minuto, depois 429).
// Nunca há limite por IP para token válido (o portal envia de poucos IPs). A resposta para token
// válido e corpo válido é sempre a mesma. Nada de nome, e-mail, telefone, mensagem ou token nos logs.
routerAdd('POST', '/backend/v1/public/portal-leads/{token}', (e) => {
  const token = String(e.request.pathValue('token') || '')
  const win = Math.floor(Date.now() / 60000)

  // contador por janela de 1 minuto: uma chave por IP/linha guardando {w, n}; o incremento roda
  // dentro do setFunc (atômico). De vez em quando (~1 em 100) varre o store e remove as chaves de
  // janelas antigas, para a memória não crescer com IPs que nunca voltam.
  const hit = (key) => {
    let n = 0
    $app.store().setFunc(key, (old) => {
      n = old && old.w === win ? Number(old.n || 0) + 1 : 1
      return { w: win, n: n }
    })
    if (Math.random() < 0.01) {
      try {
        const all = $app.store().getAll()
        Object.keys(all).forEach((k) => {
          if (k.indexOf('thr:plbad:') !== 0 && k.indexOf('thr:pltok:') !== 0) return
          const v = all[k]
          if (!v || typeof v.w !== 'number' || v.w < win - 1) $app.store().remove(k)
        })
      } catch (err) {
        $app.logger().error('portal_lead_sweep_failed')
      }
    }
    return n
  }

  let feed = null
  if (/^[A-Za-z0-9]{32,64}$/.test(token)) {
    try {
      feed = $app.findFirstRecordByData('portal_feeds', 'leads_token', token)
    } catch (err) {
      feed = null
    }
  }
  if (!feed || feed.get('active') !== true || feed.getString('portal') !== 'chaves_na_mao') {
    // limite por IP só para tentativas com token inválido
    if (hit('thr:plbad:' + e.realIP()) > 30) {
      throw new TooManyRequestsError('Muitas tentativas. Aguarde um minuto e tente de novo.')
    }
    throw new NotFoundError('Não encontrado.')
  }

  // limite por token (chave pelo id da linha, nunca pelo token)
  if (hit('thr:pltok:' + feed.id) > 120) {
    throw new TooManyRequestsError('Muitas tentativas. Aguarde um minuto e tente de novo.')
  }

  const orgId = feed.getString('organization_id')

  let body = null
  try {
    body = e.requestInfo().body
  } catch (err) {
    throw new BadRequestError('Corpo inválido.')
  }
  if (!body || typeof body !== 'object') body = {}
  const clean = (v, max) =>
    String(v == null ? '' : v)
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .trim()
      .slice(0, max)

  let name = clean(body.name, 120)
  if (name.length < 2) name = 'Contato do portal'
  let phone = String(body.phone == null ? '' : body.phone)
    .replace(/\D/g, '')
    .replace(/^0+/, '')
  if (phone.length === 10 || phone.length === 11) phone = '55' + phone
  if (phone.length < 12 || phone.length > 13) phone = ''
  let email = clean(body.email, 160).toLowerCase()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (!phone) throw new BadRequestError('E-mail inválido.')
    email = ''
  }
  if (!phone && !email) throw new BadRequestError('Informe telefone ou e-mail.')
  const message = clean(body.message, 1000)
  const reference = clean(body.reference, 60)

  const intentKey = 'portal:' + $security.sha256(JSON.stringify([reference, phone, email, message]))

  // imóvel do anúncio: qualquer situação, só nesta organização, parâmetros ligados
  let property = null
  if (reference) {
    const prows = $app.findRecordsByFilter(
      'properties',
      'organization_id = {:o} && code = {:c}',
      '',
      1,
      0,
      { o: orgId, c: reference },
    )
    if (prows.length) property = prows[0]
  }
  const originDetail =
    property || !reference
      ? 'Chaves na Mão'
      : ('Chaves na Mão (ref: ' + reference + ')').slice(0, 80)

  const nowIso = new Date().toISOString()
  const addEvent = (app, leadId, type, text, key) => {
    const ev = new Record(app.findCollectionByNameOrId('lead_events'))
    ev.set('organization_id', orgId)
    ev.set('lead_id', leadId)
    ev.set('type', type)
    ev.set('occurred_at', nowIso)
    ev.set('text', text.slice(0, 2000))
    if (key) ev.set('intent_key', key)
    app.save(ev)
  }
  const audit = (action, leadId) => {
    try {
      const rec = new Record($app.findCollectionByNameOrId('audit_log'))
      rec.set('organization_id', orgId)
      rec.set('actor_id', 'portal_chaves_na_mao')
      rec.set('actor_role', 'portal')
      rec.set('action', action)
      rec.set('collection_name', 'leads')
      rec.set('record_id', leadId)
      rec.set('reason', 'origem=portal')
      rec.set('occurred_at', nowIso)
      $app.save(rec)
    } catch (err) {
      $app.logger().error('portal_lead_audit_failed')
    }
  }

  const parts = []
  const params = { o: orgId }
  if (phone) {
    parts.push('phone = {:p}')
    params.p = phone
  }
  if (email) {
    parts.push('email = {:m}')
    params.m = email
  }

  // verificação de repetição, deduplicação, gravação do lead e do evento numa só transação:
  // as transações de escrita são serializadas, então dois envios simultâneos não se perdem
  let outcome = null // { kind: 'replay' | 'repeat' | 'new', ... }
  try {
    $app.runInTransaction((tx) => {
      const replay = tx.findRecordsByFilter(
        'lead_events',
        'organization_id = {:o} && intent_key = {:k}',
        '',
        1,
        0,
        { o: orgId, k: intentKey },
      )
      if (replay.length) {
        outcome = { kind: 'replay' }
        return
      }

      const rows = tx.findRecordsByFilter(
        'leads',
        'organization_id = {:o} && (' + parts.join(' || ') + ')',
        '-created',
        20,
        0,
        params,
      )
      let consistent = null
      let conflict = null
      rows.forEach((l) => {
        if (l.getString('lost_reason') === 'duplicado') return
        const lp = l.getString('phone')
        const le = l.getString('email')
        const samePhone = !!phone && lp === phone
        const sameEmail = !!email && le === email
        const isConflict =
          (samePhone && !!email && !!le && le !== email) ||
          (sameEmail && !!phone && !!lp && lp !== phone)
        if (isConflict) {
          if (!conflict) conflict = l
        } else if (samePhone || sameEmail) {
          if (!consistent) consistent = l
        }
      })

      if (consistent) {
        addEvent(
          tx,
          consistent.id,
          'contato_repetido',
          'Novo contato pelo portal' +
            (property ? ' no imóvel ' + property.getString('code') : '') +
            (message ? ': ' + message : '.'),
          intentKey,
        )
        outcome = { kind: 'repeat', lead: consistent }
        return
      }

      const crows = tx.findRecordsByFilter(
        'clients',
        'organization_id = {:o} && (' + parts.join(' || ') + ')',
        '-created',
        1,
        0,
        params,
      )
      const client = crows.length ? crows[0] : null

      const lead = new Record(tx.findCollectionByNameOrId('leads'))
      lead.set('organization_id', orgId)
      lead.set('name', name)
      lead.set('phone', phone)
      lead.set('email', email)
      lead.set('origin', 'portal')
      lead.set('origin_detail', originDetail)
      lead.set('stage', 'novo')
      lead.set('consent_status', 'unknown')
      lead.set('consent_channel', 'portal_chaves_na_mao')
      if (property) lead.set('property_id', property.id)
      if (client) lead.set('client_id', client.id)
      if (conflict) {
        lead.set('dedupe_status', 'pendente')
        lead.set('dedupe_of', conflict.id)
      }
      tx.save(lead)
      addEvent(
        tx,
        lead.id,
        'criado',
        'Contato pelo portal: ' + (message ? message.slice(0, 500) : '(sem mensagem)'),
        intentKey,
      )
      outcome = { kind: 'new', lead: lead, client: client, conflict: conflict }
    })
  } catch (err) {
    // índice único (lead_id, intent_key): um envio idêntico simultâneo já gravou; resposta igual
    const msg = String((err && err.message) || err)
    if (/unique|UNIQUE/i.test(msg)) return e.json(200, { ok: true })
    throw err
  }

  if (!outcome || outcome.kind === 'replay') return e.json(200, { ok: true })

  // gravado: daqui em diante nenhuma falha vira erro
  try {
    if (outcome.kind === 'repeat') {
      const consistent = outcome.lead
      let changed = false
      if (property && !consistent.getString('property_id')) {
        consistent.set('property_id', property.id)
        changed = true
      }
      if (consistent.getString('stage') === 'perdido') {
        consistent.set('stage', 'novo')
        consistent.set('lost_reason', '')
        changed = true
        addEvent($app, consistent.id, 'estagio', 'perdido → novo (novo contato pelo portal)', '')
      }
      if (changed) $app.save(consistent)
    } else {
      const lead = outcome.lead
      if (outcome.client) addEvent($app, lead.id, 'nota', 'Já é cliente.', '')
      if (outcome.conflict) {
        addEvent(
          $app,
          lead.id,
          'pendencia_dedupe',
          'Possível duplicidade com outro lead: telefone ou e-mail iguais com o outro dado diferente.',
          '',
        )
        addEvent(
          $app,
          outcome.conflict.id,
          'pendencia_dedupe',
          'Um lead novo do portal ficou como possível duplicidade deste.',
          '',
        )
      }
    }
  } catch (err) {
    $app.logger().error('portal_lead_bookkeeping_failed')
  }
  audit(outcome.kind === 'repeat' ? 'lead_contato_portal' : 'lead_criado_portal', outcome.lead.id)
  try {
    const f = $app.findRecordById('portal_feeds', feed.id)
    f.set('last_lead_at', nowIso)
    f.set('leads_count', Number(f.get('leads_count') || 0) + 1)
    $app.save(f)
  } catch (err) {
    $app.logger().error('portal_lead_counter_failed')
  }
  return e.json(200, { ok: true })
})
