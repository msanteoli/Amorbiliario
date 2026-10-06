migrate(
  (app) => {
    const orgId = app.findCollectionByNameOrId('organizations').id
    const clientsId = app.findCollectionByNameOrId('clients').id
    const authOk =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || @request.auth.role = 'sdr' || @request.auth.role = 'corretor')"
    const sameOrg = ' && organization_id = @request.auth.organization_id'
    // leitura por id leve: o hook role_gate_view responde 403 e audita
    const readLight = "@request.auth.id != '' && organization_id = @request.auth.organization_id"
    const writeRole =
      "@request.auth.active = true && (@request.auth.role = 'admin' || @request.auth.role = 'corretor')"

    const properties = new Collection({
      name: 'properties',
      type: 'base',
      listRule: authOk + sameOrg,
      viewRule: readLight,
      // o corretor só cadastra em nome dele; o admin escolhe o captador
      createRule:
        writeRole +
        " && @request.body.organization_id = @request.auth.organization_id && (@request.auth.role = 'admin' || @request.body.captured_by = @request.auth.id)",
      // a regra de edição completa (com :isset) é atribuída logo abaixo, depois do save
      updateRule:
        writeRole +
        sameOrg +
        " && (@request.auth.role = 'admin' || captured_by = @request.auth.id)",
      deleteRule: null,
      fields: [
        {
          name: 'organization_id',
          type: 'relation',
          required: true,
          collectionId: orgId,
          maxSelect: 1,
        },
        { name: 'code', type: 'text', required: true, min: 1, max: 40 },
        { name: 'title', type: 'text', required: true, min: 2, max: 160 },
        {
          name: 'purpose',
          type: 'select',
          required: true,
          values: ['venda', 'locacao', 'ambos'],
          maxSelect: 1,
        },
        {
          name: 'property_type',
          type: 'select',
          required: true,
          values: ['casa', 'apartamento', 'terreno', 'comercial', 'galpao', 'chacara', 'outro'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['rascunho', 'disponivel', 'reservado', 'vendido', 'alugado', 'inativo'],
          maxSelect: 1,
        },
        { name: 'street', type: 'text', max: 120 },
        { name: 'street_number', type: 'text', max: 20 },
        { name: 'complement', type: 'text', max: 80 },
        { name: 'neighborhood', type: 'text', max: 80 },
        { name: 'city', type: 'text', max: 80 },
        { name: 'bedrooms', type: 'number', onlyInt: true, min: 0, max: 99 },
        { name: 'bathrooms', type: 'number', onlyInt: true, min: 0, max: 99 },
        { name: 'parking', type: 'number', onlyInt: true, min: 0, max: 99 },
        { name: 'area', type: 'number', min: 0, max: 1000000 },
        { name: 'sale_price', type: 'number', min: 0 },
        { name: 'rent_price', type: 'number', min: 0 },
        { name: 'price_on_request', type: 'bool' },
        { name: 'condo_fee', type: 'number', min: 0 },
        { name: 'iptu', type: 'number', min: 0 },
        { name: 'description', type: 'text', max: 3000 },
        { name: 'owner_id', type: 'relation', collectionId: clientsId, maxSelect: 1 },
        {
          name: 'captured_by',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'last_reviewed_at', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_properties_org_code ON properties (organization_id, code)',
        'CREATE INDEX idx_properties_org_status ON properties (organization_id, status)',
        'CREATE INDEX idx_properties_org_neighborhood ON properties (organization_id, neighborhood)',
        'CREATE INDEX idx_properties_org_reviewed ON properties (organization_id, last_reviewed_at)',
      ],
    })
    app.save(properties)

    // O validador do Skip não aceita :isset numa coleção recém-criada. Ninguém muda a
    // organização; o corretor também não muda o captador.
    const propertiesFinal = app.findCollectionByNameOrId('properties')
    propertiesFinal.updateRule =
      writeRole +
      sameOrg +
      " && @request.body.organization_id:isset = false && (@request.auth.role = 'admin' || (captured_by = @request.auth.id && @request.body.captured_by:isset = false))"
    app.save(propertiesFinal)

    const propertiesId = app.findCollectionByNameOrId('properties').id
    const photos = new Collection({
      name: 'property_photos',
      type: 'base',
      listRule: authOk + sameOrg,
      viewRule: readLight,
      // quem pode enviar foto de qual imóvel é conferido pelo hook property_photos_write_create
      createRule: writeRole + ' && @request.body.organization_id = @request.auth.organization_id',
      // a regra de edição completa (com :isset) é atribuída logo abaixo, depois do save
      updateRule:
        writeRole +
        sameOrg +
        " && (@request.auth.role = 'admin' || property_id.captured_by = @request.auth.id)",
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
          name: 'property_id',
          type: 'relation',
          required: true,
          collectionId: propertiesId,
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
        'CREATE INDEX idx_property_photos_property ON property_photos (property_id, is_active)',
      ],
    })
    app.save(photos)

    // Só o is_active muda depois do envio: imóvel, arquivo e organização ficam fixos.
    const photosFinal = app.findCollectionByNameOrId('property_photos')
    photosFinal.updateRule =
      writeRole +
      sameOrg +
      " && @request.body.organization_id:isset = false && @request.body.property_id:isset = false && @request.body.file:isset = false && (@request.auth.role = 'admin' || property_id.captured_by = @request.auth.id)"
    app.save(photosFinal)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('property_photos'))
    app.delete(app.findCollectionByNameOrId('properties'))
  },
)
