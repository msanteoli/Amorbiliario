// M12 etapa 2 — segundo código secreto de portal_feeds (contatos) e contadores.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('portal_feeds')
    col.fields.add(new TextField({ name: 'leads_token', min: 32, max: 64 }))
    col.fields.add(new DateField({ name: 'last_lead_at' }))
    col.fields.add(new NumberField({ name: 'leads_count', onlyInt: true, min: 0 }))
    col.addIndex('idx_portal_feeds_leads_token', true, 'leads_token', "leads_token != ''")
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('portal_feeds')
    col.removeIndex('idx_portal_feeds_leads_token')
    ;['leads_token', 'last_lead_at', 'leads_count'].forEach((n) => col.fields.removeByName(n))
    app.save(col)
  },
)
