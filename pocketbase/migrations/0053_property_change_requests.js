// Aprovação de alteração de imóvel (regra de 10/11/2026, decidida por Janeide):
// o corretor altera preço, finalidade ou situação de um imóvel => vira PEDIDO e espera a
// decisão de qualquer administrador. O resto do imóvel continua sendo editado direto.
//
// Esta coleção só guarda o pedido. Quem ESCREVE é o hook properties_write_update (cria o pedido)
// e o endpoint de decisão (aprova/recusa); por isso create/update/delete são nulos: nenhum
// cliente grava direto pela API.
//
// Leitura: admin enxerga a organização toda; corretor enxerga só os pedidos dele; SDR não enxerga.
// Pedido não se apaga (deleteRule nulo) — é registro de decisão.
migrate(
  (app) => {
    const orgId = app.findCollectionByNameOrId('organizations').id
    const propsId = app.findCollectionByNameOrId('properties').id

    app.save(
      new Collection({
        name: 'property_change_requests',
        type: 'base',
        listRule:
          "@request.auth.active = true && organization_id = @request.auth.organization_id && (@request.auth.role = 'admin' || (requested_by = @request.auth.id && @request.auth.role = 'corretor'))",
        viewRule:
          "@request.auth.active = true && organization_id = @request.auth.organization_id && (@request.auth.role = 'admin' || (requested_by = @request.auth.id && @request.auth.role = 'corretor'))",
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
            name: 'property_id',
            type: 'relation',
            required: true,
            collectionId: propsId,
            maxSelect: 1,
            cascadeDelete: false,
          },
          {
            name: 'requested_by',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
            cascadeDelete: false,
          },
          // lista de { campo, de, para } — lida com JSON.parse(record.getString('changes'))
          { name: 'changes', type: 'json', maxSize: 20000 },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pendente', 'aprovado', 'recusado', 'substituido'],
            maxSelect: 1,
          },
          {
            name: 'decided_by',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
            cascadeDelete: false,
          },
          { name: 'decided_at', type: 'date' },
          { name: 'reason', type: 'text', max: 300 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_prop_changes_prop_status ON property_change_requests (property_id, status)',
          'CREATE INDEX idx_prop_changes_org_status ON property_change_requests (organization_id, status)',
          'CREATE INDEX idx_prop_changes_requested_by ON property_change_requests (requested_by, status)',
        ],
      }),
    )
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('property_change_requests'))
  },
)
