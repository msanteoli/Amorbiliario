// Ajustes do site, Fase 1 (spec docs/superpowers/specs/2026-10-19-ajustes-do-site-design.md). Só admin. Atenção (goja): nada de função no topo do arquivo.
// Gera um token de prévia (vale 30 minutos; guardado só como hash). Com ele, GET /public/site?preview=TOKEN mostra o rascunho.
routerAdd(
  'POST',
  '/backend/v1/admin/site/preview',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    const orgId = String(actor.get('organization_id') || '')
    if (actor.get('active') !== true || role !== 'admin') {
      try {
        const a = new Record($app.findCollectionByNameOrId('audit_log'))
        a.set('organization_id', orgId)
        a.set('actor_id', actor.id)
        a.set('actor_role', role)
        a.set('action', 'acesso_negado')
        a.set('collection_name', 'site_settings')
        a.set('record_id', orgId)
        a.set('reason', 'so_admin_ajusta_o_site')
        a.set('occurred_at', new Date().toISOString())
        $app.save(a)
      } catch (err) {
        $app.logger().error('site_audit_failed', 'err', String((err && err.message) || err))
      }
      throw new ForbiddenError('Só o admin ajusta o site.')
    }
    const token =
      'prev_' +
      $security.randomStringWithAlphabet(
        40,
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      )
    const expires = new Date(Date.now() + 30 * 60000).toISOString().replace('T', ' ')
    const rec = new Record($app.findCollectionByNameOrId('site_preview_tokens'))
    rec.set('organization_id', orgId)
    rec.set('token_hash', $security.sha256(token))
    rec.set('expires_at', expires)
    rec.set('created_by', actor.id)
    $app.save(rec)
    return e.json(200, { token: token, expires_at: expires })
  },
  $apis.requireAuth(),
)
