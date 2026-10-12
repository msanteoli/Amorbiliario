// Contatos enviados pela Chaves na Mão (público, protegido pelo código secreto leads_token do
// portal_feeds). Cria o lead com origem Portal (ou registra o recontato num lead que já existe) com a
// mesma deduplicação do site (public_leads_create.js, copiada: goja não compartilha código).
// Limites: 120 por minuto por token; por IP só para token inválido (30 por minuto, depois 429).
// Nunca há limite por IP para token válido (o portal envia de poucos IPs). A resposta para token
// válido e corpo válido é sempre a mesma. Nada de nome, e-mail, telefone, mensagem ou token nos logs.
routerAdd('POST', '/backend/v1/public/portal-leads/{token}', (e) => {
  const token = String(e.request.pathValue('token') || '')
  const win = Math.floor(Date.now() / 60000)

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
    const ip = e.realIP()
    const bkey = 'thr:plbad:' + ip + ':' + win
    // incremento atômico (setFunc segura a trava do store)
    let bn = 0
    $app.store().setFunc(bkey, (old) => {
      bn = Number(old || 0) + 1
      return bn
    })
    $app.store().remove('thr:plbad:' + ip + ':' + (win - 1))
    if (bn > 30)
      throw new TooManyRequestsError('Muitas tentativas. Aguarde um minuto e tente de novo.')
    throw new NotFoundError('Não encontrado.')
  }

  // limite por token (chave pelo id da linha, nunca pelo token)
  const tkey = 'thr:pltok:' + feed.id + ':' + win
  // incremento atômico: requisições simultâneas não passam do limite
  let tn = 0
  $app.store().setFunc(tkey, (old) => {
    tn = Number(old || 0) + 1
    return tn
  })
  $app.store().remove('thr:pltok:' + feed.id + ':' + (win - 1))
  if (tn > 120)
    throw new TooManyRequestsError('Muitas tentativas. Aguarde um minuto e tente de novo.')

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

  const intentKey =
    'portal:' + $security.sha256(reference + '|' + phone + '|' + email + '|' + message)
  const replay = $app.findRecordsByFilter(
    'lead_events',
    'organization_id = {:o} && intent_key = {:k}',
    '',
    1,
    0,
    { o: orgId, k: intentKey },
  )
  if (replay.length) return e.json(200, { ok: true })

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
  const addEvent = (leadId, type, text, key) => {
    const ev = new Record($app.findCollectionByNameOrId('lead_events'))
    ev.set('organization_id', orgId)
    ev.set('lead_id', leadId)
    ev.set('type', type)
    ev.set('occurred_at', nowIso)
    ev.set('text', text.slice(0, 2000))
    if (key) ev.set('intent_key', key)
    $app.save(ev)
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
  const bumpCounters = () => {
    try {
      const f = $app.findRecordById('portal_feeds', feed.id)
      f.set('last_lead_at', nowIso)
      f.set('leads_count', Number(f.get('leads_count') || 0) + 1)
      $app.save(f)
    } catch (err) {
      $app.logger().error('portal_lead_counter_failed')
    }
  }

  // deduplicação (mesma regra do site)
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
  const rows = $app.findRecordsByFilter(
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
      consistent.id,
      'contato_repetido',
      'Novo contato pelo portal' +
        (property ? ' no imóvel ' + property.getString('code') : '') +
        (message ? ': ' + message : '.'),
      intentKey,
    )
    // gravado: daqui em diante nenhuma falha vira erro
    try {
      let changed = false
      if (property && !consistent.getString('property_id')) {
        consistent.set('property_id', property.id)
        changed = true
      }
      if (consistent.getString('stage') === 'perdido') {
        consistent.set('stage', 'novo')
        consistent.set('lost_reason', '')
        changed = true
        addEvent(consistent.id, 'estagio', 'perdido → novo (novo contato pelo portal)', '')
      }
      if (changed) $app.save(consistent)
    } catch (err) {
      $app.logger().error('portal_lead_repeat_update_failed')
    }
    audit('lead_contato_portal', consistent.id)
    bumpCounters()
    return e.json(200, { ok: true })
  }

  const crows = $app.findRecordsByFilter(
    'clients',
    'organization_id = {:o} && (' + parts.join(' || ') + ')',
    '-created',
    1,
    0,
    params,
  )
  const client = crows.length ? crows[0] : null

  const lead = new Record($app.findCollectionByNameOrId('leads'))
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
  $app.save(lead)
  addEvent(
    lead.id,
    'criado',
    'Contato pelo portal: ' + (message ? message.slice(0, 500) : '(sem mensagem)'),
    intentKey,
  )

  // gravado: daqui em diante nenhuma falha vira erro
  try {
    if (!conflict) {
      const late = $app.findRecordsByFilter(
        'leads',
        'organization_id = {:o} && id != {:s} && (' + parts.join(' || ') + ')',
        'created',
        1,
        0,
        Object.assign({ s: lead.id }, params),
      )
      if (late.length) {
        conflict = late[0]
        lead.set('dedupe_status', 'pendente')
        lead.set('dedupe_of', conflict.id)
        $app.save(lead)
      }
    }
    if (client) addEvent(lead.id, 'nota', 'Já é cliente.', '')
    if (conflict) {
      addEvent(
        lead.id,
        'pendencia_dedupe',
        'Possível duplicidade com outro lead: telefone ou e-mail iguais com o outro dado diferente.',
        '',
      )
      addEvent(
        conflict.id,
        'pendencia_dedupe',
        'Um lead novo do portal ficou como possível duplicidade deste.',
        '',
      )
    }
  } catch (err) {
    $app.logger().error('portal_lead_bookkeeping_failed')
  }
  audit('lead_criado_portal', lead.id)
  bumpCounters()
  return e.json(200, { ok: true })
})
