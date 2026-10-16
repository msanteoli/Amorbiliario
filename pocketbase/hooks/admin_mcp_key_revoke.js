// Revoga uma chave MCP (ela deixa de autenticar na hora). Só o admin da mesma organização.
// Auditoria 'mcp_chave_revogada'.
routerAdd(
  'POST',
  '/backend/v1/admin/mcp/keys/{id}/revoke',
  (e) => {
    const actor = e.auth
    if (actor.get('active') !== true || String(actor.get('role') || '') !== 'admin') {
      throw new ForbiddenError('Só o admin acessa a Administração.')
    }
    const orgId = String(actor.get('organization_id') || '')
    let rec = null
    try {
      rec = $app.findRecordById('mcp_keys', e.request.pathValue('id'))
    } catch (_) {}
    if (!rec || rec.getString('organization_id') !== orgId)
      throw new NotFoundError('Chave não encontrada.')
    rec.set('active', false)
    rec.set('revoked_at', new Date().toISOString())
    $app.save(rec)
    try {
      const audit = new Record($app.findCollectionByNameOrId('audit_log'))
      audit.set('organization_id', orgId)
      audit.set('actor_id', actor.id)
      audit.set('actor_role', 'admin')
      audit.set('action', 'mcp_chave_revogada')
      audit.set('collection_name', 'mcp_keys')
      audit.set('record_id', rec.id)
      audit.set('occurred_at', new Date().toISOString())
      $app.save(audit)
    } catch (err) {
      $app.logger().error('mcp_revoke_audit_failed', 'err', String((err && err.message) || err))
    }
    return e.json(200, { id: rec.id, active: false })
  },
  $apis.requireAuth(),
)
