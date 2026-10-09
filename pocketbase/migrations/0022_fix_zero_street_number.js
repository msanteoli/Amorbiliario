// Corrige os imóveis importados da Kenlo que ficaram com o número "0" (a Kenlo usa 0 quando não há
// número): passam a "S/N". Só toca em imóveis de origem "importacao" com street_number exatamente "0".
migrate(
  (app) => {
    const rows = app.findRecordsByFilter(
      'properties',
      "source = 'importacao' && street_number = '0'",
      '',
      5000,
      0,
    )
    rows.forEach((p) => {
      p.set('street_number', 'S/N')
      app.save(p)
    })
  },
  (app) => {
    // sem volta: "0" não é um número de imóvel válido
  },
)
