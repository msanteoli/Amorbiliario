// Lista os lotes de importação da organização (mais novos primeiro). Só o admin.
routerAdd(
  'GET',
  '/backend/v1/admin/imports',
  (e) => {
    const actor = e.auth
    if (actor.get('active') !== true || String(actor.get('role') || '') !== 'admin') {
      throw new ForbiddenError('Só o admin vê as importações.')
    }
    const rows = $app.findRecordsByFilter(
      'import_batches',
      'organization_id = {:o}',
      '-created',
      100,
      0,
      { o: String(actor.get('organization_id') || '') },
    )
    return e.json(200, {
      items: rows.map((b) => ({
        id: b.id,
        kind: b.getString('kind'),
        filename: b.getString('filename'),
        state: b.getString('state'),
        counts: {
          aceito: Number(b.get('counts_accepted') || 0),
          pendente: Number(b.get('counts_pending') || 0),
          recusado: Number(b.get('counts_rejected') || 0),
        },
        created: b.getString('created'),
      })),
    })
  },
  $apis.requireAuth(),
)
