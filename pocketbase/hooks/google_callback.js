// M11 — Retorno do Google (público: o usuário chega pelo navegador vindo do Google).
// Ordem das validações: (1) segredos IMOB_GOOGLE_* ausentes -> 503 JSON, nada é lido nem gravado;
// (2) state ausente, malformado, com assinatura errada, vencido, de usuário inexistente/inativo/sem papel,
// ou nonce já usado -> 400 JSON, sem gravar nada; (3) a partir daqui o nonce é gravado como usado
// (audit_log 'google_state_usado') e qualquer falha com o Google redireciona para IMOB_APP_URL/hoje?google=erro
// (sem repassar o corpo do erro); sucesso -> /hoje?google=ok. Nenhum token vai para log, auditoria ou resposta.
routerAdd('GET', '/backend/v1/google/callback', (e) => {
  const clientId = String($secrets.get('IMOB_GOOGLE_CLIENT_ID') || '')
  const clientSecret = String($secrets.get('IMOB_GOOGLE_CLIENT_SECRET') || '')
  const key = String($secrets.get('IMOB_GOOGLE_TOKEN_KEY') || '')
  let appUrl = String($secrets.get('IMOB_APP_URL') || '')
  if (!clientId || !clientSecret || key.length !== 32 || !appUrl) {
    return e.json(503, { message: 'Integração com o Google ainda não configurada.' })
  }
  while (appUrl.endsWith('/')) appUrl = appUrl.slice(0, -1)
  const redirectUri =
    'https://imobdigital-1ceec.shrd00.internal.goskip.dev/backend/v1/google/callback'
  const bad = { message: 'Pedido de conexão inválido ou vencido. Tente conectar de novo.' }

  const q = e.request.url.query()
  const state = String(q.get('state') || '')
  const dot = state.indexOf('.')
  if (!state || dot < 1 || state.length > 600) return e.json(400, bad)
  const payload = state.slice(0, dot)
  const sig = state.slice(dot + 1)
  const expected = String($security.hs256(payload, key))
  // comparação em tempo constante
  let diff = sig.length === expected.length ? 0 : 1
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ (i < sig.length ? sig.charCodeAt(i) : 0)
  }
  if (diff !== 0) return e.json(400, bad)
  let data = null
  try {
    data = JSON.parse(atob(payload))
  } catch (_) {}
  if (
    !data ||
    typeof data.u !== 'string' ||
    typeof data.n !== 'string' ||
    typeof data.e !== 'number'
  ) {
    return e.json(400, bad)
  }
  if (Date.now() > data.e) return e.json(400, bad)
  let user = null
  try {
    user = $app.findRecordById('users', data.u)
  } catch (_) {}
  if (
    !user ||
    user.get('active') !== true ||
    ['admin', 'corretor'].indexOf(user.getString('role')) < 0
  ) {
    return e.json(400, bad)
  }
  const orgId = user.getString('organization_id')
  let used = null
  try {
    used = $app.findFirstRecordByFilter(
      'audit_log',
      "action = 'google_state_usado' && reason = {:n}",
      { n: data.n },
    )
  } catch (_) {}
  if (used) return e.json(400, bad)

  const audit = (action, reason) => {
    try {
      const a = new Record($app.findCollectionByNameOrId('audit_log'))
      a.set('organization_id', orgId)
      a.set('actor_id', user.id)
      a.set('actor_role', user.getString('role'))
      a.set('action', action)
      a.set('collection_name', 'google_connections')
      if (reason) a.set('reason', reason)
      a.set('occurred_at', new Date().toISOString())
      $app.save(a)
    } catch (err) {
      $app.logger().error('google_callback_audit_failed', 'action', action)
    }
  }
  audit('google_state_usado', data.n)

  const fail = (why) => {
    $app.logger().warn('google_callback_failed', 'why', why, 'user', user.id)
    return e.redirect(302, appUrl + '/hoje?google=erro')
  }
  const code = String(q.get('code') || '')
  if (!code || q.get('error')) return fail('sem_codigo')

  let tok = null
  try {
    const res = $http.send({
      url: 'https://oauth2.googleapis.com/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:
        'grant_type=authorization_code&code=' +
        encodeURIComponent(code) +
        '&client_id=' +
        encodeURIComponent(clientId) +
        '&client_secret=' +
        encodeURIComponent(clientSecret) +
        '&redirect_uri=' +
        encodeURIComponent(redirectUri),
      timeout: 15,
    })
    if (res.statusCode !== 200) return fail('troca_' + res.statusCode)
    tok = res.json
  } catch (_) {
    return fail('troca_transporte')
  }
  const refresh = String((tok && tok.refresh_token) || '')
  const access = String((tok && tok.access_token) || '')
  const scope = String((tok && tok.scope) || '')
  if (!refresh || !access) return fail('sem_refresh_token')
  if (scope.split(' ').indexOf('https://www.googleapis.com/auth/calendar.events') < 0)
    return fail('escopo')

  let email = ''
  try {
    const res = $http.send({
      url: 'https://www.googleapis.com/calendar/v3/calendars/primary',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + access },
      timeout: 15,
    })
    if (res.statusCode === 200 && res.json && typeof res.json.id === 'string')
      email = res.json.id.slice(0, 200)
  } catch (_) {}

  const now = new Date()
  try {
    let conn = null
    try {
      conn = $app.findFirstRecordByFilter('google_connections', 'user_id = {:u}', { u: user.id })
    } catch (_) {}
    if (!conn) {
      conn = new Record($app.findCollectionByNameOrId('google_connections'))
      conn.set('user_id', user.id)
    }
    conn.set('organization_id', orgId)
    conn.set('refresh_token_enc', $security.encrypt(refresh, key))
    conn.set('google_email', email)
    conn.set('status', 'conectado')
    conn.set('connected_at', now.toISOString())
    conn.set('last_error', '')
    $app.save(conn)
  } catch (_) {
    return fail('gravar_conexao')
  }

  try {
    const list = $app.findRecordsByFilter(
      'visits',
      "broker_id = {:u} && status = 'confirmada' && start_at > {:now} && (google_sync = '' || google_sync = 'nao_aplicavel')",
      'start_at',
      200,
      0,
      { u: user.id, now: now.toISOString().replace('T', ' ') },
    )
    list.forEach((v) => {
      v.set('google_sync', 'pendente')
      v.set('google_sync_attempts', 0)
      $app.save(v)
    })
  } catch (err) {
    $app.logger().error('google_callback_mark_pending_failed', 'user', user.id)
  }
  audit('google_conectado', '')
  return e.redirect(302, appUrl + '/hoje?google=ok')
})
