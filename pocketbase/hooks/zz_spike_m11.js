// SPIKE descartável (M11 T4): só confirma o que o goja oferece. Será removido.
routerAdd('GET', '/backend/v1/zz-spike-m11', (e) => {
  const s = String(e.request.url.query().get('s') || '0')
  if (s === '0') return e.json(200, { ok: 'vivo' })
  const k = 'abcdefghijklmnopqrstuvwxyz012345'
  if (s === '1') {
    const c = $security.encrypt('ola-mundo', k)
    const d = $security.decrypt(c, k)
    return e.json(200, {
      encType: typeof c,
      encLen: String(c).length,
      decType: typeof d,
      decOk: d === 'ola-mundo',
    })
  }
  if (s === '2') {
    let r = 'nao lançou'
    try {
      $security.decrypt('lixo', k)
    } catch (_) {
      r = 'lançou'
    }
    return e.json(200, { decBad: r })
  }
  if (s === '3') {
    const h = $security.hs256('abc', k)
    return e.json(200, { hsType: typeof h, hsLen: String(h).length })
  }
  if (s === '4') {
    const r = $security.randomString(16)
    return e.json(200, { t: typeof r, l: String(r).length })
  }
  if (s === '5')
    return e.json(200, { btoa: typeof btoa, atob: typeof atob, td: typeof TextDecoder })
  if (s === '6') {
    const b = btoa('{"a":1}')
    return e.json(200, { b: b, u: atob(b) })
  }
  if (s === '7') {
    const res = $http.send({
      url: 'https://oauth2.googleapis.com/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=x',
      timeout: 10,
    })
    return e.json(200, {
      st: res.statusCode,
      jt: typeof res.json,
      err: String((res.json && res.json.error) || ''),
    })
  }
  if (s === '8') return e.redirect(302, 'https://example.com/x?google=ok')
  if (s === '9')
    return e.json(200, {
      has: $secrets.has('IMOB_GOOGLE_CLIENT_ID'),
      len0: $secrets.get('IMOB_NAO_EXISTE') === '',
    })
  return e.json(200, {})
})
