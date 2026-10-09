// Lista as negociações de um lead (a aberta e o histórico). Admin, SDR e o corretor dono do lead.
routerAdd(
  'GET',
  '/backend/v1/leads/{id}/negotiations',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'sdr', 'corretor'].indexOf(role) < 0) {
      throw new ForbiddenError('Papel sem acesso a estes dados.')
    }
    const orgId = String(actor.get('organization_id') || '')
    let lead = null
    try {
      lead = $app.findRecordById('leads', e.request.pathValue('id'))
    } catch (_) {}
    if (!lead || lead.get('organization_id') !== orgId)
      throw new NotFoundError('Lead não encontrado.')
    if (role === 'corretor' && lead.getString('assigned_to') !== actor.id)
      throw new NotFoundError('Lead não encontrado.')
    const rows = $app.findRecordsByFilter('negotiations', 'lead_id = {:l}', '-created', 100, 0, {
      l: lead.id,
    })
    return e.json(200, {
      items: rows.map((n) => {
        let code = ''
        try {
          code = $app.findRecordById('properties', n.getString('property_id')).getString('code')
        } catch (_) {}
        return {
          id: n.id,
          status: n.getString('status'),
          purpose: n.getString('purpose'),
          agreed_value: Number(n.get('agreed_value') || 0),
          property_id: n.getString('property_id'),
          property_code: code,
          responsible_id: n.getString('responsible_id'),
          closed_at: n.getString('closed_at'),
          notes: n.getString('notes'),
          created: n.getString('created'),
        }
      }),
    })
  },
  $apis.requireAuth(),
)
