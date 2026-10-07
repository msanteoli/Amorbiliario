migrate(
  (app) => {
    const orgId = app.findCollectionByNameOrId('organizations').id
    const authOk =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || @request.auth.role = 'sdr' || @request.auth.role = 'corretor')"
    const sameOrg = ' && organization_id = @request.auth.organization_id'
    const readLight = "@request.auth.id != '' && organization_id = @request.auth.organization_id"
    const writeRole =
      "@request.auth.active = true && (@request.auth.role = 'admin' || @request.auth.role = 'corretor')"
    const adminOnly =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin'"

    // 1) condomínios
    const condos = new Collection({
      name: 'condominiums',
      type: 'base',
      listRule: authOk + sameOrg,
      viewRule: readLight,
      createRule: writeRole + ' && @request.body.organization_id = @request.auth.organization_id',
      updateRule: writeRole + sameOrg,
      deleteRule: null,
      fields: [
        {
          name: 'organization_id',
          type: 'relation',
          required: true,
          collectionId: orgId,
          maxSelect: 1,
        },
        { name: 'name', type: 'text', required: true, min: 2, max: 120 },
        { name: 'name_key', type: 'text', max: 140 },
        { name: 'street', type: 'text', max: 160 },
        { name: 'neighborhood', type: 'text', max: 80 },
        { name: 'city', type: 'text', max: 80 },
        { name: 'amenities', type: 'text', max: 2000 },
        { name: 'rules', type: 'text', max: 2000 },
        { name: 'is_active', type: 'bool' },
        { name: 'created_batch_id', type: 'text', max: 40 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_condominiums_org_key ON condominiums (organization_id, name_key)',
        'CREATE INDEX idx_condominiums_org_name ON condominiums (organization_id, name)',
      ],
    })
    app.save(condos)

    // a organização e a origem do cadastro não mudam depois de criadas
    const condosFinal = app.findCollectionByNameOrId('condominiums')
    condosFinal.updateRule =
      writeRole +
      sameOrg +
      ' && @request.body.organization_id:isset = false && @request.body.created_batch_id:isset = false'
    app.save(condosFinal)

    const condoId = app.findCollectionByNameOrId('condominiums').id
    const condoPhotos = new Collection({
      name: 'condominium_photos',
      type: 'base',
      listRule: authOk + sameOrg,
      viewRule: readLight,
      createRule: writeRole + ' && @request.body.organization_id = @request.auth.organization_id',
      updateRule: writeRole + sameOrg,
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
          name: 'condominium_id',
          type: 'relation',
          required: true,
          collectionId: condoId,
          maxSelect: 1,
        },
        {
          name: 'file',
          type: 'file',
          required: true,
          maxSelect: 1,
          maxSize: 8388608,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        },
        { name: 'is_active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_condo_photos_condo ON condominium_photos (condominium_id, is_active)',
      ],
    })
    app.save(condoPhotos)
    const condoPhotosFinal = app.findCollectionByNameOrId('condominium_photos')
    condoPhotosFinal.updateRule =
      writeRole +
      sameOrg +
      ' && @request.body.organization_id:isset = false && @request.body.condominium_id:isset = false && @request.body.file:isset = false'
    app.save(condoPhotosFinal)

    // 2) lotes de importação (só o admin lê; só os endpoints escrevem)
    const batches = new Collection({
      name: 'import_batches',
      type: 'base',
      listRule: adminOnly + sameOrg,
      viewRule: adminOnly + sameOrg,
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
          name: 'kind',
          type: 'select',
          required: true,
          values: ['imoveis', 'condominios'],
          maxSelect: 1,
        },
        { name: 'filename', type: 'text', max: 200 },
        {
          name: 'created_by',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        {
          name: 'state',
          type: 'select',
          required: true,
          values: ['aplicada', 'desfeita'],
          maxSelect: 1,
        },
        { name: 'counts_accepted', type: 'number', onlyInt: true, min: 0 },
        { name: 'counts_pending', type: 'number', onlyInt: true, min: 0 },
        { name: 'counts_rejected', type: 'number', onlyInt: true, min: 0 },
        { name: 'report', type: 'json', maxSize: 2000000 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_import_batches_org ON import_batches (organization_id, created)'],
    })
    app.save(batches)

    // 3) campos novos de properties e título opcional
    const props = app.findCollectionByNameOrId('properties')
    props.fields.add(
      new SelectField({
        name: 'use_type',
        values: ['residencial', 'comercial', 'rural', 'temporada'],
        maxSelect: 1,
      }),
    )
    props.fields.add(new BoolField({ name: 'in_condominium' }))
    props.fields.add(
      new RelationField({ name: 'condominium_id', collectionId: condoId, maxSelect: 1 }),
    )
    props.fields.add(
      new SelectField({ name: 'source', values: ['manual', 'importacao'], maxSelect: 1 }),
    )
    props.fields.add(new TextField({ name: 'import_batch_id', max: 40 }))
    const title = props.fields.getByName('title')
    title.required = false
    title.min = 0
    app.save(props)

    // quem escreve nestes campos é o hook; a regra de edição não muda
    app.findCollectionByNameOrId('properties')
  },
  (app) => {
    const props = app.findCollectionByNameOrId('properties')
    ;['use_type', 'in_condominium', 'condominium_id', 'source', 'import_batch_id'].forEach((n) => {
      props.fields.removeByName(n)
    })
    app.save(props)
    app.delete(app.findCollectionByNameOrId('import_batches'))
    app.delete(app.findCollectionByNameOrId('condominium_photos'))
    app.delete(app.findCollectionByNameOrId('condominiums'))
  },
)
