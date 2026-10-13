// SPIKE DESCARTÁVEL (M14, T0, cópia de arquivo, rodada 3). Será removido logo após o teste.
routerAdd('GET', '/backend/v1/zz-spike-copia/{pid}', (e) => {
  const actor = e.auth
  if (actor.get('active') !== true || String(actor.get('role')) !== 'admin') {
    throw new ForbiddenError('spike: só admin')
  }
  const pid = e.request.pathValue('pid')
  const out = {}
  const rows = $app.findRecordsByFilter('property_photos', 'property_id = {:p}', '', 1, 0, {
    p: pid,
  })
  if (!rows.length) return e.json(200, { origem: 'sem foto' })
  const src = rows[0]
  const caminho = src.baseFilesPath() + '/' + src.getStringSlice('file')[0]
  const fs = $app.newFilesystem()
  const r = fs.getReader(caminho)
  out.tamanho = r.size
  const parts = []
  let total = 0
  for (let i = 0; i < 5000; i++) {
    const buf = new Uint8Array(8192)
    let n = 0
    try {
      n = r.read(buf)
    } catch (err) {
      out.fim = String((err && err.message) || err)
      break
    }
    if (!n || n <= 0) break
    parts.push(buf.slice(0, n))
    total += n
  }
  out.lidos = total
  // junta os pedaços num único array de bytes
  const bytes = new Uint8Array(total)
  let off = 0
  parts.forEach((p) => {
    bytes.set(p, off)
    off += p.length
  })
  out.bytes_montados = bytes.length
  // cria um registro novo com esses bytes, na mesma transação, e depois remove
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
