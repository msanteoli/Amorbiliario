// Estado do MCP da organização e lista de chaves (sem o hash e sem a chave em texto). Só o admin.
routerAdd(
  'GET',
  '/backend/v1/admin/mcp',
  (e) => {
    const actor = e.auth
    if (actor.get('active') !== true || String(actor.get('role') || '') !== 'admin') {
      throw new ForbiddenError('Só o admin acessa a Administração.')
    }
    const orgId = String(actor.get('organization_id') || '')
    const org = $app.findRecordById('organizations', orgId)
    const keys = $app.findRecordsByFilter(
      'mcp_keys',
      'organization_id = {:o}',
      '-created',
      200,
      0,
      { o: orgId },
    )
    return e.json(200, {
      enabled: org.get('mcp_enabled') === true,
      keys: keys.map((k) => ({
        id: k.id,
        name: k.getString('name'),
        user_id: k.getString('user_id'),
        token_prefix: k.getString('token_prefix'),
        scope: k.getString('scope'),
        active: k.get('active') === true,
        revoked_at: k.getString('revoked_at'),
        last_used_at: k.getString('last_used_at'),
        created: k.getString('created'),
      })),
    })
  },
  $apis.requireAuth(),
)
