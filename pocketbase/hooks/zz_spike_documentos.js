// SPIKE DESCARTÁVEL (M14, T0). Será apagado logo após o teste. Não é código de produto.
// Testa: (1) hash e geração aleatória, (2) cifra/decifra de texto longo, (3) leitura de um arquivo existente.
routerAdd('GET', '/backend/v1/zz-spike-documentos', (e) => {
  const actor = e.auth
  if (actor.get('active') !== true || String(actor.get('role')) !== 'admin') {
    throw new ForbiddenError('spike: só admin')
  }
  const out = {}
  // 1) aleatório e hash
  try {
    const code = $security.randomStringWithAlphabet(
      48,
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    )
    out.random_len = String(code).length
    out.hash_sha256 =
      typeof $security.sha256 === 'function' ? String($security.sha256(code)).length : 'SEM sha256'
    out.hash_md5 = typeof $security.md5 === 'function' ? 'ok' : 'SEM md5'
  } catch (err) {
    out.random_erro = String((err && err.message) || err)
  }
  // 2) cifra de texto longo (CPF+RG em JSON, ~200 chars)
  try {
    const key = $secrets.get('IMOB_GOOGLE_TOKEN_KEY')
    const plain = JSON.stringify({
      cpf: '12345678901',
      rg: '1234567',
      nome: 'ZZ TESTE Spike',
      pad: 'x'.repeat(120),
    })
    const enc = $security.encrypt(plain, key)
    const dec = $security.decrypt(enc, key)
    out.cifra_ok = dec === plain
    out.cifra_len = String(enc).length
  } catch (err) {
    out.cifra_erro = String((err && err.message) || err)
  }
  // 3) arquivo existente: lê o nome e o tamanho do primeiro arquivo de property_photos
  try {
    const rows = $app.findRecordsByFilter('property_photos', '', '', 1, 0, {})
    if (rows.length) {
      const f = rows[0].getStringSlice('file')
      out.foto_nome = f.length ? 'existe' : 'sem arquivo'
      const fs = $app.newFilesystem()
      const key2 = 'properties/' + rows[0].getString('property_id') + '/' + f[0]
      out.fs_tem = fs.exists(rows[0].baseFilesPath() + '/' + f[0])
    } else {
      out.foto_nome = 'sem fotos na base'
    }
  } catch (err) {
    out.arquivo_erro = String((err && err.message) || err)
  }
  return e.json(200, out)
})
