// M10 — Negociação: negociações, pessoas da negociação e documentos. Tudo é escrito só pelos endpoints
// (regras de criação e edição nulas). Pessoas são clientes da base única (clients). O arquivo do
// documento é privado: a coleção de documentos não é legível por ninguém (só superusuário) e o arquivo
// sai apenas pelo endpoint, que audita cada abertura.
migrate(
  (app) => {
    const orgId = app.findCollectionByNameOrId('organizations').id
    const leadsId = app.findCollectionByNameOrId('leads').id
    const propsId = app.findCollectionByNameOrId('properties').id
    const clientsId = app.findCollectionByNameOrId('clients').id
    const authOk =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || @request.auth.role = 'sdr' || @request.auth.role = 'corretor')"
    const sameOrg = ' && organization_id = @request.auth.organization_id'
    const rowOwn =
      " && (@request.auth.role = 'admin' || @request.auth.role = 'sdr' || responsible_id = @request.auth.id)"
    const rowViaNeg =
      " && (@request.auth.role = 'admin' || @request.auth.role = 'sdr' || negotiation_id.responsible_id = @request.auth.id)"
    // leitura individual: o papel "outro" chega ao hook role_gate_view (403 e auditoria)
    const viewLight =
      "@request.auth.id != '' && organization_id = @request.auth.organization_id && (@request.auth.role != 'corretor' || responsible_id = @request.auth.id)"
    const viewLightNeg =
      "@request.auth.id != '' && organization_id = @request.auth.organization_id && (@request.auth.role != 'corretor' || negotiation_id.responsible_id = @request.auth.id)"

    app.save(
      new Collection({
        name: 'negotiations',
        type: 'base',
        listRule: authOk + sameOrg + rowOwn,
        viewRule: viewLight,
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
            name: 'lead_id',
            type: 'relation',
            required: true,
            collectionId: leadsId,
            maxSelect: 1,
          },
          {
            name: 'property_id',
            type: 'relation',
            required: true,
            collectionId: propsId,
            maxSelect: 1,
          },
          {
            name: 'purpose',
            type: 'select',
            required: true,
            values: ['venda', 'locacao'],
            maxSelect: 1,
          },
          { name: 'agreed_value', type: 'number', min: 0 },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['em_analise', 'aprovada', 'fechada', 'desistiu'],
            maxSelect: 1,
          },
          {
            name: 'responsible_id',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
          },
          { name: 'closed_at', type: 'date' },
          { name: 'notes', type: 'text', max: 2000 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          "CREATE UNIQUE INDEX idx_negotiations_open_lead ON negotiations (lead_id) WHERE status IN ('em_analise','aprovada')",
          'CREATE INDEX idx_negotiations_org_status ON negotiations (organization_id, status)',
          'CREATE INDEX idx_negotiations_property ON negotiations (property_id)',
        ],
      }),
    )
    const negId = app.findCollectionByNameOrId('negotiations').id

    app.save(
      new Collection({
        name: 'negotiation_people',
        type: 'base',
        listRule: authOk + sameOrg + rowViaNeg,
        viewRule: viewLightNeg,
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
            name: 'negotiation_id',
            type: 'relation',
            required: true,
            collectionId: negId,
            maxSelect: 1,
          },
          {
            name: 'client_id',
            type: 'relation',
            required: true,
            collectionId: clientsId,
            maxSelect: 1,
          },
          {
            name: 'role',
            type: 'select',
            required: true,
            values: ['cliente', 'fiador', 'conjuge_cliente', 'conjuge_fiador', 'morador'],
            maxSelect: 1,
          },
          { name: 'active', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_neg_people_unique ON negotiation_people (negotiation_id, client_id, role)',
          'CREATE INDEX idx_neg_people_client ON negotiation_people (client_id)',
        ],
      }),
    )
    const peopleId = app.findCollectionByNameOrId('negotiation_people').id

    app.save(
      new Collection({
        name: 'negotiation_documents',
        type: 'base',
        // ninguém lê direto: só os endpoints (checklist e arquivo)
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
            name: 'negotiation_id',
            type: 'relation',
            required: true,
            collectionId: negId,
            maxSelect: 1,
          },
          {
            name: 'person_id',
            type: 'relation',
            required: true,
            collectionId: peopleId,
            maxSelect: 1,
          },
          {
            name: 'doc_type',
            type: 'select',
            required: true,
            values: [
              'documento_foto',
              'cpf',
              'comprovante_renda',
              'comprovante_renda_3m',
              'comprovante_residencia',
              'certidao_estado_civil',
              'matricula_garantia',
              'contrato_social',
              'cnpj',
            ],
            maxSelect: 1,
          },
          {
            name: 'state',
            type: 'select',
            required: true,
            values: ['pendente', 'recebido', 'conferido'],
            maxSelect: 1,
          },
          {
            name: 'file',
            type: 'file',
            maxSelect: 5,
            maxSize: 10485760,
            protected: true,
            mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
          },
          { name: 'active', type: 'bool' },
          { name: 'checked_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
          { name: 'checked_at', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_neg_docs_neg ON negotiation_documents (negotiation_id, active)',
        ],
      }),
    )
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('negotiation_documents'))
    app.delete(app.findCollectionByNameOrId('negotiation_people'))
    app.delete(app.findCollectionByNameOrId('negotiations'))
  },
)
