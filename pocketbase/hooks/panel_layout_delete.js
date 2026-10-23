// Painel personalizável (spec 2026-10-23): "Voltar ao padrão". Apaga o arranjo da pessoa logada (só o dela); sem arranjo, responde 200 do mesmo jeito.
routerAdd(
  'DELETE',
  '/backend/v1/panel/layout',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    const orgId = String(actor.get('organization_id') || '')
    if (actor.get('active') !== true || ['admin', 'sdr', 'corretor'].indexOf(role) < 0) {
      throw new ForbiddenError('Papel sem acesso a estes dados.')
    }
    let rec = null
    try {
      rec = $app.findFirstRecordByData('panel_layouts', 'user_id', actor.id)
    } catch (_) {}
    if (rec) {
      const id = rec.id
      $app.delete(rec)
      try {
        const a = new Record($app.findCollectionByNameOrId('audit_log'))
        a.set('organization_id', orgId)
        a.set('actor_id', actor.id)
        a.set('actor_role', role)
        a.set('action', 'painel_personalizado')
        a.set('collection_name', 'panel_layouts')
        a.set('record_id', id)
        a.set('reason', 'padrao')
        a.set('occurred_at', new Date().toISOString())
        $app.save(a)
      } catch (err) {
        $app.logger().error('painel_audit_failed', 'err', String((err && err.message) || err))
      }
    }
    return e.json(200, { ok: true })
  },
  $apis.requireAuth(),
)
