// Painel "Hoje" de cada papel. As consultas filtram por papel aqui no servidor (o corretor só
// recebe o que é dele). "Hoje" é o dia em America/Bahia (UTC-3 fixo) e a semana vai de segunda
// a domingo nesse fuso. Cada seção lê no máximo 500 registros e devolve até 20 itens; "more"
// avisa quando o teto foi atingido.
routerAdd(
  'GET',
  '/backend/v1/today',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'sdr', 'corretor'].indexOf(role) < 0) {
      throw new ForbiddenError('Papel sem acesso a estes dados.')
    }
    const orgId = String(actor.get('organization_id') || '')

    // Novo Painel (spec 2026-10-22-painel-agenda-e-indicadores): período dos indicadores. Sem o parâmetro, vale a semana.
    const periodKey = String(e.request.url.query().get('period') || 'semana')
    if (periodKey !== 'semana' && periodKey !== 'mes')
      throw new BadRequestError('Período inválido. Use semana ou mes.')

    const now = new Date()
    const fmt = (d) => d.toISOString().replace('T', ' ')
    const bahia = new Date(now.getTime() - 3 * 3600000)
    const dayStart = new Date(
      Date.UTC(bahia.getUTCFullYear(), bahia.getUTCMonth(), bahia.getUTCDate(), 3),
    )
    const dayEnd = new Date(dayStart.getTime() + 86400000)
    const dow = (bahia.getUTCDay() + 6) % 7
    const weekStart = new Date(dayStart.getTime() - dow * 86400000)
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400000)
    const cut24 = new Date(now.getTime() - 24 * 3600000)
    const cut7d = new Date(now.getTime() - 7 * 86400000)
    const CAP = 500
    const LIMIT = 20

    const nameCache = {}
    const nameOf = (coll, id) => {
      if (!id) return ''
      const k = coll + ':' + id
      if (nameCache[k] === undefined) {
        try {
          const r = $app.findRecordById(coll, id)
          nameCache[k] = coll === 'properties' ? r.getString('code') : r.getString('name')
        } catch (_) {
          nameCache[k] = ''
        }
      }
      return nameCache[k]
    }

    const find = (coll, filter, sort, params) =>
      $app.findRecordsByFilter(
        coll,
        'organization_id = {:o} && (' + filter + ')',
        sort,
        CAP,
        0,
        Object.assign({ o: orgId }, params || {}),
      )
    const section = (rows, map) => ({
      count: rows.length,
      more: rows.length >= CAP,
      items: rows.slice(0, LIMIT).map(map),
    })
    const leadItem = (r) => ({
      id: r.id,
      name: r.getString('name'),
      origin: r.getString('origin'),
      stage: r.getString('stage'),
      assigned_to: r.getString('assigned_to'),
      next_step: r.getString('next_step'),
      next_step_due: r.getString('next_step_due'),
      created: r.getString('created'),
      // lead do site sem corretor há mais de 1 hora (prazo de atendimento do fluxo M14)
      overdue:
        r.getString('origin') === 'site' &&
        r.getString('assigned_to') === '' &&
        Date.now() - new Date(r.getString('created').replace(' ', 'T')).getTime() > 3600000,
    })
    const visitItem = (r) => ({
      id: r.id,
      status: r.getString('status'),
      start_at: r.getString('start_at'),
      end_at: r.getString('end_at'),
      broker_id: r.getString('broker_id'),
      broker_name: nameOf('users', r.getString('broker_id')),
      property_id: r.getString('property_id'),
      property_code: nameOf('properties', r.getString('property_id')),
      lead_id: r.getString('lead_id'),
      client_id: r.getString('client_id'),
      person_name: r.getString('lead_id')
        ? nameOf('leads', r.getString('lead_id'))
        : nameOf('clients', r.getString('client_id')),
    })
    const taskItem = (r) => ({
      id: r.id,
      title: r.getString('title'),
      due_at: r.getString('due_at'),
      assigned_to: r.getString('assigned_to'),
      assigned_name: nameOf('users', r.getString('assigned_to')),
      lead_id: r.getString('lead_id'),
      client_id: r.getString('client_id'),
      property_id: r.getString('property_id'),
    })
    const propertyItem = (r) => ({
      id: r.id,
      code: r.getString('code'),
      title: r.getString('title'),
      status: r.getString('status'),
      last_reviewed_at: r.getString('last_reviewed_at'),
    })

    const open = 'stage != "ganho" && stage != "perdido"'
    const active = '(status = "agendada" || status = "confirmada")'
    const sections = {}

    if (role === 'sdr') {
      sections.new_unassigned_leads = section(
        find('leads', 'stage = "novo" && assigned_to = ""', '-created'),
        leadItem,
      )
      sections.dedupe_pending = section(
        find('leads', 'dedupe_status = "pendente"', '-created'),
        leadItem,
      )
      sections.overdue_next_steps = section(
        find('leads', 'next_step_due != "" && next_step_due < {:now} && ' + open, 'next_step_due', {
          now: fmt(now),
        }),
        leadItem,
      )
      sections.pending_visits = section(
        find('visits', 'status = "pendente_agenda"', 'created'),
        visitItem,
      )
      sections.my_tasks_due = section(
        find(
          'tasks',
          'assigned_to = {:u} && status = "aberta" && due_at != "" && due_at < {:end}',
          'due_at',
          {
            u: actor.id,
            end: fmt(dayEnd),
          },
        ),
        taskItem,
      )
      sections.visits_today = section(
        find('visits', active + ' && start_at >= {:a} && start_at < {:b}', 'start_at', {
          a: fmt(dayStart),
          b: fmt(dayEnd),
        }),
        visitItem,
      )
    } else if (role === 'corretor') {
      sections.visits_today = section(
        find(
          'visits',
          'broker_id = {:u} && ' + active + ' && start_at >= {:a} && start_at < {:b}',
          'start_at',
          {
            u: actor.id,
            a: fmt(dayStart),
            b: fmt(dayEnd),
          },
        ),
        visitItem,
      )
      sections.visits_to_confirm = section(
        find(
          'visits',
          'broker_id = {:u} && status = "agendada" && start_at >= {:now}',
          'start_at',
          {
            u: actor.id,
            now: fmt(now),
          },
        ),
        visitItem,
      )
      sections.my_tasks_due = section(
        find(
          'tasks',
          'assigned_to = {:u} && status = "aberta" && due_at != "" && due_at < {:end}',
          'due_at',
          {
            u: actor.id,
            end: fmt(dayEnd),
          },
        ),
        taskItem,
      )
      sections.overdue_next_steps = section(
        find(
          'leads',
          'assigned_to = {:u} && next_step_due != "" && next_step_due < {:now} && ' + open,
          'next_step_due',
          {
            u: actor.id,
            now: fmt(now),
          },
        ),
        leadItem,
      )
    } else {
      const stages = ['novo', 'em_atendimento', 'visita_marcada', 'proposta', 'ganho', 'perdido']
      const byStage = stages.map((s) => ({
        stage: s,
        count: find('leads', 'stage = {:s}', '', { s: s }).length,
      }))
      sections.leads_by_stage = {
        count: byStage.reduce((sum, x) => sum + x.count, 0),
        more: byStage.some((x) => x.count >= CAP),
        items: byStage,
      }
      sections.visits_week = section(
        find('visits', active + ' && start_at >= {:a} && start_at < {:b}', 'start_at', {
          a: fmt(weekStart),
          b: fmt(weekEnd),
        }),
        visitItem,
      )
      sections.stalled_leads = section(
        find('leads', 'stage = "novo" && assigned_to = "" && created < {:cut}', 'created', {
          cut: fmt(cut24),
        }),
        leadItem,
      )
      sections.properties_pending_review = section(
        find(
          'properties',
          '(status = "rascunho" || status = "disponivel" || status = "reservado") && (last_reviewed_at = "" || last_reviewed_at < {:cut})',
          'last_reviewed_at',
          { cut: fmt(cut7d) },
        ),
        propertyItem,
      )
      sections.overdue_tasks = section(
        find('tasks', 'status = "aberta" && due_at != "" && due_at < {:now}', 'due_at', {
          now: fmt(now),
        }),
        taskItem,
      )
    }
    // ---- Novo Painel: agenda do dia e indicadores (a resposta antiga, em `sections`, não muda) ----
    const DAY = 86400000
    const nowMs = now.getTime()
    const ts = (v) => {
      const x = String(v || '')
      return x ? new Date(x.replace(' ', 'T')).getTime() : 0
    }
    const iso = (ms) => fmt(new Date(ms))

    // agenda do dia: tarefas, atendimentos (próximos passos de leads), visitas e bloqueios; atrasados primeiro, depois por horário
    const agenda = []
    const addAgenda = (kind, id, title, at, extra) => {
      agenda.push(
        Object.assign(
          {
            kind: kind,
            id: id,
            title: title,
            at: at || '',
            overdue: (kind === 'tarefa' || kind === 'atendimento') && !!at && ts(at) < nowMs,
          },
          extra || {},
        ),
      )
    }
    try {
      find(
        'tasks',
        'assigned_to = {:u} && status = "aberta" && due_at != "" && due_at < {:end}',
        'due_at',
        {
          u: actor.id,
          end: fmt(dayEnd),
        },
      )
        .slice(0, 60)
        .forEach((r) =>
          addAgenda('tarefa', r.id, r.getString('title'), r.getString('due_at'), {
            lead_id: r.getString('lead_id'),
            property_id: r.getString('property_id'),
            pendencia: r.getString('description').indexOf('pend:') === 0,
          }),
        )
    } catch (_) {}
    try {
      const nf =
        (role === 'sdr' ? '' : 'assigned_to = {:u} && ') +
        'next_step_due != "" && next_step_due < {:end} && ' +
        open
      find('leads', nf, 'next_step_due', { u: actor.id, end: fmt(dayEnd) })
        .slice(0, 60)
        .forEach((r) =>
          addAgenda(
            'atendimento',
            r.id,
            (r.getString('next_step') ? r.getString('next_step') + ' · ' : '') +
              r.getString('name'),
            r.getString('next_step_due'),
            { lead_id: r.id },
          ),
        )
    } catch (_) {}
    try {
      const vf =
        (role === 'corretor' ? 'broker_id = {:u} && ' : '') +
        active +
        ' && start_at >= {:a} && start_at < {:b}'
      find('visits', vf, 'start_at', { u: actor.id, a: fmt(dayStart), b: fmt(dayEnd) })
        .slice(0, 60)
        .forEach((r) => {
          const v = visitItem(r)
          addAgenda(
            'visita',
            r.id,
            'Visita · ' + v.property_code + (v.person_name ? ' · ' + v.person_name : ''),
            v.start_at,
            {
              status: v.status,
              property_code: v.property_code,
              lead_id: v.lead_id,
            },
          )
        })
    } catch (_) {}
    try {
      find(
        'agenda_blocks',
        'user_id = {:u} && ended_at = "" && end_at > {:a} && start_at < {:b}',
        'start_at',
        {
          u: actor.id,
          a: fmt(dayStart),
          b: fmt(dayEnd),
        },
      ).forEach((r) =>
        addAgenda(
          'bloqueio',
          r.id,
          'Bloqueio de agenda' + (r.getString('reason') ? ' · ' + r.getString('reason') : ''),
          r.getString('start_at'),
          {
            end_at: r.getString('end_at'),
          },
        ),
      )
    } catch (_) {}
    agenda.sort((x, y) => {
      if (x.overdue !== y.overdue) return x.overdue ? -1 : 1
      const tx = x.at ? ts(x.at) : Infinity
      const ty = y.at ? ts(y.at) : Infinity
      return tx === ty ? 0 : tx < ty ? -1 : 1
    })

    // indicadores da função, no período escolhido (semana de segunda a domingo ou mês do calendário, fuso Bahia)
    let indicators = null
    try {
      let pStart = weekStart
      let pEnd = weekEnd
      let prevStart = new Date(weekStart.getTime() - 7 * DAY)
      let prevEnd = weekStart
      if (periodKey === 'mes') {
        const y = bahia.getUTCFullYear()
        const m = bahia.getUTCMonth()
        pStart = new Date(Date.UTC(y, m, 1, 3))
        pEnd = new Date(Date.UTC(y, m + 1, 1, 3))
        prevStart = new Date(Date.UTC(y, m - 1, 1, 3))
        prevEnd = pStart
      }
      const buckets = []
      if (periodKey === 'semana') {
        const names = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']
        for (let i = 0; i < 7; i++)
          buckets.push({
            label: names[i],
            a: pStart.getTime() + i * DAY,
            b: pStart.getTime() + (i + 1) * DAY,
          })
      } else {
        let i = 0
        for (let t = pStart.getTime(); t < pEnd.getTime(); t += 7 * DAY) {
          i++
          buckets.push({ label: 'S' + i, a: t, b: Math.min(t + 7 * DAY, pEnd.getTime()) })
        }
      }
      const chartOf = (rows, field) => ({
        labels: buckets.map((bk) => bk.label),
        values: buckets.map(
          (bk) =>
            rows.filter((r) => ts(r.getString(field)) >= bk.a && ts(r.getString(field)) < bk.b)
              .length,
        ),
      })
      const between = (coll, field, extra, from, to, u) =>
        find(
          coll,
          (extra ? extra + ' && ' : '') + field + ' >= {:a} && ' + field + ' < {:b}',
          field,
          {
            u: actor.id,
            a: iso(from.getTime()),
            b: iso(to.getTime()),
          },
        )
      const sumValue = (rows) =>
        rows.reduce((sum, r) => sum + Number(r.get('agreed_value') || 0), 0)
      const pct = (num, den) => (den ? Math.round((100 * num) / den) : 0)
      const items = []
      let chart = { labels: [], values: [] }

      if (role === 'sdr') {
        const openLeads = find('leads', open, '-created')
        const stale = openLeads.filter((r) => {
          const last = ts(r.getString('last_contact_at')) || ts(r.getString('created'))
          return nowMs - last > 2 * DAY && !(ts(r.getString('next_step_due')) > nowMs)
        }).length
        const cur = between('leads', 'created', '', pStart, pEnd)
        const prev = between('leads', 'created', '', prevStart, prevEnd)
        const avgFirst = (rows) => {
          const xs = rows
            .filter((r) => r.getString('first_contact_at'))
            .map((r) => (ts(r.getString('first_contact_at')) - ts(r.getString('created'))) / 60000)
            .filter((x) => x >= 0)
          return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null
        }
        const handed = (rows) =>
          rows.length
            ? pct(rows.filter((r) => r.getString('assigned_to')).length, rows.length)
            : null
        items.push({
          key: 'leads_sem_followup',
          label: 'Leads sem follow-up',
          value: stale,
          unit: 'leads',
        })
        items.push({
          key: 'tempo_primeiro_atendimento',
          label: 'Tempo para o primeiro atendimento',
          value: avgFirst(cur) || 0,
          unit: 'min',
          previous: avgFirst(prev),
          no_data: avgFirst(cur) === null,
        })
        items.push({
          key: 'pct_repassados',
          label: 'Leads repassados ao corretor',
          value: handed(cur) || 0,
          unit: '%',
          previous: handed(prev),
          no_data: handed(cur) === null,
        })
        chart = chartOf(cur, 'created')
      } else if (role === 'corretor') {
        const cur = between(
          'visits',
          'start_at',
          'broker_id = {:u} && status != "cancelada"',
          pStart,
          pEnd,
        )
        const prev = between(
          'visits',
          'start_at',
          'broker_id = {:u} && status != "cancelada"',
          prevStart,
          prevEnd,
        )
        const done = (rows) => rows.filter((r) => r.getString('status') === 'realizada').length
        const negoOpen = find(
          'negotiations',
          'responsible_id = {:u} && (status = "em_analise" || status = "aprovada")',
          '-created',
        ).length
        const opened = between(
          'negotiations',
          'created',
          'responsible_id = {:u}',
          pStart,
          pEnd,
        ).length
        const closed = between(
          'negotiations',
          'closed_at',
          'responsible_id = {:u} && status = "fechada"',
          pStart,
          pEnd,
        )
        const closedPrev = between(
          'negotiations',
          'closed_at',
          'responsible_id = {:u} && status = "fechada"',
          prevStart,
          prevEnd,
        )
        items.push({
          key: 'visitas',
          label: 'Visitas realizadas',
          value: done(cur),
          unit: 'visitas',
          secondary: { label: 'agendadas', value: cur.length, unit: 'visitas' },
          previous: done(prev),
        })
        items.push({
          key: 'negociacoes',
          label: 'Negociações em andamento',
          value: negoOpen,
          unit: 'negociações',
          secondary: { label: 'conversão', value: pct(closed.length, opened), unit: '%' },
        })
        items.push({
          key: 'vgv_fechado',
          label: 'VGV fechado',
          value: sumValue(closed),
          unit: 'R$',
          previous: sumValue(closedPrev),
        })
        chart = chartOf(cur, 'start_at')
      } else {
        const closed = between('negotiations', 'closed_at', 'status = "fechada"', pStart, pEnd)
        const closedPrev = between(
          'negotiations',
          'closed_at',
          'status = "fechada"',
          prevStart,
          prevEnd,
        )
        const leadsCur = between('leads', 'created', '', pStart, pEnd)
        const leadsPrev = between('leads', 'created', '', prevStart, prevEnd)
        const visitsDone = between('visits', 'start_at', 'status = "realizada"', pStart, pEnd)
        const overdueNow = find(
          'tasks',
          'status = "aberta" && due_at != "" && due_at < {:now}',
          'due_at',
          { now: fmt(now) },
        )
        const concluded = between(
          'tasks',
          'closed_at',
          'status = "concluida" && due_at != ""',
          pStart,
          pEnd,
        )
        const onTime = concluded.filter(
          (r) => ts(r.getString('closed_at')) <= ts(r.getString('due_at')),
        ).length
        items.push({
          key: 'vgv_equipe',
          label: 'VGV fechado da equipe',
          value: sumValue(closed),
          unit: 'R$',
          previous: sumValue(closedPrev),
        })
        items.push({
          key: 'funil',
          label: 'Funil do período',
          value: leadsCur.length,
          unit: 'leads',
          secondary: { label: 'conversão', value: pct(closed.length, leadsCur.length), unit: '%' },
          parts: [
            { label: 'Leads', value: leadsCur.length },
            { label: 'Visitas realizadas', value: visitsDone.length },
            { label: 'Fechados', value: closed.length },
          ],
          previous: leadsPrev.length,
        })
        items.push({
          key: 'tarefas',
          label: 'Tarefas atrasadas',
          value: overdueNow.length,
          unit: 'tarefas',
          secondary: {
            label: 'no prazo',
            value: concluded.length ? pct(onTime, concluded.length) : 0,
            unit: '%',
            no_data: concluded.length === 0,
          },
        })
        chart = chartOf(closed, 'closed_at')
      }
      indicators = {
        period: periodKey,
        from: pStart.toISOString(),
        to: pEnd.toISOString(),
        items: items,
        chart: chart,
      }
    } catch (err) {
      $app.logger().error('painel_indicators_failed', 'err', String((err && err.message) || err))
      indicators = null
    }

    return e.json(200, {
      role: role,
      generated_at: now.toISOString(),
      sections: sections,
      agenda: agenda.slice(0, 30),
      indicators: indicators,
    })
  },
  $apis.requireAuth(),
)
