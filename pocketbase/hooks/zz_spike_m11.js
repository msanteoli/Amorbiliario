// SPIKE descartável (M11 T4): só confirma o que o goja oferece. Será removido.
routerAdd('GET', '/backend/v1/zz-spike-m11', (e) => {
  const s = String(e.request.url.query().get('s') || '0')
  if (s === '0') return e.json(200, { ok: 'vivo' })
  const k = 'abcdefghijklmnopqrstuvwxyz012345'
  if (s === '10') {
    const c = $security.encrypt('ola', k)
    let r = 'nao lançou'
    let v = ''
    try {
      v = $security.decrypt(c, 'ZZZdefghijklmnopqrstuvwxyz012345')
    } catch (_) {
      r = 'lançou'
    }
    return e.json(200, {
      r: r,
      vLen: String(v).length,
      sample: c.slice(0, 4),
      hex: /^[0-9a-f]+$/.test($security.hs256('a', k)),
    })
  }
  if (s === '11') {
    let r = 'nao lançou'
    try {
      $security.decrypt('bGl4b2xpeG9saXhvbGl4b2xpeG9saXhvbGl4bw==', k)
    } catch (_) {
      r = 'lançou'
    }
    return e.json(200, { r: r })
  }
  return e.json(200, {})
})
