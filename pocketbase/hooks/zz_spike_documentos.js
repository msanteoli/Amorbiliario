// SPIKE DESCARTÁVEL (M14, T0, cópia de arquivo). Será removido logo após o teste.
routerAdd('GET', '/backend/v1/zz-spike-copia/{pid}', (e) => {
  const actor = e.auth
  if (actor.get('active') !== true || String(actor.get('role')) !== 'admin') {
    throw new ForbiddenError('spike: só admin')
  }
  const pid = e.request.pathValue('pid')
  const out = {}
  let src = null
  try {
    const rows = $app.findRecordsByFilter('property_photos', 'property_id = {:p}', '', 1, 0, {
      p: pid,
    })
    src = rows.length ? rows[0] : null
  } catch (err) {
    out.busca_erro = String((err && err.message) || err)
  }
  if (!src) return e.json(200, Object.assign(out, { origem: 'sem foto de origem' }))
  const nomes = src.getStringSlice('file')
  out.origem_nome = nomes.length
  const caminho = src.baseFilesPath() + '/' + nomes[0]
  out.caminho_ok = caminho.length > 0
  // 1) ler os bytes do arquivo de origem
  let bytes = null
  const fs = $app.newFilesystem()
  try {
    const f = fs.getFile(caminho)
    out.ler_getFile = 'ok'
    bytes = f && (f.bytes || f.content || null)
  } catch (err) {
    out.ler_getFile_erro = String((err && err.message) || err)
  }
  if (!bytes) {
    try {
      const r = fs.getReader(caminho)
      out.ler_getReader = 'ok'
      bytes = r.readAll ? r.readAll() : null
      out.ler_readAll = bytes ? 'ok' : 'sem readAll'
    } catch (err) {
      out.ler_getReader_erro = String((err && err.message) || err)
    }
  }
  out.bytes_obtidos = bytes ? 'sim' : 'não'
  // 2) criar um arquivo a partir dos bytes e gravar um registro novo com ele, na mesma transação
  let copia = null
  try {
    $app.runInTransaction((tx) => {
      const novo = new Record(tx.findCollectionByNameOrId('property_photos'))
      novo.set('organization_id', src.getString('organization_id'))
      novo.set('property_id', pid)
      novo.set('file', $filesystem.fileFromBytes(bytes, 'copia-spike.jpg'))
      tx.save(novo)
      copia = novo.id
    })
    out.copia_gravada = copia ? 'sim' : 'não'
  } catch (err) {
    out.copia_erro = String((err && err.message) || err)
  }
  // 3) limpa a cópia de teste
  if (copia) {
    try {
      $app.delete($app.findRecordById('property_photos', copia))
      out.copia_removida = 'sim'
    } catch (err) {
      out.limpeza_erro = String((err && err.message) || err)
    }
  }
  return e.json(200, out)
})
