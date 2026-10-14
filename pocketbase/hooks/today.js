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
    return e.json(200, { role: role, generated_at: now.toISOString(), sections: sections })
  },
  $apis.requireAuth(),
)
