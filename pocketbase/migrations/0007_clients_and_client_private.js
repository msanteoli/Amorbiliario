migrate(
  (app) => {
    const orgId = app.findCollectionByNameOrId('organizations').id
    const authOk =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || @request.auth.role = 'sdr' || @request.auth.role = 'corretor')"
    const sameOrg = ' && organization_id = @request.auth.organization_id'
    // admin e sdr leem todos; corretor só os que ele é responsável
    const rowAccess =
      " && (@request.auth.role = 'admin' || @request.auth.role = 'sdr' || responsible_id = @request.auth.id)"

    const clients = new Collection({
      name: 'clients',
      type: 'base',
      listRule: authOk + sameOrg + rowAccess,
      viewRule: authOk + sameOrg + rowAccess,
      // o corretor só cadastra com ele mesmo como responsável
      createRule:
        authOk +
        " && @request.body.organization_id = @request.auth.organization_id && (@request.auth.role != 'corretor' || @request.body.responsible_id = @request.auth.id)",
      // ninguém muda a organização; o corretor também não muda o responsável
      updateRule:
        authOk +
        sameOrg +
        rowAccess +
        " && @request.body.organization_id:isset = false && (@request.auth.role = 'admin' || @request.auth.role = 'sdr' || @request.body.responsible_id:isset = false)",
      deleteRule: null,
      fields: [
        {
          name: 'organization_id',
          type: 'relation',
          required: true,
          collectionId: orgId,
          maxSelect: 1,
        },
        { name: 'name', type: 'text', required: true, min: 2, max: 160 },
        { name: 'phone', type: 'text', max: 20 },
        { name: 'email', type: 'email' },
        {
          name: 'kind',
          type: 'select',
          required: true,
          values: ['comprador', 'locatario', 'proprietario', 'investidor'],
          maxSelect: 4,
        },
        { name: 'responsible_id', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        {
          name: 'consent_status',
          type: 'select',
          values: ['opt_in', 'opt_out', 'unknown'],
          maxSelect: 1,
        },
        { name: 'consent_at', type: 'date' },
        { name: 'consent_channel', type: 'text', max: 60 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_clients_org_phone ON clients (organization_id, phone)',
        'CREATE INDEX idx_clients_org_email ON clients (organization_id, email)',
        'CREATE INDEX idx_clients_org_responsible ON clients (organization_id, responsible_id)',
      ],
    })
    app.save(clients)

    const clientsId = app.findCollectionByNameOrId('clients').id
    const privateCol = new Collection({
      name: 'client_private',
      type: 'base',
      // leitura estrita (também por id): admin ou o corretor responsável
      listRule:
        authOk +
        sameOrg +
        " && (@request.auth.role = 'admin' || (@request.auth.role = 'corretor' && client_id.responsible_id = @request.auth.id))",
      viewRule:
        authOk +
        sameOrg +
        " && (@request.auth.role = 'admin' || (@request.auth.role = 'corretor' && client_id.responsible_id = @request.auth.id))",
      // quem é o responsável do cliente é conferido pelo hook client_private_write_create
      createRule:
        "@request.auth.active = true && (@request.auth.role = 'admin' || @request.auth.role = 'corretor') && @request.body.organization_id = @request.auth.organization_id",
      updateRule:
        "@request.auth.active = true && organization_id = @request.auth.organization_id && @request.body.organization_id:isset = false && @request.body.client_id:isset = false && (@request.auth.role = 'admin' || (@request.auth.role = 'corretor' && client_id.responsible_id = @request.auth.id))",
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
          name: 'client_id',
          type: 'relation',
          required: true,
          collectionId: clientsId,
          maxSelect: 1,
        },
        { name: 'cpf', type: 'text', max: 14 },
        { name: 'birth_date', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_client_private_client ON client_private (client_id)',
        "CREATE UNIQUE INDEX idx_client_private_cpf ON client_private (organization_id, cpf) WHERE cpf != ''",
      ],
    })
    app.save(privateCol)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('client_private'))
    app.delete(app.findCollectionByNameOrId('clients'))
  },
)
