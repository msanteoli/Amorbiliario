// Lista os usuários da organização para a Administração, com o e-mail (que o PocketBase só
// mostra para a própria pessoa). Só o admin.
routerAdd(
  'GET',
  '/backend/v1/admin/users',
  (e) => {
    const actor = e.auth
    if (actor.get('active') !== true || String(actor.get('role') || '') !== 'admin') {
      throw new ForbiddenError('Só o admin acessa a Administração.')
    }
    const rows = $app.findRecordsByFilter('users', 'organization_id = {:o}', 'name', 500, 0, {
      o: String(actor.get('organization_id') || ''),
    })
    return e.json(200, {
      items: rows.map((u) => ({
        id: u.id,
        name: u.getString('name'),
        email: u.getString('email'),
        role: u.getString('role'),
        active: u.get('active') === true,
      })),
    })
  },
  $apis.requireAuth(),
)
