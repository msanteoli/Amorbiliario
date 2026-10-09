// M11 — Desconectar a agenda do Google (idempotente: sem conexão responde 200).
// Remove da agenda do usuário os eventos futuros que o sistema criou (máx. 50; 404/410 contam como removidos),
// limpa google_event_id e volta as visitas futuras do corretor a google_sync = 'nao_aplicavel', revoga o token
// (falha ignorada) e apaga o registro de google_connections. O que não foi removido entra em audit_log só como contagem.
// Funciona sem os segredos: sem eles (ou sem conseguir renovar o acesso), os eventos contam como não removidos.
routerAdd(
  'POST',
  '/backend/v1/google/disconnect',
  (e) => {
    const actor = e.auth
    let conn = null
    try {
      conn = $app.findFirstRecordByFilter('google_connections', 'user_id = {:u}', { u: actor.id })
    } catch (_) {}
    if (!conn) return e.json(200, { status: 'nao_conectado' })

    const orgId = String(actor.get('organization_id') || conn.getString('organization_id'))
    const clientId = String($secrets.get('IMOB_GOOGLE_CLIENT_ID') || '')
    const clientSecret = String($secrets.get('IMOB_GOOGLE_CLIENT_SECRET') || '')
    const key = String($secrets.get('IMOB_GOOGLE_TOKEN_KEY') || '')
    const now = new Date()

    // token de renovação (só decifra texto com cara de cifra: decrypt com entrada curta derruba a requisição)
    let refresh = ''
    const enc = conn.getString('refresh_token_enc')
    if (key.length === 32 && enc.length >= 40 && /^[A-Za-z0-9+/=_-]+$/.test(enc)) {
      try {
        refresh = String($security.decrypt(enc, key) || '')
      } catch (_) {}
    }
    let access = ''
    if (refresh && clientId && clientSecret) {
      try {
        const res = $http.send({
          url: 'https://oauth2.googleapis.com/token',
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body:
            'grant_type=refresh_token&refresh_token=' +
            encodeURIComponent(refresh) +
            '&client_id=' +
            encodeURIComponent(clientId) +
            '&client_secret=' +
            encodeURIComponent(clientSecret),
          timeout: 15,
        })
        if (res.statusCode === 200 && res.json && res.json.access_token)
          access = String(res.json.access_token)
      } catch (_) {}
    }

    let notRemoved = 0
    try {
      const visits = $app.findRecordsByFilter(
        'visits',
        "broker_id = {:u} && start_at > {:now} && (google_event_id != '' || (google_sync != '' && google_sync != 'nao_aplicavel'))",
        'start_at',
        50,
        0,
        { u: actor.id, now: now.toISOString().replace('T', ' ') },
      )
      visits.forEach((v) => {
        const evId = v.getString('google_event_id')
        if (evId) {
          let ok = false
          if (access) {
            try {
              const res = $http.send({
                url:
                  'https://www.googleapis.com/calendar/v3/calendars/primary/events/' +
                  encodeURIComponent(evId),
                method: 'DELETE',
                headers: { Authorization: 'Bearer ' + access },
                timeout: 15,
              })
              ok =
                res.statusCode === 200 ||
                res.statusCode === 204 ||
                res.statusCode === 404 ||
                res.statusCode === 410
            } catch (_) {}
          }
          if (!ok) notRemoved++
        }
        v.set('google_event_id', '')
        v.set('google_sync', 'nao_aplicavel')
        v.set('google_sync_attempts', 0)
        $app.save(v)
      })
    } catch (err) {
      $app.logger().error('google_disconnect_events_failed', 'user', actor.id)
    }

    if (refresh) {
      try {
        $http.send({
          url: 'https://oauth2.googleapis.com/revoke',
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'token=' + encodeURIComponent(refresh),
          timeout: 10,
        })
      } catch (_) {}
    }

    $app.delete(conn)

    const audit = (action, reason) => {
      try {
        const a = new Record($app.findCollectionByNameOrId('audit_log'))
        a.set('organization_id', orgId)
        a.set('actor_id', actor.id)
        a.set('actor_role', String(actor.get('role') || ''))
        a.set('action', action)
        a.set('collection_name', 'google_connections')
        if (reason) a.set('reason', reason)
        a.set('occurred_at', now.toISOString())
        $app.save(a)
      } catch (_) {
        $app.logger().error('google_disconnect_audit_failed', 'action', action)
      }
    }
    audit('google_desconectado', '')
    if (notRemoved > 0) audit('google_eventos_nao_removidos', String(notRemoved))
    return e.json(200, { status: 'nao_conectado' })
  },
  $apis.requireAuth(),
)
