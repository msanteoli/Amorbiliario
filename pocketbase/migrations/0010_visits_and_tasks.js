migrate(
  (app) => {
    const orgId = app.findCollectionByNameOrId('organizations').id
    const leadsId = app.findCollectionByNameOrId('leads').id
    const clientsId = app.findCollectionByNameOrId('clients').id
    const propertiesId = app.findCollectionByNameOrId('properties').id
    const authOk =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || @request.auth.role = 'sdr' || @request.auth.role = 'corretor')"
    const sameOrg = ' && organization_id = @request.auth.organization_id'

    // a linha do tempo do lead ganha o tipo "visita"
    const events = app.findCollectionByNameOrId('lead_events')
    const typeField = events.fields.getByName('type')
    typeField.values = typeField.values.concat(['visita'])
    app.save(events)

    // Visitas: só leitura pela coleção. Toda mudança passa pelos endpoints /backend/v1/visits,
    // que devolvem 409 no conflito e gravam a linha do tempo do lead. O corretor lê só as dele.
    const visits = new Collection({
      name: 'visits',
      type: 'base',
      listRule:
        authOk +
        sameOrg +
        " && (@request.auth.role = 'admin' || @request.auth.role = 'sdr' || broker_id = @request.auth.id)",
      // leitura por id: o papel 'outro' passa até o hook role_gate_view (403); o corretor continua filtrado
      viewRule:
        "@request.auth.id != '' && organization_id = @request.auth.organization_id && (@request.auth.role != 'corretor' || broker_id = @request.auth.id)",
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
        { name: 'lead_id', type: 'relation', collectionId: leadsId, maxSelect: 1 },
        { name: 'client_id', type: 'relation', collectionId: clientsId, maxSelect: 1 },
        {
          name: 'property_id',
          type: 'relation',
          required: true,
          collectionId: propertiesId,
          maxSelect: 1,
        },
        { name: 'broker_id', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'start_at', type: 'date' },
        { name: 'end_at', type: 'date' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: [
            'pendente_agenda',
            'agendada',
            'confirmada',
            'realizada',
            'cancelada',
            'nao_compareceu',
          ],
          maxSelect: 1,
        },
        { name: 'result_text', type: 'text', max: 1000 },
        { name: 'cancel_reason', type: 'text', max: 300 },
        { name: 'cancelled_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'cancelled_at', type: 'date' },
        { name: 'created_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_visits_org_broker_start ON visits (organization_id, broker_id, start_at)',
        'CREATE INDEX idx_visits_org_status ON visits (organization_id, status)',
        'CREATE INDEX idx_visits_lead ON visits (lead_id)',
      ],
    })
    app.save(visits)

    // Tarefas: admin lê todas; sdr lê as que criou ou que são dele; corretor lê as dele.
    const taskRow =
      " && (@request.auth.role = 'admin' || assigned_to = @request.auth.id || created_by = @request.auth.id)"
    const tasks = new Collection({
      name: 'tasks',
      type: 'base',
      listRule: authOk + sameOrg + taskRow,
      // o papel 'outro' passa até o hook role_gate_view (403); sdr e corretor continuam filtrados
      viewRule:
        "@request.auth.id != '' && organization_id = @request.auth.organization_id && ((@request.auth.role != 'sdr' && @request.auth.role != 'corretor') || assigned_to = @request.auth.id || created_by = @request.auth.id)",
      // quem pode criar para quem, e os vínculos, são conferidos pelo hook tasks_write_create
      createRule: authOk + ' && @request.body.organization_id = @request.auth.organization_id',
      // a regra de edição completa (com :isset) é atribuída logo abaixo, depois do save
      updateRule: authOk + sameOrg + taskRow,
      deleteRule: null,
      fields: [
        {
          name: 'organization_id',
          type: 'relation',
          required: true,
          collectionId: orgId,
          maxSelect: 1,
        },
        { name: 'title', type: 'text', required: true, min: 2, max: 160 },
        { name: 'description', type: 'text', max: 500 },
        { name: 'due_at', type: 'date' },
        {
          name: 'assigned_to',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['aberta', 'concluida', 'cancelada'],
          maxSelect: 1,
        },
        { name: 'closed_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'closed_at', type: 'date' },
        { name: 'lead_id', type: 'relation', collectionId: leadsId, maxSelect: 1 },
        { name: 'client_id', type: 'relation', collectionId: clientsId, maxSelect: 1 },
        { name: 'property_id', type: 'relation', collectionId: propertiesId, maxSelect: 1 },
        {
          name: 'created_by',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_tasks_org_assigned ON tasks (organization_id, assigned_to, status)',
        'CREATE INDEX idx_tasks_org_due ON tasks (organization_id, due_at)',
      ],
    })
    app.save(tasks)

    // O validador do Skip não aceita :isset numa coleção recém-criada. Ninguém muda a
    // organização, o criador, quem encerrou, nem os vínculos; o corretor também não muda o responsável.
    const tasksFinal = app.findCollectionByNameOrId('tasks')
    tasksFinal.updateRule =
      authOk +
      sameOrg +
      taskRow +
      " && @request.body.organization_id:isset = false && @request.body.created_by:isset = false && @request.body.closed_by:isset = false && @request.body.closed_at:isset = false && @request.body.lead_id:isset = false && @request.body.client_id:isset = false && @request.body.property_id:isset = false && (@request.auth.role != 'corretor' || @request.body.assigned_to:isset = false)"
    app.save(tasksFinal)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('tasks'))
    app.delete(app.findCollectionByNameOrId('visits'))
  },
)
