// Disponibilidade de visita de um imóvel (janelas ativas). Para a tela interna do imóvel.
routerAdd(
  'GET',
  '/backend/v1/properties/{id}/visit-slots',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'sdr', 'corretor'].indexOf(role) < 0) {
      throw new ForbiddenError('Papel sem acesso a estes dados.')
    }
    const orgId = String(actor.get('organization_id') || '')
    let property = null
    try {
      property = $app.findRecordById('properties', e.request.pathValue('id'))
    } catch (_) {}
    if (!property || property.get('organization_id') !== orgId)
      throw new NotFoundError('Imóvel não encontrado.')

    const rows = $app.findRecordsByFilter(
      'property_visit_slots',
      'property_id = {:p} && is_active = true',
      'weekday,start_time',
      100,
      0,
      { p: property.id },
    )
    return e.json(200, {
      windows: rows.map((r) => ({
        weekday: Number(r.get('weekday') || 0),
        start: r.getString('start_time'),
        end: r.getString('end_time'),
        duration: Number(r.get('duration_minutes') || 0),
      })),
    })
  },
  $apis.requireAuth(),
)
