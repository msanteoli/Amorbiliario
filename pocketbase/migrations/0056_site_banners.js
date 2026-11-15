// Site tecnológico, Parte A (spec docs/superpowers/specs/2026-11-15-site-tecnologico-design.md): banners da capa.
//   site_banners  cada banner do RASCUNHO; os ativos entram no snapshot de site_publications ao Publicar.
// Leitura só do admin da própria organização; ESCRITA FECHADA (só os endpoints /backend/v1/admin/site/banners...).
// Nada é apagado: o banner é desativado. Imagens são relações com site_assets (banner_desktop e banner_mobile).
migrate(
  (app) => {
    const orgId = app.findCollectionByNameOrId('organizations').id
    const assetsId = app.findCollectionByNameOrId('site_assets').id
    const admin =
      "@request.auth.id != '' && @request.auth.role = 'admin' && @request.auth.active = true && organization_id = @request.auth.organization_id"
    const banners = new Collection({
      type: 'base',
      name: 'site_banners',
      listRule: admin,
      viewRule: admin,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'organization_id',
          type: 'relation',
          required: true,
          collectionId: orgId,
          maxSelect: 1,
        },
        { name: 'title', type: 'text', max: 80 },
        { name: 'subtitle', type: 'text', max: 120 },
        { name: 'button_text', type: 'text', max: 30 },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['campanha', 'lancamento', 'super_destaque'],
        },
        { name: 'destino_url', type: 'text', max: 300 },
        { name: 'imovel_codigo', type: 'text', max: 20 },
        {
          name: 'desktop_asset_id',
          type: 'relation',
          required: true,
          collectionId: assetsId,
          maxSelect: 1,
        },
        { name: 'mobile_asset_id', type: 'relation', collectionId: assetsId, maxSelect: 1 },
        { name: 'night_desktop_asset_id', type: 'relation', collectionId: assetsId, maxSelect: 1 },
        { name: 'night_mobile_asset_id', type: 'relation', collectionId: assetsId, maxSelect: 1 },
        { name: 'start_at', type: 'date' },
        { name: 'end_at', type: 'date' },
        { name: 'position', type: 'number', onlyInt: true, min: 0 },
        { name: 'active', type: 'bool' },
        { name: 'updated_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_site_banners_org ON site_banners (organization_id, active, position)',
      ],
    })
    app.save(banners)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('site_banners'))
  },
)
