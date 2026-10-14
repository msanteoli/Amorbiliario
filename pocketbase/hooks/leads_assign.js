// M14 — O SDR (ou o admin) direciona um lead do site a um corretor. Valida que o corretor é ativo,
// do papel corretor, da mesma organização e sem bloqueio de agenda agora. Grava o responsável,
// marca a última entrega do corretor (fila), registra o evento "atribuicao" e a auditoria.
routerAdd(
  'POST',
  '/backend/v1/leads/{id}/assign',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || (role !== 'admin' && role !== 'sdr')) {
      throw new ForbiddenError('Só o SDR ou o admin direciona lead.')
    }
    const orgId = String(actor.get('organization_id') || '')
    const body = e.requestInfo().body || {}

    let lead = null
    try {
      lead = $app.findRecordById('leads', e.request.pathValue('id'))
    } catch (_) {}
    if (!lead || lead.get('organization_id') !== orgId)
      throw new NotFoundError('Lead não encontrado.')

    let target = null
    try {
      target = $app.findRecordById('users', String(body.user_id || ''))
    } catch (_) {}
    if (
      !target ||
      target.get('organization_id') !== orgId ||
      target.get('role') !== 'corretor' ||
      target.get('active') !== true
    ) {
      throw new BadRequestError('Escolha um corretor ativo da imobiliária.')
    }

    const nowMs = Date.now()
    const blocos = $app.findRecordsByFilter('agenda_blocks', 'user_id = {:u}', '', 200, 0, {
      u: target.id,
    })
    const bloqueado = blocos.some((b) => {
      if (String(b.get('ended_at') || '') !== '') return false
      const ini = new Date(b.getString('start_at').replace(' ', 'T')).getTime()
      const fim = new Date(b.getString('end_at').replace(' ', 'T')).getTime()
      return ini <= nowMs && fim > nowMs
    })
    if (bloqueado)
      return e.json(409, { message: 'Este corretor está com a agenda bloqueada agora.' })

    const now = new Date().toISOString()
    const anterior = lead.getString('assigned_to')
    lead.set('assigned_to', target.id)
    $app.save(lead)

    target.set('last_intake_at', now)
    $app.save(target)

    const ev = new Record($app.findCollectionByNameOrId('lead_events'))
    ev.set('organization_id', orgId)
    ev.set('lead_id', lead.id)
    ev.set('type', 'atribuicao')
    ev.set('author_id', actor.id)
    ev.set('occurred_at', now)
    ev.set(
      'text',
      'Direcionado a ' + target.getString('name') + (anterior ? ' (antes: outro corretor).' : '.'),
    )
    $app.save(ev)

    const audit = new Record($app.findCollectionByNameOrId('audit_log'))
    audit.set('organization_id', orgId)
    audit.set('actor_id', actor.id)
    audit.set('actor_role', role)
    audit.set('action', 'lead_direcionado')
    audit.set('collection_name', 'leads')
    audit.set('record_id', lead.id)
    audit.set('field_name', 'assigned_to')
    audit.set('occurred_at', now)
    $app.save(audit)

    return e.json(200, { assigned_to: target.id })
  },
  $apis.requireAuth(),
)
