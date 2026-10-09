// SPIKE descartável (M11 T4): só confirma o que o goja oferece. Será removido.
routerAdd(
  'GET',
  '/backend/v1/zz-spike-m11',
  (e) => {
    if (e.auth.getString('role') !== 'admin') throw new ForbiddenError('x')
    const out = {}
    const k = 'abcdefghijklmnopqrstuvwxyz012345'
    try {
      const c = $security.encrypt('ola-mundo', k)
      out.encType = typeof c
      out.encLen = String(c).length
      const d = $security.decrypt(c, k)
      out.decType = typeof d
      out.decOk = d === 'ola-mundo'
      out.decStr = String(d) === 'ola-mundo'
    } catch (err) {
      out.encErr = String(err)
    }
    try {
      $security.decrypt('lixo', k)
      out.decBad = 'nao lançou'
    } catch (err) {
      out.decBad = 'lançou'
    }
    try {
      const h = $security.hs256('abc', k)
      out.hsType = typeof h
      out.hsLen = String(h).length
    } catch (err) {
      out.hsErr = String(err)
    }
    try {
      const r = $security.randomString(16)
      out.rnd = typeof r + ':' + String(r).length
    } catch (err) {
      out.rndErr = String(err)
    }
    out.btoa = typeof btoa
    out.atob = typeof atob
    out.textDecoder = typeof TextDecoder
    try {
      out.b64 = btoa('{"a":1}')
      out.unb64 = atob(out.b64)
    } catch (err) {
      out.b64Err = String(err)
    }
    out.httpSend = typeof $http.send
    out.redirect = typeof e.redirect
    out.secretsHas = typeof $secrets.has
    try {
      const res = $http.send({
        url: 'https://oauth2.googleapis.com/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=x',
        timeout: 10,
      })
      out.httpStatus = res.statusCode
      out.jsonType = typeof res.json
      out.jsonErrKey = res.json && res.json.error
    } catch (err) {
      out.httpErr = String(err)
    }
    if (e.request.url.query().get('r') === '1')
      return e.redirect(302, 'https://example.com/x?google=ok')
    return e.json(200, out)
  },
  $apis.requireAuth(),
)
