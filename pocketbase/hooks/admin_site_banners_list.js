// Site tecnológico, Parte A (spec docs/superpowers/specs/2026-11-15-site-tecnologico-design.md). Só admin. Atenção (goja): nada de função no topo do arquivo.
// Lista os banners do RASCUNHO (ativos e inativos), na ordem de position.
routerAdd(
  'GET',
  '/backend/v1/admin/site/banners',
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
        a.set('collection_name', 'site_banners')
        a.set('record_id', orgId)
        a.set('reason', 'so_admin_ajusta_o_site')
        a.set('occurred_at', new Date().toISOString())
        $app.save(a)
      } catch (err) {
        $app.logger().error('site_audit_failed', 'err', String((err && err.message) || err))
      }
      throw new ForbiddenError('Só o admin ajusta o site.')
    }
    // banner -> forma do admin (com as URLs das imagens já resolvidas)
    const url = (assetId) => {
      if (!assetId) return ''
      try {
        const a = $app.findRecordById('site_assets', assetId)
        return '/api/files/site_assets/' + a.id + '/' + a.getString('file')
      } catch (_) {
        return ''
      }
    }
    const ser = (r) => ({
      id: r.id,
      title: r.getString('title'),
      subtitle: r.getString('subtitle'),
      button_text: r.getString('button_text'),
      tipo: r.getString('tipo'),
      destino_url: r.getString('destino_url'),
      imovel_codigo: r.getString('imovel_codigo'),
      desktop_asset_id: r.getString('desktop_asset_id'),
      mobile_asset_id: r.getString('mobile_asset_id'),
      night_desktop_asset_id: r.getString('night_desktop_asset_id'),
      night_mobile_asset_id: r.getString('night_mobile_asset_id'),
      start_at: r.getString('start_at'),
      end_at: r.getString('end_at'),
      position: r.getInt('position'),
      active: r.getBool('active'),
      desktop_url: url(r.getString('desktop_asset_id')),
      mobile_url: url(r.getString('mobile_asset_id')),
      night_desktop_url: url(r.getString('night_desktop_asset_id')),
      night_mobile_url: url(r.getString('night_mobile_asset_id')),
    })
    const rows = $app.findRecordsByFilter(
      'site_banners',
      'organization_id = {:o}',
      'position,created',
      200,
      0,
      { o: orgId },
    )
    return e.json(200, { items: rows.map(ser) })
  },
  $apis.requireAuth(),
)
