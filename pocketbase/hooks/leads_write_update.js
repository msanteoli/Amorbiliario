// Edição de lead pela coleção. Normaliza telefone e e-mail, limita o que o corretor muda
// (só etapa, motivo da perda, próximo passo e prazo), valida o atribuído e a perda com motivo,
// e grava a linha do tempo (estágio, atribuição e próximo passo). Quem pode editar qual linha
// já é decidido pela updateRule (corretor só os atribuídos a ele); origem, ligação com o cliente,
// pendência de duplicidade e datas de contato nunca mudam por aqui.
onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const rec = e.record
  const orig = rec.original()
  const role = String(e.auth.get('role'))

  // tira também os zeros à esquerda (prefixo de DDD, ex.: 011 98765-4321)
  let phone = String(rec.get('phone') || '')
    .replace(/\D/g, '')
    .replace(/^0+/, '')
  if (phone.length === 10 || phone.length === 11) phone = '55' + phone
  if (phone && (phone.length < 12 || phone.length > 13)) {
    throw new BadRequestError('Telefone inválido. Informe DDD e número.')
  }
  const email = String(rec.get('email') || '')
    .trim()
    .toLowerCase()
  if (!phone && !email) throw new BadRequestError('Informe ao menos telefone ou e-mail.')
  rec.set('phone', phone)
  rec.set('email', email)
  rec.set('name', String(rec.get('name') || '').trim())

  // trocar telefone ou e-mail para o de outro lead cria uma pendência de duplicidade
  let dupOf = ''
  const dparts = []
  const dparams = { o: rec.getString('organization_id'), s: rec.id }
  if (phone && phone !== orig.getString('phone')) {
    dparts.push('phone = {:p}')
    dparams.p = phone
  }
  if (email && email !== orig.getString('email')) {
    dparts.push('email = {:m}')
    dparams.m = email
  }
  if (dparts.length) {
    const other = $app.findRecordsByFilter(
      'leads',
      'organization_id = {:o} && id != {:s} && (' + dparts.join(' || ') + ')',
      '-created',
      1,
      0,
      dparams,
    )
    if (other.length) {
      dupOf = other[0].id
      rec.set('dedupe_status', 'pendente')
      rec.set('dedupe_of', dupOf)
    }
  }

  // o corretor só mexe em etapa, motivo da perda, próximo passo e prazo
  const locked = [
    'name',
    'phone',
    'email',
    'origin_detail',
    'property_id',
    'search_neighborhood',
    'search_type',
    'search_bedrooms',
    'search_max_price',
    'search_min_price',
    'search_neighborhoods',
    'notes',
    'consent_status',
    'assigned_to',
  ]
  if (role === 'corretor') {
    const touched = locked.filter((f) => String(rec.get(f)) !== String(orig.get(f)))
    if (touched.length)
      throw new ForbiddenError('O corretor só altera etapa, próximo passo e prazo.')
  }

  // atribuído: usuário ativo da mesma organização, com papel corretor ou admin
  const assignee = rec.getString('assigned_to')
  const assigneeChanged = assignee !== orig.getString('assigned_to')
  let assigneeName = ''
  if (assigneeChanged && assignee) {
    let u = null
    try {
      u = $app.findRecordById('users', assignee)
    } catch (_) {}
    const roleOk = u && ['corretor', 'admin'].indexOf(String(u.get('role'))) >= 0
    if (
      !roleOk ||
      u.get('active') !== true ||
      u.get('organization_id') !== rec.get('organization_id')
    ) {
      throw new BadRequestError('Responsável inválido.')
    }
    assigneeName = u.getString('name') || 'Usuário'
  }

  // imóvel de interesse: da mesma organização
  const pid = rec.getString('property_id')
  if (pid && pid !== orig.getString('property_id')) {
    let p = null
    try {
      p = $app.findRecordById('properties', pid)
    } catch (_) {}
    if (!p || p.get('organization_id') !== rec.get('organization_id')) {
      throw new BadRequestError('Imóvel inválido.')
    }
  }

  // perder exige motivo; o motivo de sistema "duplicado" não é escolhido à mão; reabrir limpa
  const stage = rec.getString('stage')
  const origStage = orig.getString('stage')
  const reason = rec.getString('lost_reason')
  const origReason = orig.getString('lost_reason')
  if (stage === 'perdido') {
    if (!reason) throw new BadRequestError('Informe o motivo da perda.')
    if (reason === 'duplicado' && origReason !== 'duplicado')
      throw new BadRequestError('Motivo inválido.')
  } else {
    if (reason && reason !== origReason) {
      throw new BadRequestError('Motivo de perda só vale para lead perdido.')
    }
    rec.set('lost_reason', '')
  }

  const events = []
  if (stage !== origStage) {
    events.push({
      type: 'estagio',
      text: origStage + ' → ' + stage + (stage === 'perdido' ? ' (motivo: ' + reason + ')' : ''),
    })
  }
  if (assigneeChanged) {
    events.push({
      type: 'atribuicao',
      text: assignee ? 'Atribuído a ' + assigneeName : 'Atribuição removida',
    })
  }
  const step = rec.getString('next_step')
  const due = rec.getString('next_step_due')
  if (step !== orig.getString('next_step') || due !== orig.getString('next_step_due')) {
    events.push({
      type: 'proximo_passo',
      text: (step || '(sem texto)') + (due ? ' (prazo ' + due.substring(0, 10) + ')' : ''),
    })
  }

  const res = e.next()
  if (assigneeChanged) {
    try {
      const open = $app.findRecordsByFilter(
        'negotiations',
        "lead_id = {:l} && (status = 'em_analise' || status = 'aprovada')",
        '',
        5,
        0,
        { l: rec.id },
      )
      open.forEach((n) => {
        n.set('responsible_id', assignee)
        $app.save(n)
      })
    } catch (err) {
      $app
        .logger()
        .error('negotiation_follow_lead_failed', 'err', String((err && err.message) || err))
    }
  }

  try {
    const col = $app.findCollectionByNameOrId('lead_events')
    if (dupOf) {
      events.push({
        type: 'pendencia_dedupe',
        text: 'Telefone ou e-mail alterado para o de outro lead: possível duplicidade.',
      })
      const r2 = new Record(col)
      r2.set('organization_id', rec.get('organization_id'))
      r2.set('lead_id', dupOf)
      r2.set('type', 'pendencia_dedupe')
      r2.set('author_id', e.auth.id)
      r2.set('occurred_at', new Date().toISOString())
      r2.set(
        'text',
        'Outro lead teve o telefone ou e-mail alterado para o deste: possível duplicidade.',
      )
      $app.save(r2)
    }
    events.forEach((ev) => {
      const r = new Record(col)
      r.set('organization_id', rec.get('organization_id'))
      r.set('lead_id', rec.id)
      r.set('type', ev.type)
      r.set('author_id', e.auth.id)
      r.set('occurred_at', new Date().toISOString())
      r.set('text', ev.text)
      $app.save(r)
    })
  } catch (err) {
    $app.logger().error('lead_events_failed', 'err', String((err && err.message) || err))
  }
  return res
}, 'leads')
