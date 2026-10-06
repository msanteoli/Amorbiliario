migrate(
  (app) => {
    const orgId = app.findCollectionByNameOrId('organizations').id
    const propertiesId = app.findCollectionByNameOrId('properties').id
    const clientsId = app.findCollectionByNameOrId('clients').id
    const authOk =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || @request.auth.role = 'sdr' || @request.auth.role = 'corretor')"
    const sameOrg = ' && organization_id = @request.auth.organization_id'
    // admin e sdr leem todos; corretor só os atribuídos a ele
    const rowAccess =
      " && (@request.auth.role = 'admin' || @request.auth.role = 'sdr' || assigned_to = @request.auth.id)"
    // leitura por id: o papel 'outro' passa até o hook role_gate_view, que responde 403 e audita;
    // o corretor continua filtrado por linha (404 no lead de outro)
    const viewRule =
      "@request.auth.id != '' && organization_id = @request.auth.organization_id && (@request.auth.role != 'corretor' || assigned_to = @request.auth.id)"

    const leads = new Collection({
      name: 'leads',
      type: 'base',
      listRule: authOk + sameOrg + rowAccess,
      viewRule: viewRule,
      // todo lead nasce pelo endpoint /backend/v1/leads/intake (que deduplica)
      createRule: null,
      // a regra de edição completa (com :isset) é atribuída logo abaixo, depois do save
      updateRule: authOk + sameOrg + rowAccess,
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
          name: 'origin',
          type: 'select',
          required: true,
          values: ['whatsapp', 'portal', 'indicacao_balcao', 'site_redes_outros'],
          maxSelect: 1,
        },
        { name: 'origin_detail', type: 'text', max: 80 },
        { name: 'property_id', type: 'relation', collectionId: propertiesId, maxSelect: 1 },
        { name: 'search_neighborhood', type: 'text', max: 80 },
        {
          name: 'search_type',
          type: 'select',
          values: ['casa', 'apartamento', 'terreno', 'comercial', 'galpao', 'chacara', 'outro'],
          maxSelect: 1,
        },
        { name: 'search_bedrooms', type: 'number', onlyInt: true, min: 0, max: 99 },
        { name: 'search_max_price', type: 'number', min: 0 },
        {
          name: 'consent_status',
          type: 'select',
          values: ['opt_in', 'opt_out', 'unknown'],
          maxSelect: 1,
        },
        {
          name: 'stage',
          type: 'select',
          required: true,
          values: ['novo', 'em_atendimento', 'visita_marcada', 'proposta', 'ganho', 'perdido'],
          maxSelect: 1,
        },
        { name: 'assigned_to', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'next_step', type: 'text', max: 200 },
        { name: 'next_step_due', type: 'date' },
        { name: 'first_contact_at', type: 'date' },
        { name: 'last_contact_at', type: 'date' },
        { name: 'conversation_ref', type: 'text', max: 120 },
        { name: 'client_id', type: 'relation', collectionId: clientsId, maxSelect: 1 },
        {
          name: 'lost_reason',
          type: 'select',
          values: ['sem_retorno', 'desistencia', 'duplicado'],
          maxSelect: 1,
        },
        {
          name: 'dedupe_status',
          type: 'select',
          values: ['pendente', 'resolvido_separado', 'resolvido_mesma_pessoa'],
          maxSelect: 1,
        },
        { name: 'dedupe_of', type: 'text', max: 40 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_leads_org_phone ON leads (organization_id, phone)',
        'CREATE INDEX idx_leads_org_email ON leads (organization_id, email)',
        'CREATE INDEX idx_leads_org_stage ON leads (organization_id, stage)',
        'CREATE INDEX idx_leads_org_assigned ON leads (organization_id, assigned_to)',
        'CREATE INDEX idx_leads_org_dedupe ON leads (organization_id, dedupe_status)',
      ],
    })
    app.save(leads)

    // O validador do Skip não aceita :isset numa coleção recém-criada. Ninguém muda a
    // organização, a origem, a ligação com o cliente, a pendência de duplicidade nem as datas
    // de contato (só os endpoints e os hooks mexem nisso); o corretor também não muda o dono.
    const leadsFinal = app.findCollectionByNameOrId('leads')
    leadsFinal.updateRule =
      authOk +
      sameOrg +
      rowAccess +
      " && @request.body.organization_id:isset = false && @request.body.origin:isset = false && @request.body.client_id:isset = false && @request.body.dedupe_status:isset = false && @request.body.dedupe_of:isset = false && @request.body.first_contact_at:isset = false && @request.body.last_contact_at:isset = false && @request.body.conversation_ref:isset = false && (@request.auth.role != 'corretor' || @request.body.assigned_to:isset = false)"
    app.save(leadsFinal)

    const leadsId = app.findCollectionByNameOrId('leads').id
    const events = new Collection({
      name: 'lead_events',
      type: 'base',
      listRule:
        authOk +
        sameOrg +
        " && (@request.auth.role != 'corretor' || lead_id.assigned_to = @request.auth.id)",
      viewRule:
        "@request.auth.id != '' && organization_id = @request.auth.organization_id && (@request.auth.role != 'corretor' || lead_id.assigned_to = @request.auth.id)",
      // o hook lead_events_write_create confere o lead, o tipo (só nota e contato) e o autor
      createRule: authOk + ' && @request.body.organization_id = @request.auth.organization_id',
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
        { name: 'lead_id', type: 'relation', required: true, collectionId: leadsId, maxSelect: 1 },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: [
            'criado',
            'nota',
            'contato',
            'estagio',
            'atribuicao',
            'proximo_passo',
            'ficha_enviada',
            'convertido',
            'origem_corrigida',
            'pendencia_dedupe',
            'dedupe_resolvido',
            'contato_repetido',
          ],
          maxSelect: 1,
        },
        { name: 'author_id', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'occurred_at', type: 'date' },
        { name: 'text', type: 'text', max: 2000 },
        { name: 'intent_key', type: 'text', max: 80 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_lead_events_lead ON lead_events (lead_id, created)',
        "CREATE UNIQUE INDEX idx_lead_events_intent ON lead_events (lead_id, intent_key) WHERE intent_key != ''",
      ],
    })
    app.save(events)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('lead_events'))
    app.delete(app.findCollectionByNameOrId('leads'))
  },
)
