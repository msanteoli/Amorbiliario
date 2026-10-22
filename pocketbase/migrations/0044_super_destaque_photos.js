// Super-destaque, Fase A (spec docs/superpowers/specs/2026-10-21-super-destaque-design.md): três campos em property_photos.
//   is_starred        : estrela de "manter" (até 20 por imóvel; só pelo endpoint /properties/{id}/photos/stars)
//   auto_archived     : a foto foi arquivada pelo sistema na saída do super-destaque (só estas reativam sozinhas)
//   archived_position : a posição que a foto tinha ao ser arquivada, para voltar na mesma ordem
// As regras de edição passam a PROIBIR gravar os três direto pela coleção (mesmo padrão de position, migration 0041).
migrate(
  (app) => {
    const photos = app.findCollectionByNameOrId('property_photos')
    photos.fields.add(new BoolField({ name: 'is_starred' }))
    photos.fields.add(new BoolField({ name: 'auto_archived' }))
    photos.fields.add(new NumberField({ name: 'archived_position', onlyInt: true, min: 0 }))
    app.save(photos)
    // regras: só depois de os campos existirem (regras com :isset exigem o campo já salvo)
    photos.updateRule =
      photos.updateRule +
      ' && @request.body.is_starred:isset = false && @request.body.auto_archived:isset = false && @request.body.archived_position:isset = false'
    app.save(photos)
  },
  (app) => {
    const photos = app.findCollectionByNameOrId('property_photos')
    photos.updateRule = String(photos.updateRule || '')
      .split(
        ' && @request.body.is_starred:isset = false && @request.body.auto_archived:isset = false && @request.body.archived_position:isset = false',
      )
      .join('')
    app.save(photos)
    photos.fields.removeByName('is_starred')
    photos.fields.removeByName('auto_archived')
    photos.fields.removeByName('archived_position')
    app.save(photos)
  },
)
