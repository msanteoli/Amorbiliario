// M11 — Sincroniza visitas com a Google Agenda dos corretores (único arquivo que escreve eventos no Google).
// A cada minuto: até 20 visitas com google_sync = 'pendente' (mais antigas primeiro) e até 20 eventos órfãos
// (audit_log 'google_evento_orfao' sem o sufixo '|ok'). Sem os segredos IMOB_GOOGLE_* e IMOB_APP_URL não faz nada.
// Organização: (1) decide o que fazer com cada visita olhando só os registros (decide); (2) um bloco delimitado faz
// as chamadas HTTP (tokenFor / callEvent); (3) aplica o resultado. Nunca grava token nem corpo de resposta.
// Regras goja: tudo declarado dentro do callback; $app, nunca app.
cronAdd('google_calendar_sync', '* * * * *', () => {
  const clientId = String($secrets.get('IMOB_GOOGLE_CLIENT_ID') || '')
  const clientSecret = String($secrets.get('IMOB_GOOGLE_CLIENT_SECRET') || '')
  const key = String($secrets.get('IMOB_GOOGLE_TOKEN_KEY') || '')
  let appUrl = String($secrets.get('IMOB_APP_URL') || '')
  if (!clientId || !clientSecret || key.length !== 32 || !appUrl) return
  while (appUrl.endsWith('/')) appUrl = appUrl.slice(0, -1)

  const MAX_ATTEMPTS = 5
  const EVENTS = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

  const audit = (orgId, action, reason, recordId) => {
    try {
      const a = new Record($app.findCollectionByNameOrId('audit_log'))
      a.set('organization_id', orgId)
      a.set('actor_role', 'sistema')
      a.set('action', action)
      a.set('collection_name', 'visits')
      if (recordId) a.set('record_id', recordId)
      if (reason) a.set('reason', reason)
      a.set('occurred_at', new Date().toISOString())
      $app.save(a)
    } catch (_) {
      $app.logger().error('google_sync_audit_failed', 'action', action)
    }
  }

  // id do evento: o Google aceita só base32hex (0-9 e a-v), 5 a 1024 chars. O id do PocketBase usa a-z (w-z são
  // inválidos), então vai em hexadecimal: 'imob' + hex(id) — 'i','m','o','b' e 0-9a-f estão todos no alfabeto.
  const eventIdFor = (visitId) => {
    let h = ''
    for (let i = 0; i < visitId.length; i++)
      h += ('0' + visitId.charCodeAt(i).toString(16)).slice(-2)
    return 'imob' + h
  }
  const pbToIso = (s) => {
    const d = new Date(String(s || '').replace(' ', 'T'))
    return isNaN(d.getTime()) ? null : d
  }

  // conexão utilizável = status 'conectado' + cifra com formato válido (decrypt de texto curto derruba o processo)
  const connCache = {}
  const waiting = {} // user_id -> true quando a conexão está (ou ficou) 'reconectar'
  const connFor = (userId) => {
    if (!userId) return null
    if (Object.prototype.hasOwnProperty.call(connCache, userId)) return connCache[userId]
    let conn = null
    try {
      conn = $app.findFirstRecordByFilter(
        'google_connections',
        "user_id = {:u} && status = 'conectado'",
        { u: userId },
      )
    } catch (_) {}
    if (conn) {
      const enc = conn.getString('refresh_token_enc')
      if (!(enc.length >= 40 && /^[A-Za-z0-9+/=_-]+$/.test(enc))) {
        conn.set('status', 'reconectar')
        conn.set('last_error', 'token_invalido')
        waiting[userId] = true
        try {
          $app.save(conn)
        } catch (_) {}
        conn = null
      }
    }
    connCache[userId] = conn ? { rec: conn, access: '' } : null
    return connCache[userId]
  }
  const markReconnect = (c, why) => {
    c.rec.set('status', 'reconectar')
    c.rec.set('last_error', why)
    try {
      $app.save(c.rec)
    } catch (_) {}
    connCache[c.rec.getString('user_id')] = null
    waiting[c.rec.getString('user_id')] = true
  }

  // ---------- bloco HTTP (único trecho que fala com o Google) ----------
  // devolve {ok:true} com c.access preenchido, ou {invalid:true} (invalid_grant / token indecifrável), ou {code}
  const tokenFor = (c, fresh) => {
    if (c.access && !fresh) return { ok: true }
    let refresh = ''
    try {
      refresh = String($security.decrypt(c.rec.getString('refresh_token_enc'), key) || '')
    } catch (_) {}
    if (!refresh) {
      markReconnect(c, 'token_invalido')
      return { invalid: true }
    }
    try {
      const r = $http.send({
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
      if (r.statusCode === 200 && r.json && r.json.access_token) {
        c.access = String(r.json.access_token)
        return { ok: true }
      }
      if (r.json && r.json.error === 'invalid_grant') {
        markReconnect(c, 'invalid_grant')
        return { invalid: true }
      }
      return { code: r.statusCode || 0 }
    } catch (_) {
      return { code: 0 }
    }
  }
  // chamada a /events com uma nova tentativa (token novo) em 401. Devolve {status} ou {invalid} ou {code}
  const callEvent = (c, method, path, body) => {
    for (let round = 0; round < 2; round++) {
      const t = tokenFor(c, round > 0)
      if (!t.ok) return t
      let r = null
      try {
        const req = {
          url: EVENTS + path,
          method: method,
          headers: { Authorization: 'Bearer ' + c.access },
          timeout: 15,
        }
        if (body) {
          req.headers['Content-Type'] = 'application/json'
          req.body = JSON.stringify(body)
        }
        r = $http.send(req)
      } catch (_) {
        return { code: 0 }
      }
      if (r.statusCode === 401 && round === 0) continue
      return { status: r.statusCode }
    }
    return { code: 401 }
  }
  const deleteEvent = (c, evId) => {
    const r = callEvent(c, 'DELETE', '/' + encodeURIComponent(evId), null)
    if (r.status === 200 || r.status === 204 || r.status === 404 || r.status === 410)
      return { ok: true }
    return r.invalid ? r : { code: r.status || r.code || 0 }
  }
  const upsertEvent = (c, evId, body) => {
    const r = callEvent(c, 'POST', '', Object.assign({ id: evId }, body))
    if (r.status === 200) return { ok: true }
    if (r.status === 409) {
      const u = callEvent(c, 'PUT', '/' + encodeURIComponent(evId), body)
      if (u.status === 200) return { ok: true }
      return u.invalid ? u : { code: u.status || u.code || 0 }
    }
    return r.invalid ? r : { code: r.status || r.code || 0 }
  }
  // ---------- fim do bloco HTTP ----------

  // decisão só a partir dos registros: 'upsert' | 'delete' | 'none' (nada a manter no Google)
  const decide = (v, now) => {
    const status = v.getString('status')
    const start = pbToIso(v.getString('start_at'))
    if (status === 'confirmada' && start && start.getTime() > now.getTime()) return 'upsert'
    if (v.getString('google_event_id')) return 'delete'
    return 'none'
  }
  const eventBody = (v) => {
    const start = pbToIso(v.getString('start_at'))
    let end = pbToIso(v.getString('end_at'))
    if (!end || end.getTime() <= start.getTime()) end = new Date(start.getTime() + 3600 * 1000)
    let code = ''
    let address = ''
    let leadName = ''
    try {
      const p = $app.findRecordById('properties', v.getString('property_id'))
      code = p.getString('code')
      const street = [p.getString('street'), p.getString('street_number')]
        .filter((x) => x)
        .join(', ')
      address = [
        street,
        p.getString('complement'),
        p.getString('neighborhood'),
        p.getString('city'),
      ]
        .filter((x) => x)
        .join(' - ')
    } catch (_) {}
    try {
      if (v.getString('lead_id'))
        leadName = $app.findRecordById('leads', v.getString('lead_id')).getString('name')
    } catch (_) {}
    return {
      summary: 'Visita — ' + (code || 'imóvel') + ' — ' + (leadName || 'cliente'),
      location: address,
      description:
        'Abrir no sistema: ' +
        appUrl +
        '/agenda\n\nAlterações feitas aqui no Google não voltam para o sistema.',
      start: { dateTime: start.toISOString(), timeZone: 'America/Bahia' },
      end: { dateTime: end.toISOString(), timeZone: 'America/Bahia' },
      reminders: { useDefault: true },
      status: 'confirmed', // reativa o evento se a visita foi cancelada e reconfirmada (o id é o mesmo)
    }
  }

  // ---------- visitas pendentes ----------
  let rows = []
  try {
    rows = $app.findRecordsByFilter('visits', "google_sync = 'pendente'", 'updated', 200, 0)
  } catch (_) {}
  // corretor com conexão 'reconectar': as visitas dele esperam pendentes (não contam no limite de 20 por rodada)
  const isWaiting = (userId) => {
    if (!userId) return false
    if (!Object.prototype.hasOwnProperty.call(waiting, userId)) {
      let n = 0
      try {
        n = $app.findRecordsByFilter(
          'google_connections',
          "user_id = {:u} && status = 'reconectar'",
          '',
          1,
          0,
          {
            u: userId,
          },
        ).length
      } catch (_) {}
      waiting[userId] = n > 0
    }
    return waiting[userId]
  }
  let handled = 0
  rows.forEach((row) => {
    if (handled >= 20) return
    let v = null
    try {
      v = $app.findRecordById('visits', row.id)
    } catch (_) {
      return
    }
    if (v.getString('google_sync') !== 'pendente') return // outra execução já tratou
    const now = new Date()
    const action = decide(v, now)
    const orgId = v.getString('organization_id')
    if (action === 'none') {
      v.set('google_sync', 'nao_aplicavel')
      v.set('google_sync_attempts', 0)
      $app.save(v)
      return
    }
    if (isWaiting(v.getString('broker_id'))) return
    handled++
    const c = connFor(v.getString('broker_id'))
    if (!c && isWaiting(v.getString('broker_id'))) return // acabou de virar 'reconectar' (cifra inválida)
    if (!c) {
      // sem conexão utilizável do corretor da visita: nada a fazer no Google por ela
      // (o evento antigo, se houver, sai pelo desconectar ou pelo órfão)
      v.set('google_sync', 'nao_aplicavel')
      v.set('google_sync_attempts', 0)
      $app.save(v)
      return
    }
    // trava: conta a tentativa antes de chamar o Google
    const attempts = v.getInt('google_sync_attempts') + 1
    v.set('google_sync_attempts', attempts)
    $app.save(v)

    let res = null
    const evId = action === 'upsert' ? eventIdFor(v.id) : v.getString('google_event_id')
    if (action === 'upsert') res = upsertEvent(c, evId, eventBody(v))
    else res = deleteEvent(c, evId)

    if (res.ok) {
      if (action === 'upsert') {
        v.set('google_event_id', evId)
        v.set('google_sync', 'sincronizada')
      } else {
        v.set('google_event_id', '')
        v.set('google_sync', 'nao_aplicavel')
      }
      v.set('google_sync_attempts', 0)
      $app.save(v)
      return
    }
    if (res.invalid) {
      // conexão marcada 'reconectar': a visita fica pendente e só volta quando o corretor reconectar
      v.set('google_sync_attempts', 0)
      $app.save(v)
      return
    }
    if (attempts >= MAX_ATTEMPTS) {
      v.set('google_sync', 'falhou')
      $app.save(v)
      audit(orgId, 'google_sync_falhou', String(res.code || 0), v.id)
    }
  })

  // ---------- eventos órfãos (troca de corretor): reason = '<corretor antigo>|<id do evento>' ----------
  let orphans = []
  try {
    orphans = $app.findRecordsByFilter(
      'audit_log',
      "action = 'google_evento_orfao' && reason !~ '|ok'",
      'created',
      20,
      0,
    )
  } catch (_) {}
  orphans.forEach((o) => {
    const reason = o.getString('reason')
    const bar = reason.indexOf('|')
    const done = () => {
      o.set('reason', reason + '|ok')
      try {
        $app.save(o)
      } catch (_) {}
    }
    if (bar < 1) return done()
    const evId = reason.slice(bar + 1)
    const c = connFor(reason.slice(0, bar))
    if (!c || !evId) return done() // corretor antigo sem conexão utilizável: nada a apagar
    const r = deleteEvent(c, evId)
    // sucesso, conexão inválida ou erro definitivo (4xx que não melhora) encerram; 429/5xx/rede tentam de novo
    if (r.ok || r.invalid || (r.code >= 400 && r.code < 500 && r.code !== 401 && r.code !== 429))
      done()
  })
})
