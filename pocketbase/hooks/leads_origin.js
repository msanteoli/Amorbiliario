// Correção da origem de um lead: só o admin, com motivo, gravando auditoria e a linha do
// tempo. É o único caminho que muda a origem (a coleção a bloqueia).
routerAdd(
  'POST',
  '/backend/v1/leads/{id}/origin',
  (e) => {
    const actor = e.auth
    if (actor.get('active') !== true || String(actor.get('role') || '') !== 'admin') {
      throw new ForbiddenError('Só o admin corrige a origem do lead.')
    }
    const orgId = String(actor.get('organization_id') || '')
    const body = e.requestInfo().body || {}
    const origin = String(body.origin || '')
    const origins = [
      'whatsapp',
      'portal',
      'indicacao_balcao',
      'site_redes_outros',
      'ligacao',
      'site',
      'redes_sociais',
    ]
    if (origins.indexOf(origin) < 0) {
      throw new BadRequestError('Origem inválida.')
    }
    const reason = String(body.reason || '').trim()
    if (reason.length < 3) throw new BadRequestError('Informe o motivo da correção.')

    let lead = null
    try {
      lead = $app.findRecordById('leads', e.request.pathValue('id'))
    } catch (_) {}
    if (!lead || lead.get('organization_id') !== orgId)
      throw new NotFoundError('Lead não encontrado.')

    const old = lead.getString('origin')
    lead.set('origin', origin)
    $app.save(lead)

    const now = new Date().toISOString()
    const audit = new Record($app.findCollectionByNameOrId('audit_log'))
    audit.set('organization_id', orgId)
    audit.set('actor_id', actor.id)
    audit.set('actor_role', 'admin')
    audit.set('action', 'lead_origem_corrigida')
    audit.set('collection_name', 'leads')
    audit.set('record_id', lead.id)
    audit.set('field_name', 'origin')
    audit.set('reason', reason.slice(0, 300))
    audit.set('occurred_at', now)
    $app.save(audit)

    const ev = new Record($app.findCollectionByNameOrId('lead_events'))
    ev.set('organization_id', orgId)
    ev.set('lead_id', lead.id)
    ev.set('type', 'origem_corrigida')
    ev.set('author_id', actor.id)
    ev.set('occurred_at', now)
    ev.set(
      'text',
      'Origem corrigida: ' + old + ' → ' + origin + '. Motivo: ' + reason.slice(0, 300),
    )
    $app.save(ev)

    return e.json(200, { origin: origin })
  },
  $apis.requireAuth(),
)
