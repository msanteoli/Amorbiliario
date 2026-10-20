// Ordem das fotos e escolha da capa (spec docs/superpowers/specs/2026-10-20-ordem-das-fotos-design.md), imóvel e condomínio.
//   property_photos.position e condominium_photos.position: posição 1..n das fotos ATIVAS (as inativas ficam com 0).
//   properties.cover_photo_id e condominiums.cover_photo_id: capa escolhida (opcional); sem ela, vale a primeira da ordem.
// Preenchimento inicial: as fotos ativas de cada imóvel e de cada condomínio são numeradas pela data de envio (a ordem de hoje não muda).
// As regras de edição passam a PROIBIR gravar position e cover_photo_id direto: só os endpoints /backend/v1/.../photos/order e .../cover.
migrate(
  (app) => {
    const photos = app.findCollectionByNameOrId('property_photos')
    photos.fields.add(new NumberField({ name: 'position', onlyInt: true, min: 0 }))
    app.save(photos)
    const cphotos = app.findCollectionByNameOrId('condominium_photos')
    cphotos.fields.add(new NumberField({ name: 'position', onlyInt: true, min: 0 }))
    app.save(cphotos)
    const props = app.findCollectionByNameOrId('properties')
    props.fields.add(
      new RelationField({ name: 'cover_photo_id', collectionId: photos.id, maxSelect: 1 }),
    )
    app.save(props)
    const condos = app.findCollectionByNameOrId('condominiums')
    condos.fields.add(
      new RelationField({ name: 'cover_photo_id', collectionId: cphotos.id, maxSelect: 1 }),
    )
    app.save(condos)

    // numeração inicial pela data de envio (SQL direto: não dispara hooks nem muda a data de atualização)
    const fill = (photoColl, parentField) => {
      const rows = app.findRecordsByFilter(photoColl, 'is_active = true', 'created', 100000, 0)
      const next = {}
      rows.forEach((r) => {
        const k = r.getString(parentField)
        next[k] = (next[k] || 0) + 1
        app
          .db()
          .newQuery('UPDATE ' + photoColl + ' SET position = {:p} WHERE id = {:i}')
          .bind({ p: next[k], i: r.id })
          .execute()
      })
    }
    fill('property_photos', 'property_id')
    fill('condominium_photos', 'condominium_id')

    // regras: só depois de os campos existirem (regras com :isset exigem o campo já salvo)
    const noPos = ' && @request.body.position:isset = false'
    const noCover = ' && @request.body.cover_photo_id:isset = false'
    photos.updateRule = photos.updateRule + noPos
    app.save(photos)
    cphotos.updateRule = cphotos.updateRule + noPos
    app.save(cphotos)
    props.updateRule = props.updateRule + noCover
    app.save(props)
    condos.updateRule = condos.updateRule + noCover
    app.save(condos)
  },
  (app) => {
    const strip = (col, text) => {
      col.updateRule = String(col.updateRule || '')
        .split(text)
        .join('')
      app.save(col)
    }
    const photos = app.findCollectionByNameOrId('property_photos')
    const cphotos = app.findCollectionByNameOrId('condominium_photos')
    const props = app.findCollectionByNameOrId('properties')
    const condos = app.findCollectionByNameOrId('condominiums')
    strip(photos, ' && @request.body.position:isset = false')
    strip(cphotos, ' && @request.body.position:isset = false')
    strip(props, ' && @request.body.cover_photo_id:isset = false')
    strip(condos, ' && @request.body.cover_photo_id:isset = false')
    props.fields.removeByName('cover_photo_id')
    app.save(props)
    condos.fields.removeByName('cover_photo_id')
    app.save(condos)
    photos.fields.removeByName('position')
    app.save(photos)
    cphotos.fields.removeByName('position')
    app.save(cphotos)
  },
)
