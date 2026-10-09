// M11 — Conclui a conexão com o Google. O Google devolve o navegador para a tela IMOB_APP_URL/google/retorno,
// que chama este endpoint com {code, state} usando o login do próprio usuário.
// Ordem: papel (403) -> segredos (503) -> state assinado, não vencido e do MESMO usuário logado (400, nada gravado)
// -> nonce gravado em audit_log numa transação, com índice único (repetido = 400, sem chamar o Google)
// -> troca do código, token cifrado, conexão, visitas pendentes, auditoria. Nunca devolve nem registra token.
routerAdd(
  'POST',
  '/backend/v1/google/finish',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'corretor'].indexOf(role) < 0) {
      throw new ForbiddenError('Só o corretor e o admin conectam a agenda do Google.')
    }
    const clientId = String($secrets.get('IMOB_GOOGLE_CLIENT_ID') || '')
    const clientSecret = String($secrets.get('IMOB_GOOGLE_CLIENT_SECRET') || '')
    const key = String($secrets.get('IMOB_GOOGLE_TOKEN_KEY') || '')
    let appUrl = String($secrets.get('IMOB_APP_URL') || '')
    if (!clientId || !clientSecret || key.length !== 32 || !appUrl) {
      return e.json(503, { message: 'Integração com o Google ainda não configurada.' })
    }
    while (appUrl.endsWith('/')) appUrl = appUrl.slice(0, -1)
    const redirectUri = appUrl + '/google/retorno'
    const bad = { message: 'Pedido de conexão inválido ou vencido. Tente conectar de novo.' }
    const fail = { message: 'Não foi possível conectar a agenda do Google. Tente de novo.' }

    const body = e.requestInfo().body || {}
    const state = String(body.state || '')
    const code = String(body.code || '')
    const dot = state.indexOf('.')
    if (!state || dot < 1 || state.length > 600) return e.json(400, bad)
    const payload = state.slice(0, dot)
    const sig = state.slice(dot + 1)
    const expected = String($security.hs256(payload, key))
    let diff = sig.length === expected.length ? 0 : 1 // comparação em tempo constante
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
    if (Date.now() > data.e || data.u !== actor.id || data.n.length < 8) return e.json(400, bad)
    if (!code || code.length > 2000) return e.json(400, bad)
    const orgId = String(actor.get('organization_id') || '')

    const audit = (action, reason) => {
      try {
        const a = new Record($app.findCollectionByNameOrId('audit_log'))
        a.set('organization_id', orgId)
        a.set('actor_id', actor.id)
        a.set('actor_role', role)
        a.set('action', action)
        a.set('collection_name', 'google_connections')
        if (reason) a.set('reason', reason)
        a.set('occurred_at', new Date().toISOString())
        $app.save(a)
      } catch (_) {
        $app.logger().error('google_finish_audit_failed', 'action', action)
      }
    }
    // nonce de uso único: falha ao gravar (índice único) = state já usado
    try {
      $app.runInTransaction((tx) => {
        const a = new Record(tx.findCollectionByNameOrId('audit_log'))
        a.set('organization_id', orgId)
        a.set('actor_id', actor.id)
        a.set('actor_role', role)
        a.set('action', 'google_state_usado')
        a.set('collection_name', 'google_connections')
        a.set('reason', data.n)
        a.set('occurred_at', new Date().toISOString())
        tx.save(a)
      })
    } catch (_) {
      return e.json(400, bad)
    }

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
      if (res.statusCode !== 200) {
        $app
          .logger()
          .warn('google_finish_failed', 'why', 'troca_' + res.statusCode, 'user', actor.id)
        return e.json(502, fail)
      }
      tok = res.json
    } catch (_) {
      $app.logger().warn('google_finish_failed', 'why', 'troca_transporte', 'user', actor.id)
      return e.json(502, fail)
    }
    const refresh = String((tok && tok.refresh_token) || '')
    const access = String((tok && tok.access_token) || '')
    const scope = String((tok && tok.scope) || '')
    if (
      !refresh ||
      !access ||
      scope.split(' ').indexOf('https://www.googleapis.com/auth/calendar.events') < 0
    ) {
      $app.logger().warn('google_finish_failed', 'why', 'sem_refresh_ou_escopo', 'user', actor.id)
      return e.json(400, { message: 'Autorize o acesso à agenda para conectar.' })
    }

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
        conn = $app.findFirstRecordByFilter('google_connections', 'user_id = {:u}', { u: actor.id })
      } catch (_) {}
      if (!conn) {
        conn = new Record($app.findCollectionByNameOrId('google_connections'))
        conn.set('user_id', actor.id)
      }
      conn.set('organization_id', orgId)
      conn.set('refresh_token_enc', $security.encrypt(refresh, key))
      conn.set('google_email', email)
      conn.set('status', 'conectado')
      conn.set('connected_at', now.toISOString())
      conn.set('last_error', '')
      $app.save(conn)
    } catch (_) {
      $app.logger().error('google_finish_failed', 'why', 'gravar_conexao', 'user', actor.id)
      return e.json(500, fail)
    }

    try {
      const list = $app.findRecordsByFilter(
        'visits',
        "broker_id = {:u} && status = 'confirmada' && start_at > {:now} && (google_sync = '' || google_sync = 'nao_aplicavel')",
        'start_at',
        200,
        0,
        { u: actor.id, now: now.toISOString().replace('T', ' ') },
      )
      list.forEach((v) => {
        v.set('google_sync', 'pendente')
        v.set('google_sync_attempts', 0)
        $app.save(v)
      })
    } catch (_) {
      $app.logger().error('google_finish_mark_pending_failed', 'user', actor.id)
    }
    audit('google_conectado', '')
    return e.json(200, { status: 'conectado', google_email: email })
  },
  $apis.requireAuth(),
)
