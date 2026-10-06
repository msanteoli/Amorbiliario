// Histórico de um imóvel para quem enxerga o imóvel (admin, sdr e corretor). Devolve só
// autor, horário, ação e NOME do campo; nunca os valores. O audit_log em si continua
// legível apenas pelo admin.
routerAdd(
  'GET',
  '/backend/v1/properties/{id}/history',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'sdr', 'corretor'].indexOf(role) < 0) {
      throw new ForbiddenError('Papel sem acesso a estes dados.')
    }
    const orgId = String(actor.get('organization_id') || '')
    const id = e.request.pathValue('id')
    let p = null
    try {
      p = $app.findRecordById('properties', id)
    } catch (_) {}
    if (!p || p.get('organization_id') !== orgId) {
      throw new NotFoundError('Imóvel não encontrado.')
    }

    const rows = $app.findRecordsByFilter(
      'audit_log',
      'collection_name = "properties" && record_id = {:r} && organization_id = {:o}',
      '-occurred_at',
      200,
      0,
      { r: id, o: orgId },
    )
    const names = {}
    const items = []
    rows.forEach((row) => {
      const aid = row.getString('actor_id')
      if (aid && names[aid] === undefined) {
        try {
          const u = $app.findRecordById('users', aid)
          names[aid] = u.getString('name') || 'Usuário'
        } catch (_) {
          names[aid] = ''
        }
      }
      items.push({
        action: row.getString('action'),
        field: row.getString('field_name'),
        reason: row.getString('reason'),
        occurred_at: row.getString('occurred_at'),
        actor: names[aid] || '',
      })
    })
    return e.json(200, { items: items })
  },
  $apis.requireAuth(),
)
