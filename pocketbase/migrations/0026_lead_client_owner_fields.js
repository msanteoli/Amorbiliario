// M10 — campos novos do lead (faixa de valor, vários bairros, observações, origens novas), do cliente
// (pessoa física ou jurídica, razão social) e da parte protegida do cliente (RG, endereço, dados
// bancários e CNPJ). Só acrescenta; nada do que existe muda.
migrate(
  (app) => {
    const leads = app.findCollectionByNameOrId('leads')
    leads.fields.add(new NumberField({ name: 'search_min_price', min: 0 }))
    leads.fields.add(new TextField({ name: 'search_neighborhoods', max: 300 }))
    leads.fields.add(new TextField({ name: 'notes', max: 2000 }))
    const origin = leads.fields.getByName('origin')
    origin.values = [
      'whatsapp',
      'portal',
      'indicacao_balcao',
      'site_redes_outros',
      'ligacao',
      'site',
      'redes_sociais',
    ]
    app.save(leads)

    const clients = app.findCollectionByNameOrId('clients')
    clients.fields.add(
      new SelectField({ name: 'person_type', values: ['fisica', 'juridica'], maxSelect: 1 }),
    )
    clients.fields.add(new TextField({ name: 'company_name', max: 160 }))
    app.save(clients)

    const priv = app.findCollectionByNameOrId('client_private')
    priv.fields.add(new TextField({ name: 'rg', max: 30 }))
    priv.fields.add(new TextField({ name: 'address', max: 300 }))
    priv.fields.add(new TextField({ name: 'bank_details', max: 500 }))
    priv.fields.add(new TextField({ name: 'cnpj', max: 18 }))
    app.save(priv)
  },
  (app) => {
    const leads = app.findCollectionByNameOrId('leads')
    ;['search_min_price', 'search_neighborhoods', 'notes'].forEach((n) =>
      leads.fields.removeByName(n),
    )
    app.save(leads)
    const clients = app.findCollectionByNameOrId('clients')
    ;['person_type', 'company_name'].forEach((n) => clients.fields.removeByName(n))
    app.save(clients)
    const priv = app.findCollectionByNameOrId('client_private')
    ;['rg', 'address', 'bank_details', 'cnpj'].forEach((n) => priv.fields.removeByName(n))
    app.save(priv)
  },
)
