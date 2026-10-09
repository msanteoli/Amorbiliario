// M11 — Sincroniza visitas com a Google Agenda dos corretores (único arquivo que escreve eventos no Google).
// A cada minuto: até 20 visitas com google_sync = 'pendente' (mais antigas primeiro) e até 20 eventos órfãos
// (audit_log 'google_evento_orfao' sem o sufixo '|ok'). Sem os segredos IMOB_GOOGLE_* e IMOB_APP_URL não faz nada.
// Decisão: confirmada e futura -> cria/atualiza; cancelada, agendada ou pendente_agenda com evento -> apaga;
// realizada, nao_compareceu ou confirmada já passada -> o evento fica (histórico), sem chamar o Google.
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

  // decisão só a partir dos registros:
  //  'upsert' = confirmada e futura; 'delete' = cancelada / agendada / pendente_agenda com evento;
  //  'keep'   = realizada, nao_compareceu ou confirmada já passada: o evento fica (histórico) -> sincronizada se há
  //             evento, senão nao_aplicavel; 'none' = nada a manter -> nao_aplicavel
  const decide = (v, now) => {
    const status = v.getString('status')
    const start = pbToIso(v.getString('start_at'))
    const hasEvent = !!v.getString('google_event_id')
    if (status === 'confirmada' && start && start.getTime() > now.getTime()) return 'upsert'
    if (['cancelada', 'agendada', 'pendente_agenda'].indexOf(status) >= 0)
      return hasEvent ? 'delete' : 'none'
    return hasEvent ? 'keep' : 'none'
  }
  const snapOf = (v) =>
    [
      v.getString('status'),
      v.getString('start_at'),
      v.getString('end_at'),
      v.getString('broker_id'),
    ].join('|')
  // grava SÓ os campos de sincronização num registro relido. Se a visita mudou desde a decisão (ou não está mais
  // pendente), não grava o resultado — fica para a próxima rodada —, mas registra google_event_id, para que um evento
  // criado/apagado continue rastreado. Nunca salva a cópia antiga da visita.
  const writeOutcome = (id, snap, f) => {
    let cur = null
    try {
      cur = $app.findRecordById('visits', id)
    } catch (_) {
      return
    }
    const fresh = snapOf(cur) === snap && cur.getString('google_sync') === 'pendente'
    if (!fresh && !Object.prototype.hasOwnProperty.call(f, 'google_event_id')) return
    if (Object.prototype.hasOwnProperty.call(f, 'google_event_id'))
      cur.set('google_event_id', f.google_event_id)
    if (fresh) {
      if (Object.prototype.hasOwnProperty.call(f, 'google_sync'))
        cur.set('google_sync', f.google_sync)
      if (Object.prototype.hasOwnProperty.call(f, 'google_sync_attempts')) {
        cur.set('google_sync_attempts', f.google_sync_attempts)
      }
    }
    $app.save(cur)
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
  const t0 = Date.now()
  const BUDGET_MS = 40000 // depois de ~40 s não pega visita nova (a rodada seguinte continua)
  // corretor com conexão 'reconectar': as visitas dele esperam pendentes, sem mudar nada, e não contam no limite
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
  const processVisit = (id) => {
    let v = $app.findRecordById('visits', id)
    if (v.getString('google_sync') !== 'pendente') return false // outra execução já tratou
    const action = decide(v, new Date())
    if (action === 'none' || action === 'keep') {
      v.set('google_sync', action === 'keep' ? 'sincronizada' : 'nao_aplicavel')
      v.set('google_sync_attempts', 0)
      $app.save(v)
      return false
    }
    const broker = v.getString('broker_id')
    if (isWaiting(broker)) return false
    const c = connFor(broker)
    if (!c && isWaiting(broker)) return false // acabou de virar 'reconectar' (cifra inválida)
    if (!c) {
      // sem conexão utilizável do corretor da visita (o evento antigo, se houver, sai pelo desconectar ou pelo órfão)
      v.set('google_sync', 'nao_aplicavel')
      v.set('google_sync_attempts', 0)
      $app.save(v)
      return true
    }
    // trava: relê, conta a tentativa e salva antes de chamar o Google (só google_sync_attempts muda)
    v = $app.findRecordById('visits', id)
    if (v.getString('google_sync') !== 'pendente') return false
    const attempts = v.getInt('google_sync_attempts') + 1
    v.set('google_sync_attempts', attempts)
    $app.save(v)
    const snap = snapOf(v)
    const now = new Date()
    const act = decide(v, now)
    if (act !== 'upsert' && act !== 'delete') return true // mudou entre as leituras: a próxima rodada decide

    const evId = act === 'upsert' ? eventIdFor(v.id) : v.getString('google_event_id')
    const res = act === 'upsert' ? upsertEvent(c, evId, eventBody(v)) : deleteEvent(c, evId)
    if (res.ok) {
      if (act === 'upsert') {
        writeOutcome(id, snap, {
          google_event_id: evId,
          google_sync: 'sincronizada',
          google_sync_attempts: 0,
        })
      } else
        writeOutcome(id, snap, {
          google_event_id: '',
          google_sync: 'nao_aplicavel',
          google_sync_attempts: 0,
        })
      return true
    }
    if (res.invalid) {
      // conexão marcada 'reconectar': a visita fica pendente e só volta quando o corretor reconectar
      writeOutcome(id, snap, { google_sync_attempts: 0 })
      return true
    }
    if (attempts >= MAX_ATTEMPTS) {
      writeOutcome(id, snap, { google_sync: 'falhou' })
      audit(v.getString('organization_id'), 'google_sync_falhou', String(res.code || 0), v.id)
    }
    return true
  }
  // pagina as pendentes (mais antigas primeiro) até tratar 20 que exigem o Google ou acabar o tempo
  let handled = 0
  for (let page = 0; page < 10 && handled < 20 && Date.now() - t0 < BUDGET_MS; page++) {
    let rows = []
    try {
      rows = $app.findRecordsByFilter(
        'visits',
        "google_sync = 'pendente'",
        'updated',
        100,
        page * 100,
      )
    } catch (_) {}
    for (let i = 0; i < rows.length && handled < 20 && Date.now() - t0 < BUDGET_MS; i++) {
      try {
        if (processVisit(rows[i].id)) handled++
      } catch (_) {
        $app.logger().error('google_sync_visit_failed', 'visit', rows[i].id)
      }
    }
    if (rows.length < 100) break
  }

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
    if (Date.now() - t0 >= BUDGET_MS) return
    try {
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
      // a visita voltou para o mesmo corretor com o mesmo evento (A -> B -> A): o evento não é órfão
      let inUse = 0
      try {
        inUse = $app.findRecordsByFilter(
          'visits',
          'broker_id = {:b} && google_event_id = {:e}',
          '',
          1,
          0,
          {
            b: reason.slice(0, bar),
            e: evId,
          },
        ).length
      } catch (_) {}
      if (inUse > 0) return done()
      const r = deleteEvent(c, evId)
      // sucesso, conexão inválida ou erro definitivo (4xx que não melhora) encerram; 429/5xx/rede tentam de novo
      if (r.ok || r.invalid || (r.code >= 400 && r.code < 500 && r.code !== 401 && r.code !== 429))
        done()
    } catch (_) {
      $app.logger().error('google_sync_orphan_failed', 'audit', o.id)
    }
  })
})
