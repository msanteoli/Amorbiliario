// M12 — Portais (Chaves na Mão): onde anunciar, CEP e UF em properties; fotos só JPEG/WebP até 3 MB;
// coleção portal_feeds (código secreto do XML). Imóveis existentes recebem publish_to = ['site'].
migrate(
  (app) => {
    const orgId = app.findCollectionByNameOrId('organizations').id

    const props = app.findCollectionByNameOrId('properties')
    props.fields.add(
      new SelectField({
        name: 'publish_to',
        values: ['site', 'chaves_na_mao', 'zap', 'vivareal', 'olx'],
        maxSelect: 5,
      }),
    )
    props.fields.add(new TextField({ name: 'zip_code', max: 9, pattern: '^[0-9]{5}-?[0-9]{3}$' }))
    props.fields.add(new TextField({ name: 'state', max: 2, pattern: '^[A-Z]{2}$' }))
    app.save(props)
    // todos os imóveis existentes continuam na vitrine do site
    app
      .db()
      .newQuery(
        "UPDATE properties SET publish_to = '[\"site\"]' WHERE publish_to IS NULL OR publish_to = '' OR publish_to = '[]'",
      )
      .execute()

    const photos = app.findCollectionByNameOrId('property_photos')
    const file = photos.fields.getByName('file')
    file.mimeTypes = ['image/jpeg', 'image/webp']
    file.maxSize = 3145728
    app.save(photos)

    app.save(
      new Collection({
        name: 'portal_feeds',
        type: 'base',
        listRule: null,
        viewRule: null,
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
          {
            name: 'portal',
            type: 'select',
            required: true,
            values: ['chaves_na_mao'],
            maxSelect: 1,
          },
          { name: 'token', type: 'text', required: true, min: 32, max: 64 },
          { name: 'active', type: 'bool' },
          { name: 'last_fetched_at', type: 'date' },
          { name: 'last_count', type: 'number', onlyInt: true, min: 0 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_portal_feeds_token ON portal_feeds (token)',
          'CREATE UNIQUE INDEX idx_portal_feeds_org_portal ON portal_feeds (organization_id, portal)',
        ],
      }),
    )
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('portal_feeds'))
    const props = app.findCollectionByNameOrId('properties')
    ;['publish_to', 'zip_code', 'state'].forEach((n) => props.fields.removeByName(n))
    app.save(props)
    const photos = app.findCollectionByNameOrId('property_photos')
    const file = photos.fields.getByName('file')
    file.mimeTypes = ['image/jpeg', 'image/png', 'image/webp']
    file.maxSize = 8388608
    app.save(photos)
  },
)
