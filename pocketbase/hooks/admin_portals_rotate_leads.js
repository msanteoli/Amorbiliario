// Troca o código secreto dos contatos da Chaves na Mão. O endereço antigo deixa de valer na hora.
// Só o admin. Mexe só em leads_token. Auditoria 'portal_leads_token_trocado' (sem o valor).
routerAdd(
  'POST',
  '/backend/v1/admin/portals/chaves-na-mao/rotate-leads',
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
    if (!rows.length) throw new NotFoundError('Abra a tela Portais antes de trocar o código.')
    const feed = rows[0]
    const token = $security.randomStringWithAlphabet(
      32,
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    )
    feed.set('leads_token', token)
    $app.save(feed)

    try {
      const audit = new Record($app.findCollectionByNameOrId('audit_log'))
      audit.set('organization_id', orgId)
      audit.set('actor_id', actor.id)
      audit.set('actor_role', 'admin')
      audit.set('action', 'portal_leads_token_trocado')
      audit.set('collection_name', 'portal_feeds')
      audit.set('record_id', feed.id)
      audit.set('field_name', 'leads_token')
      audit.set('occurred_at', new Date().toISOString())
      $app.save(audit)
    } catch (err) {
      $app
        .logger()
        .error('portal_leads_rotate_audit_failed', 'err', String((err && err.message) || err))
    }

    const proto =
      String(e.request.header.get('X-Forwarded-Proto') || 'https')
        .split(',')[0]
        .trim() || 'https'
    const base = proto + '://' + String(e.request.host || '')
    return e.json(200, { leads_url: base + '/backend/v1/public/portal-leads/' + token })
  },
  $apis.requireAuth(),
)
