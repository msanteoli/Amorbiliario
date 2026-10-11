// Troca o código secreto do XML da Chaves na Mão. O endereço antigo deixa de valer na hora.
// Só o admin. Auditoria 'portal_token_trocado' (sem o token).
routerAdd(
  'POST',
  '/backend/v1/admin/portals/chaves-na-mao/rotate',
  (e) => {
    const actor = e.auth
    if (actor.get('active') !== true || String(actor.get('role') || '') !== 'admin') {
      throw new ForbiddenError('Só o admin acessa a Administração.')
    }
    const orgId = String(actor.get('organization_id') || '')

    const rows = $app.findRecordsByFilter(
      'portal_feeds',
      "organization_id = {:o} && portal = 'chaves_na_mao'",
      '',
      1,
      0,
      { o: orgId },
    )
    let feed = rows.length ? rows[0] : null
    if (!feed) {
      feed = new Record($app.findCollectionByNameOrId('portal_feeds'))
      feed.set('organization_id', orgId)
      feed.set('portal', 'chaves_na_mao')
      feed.set('active', true)
      feed.set('last_count', 0)
    }
    const token = $security.randomStringWithAlphabet(32, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
    feed.set('token', token)
    $app.save(feed)

    try {
      const audit = new Record($app.findCollectionByNameOrId('audit_log'))
      audit.set('organization_id', orgId)
      audit.set('actor_id', actor.id)
      audit.set('actor_role', 'admin')
      audit.set('action', 'portal_token_trocado')
      audit.set('collection_name', 'portal_feeds')
      audit.set('record_id', feed.id)
      audit.set('field_name', 'token')
      audit.set('occurred_at', new Date().toISOString())
      $app.save(audit)
    } catch (err) {
      $app.logger().error('portal_rotate_audit_failed', 'err', String((err && err.message) || err))
    }

    const proto = String(e.request.header.get('X-Forwarded-Proto') || 'https').split(',')[0].trim() || 'https'
    const base = proto + '://' + String(e.request.host || '')
    return e.json(200, { feed_url: base + '/backend/v1/public/feeds/' + token + '/chavesnamao.xml' })
  },
  $apis.requireAuth(),
)
