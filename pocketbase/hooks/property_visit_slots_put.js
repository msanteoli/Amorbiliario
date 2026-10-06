// Define a disponibilidade de visita de um imóvel. Só admin, SDR e o captador do imóvel.
// Substitui o conjunto de janelas: o que não vier é desativado (nada é apagado). Cada janela
// vale por dia da semana (0 = domingo ... 6 = sábado), no horário da Bahia.
routerAdd(
  'PUT',
  '/backend/v1/properties/{id}/visit-slots',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    const orgId = String(actor.get('organization_id') || '')
    const nowIso = new Date().toISOString()
    const audit = (action, recordId, reason) => {
      try {
        const rec = new Record($app.findCollectionByNameOrId('audit_log'))
        rec.set('organization_id', orgId)
        rec.set('actor_id', actor.id)
        rec.set('actor_role', role)
        rec.set('action', action)
        rec.set('collection_name', 'property_visit_slots')
        rec.set('record_id', recordId)
        rec.set('reason', reason)
        rec.set('occurred_at', nowIso)
        $app.save(rec)
      } catch (err) {
        $app.logger().error('visit_slots_audit_failed', 'err', String((err && err.message) || err))
      }
    }

    if (actor.get('active') !== true || ['admin', 'sdr', 'corretor'].indexOf(role) < 0) {
      audit('acesso_negado', '', 'papel_sem_permissao')
      throw new ForbiddenError('Papel sem acesso a estes dados.')
    }
    let property = null
    try {
      property = $app.findRecordById('properties', e.request.pathValue('id'))
    } catch (_) {}
    if (!property || property.get('organization_id') !== orgId)
      throw new NotFoundError('Imóvel não encontrado.')
    if (role === 'corretor' && property.getString('captured_by') !== actor.id) {
      audit('acesso_negado', property.id, 'corretor_nao_captou')
      throw new ForbiddenError('Só o captador, o SDR e o admin editam a disponibilidade.')
    }

    const body = e.requestInfo().body || {}
    const list = Array.isArray(body.windows) ? body.windows : null
    if (!list) throw new BadRequestError('Informe a lista de janelas.')
    if (list.length > 21) throw new BadRequestError('Informe no máximo 21 janelas.')

    const toMin = (s) => {
      const m = /^([01][0-9]|2[0-3]):([0-5][0-9])$/.exec(String(s || ''))
      return m ? Number(m[1]) * 60 + Number(m[2]) : -1
    }
    const wins = []
    list.forEach((w) => {
      const wd = Number(w && w.weekday)
      const st = toMin(w && w.start)
      const en = toMin(w && w.end)
      const du = Number(w && w.duration)
      if (!Number.isInteger(wd) || wd < 0 || wd > 6)
        throw new BadRequestError('Dia da semana inválido.')
      if (st < 0 || en < 0) throw new BadRequestError('Horário inválido. Use HH:MM.')
      if (en <= st) throw new BadRequestError('O horário final precisa ser depois do inicial.')
      if (!Number.isInteger(du) || du < 15 || du > 240) {
        throw new BadRequestError('A duração da visita vai de 15 a 240 minutos.')
      }
      if (en - st < du) throw new BadRequestError('A janela precisa comportar ao menos uma visita.')
      wins.push({
        weekday: wd,
        start: String(w.start),
        end: String(w.end),
        duration: du,
        s: st,
        e: en,
      })
    })
    // janelas do mesmo dia não podem se sobrepor
    const byDay = {}
    wins.forEach((w) => {
      if (!byDay[w.weekday]) byDay[w.weekday] = []
      byDay[w.weekday].push(w)
    })
    Object.keys(byDay).forEach((d) => {
      const arr = byDay[d].sort((a, b) => a.s - b.s)
      for (let i = 1; i < arr.length; i++) {
        if (arr[i].s < arr[i - 1].e)
          throw new BadRequestError('Há janelas que se sobrepõem no mesmo dia.')
      }
    })

    const keyOf = (wd, st, en, du) => [wd, st, en, du].join('|')
    const wanted = {}
    wins.forEach((w) => {
      wanted[keyOf(w.weekday, w.start, w.end, w.duration)] = w
    })
    const existing = $app.findRecordsByFilter(
      'property_visit_slots',
      'property_id = {:p}',
      '',
      500,
      0,
      {
        p: property.id,
      },
    )
    let changes = 0
    existing.forEach((r) => {
      const k = keyOf(
        Number(r.get('weekday') || 0),
        r.getString('start_time'),
        r.getString('end_time'),
        Number(r.get('duration_minutes') || 0),
      )
      const active = r.get('is_active') === true
      if (wanted[k]) {
        if (!active) {
          r.set('is_active', true)
          $app.save(r)
          changes++
        }
        delete wanted[k]
      } else if (active) {
        r.set('is_active', false)
        $app.save(r)
        changes++
      }
    })
    Object.keys(wanted).forEach((k) => {
      const w = wanted[k]
      const rec = new Record($app.findCollectionByNameOrId('property_visit_slots'))
      rec.set('organization_id', orgId)
      rec.set('property_id', property.id)
      rec.set('weekday', w.weekday)
      rec.set('start_time', w.start)
      rec.set('end_time', w.end)
      rec.set('duration_minutes', w.duration)
      rec.set('is_active', true)
      $app.save(rec)
      changes++
    })

    if (changes > 0) audit('visit_slots_changed', property.id, 'janelas=' + wins.length)
    return e.json(200, { changed: changes > 0, windows: wins.length })
  },
  $apis.requireAuth(),
)
