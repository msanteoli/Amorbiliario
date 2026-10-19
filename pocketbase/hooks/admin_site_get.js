// Ajustes do site, Fase 1 (spec docs/superpowers/specs/2026-10-19-ajustes-do-site-design.md). Só admin. Atenção (goja): nada de função no topo do arquivo.
// Lê o RASCUNHO do site e a quantidade de publicações.
routerAdd(
  'GET',
  '/backend/v1/admin/site',
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
    // rascunho -> objeto do site (mesma forma do snapshot publicado)
    const toSnap = (r) => {
      const o = {}
      ;[
        'about_title',
        'about_text',
        'address',
        'hours',
        'phone',
        'email',
        'instagram',
        'whatsapp',
        'primary_color',
      ].forEach((k) => {
        o[k] = r ? r.getString(k) : ''
      })
      let links = []
      if (r) {
        try {
          const raw = r.getString('links')
          links = raw ? JSON.parse(raw) : []
        } catch (_) {
          links = []
        }
      }
      o.links = Array.isArray(links) ? links : []
      const url = (assetId) => {
        if (!assetId) return ''
        try {
          const a = $app.findRecordById('site_assets', assetId)
          return '/api/files/site_assets/' + a.id + '/' + a.getString('file')
        } catch (_) {
          return ''
        }
      }
      o.logo_url = r ? url(r.getString('logo_asset_id')) : ''
      o.favicon_url = r ? url(r.getString('favicon_asset_id')) : ''
      return o
    }
    const loadDraft = () => {
      const rows = $app.findRecordsByFilter('site_settings', 'organization_id = {:o}', '', 1, 0, {
        o: orgId,
      })
      return rows.length ? rows[0] : null
    }
    const r = loadDraft()
    const settings = toSnap(r)
    settings.logo_asset_id = r ? r.getString('logo_asset_id') : ''
    settings.favicon_asset_id = r ? r.getString('favicon_asset_id') : ''
    const pubs = $app.findRecordsByFilter(
      'site_publications',
      'organization_id = {:o}',
      '-version',
      1,
      0,
      { o: orgId },
    )
    const ativa = $app.findRecordsByFilter(
      'site_publications',
      "organization_id = {:o} && status = 'ativa'",
      '',
      1,
      0,
      { o: orgId },
    )
    return e.json(200, {
      settings: settings,
      publicacoes: pubs.length ? pubs[0].getInt('version') : 0,
      versao_ativa: ativa.length ? ativa[0].getInt('version') : 0,
    })
  },
  $apis.requireAuth(),
)
