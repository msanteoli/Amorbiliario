// SPIKE DESCARTÁVEL (M14, T0, cópia de arquivo, rodada 2). Será removido logo após o teste.
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
  const nomes = src.getStringSlice('file')
  const caminho = src.baseFilesPath() + '/' + nomes[0]
  out.caminho = caminho
  const fs = $app.newFilesystem()
  const f = fs.getFile(caminho)
  out.getFile_tipo = typeof f
  out.getFile_chaves = Object.keys(f || {}).join(',')
  const r = fs.getReader(caminho)
  out.getReader_tipo = typeof r
  out.getReader_chaves = Object.keys(r || {}).join(',')
  out.getReader_metodos = ['read', 'readAll', 'bytes', 'close', 'seek']
    .filter((m) => typeof r[m] === 'function')
    .join(',')
  // laço de leitura manual
  try {
    const chunks = []
    let total = 0
    for (let i = 0; i < 2000; i++) {
      const buf = new Uint8Array(8192)
      const n = r.read(buf)
      if (!n || n <= 0) break
      chunks.push(buf.slice(0, n))
      total += n
    }
    out.laço_bytes = total
  } catch (err) {
    out.laço_erro = String((err && err.message) || err)
  }
  return e.json(200, out)
})
