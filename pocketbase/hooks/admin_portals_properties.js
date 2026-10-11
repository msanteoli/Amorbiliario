// Liga ou desliga 'chaves_na_mao' em publish_to de vários imóveis de uma vez (até 200). Só o admin.
// Mantém os demais valores (inclusive 'site'). Ignora ids inexistentes ou de outra organização.
// Não exige que o imóvel seja elegível (a lista de pendências cuida disso).
routerAdd(
  'POST',
  '/backend/v1/admin/portals/chaves-na-mao/properties',
  (e) => {
    const actor = e.auth
    if (actor.get('active') !== true || String(actor.get('role') || '') !== 'admin') {
      throw new ForbiddenError('Só o admin acessa a Administração.')
    }
    const orgId = String(actor.get('organization_id') || '')
    const body = e.requestInfo().body || {}
    const ids = body.property_ids
    if (!Array.isArray(ids) || ids.length < 1) throw new BadRequestError('Informe ao menos um imóvel.')
    if (ids.length > 200) throw new BadRequestError('No máximo 200 imóveis por vez.')
    if (body.enabled !== true && body.enabled !== false) throw new BadRequestError('Informe se deve ligar ou desligar.')
    const enabled = body.enabled === true

    let changed = 0
    let ignored = 0
    const seen = {}
    for (let i = 0; i < ids.length; i++) {
      const id = typeof ids[i] === 'string' ? ids[i] : ''
      if (!id || seen[id]) {
        ignored++
        continue
      }
      seen[id] = true
      let rec = null
      try {
        rec = $app.findRecordById('properties', id)
      } catch (_) {
        rec = null
      }
      if (!rec || rec.getString('organization_id') !== orgId) {
        ignored++
        continue
      }
      const cur = rec.getStringSlice('publish_to')
      const has = cur.indexOf('chaves_na_mao') >= 0
      if (has === enabled) continue
      const next = enabled ? cur.concat(['chaves_na_mao']) : cur.filter((v) => v !== 'chaves_na_mao')
      $app.runInTransaction((tx) => {
        rec.set('publish_to', next)
        tx.save(rec)
      })
      changed++
    }

    try {
      const audit = new Record($app.findCollectionByNameOrId('audit_log'))
      audit.set('organization_id', orgId)
      audit.set('actor_id', actor.id)
      audit.set('actor_role', 'admin')
      audit.set('action', 'portal_lote')
      audit.set('collection_name', 'properties')
      audit.set('field_name', 'publish_to')
      audit.set('reason', (enabled ? 'on' : 'off') + ':' + changed)
      audit.set('occurred_at', new Date().toISOString())
      $app.save(audit)
    } catch (err) {
      $app.logger().error('portal_lote_audit_failed', 'err', String((err && err.message) || err))
    }
    return e.json(200, { changed: changed, ignored: ignored })
  },
  $apis.requireAuth(),
)
