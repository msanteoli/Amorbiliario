// Ajustes do site, Fase 1 (spec docs/superpowers/specs/2026-10-19-ajustes-do-site-design.md): quatro coleções novas.
//   site_assets          cada imagem enviada (logo, favicon, banner, galeria); NUNCA substituída nem apagada, para que desfazer
//                        uma publicação não quebre as imagens do snapshot anterior. JPEG ou WebP, até 3 MB; arquivo público.
//   site_settings        o RASCUNHO (um por organização): textos fixos, links, cor da ação principal, logo e favicon.
//   site_publications    cada publicação: snapshot (JSON), versão e situação (ativa, substituida, desfeita); só UMA ativa por organização.
//   site_preview_tokens  tokens de prévia (guardados só como hash), válidos por 30 minutos.
// Todas só do admin da própria organização para leitura; ESCRITA FECHADA nas coleções (só os endpoints /backend/v1/admin/site...).
migrate(
  (app) => {
    const orgId = app.findCollectionByNameOrId('organizations').id
    const admin =
      "@request.auth.id != '' && @request.auth.role = 'admin' && @request.auth.active = true && organization_id = @request.auth.organization_id"
    const org = {
      name: 'organization_id',
      type: 'relation',
      required: true,
      collectionId: orgId,
      maxSelect: 1,
    }
    const created = [
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ]

    const assets = new Collection({
      type: 'base',
      name: 'site_assets',
      listRule: admin,
      viewRule: admin,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        org,
        {
          name: 'kind',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['logo', 'favicon', 'banner_desktop', 'banner_mobile', 'galeria'],
        },
        {
          name: 'file',
          type: 'file',
          required: true,
          maxSelect: 1,
          maxSize: 3145728,
          mimeTypes: ['image/jpeg', 'image/webp'],
          protected: false,
        },
        { name: 'uploaded_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
      ].concat(created),
      indexes: ['CREATE INDEX idx_site_assets_org_kind ON site_assets (organization_id, kind)'],
    })
    app.save(assets)

    const settings = new Collection({
      type: 'base',
      name: 'site_settings',
      listRule: admin,
      viewRule: admin,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        org,
        { name: 'about_title', type: 'text', max: 160 },
        { name: 'about_text', type: 'text', max: 2000 },
        { name: 'address', type: 'text', max: 200 },
        { name: 'hours', type: 'text', max: 200 },
        { name: 'phone', type: 'text', max: 30 },
        { name: 'email', type: 'email' },
        { name: 'instagram', type: 'text', max: 200 },
        { name: 'whatsapp', type: 'text', max: 200 },
        { name: 'links', type: 'json', maxSize: 8000 },
        { name: 'primary_color', type: 'text', max: 7, pattern: '^#[0-9a-fA-F]{6}$' },
        { name: 'logo_asset_id', type: 'relation', collectionId: assets.id, maxSelect: 1 },
        { name: 'favicon_asset_id', type: 'relation', collectionId: assets.id, maxSelect: 1 },
        { name: 'updated_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
      ].concat(created),
      indexes: ['CREATE UNIQUE INDEX idx_site_settings_org ON site_settings (organization_id)'],
    })
    app.save(settings)

    const pubs = new Collection({
      type: 'base',
      name: 'site_publications',
      listRule: admin,
      viewRule: admin,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        org,
        { name: 'version', type: 'number', required: true, onlyInt: true, min: 1 },
        { name: 'snapshot', type: 'json', required: true, maxSize: 200000 },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['ativa', 'substituida', 'desfeita'],
        },
        { name: 'published_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'published_at', type: 'date' },
      ].concat(created),
      indexes: [
        'CREATE UNIQUE INDEX idx_site_pub_version ON site_publications (organization_id, version)',
        "CREATE UNIQUE INDEX idx_site_pub_active ON site_publications (organization_id) WHERE status = 'ativa'",
      ],
    })
    app.save(pubs)

    const tokens = new Collection({
      type: 'base',
      name: 'site_preview_tokens',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        org,
        { name: 'token_hash', type: 'text', required: true, max: 128, hidden: true },
        { name: 'expires_at', type: 'date', required: true },
        { name: 'created_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
      ].concat(created),
      indexes: ['CREATE UNIQUE INDEX idx_site_preview_hash ON site_preview_tokens (token_hash)'],
    })
    app.save(tokens)
  },
  (app) => {
    ;['site_preview_tokens', 'site_publications', 'site_settings', 'site_assets'].forEach((n) => {
      app.delete(app.findCollectionByNameOrId(n))
    })
  },
)
