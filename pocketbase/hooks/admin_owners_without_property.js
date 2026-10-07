// Lista os clientes do tipo proprietário que não têm nenhum imóvel vinculado. Só o admin.
// Serve para limpeza: a regra do sistema é que todo proprietário tem pelo menos um imóvel.
routerAdd(
  'GET',
  '/backend/v1/admin/owners-without-property',
  (e) => {
    const actor = e.auth
    if (actor.get('active') !== true || String(actor.get('role') || '') !== 'admin') {
      throw new ForbiddenError('Só o admin vê esta lista.')
    }
    const orgId = String(actor.get('organization_id') || '')
    const owners = $app.findRecordsByFilter(
      'clients',
      "organization_id = {:o} && kind ~ 'proprietario'",
      'name',
      2000,
      0,
      { o: orgId },
    )
    const items = []
    owners.forEach((c) => {
      const has = $app.findRecordsByFilter(
        'properties',
        'organization_id = {:o} && owner_id = {:c}',
        '',
        1,
        0,
        {
          o: orgId,
          c: c.id,
        },
      )
      if (!has.length) items.push({ id: c.id, name: c.getString('name') })
    })
    return e.json(200, { items: items })
  },
  $apis.requireAuth(),
)
