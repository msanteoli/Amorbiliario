// M14 — Fluxo de atendimento pelo site: bloqueios de agenda do corretor e campos de fila em users.
// Bloqueio = período em que o corretor não recebe leads nem pedidos de visita. Não se apaga: encerra-se
// preenchendo ended_at (regra do projeto: ninguém apaga registro). Escrita só pelos endpoints.
migrate(
  (app) => {
    const orgId = app.findCollectionByNameOrId('organizations').id
    const usersId = app.findCollectionByNameOrId('users').id
    const authOk =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || @request.auth.role = 'sdr' || @request.auth.role = 'corretor')"
    const sameOrg = ' && organization_id = @request.auth.organization_id'
    // corretor vê só os próprios bloqueios; admin e SDR veem os da organização
    const rowOwn = " && (@request.auth.role != 'corretor' || user_id = @request.auth.id)"

    app.save(
      new Collection({
        name: 'agenda_blocks',
        type: 'base',
        listRule: authOk + sameOrg + rowOwn,
        viewRule: authOk + sameOrg + rowOwn,
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
            name: 'user_id',
            type: 'relation',
            required: true,
            collectionId: usersId,
            maxSelect: 1,
          },
          { name: 'start_at', type: 'date', required: true },
          { name: 'end_at', type: 'date', required: true },
          { name: 'reason', type: 'text', max: 200 },
          { name: 'ended_at', type: 'date' },
          { name: 'created_by', type: 'relation', collectionId: usersId, maxSelect: 1 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_agenda_blocks_user ON agenda_blocks (user_id, end_at)'],
      }),
    )

    const users = app.findCollectionByNameOrId('users')
    users.fields.add(new TextField({ name: 'intake_types', max: 300 }))
    users.fields.add(new DateField({ name: 'last_intake_at' }))
    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.fields.removeByName('intake_types')
    users.fields.removeByName('last_intake_at')
    app.save(users)
    app.delete(app.findCollectionByNameOrId('agenda_blocks'))
  },
)
