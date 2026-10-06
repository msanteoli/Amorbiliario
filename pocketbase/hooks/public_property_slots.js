// Horários livres de visita de um imóvel Disponível, para os próximos 14 dias, no horário da
// Bahia (UTC-3, sem horário de verão). Sem login. Um horário não aparece se estiver segurado por
// uma visita (pedido com corretor, visita agendada ou pedido sem corretor há menos de 12 horas).
routerAdd('GET', '/backend/v1/public/properties/{code}/slots', (e) => {
  // admin logado (testes automatizados) não é limitado; visitantes anônimos são
  const isAdmin =
    !!e.auth && e.auth.get('active') === true && String(e.auth.get('role') || '') === 'admin'
  if (!isAdmin) {
    const ip = e.realIP()
    const win = Math.floor(Date.now() / 60000)
    const key = 'thr:slots:' + ip + ':' + win
    const n = Number($app.store().get(key) || 0) + 1
    $app.store().set(key, n)
    $app.store().remove('thr:slots:' + ip + ':' + (win - 1))
    if (n > 120)
      throw new TooManyRequestsError('Muitas tentativas. Aguarde um minuto e tente de novo.')
  }

  const slug = String(e.request.url.query().get('org') || '')
  const orgs = slug
    ? $app.findRecordsByFilter('organizations', 'slug = {:s}', '', 1, 0, { s: slug })
    : $app.findRecordsByFilter('organizations', "id != ''", 'created', 2, 0)
  if (!orgs.length) throw new NotFoundError('Imobiliária não encontrada.')
  if (!slug && orgs.length > 1) throw new BadRequestError('Informe a imobiliária.')
  const org = orgs[0]

  const code = String(e.request.pathValue('code') || '')
    .trim()
    .slice(0, 40)
  const prows = code
    ? $app.findRecordsByFilter(
        'properties',
        "organization_id = {:o} && code = {:c} && status = 'disponivel'",
        '',
        1,
        0,
        { o: org.id, c: code },
      )
    : []
  if (!prows.length) throw new NotFoundError('Imóvel não encontrado.')
  const property = prows[0]

  const OFFSET = 3 * 3600000
  const nowMs = Date.now()
  const minStart = nowMs + 3 * 3600000
  const maxStart = nowMs + 14 * 86400000
  const toMin = (s) => {
    const m = /^([01][0-9]|2[0-3]):([0-5][0-9])$/.exec(String(s || ''))
    return m ? Number(m[1]) * 60 + Number(m[2]) : -1
  }
  const msOf = (rec, k) => new Date(rec.getString(k).replace(' ', 'T')).getTime()

  // todos os horários possíveis dentro das janelas
  const wins = $app.findRecordsByFilter(
    'property_visit_slots',
    'property_id = {:p} && is_active = true',
    '',
    200,
    0,
    {
      p: property.id,
    },
  )
  const local = new Date(nowMs - OFFSET)
  const y = local.getUTCFullYear()
  const mo = local.getUTCMonth()
  const d = local.getUTCDate()
  const all = []
  for (let off = 0; off <= 15; off++) {
    const dayStart = Date.UTC(y, mo, d + off)
    const wd = new Date(dayStart).getUTCDay()
    wins.forEach((w) => {
      if (Number(w.get('weekday') || 0) !== wd) return
      const st = toMin(w.getString('start_time'))
      const en = toMin(w.getString('end_time'))
      const du = Number(w.get('duration_minutes') || 0)
      if (st < 0 || en < 0 || du < 15) return
      for (let t = st; t + du <= en; t += du) {
        const startMs = dayStart + t * 60000 + OFFSET
        if (startMs >= minStart && startMs <= maxStart)
          all.push({ s: startMs, e: startMs + du * 60000 })
      }
    })
  }
  all.sort((a, b) => a.s - b.s)

  // horários segurados por visitas
  const holds = $app.findRecordsByFilter(
    'visits',
    "property_id = {:p} && slot_key != '' && end_at >= {:from}",
    '',
    1000,
    0,
    { p: property.id, from: new Date(nowMs).toISOString().replace('T', ' ') },
  )
  const held = []
  holds.forEach((v) => {
    const expired =
      v.getString('status') === 'pendente_agenda' &&
      v.getString('broker_id') === '' &&
      nowMs - msOf(v, 'requested_at') > 12 * 3600000
    if (expired) return
    held.push({ s: msOf(v, 'start_at'), e: msOf(v, 'end_at') })
  })
  const free = all.filter((c) => !held.some((h) => c.s < h.e && h.s < c.e))

  return e.json(200, {
    slots: free.map((c) => ({
      start: new Date(c.s).toISOString(),
      end: new Date(c.e).toISOString(),
    })),
    timezone: 'America/Bahia',
    min_notice_hours: 3,
    window_days: 14,
  })
})
