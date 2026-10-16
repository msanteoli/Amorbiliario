// Desliga o acesso MCP (todas as chaves param de valer) da organização. Só o admin. Auditoria 'mcp_desligado'.
routerAdd(
  'POST',
  '/backend/v1/admin/mcp/disable',
  (e) => {
    const actor = e.auth
    if (actor.get('active') !== true || String(actor.get('role') || '') !== 'admin') {
      throw new ForbiddenError('Só o admin acessa a Administração.')
    }
    const orgId = String(actor.get('organization_id') || '')
    $app
      .db()
      .newQuery('UPDATE organizations SET mcp_enabled = false WHERE id = {:id}')
      .bind({ id: orgId })
      .execute()
    try {
      const audit = new Record($app.findCollectionByNameOrId('audit_log'))
      audit.set('organization_id', orgId)
      audit.set('actor_id', actor.id)
      audit.set('actor_role', 'admin')
      audit.set('action', 'mcp_desligado')
      audit.set('collection_name', 'organizations')
      audit.set('record_id', orgId)
      audit.set('occurred_at', new Date().toISOString())
      $app.save(audit)
    } catch (err) {
      $app.logger().error('mcp_enable_audit_failed', 'err', String((err && err.message) || err))
    }
    return e.json(200, { enabled: false })
  },
  $apis.requireAuth(),
)
