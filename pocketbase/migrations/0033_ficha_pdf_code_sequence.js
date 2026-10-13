// M13 — importação de ficha PDF: contador de código por organização e origem "ficha_pdf" em properties.source.
// Sem apagar nada. A sequência é incrementada com UPDATE atômico (ver properties_ficha_commit.js).
migrate(
  (app) => {
    const org = app.findCollectionByNameOrId('organizations')
    org.fields.add(new NumberField({ name: 'property_code_seq', onlyInt: true, min: 0 }))
    app.save(org)
    const props = app.findCollectionByNameOrId('properties')
    props.fields.getByName('source').values = ['manual', 'importacao', 'ficha_pdf']
    app.save(props)
  },
  (app) => {
    const props = app.findCollectionByNameOrId('properties')
    props.fields.getByName('source').values = ['manual', 'importacao']
    app.save(props)
    const org = app.findCollectionByNameOrId('organizations')
    org.fields.removeByName('property_code_seq')
    app.save(org)
  },
)
