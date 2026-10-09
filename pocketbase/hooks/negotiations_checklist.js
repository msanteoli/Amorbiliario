// Pessoas e documentos da negociação, com o que falta. Admin, SDR e o corretor responsável.
routerAdd(
  'GET',
  '/backend/v1/negotiations/{id}/checklist',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'sdr', 'corretor'].indexOf(role) < 0) {
      throw new ForbiddenError('Papel sem acesso a estes dados.')
    }
    const orgId = String(actor.get('organization_id') || '')
    let neg = null
    try {
      neg = $app.findRecordById('negotiations', e.request.pathValue('id'))
    } catch (_) {}
    if (!neg || neg.get('organization_id') !== orgId)
      throw new NotFoundError('Negociação não encontrada.')
    if (role === 'corretor' && neg.getString('responsible_id') !== actor.id)
      throw new NotFoundError('Negociação não encontrada.')

    const people = $app.findRecordsByFilter(
      'negotiation_people',
      'negotiation_id = {:n} && active = true',
      'created',
      100,
      0,
      { n: neg.id },
    )
    const docs = $app.findRecordsByFilter(
      'negotiation_documents',
      'negotiation_id = {:n} && active = true',
      'created',
      500,
      0,
      { n: neg.id },
    )
    const names = {}
    people.forEach((p) => {
      let nm = ''
      try {
        nm = $app.findRecordById('clients', p.getString('client_id')).getString('name')
      } catch (_) {}
      names[p.id] = nm
    })
    let missing = 0
    let received = 0
    let checked = 0
    docs.forEach((d) => {
      const s = d.getString('state')
      if (s === 'pendente') missing++
      else received++
      if (s === 'conferido') checked++
    })
    return e.json(200, {
      negotiation: {
        id: neg.id,
        status: neg.getString('status'),
        purpose: neg.getString('purpose'),
      },
      people: people.map((p) => ({
        id: p.id,
        client_id: p.getString('client_id'),
        name: names[p.id] || '',
        role: p.getString('role'),
      })),
      documents: docs.map((d) => ({
        id: d.id,
        person_id: d.getString('person_id'),
        doc_type: d.getString('doc_type'),
        state: d.getString('state'),
        files: d.getStringSlice('file'),
        checked_at: d.getString('checked_at'),
      })),
      total: docs.length,
      received: received,
      checked: checked,
      missing: missing,
    })
  },
  $apis.requireAuth(),
)
