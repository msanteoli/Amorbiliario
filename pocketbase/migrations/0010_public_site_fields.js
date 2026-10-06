migrate(
  (app) => {
    // número do WhatsApp da imobiliária (só dígitos, com 55); o botão do site usa este valor
    const orgs = app.findCollectionByNameOrId('organizations')
    orgs.fields.add(new TextField({ name: 'whatsapp_number', max: 20 }))
    app.save(orgs)

    // campos do lead que vêm do site: campanha, consentimento e último interesse
    const leads = app.findCollectionByNameOrId('leads')
    leads.fields.add(new TextField({ name: 'utm_source', max: 120 }))
    leads.fields.add(new TextField({ name: 'utm_medium', max: 120 }))
    leads.fields.add(new TextField({ name: 'utm_campaign', max: 120 }))
    leads.fields.add(
      new SelectField({ name: 'click_id_type', values: ['gclid', 'fbclid'], maxSelect: 1 }),
    )
    leads.fields.add(new TextField({ name: 'click_id', max: 200 }))
    leads.fields.add(new DateField({ name: 'consent_at' }))
    leads.fields.add(new TextField({ name: 'consent_channel', max: 40 }))
    leads.fields.add(new DateField({ name: 'last_site_interest_at' }))
    // só os endpoints gravam esses campos; ninguém os muda pela API de edição
    leads.updateRule =
      leads.updateRule +
      ' && @request.body.utm_source:isset = false && @request.body.utm_medium:isset = false' +
      ' && @request.body.utm_campaign:isset = false && @request.body.click_id_type:isset = false' +
      ' && @request.body.click_id:isset = false && @request.body.consent_at:isset = false' +
      ' && @request.body.consent_channel:isset = false && @request.body.last_site_interest_at:isset = false'
    app.save(leads)

    // tipos novos de evento da linha do tempo e índice para achar a chave de envio do site
    const events = app.findCollectionByNameOrId('lead_events')
    const typeField = events.fields.getByName('type')
    typeField.values = typeField.values.concat(['interesse_site', 'busca_site'])
    events.addIndex('idx_lead_events_intent_key', false, 'intent_key', "intent_key != ''")
    app.save(events)
  },
  (app) => {
    const events = app.findCollectionByNameOrId('lead_events')
    const typeField = events.fields.getByName('type')
    typeField.values = typeField.values.filter((v) => v !== 'interesse_site' && v !== 'busca_site')
    events.removeIndex('idx_lead_events_intent_key')
    app.save(events)

    const leads = app.findCollectionByNameOrId('leads')
    const cut = ' && @request.body.utm_source:isset = false'
    const i = leads.updateRule.indexOf(cut)
    if (i >= 0) leads.updateRule = leads.updateRule.slice(0, i)
    ;[
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'click_id_type',
      'click_id',
      'consent_at',
      'consent_channel',
      'last_site_interest_at',
    ].forEach((n) => leads.fields.removeByName(n))
    app.save(leads)

    const orgs = app.findCollectionByNameOrId('organizations')
    orgs.fields.removeByName('whatsapp_number')
    app.save(orgs)
  },
)
