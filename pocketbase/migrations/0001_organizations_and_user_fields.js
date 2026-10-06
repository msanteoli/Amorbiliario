migrate(
  (app) => {
    // 1) organizations, criada trancada (regras null) porque as regras citam
    //    campos de users que ainda não existem.
    const orgs = new Collection({
      name: 'organizations',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'name', type: 'text', required: true, min: 2, max: 120 },
        { name: 'slug', type: 'text', required: true, min: 2, max: 60, pattern: '^[a-z0-9-]+$' },
        { name: 'timezone', type: 'text', required: true, min: 3, max: 60 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_organizations_slug ON organizations (slug)'],
    })
    app.save(orgs)

    // 2) campos novos em users
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const orgId = app.findCollectionByNameOrId('organizations').id
    if (!users.fields.getByName('name')) {
      users.fields.add(new TextField({ name: 'name', max: 120 }))
    }
    if (!users.fields.getByName('role')) {
      users.fields.add(
        new SelectField({
          name: 'role',
          values: ['admin', 'sdr', 'corretor', 'agente', 'outro'],
          maxSelect: 1,
          required: true,
        }),
      )
    }
    if (!users.fields.getByName('organization_id')) {
      users.fields.add(
        new RelationField({
          name: 'organization_id',
          collectionId: orgId,
          maxSelect: 1,
          required: true,
          cascadeDelete: false,
        }),
      )
    }
    if (!users.fields.getByName('active')) {
      users.fields.add(new BoolField({ name: 'active' }))
    }

    // 3) regras de users: cadastro fechado (só admin cria, na própria organização),
    //    sem apagar (null = só superusuário), sem mudar o próprio papel,
    //    organização ou active.
    users.listRule = "@request.auth.id != '' && organization_id = @request.auth.organization_id"
    users.viewRule = "@request.auth.id != '' && organization_id = @request.auth.organization_id"
    users.createRule =
      "@request.auth.role = 'admin' && @request.body.organization_id = @request.auth.organization_id"
    users.updateRule =
      "organization_id = @request.auth.organization_id && ((@request.auth.role = 'admin' && (@request.body.organization_id:isset = false || @request.body.organization_id = @request.auth.organization_id)) || (id = @request.auth.id && @request.body.role:isset = false && @request.body.organization_id:isset = false && @request.body.active:isset = false))"
    users.deleteRule = null
    app.save(users)

    // 4) regras de organizations, agora que users.organization_id existe
    const orgsFinal = app.findCollectionByNameOrId('organizations')
    orgsFinal.listRule = "@request.auth.id != '' && id = @request.auth.organization_id"
    orgsFinal.viewRule = "@request.auth.id != '' && id = @request.auth.organization_id"
    orgsFinal.updateRule = "@request.auth.role = 'admin' && id = @request.auth.organization_id"
    app.save(orgsFinal)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.fields.removeByName('active')
    users.fields.removeByName('organization_id')
    users.fields.removeByName('role')
    users.listRule = 'id = @request.auth.id'
    users.viewRule = 'id = @request.auth.id'
    users.createRule = ''
    users.updateRule = 'id = @request.auth.id'
    users.deleteRule = 'id = @request.auth.id'
    app.save(users)
    app.delete(app.findCollectionByNameOrId('organizations'))
  },
)
