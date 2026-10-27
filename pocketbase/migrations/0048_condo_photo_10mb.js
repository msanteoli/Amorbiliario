// M33: foto de condomínio aceita arquivo de até 10 MB (antes 8 MB, migration 0014).
// Só muda o tamanho máximo do campo `file`; os formatos (JPEG, PNG, WebP) e as regras de acesso continuam os mesmos.
// O limite de 30 fotos ativas por condomínio fica nos hooks condominium_photos_write_create/update (não aqui).
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('condominium_photos')
    const file = col.fields.getByName('file')
    file.maxSize = 10485760
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('condominium_photos')
    const file = col.fields.getByName('file')
    file.maxSize = 8388608
    app.save(col)
  },
)
