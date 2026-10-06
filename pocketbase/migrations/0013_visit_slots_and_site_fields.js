migrate(
  (app) => {
    const orgId = app.findCollectionByNameOrId('organizations').id
    const propertiesId = app.findCollectionByNameOrId('properties').id
    const authOk =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || @request.auth.role = 'sdr' || @request.auth.role = 'corretor')"
    const sameOrg = ' && organization_id = @request.auth.organization_id'
    // leitura por id leve: o papel 'outro' passa até o hook role_gate_view, que responde 403 e audita
    const readLight = "@request.auth.id != '' && organization_id = @request.auth.organization_id"

    // disponibilidade de visita por imóvel; só o endpoint /properties/{id}/visit-slots escreve
    const slots = new Collection({
      name: 'property_visit_slots',
      type: 'base',
      listRule: authOk + sameOrg,
      viewRule: readLight,
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
          collectionId: propertiesId,
          maxSelect: 1,
        },
        // 0 = domingo ... 6 = sábado. Não é obrigatório porque o motor trata 0 como vazio; o endpoint valida.
        { name: 'weekday', type: 'number', onlyInt: true, min: 0, max: 6 },
        {
          name: 'start_time',
          type: 'text',
          required: true,
          pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$',
        },
        {
          name: 'end_time',
          type: 'text',
          required: true,
          pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$',
        },
        {
          name: 'duration_minutes',
          type: 'number',
          required: true,
          onlyInt: true,
          min: 15,
          max: 240,
        },
        { name: 'is_active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_visit_slots_key ON property_visit_slots (property_id, weekday, start_time, end_time, duration_minutes)',
        'CREATE INDEX idx_visit_slots_property ON property_visit_slots (property_id, is_active)',
      ],
    })
    app.save(slots)

    // campos do pedido de visita pelo site, na coleção do M5
    const visits = app.findCollectionByNameOrId('visits')
    visits.fields.add(
      new SelectField({ name: 'source', values: ['site', 'interno'], maxSelect: 1 }),
    )
    visits.fields.add(new DateField({ name: 'requested_at' }))
    // <id do imóvel>|<início em ISO UTC> enquanto a visita segura o horário; vazio quando não segura
    visits.fields.add(new TextField({ name: 'slot_key', max: 120 }))
    visits.fields.add(new DateField({ name: 'slot_released_at' }))
    visits.addIndex('idx_visits_slot_key', true, 'slot_key', "slot_key != ''")
    app.save(visits)
  },
  (app) => {
    const visits = app.findCollectionByNameOrId('visits')
    visits.removeIndex('idx_visits_slot_key')
    ;['source', 'requested_at', 'slot_key', 'slot_released_at'].forEach((n) =>
      visits.fields.removeByName(n),
    )
    app.save(visits)
    app.delete(app.findCollectionByNameOrId('property_visit_slots'))
  },
)
