// M20: quantidade de suítes do imóvel. "bedrooms" continua sendo o total de quartos (inclui as suítes);
// "suites" é quantas delas são suítes (0 a bedrooms). Campo novo: os imóveis existentes ficam com 0.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('properties')
    col.fields.add(new NumberField({ name: 'suites', onlyInt: true, min: 0, max: 99 }))
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('properties')
    col.fields.removeByName('suites')
    app.save(col)
  },
)
