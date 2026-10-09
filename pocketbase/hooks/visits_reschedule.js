// Remarca ou agenda uma visita (só SDR e admin): muda corretor, início e fim da MESMA visita.
// Visita pendente de agenda só vira Agendada quando tem corretor e horário (senão guarda o que
// veio e segue pendente). Visita Agendada ou Confirmada é conferida contra a agenda do corretor
// (409 em conflito) e volta para Agendada; a remarcação grava auditoria (de X para Y, só datas)
// e a linha do tempo do lead.
routerAdd(
  'POST',
  '/backend/v1/visits/{id}/reschedule',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'sdr'].indexOf(role) < 0) {
      throw new ForbiddenError('Só o SDR e o admin remarcam visitas.')
    }
    const orgId = String(actor.get('organization_id') || '')
    const body = e.requestInfo().body || {}

    let visit = null
    try {
      visit = $app.findRecordById('visits', e.request.pathValue('id'))
    } catch (_) {}
    if (!visit || visit.get('organization_id') !== orgId)
      throw new NotFoundError('Visita não encontrada.')
    const oldStatus = visit.getString('status')
    if (['pendente_agenda', 'agendada', 'confirmada'].indexOf(oldStatus) < 0) {
      throw new BadRequestError('Esta visita já foi encerrada.')
    }

    // corretor: o que veio, ou o que já estava
    let brokerId = visit.getString('broker_id')
    if (body.broker_id !== undefined) {
      brokerId = String(body.broker_id || '')
      if (!brokerId && oldStatus !== 'pendente_agenda') {
        throw new BadRequestError('Uma visita agendada precisa de corretor.')
      }
      if (brokerId) {
        let u = null
        try {
          u = $app.findRecordById('users', brokerId)
        } catch (_) {}
        const roleOk = u && ['corretor', 'admin'].indexOf(String(u.get('role'))) >= 0
        if (!roleOk || u.get('active') !== true || u.get('organization_id') !== orgId) {
          throw new BadRequestError('Corretor inválido.')
        }
      }
    }

    // horário: o que veio, ou o que já estava
    const oldStartRaw = visit.getString('start_at')
    const oldEndRaw = visit.getString('end_at')
    let start = oldStartRaw ? new Date(oldStartRaw.replace(' ', 'T')) : null
    let end = oldEndRaw ? new Date(oldEndRaw.replace(' ', 'T')) : null
    const startRaw = String(body.start_at || '').trim()
    const endRaw = String(body.end_at || '').trim()
    if (startRaw) {
      start = new Date(startRaw)
      if (isNaN(start.getTime())) throw new BadRequestError('Horário inválido.')
      // sem fim novo, mantém a duração que já existia (ou 1 hora)
      const keep =
        oldStartRaw && oldEndRaw
          ? end.getTime() - new Date(oldStartRaw.replace(' ', 'T')).getTime()
          : 3600000
      end = endRaw ? new Date(endRaw) : new Date(start.getTime() + keep)
    } else if (endRaw) {
      end = new Date(endRaw)
    }
    if (start && end) {
      if (isNaN(start.getTime()) || isNaN(end.getTime()))
        throw new BadRequestError('Horário inválido.')
      if (end.getTime() <= start.getTime())
        throw new BadRequestError('O fim deve ser depois do início.')
      if (end.getTime() - start.getTime() > 8 * 3600000) {
        throw new BadRequestError('A visita não pode passar de 8 horas.')
      }
    } else if (endRaw && !start) {
      throw new BadRequestError('Informe o início da visita.')
    }
    if (startRaw && start.getTime() < Date.now()) throw new BadRequestError('O horário já passou.')

    const complete = !!brokerId && !!start && !!end
    const changedPlan =
      brokerId !== visit.getString('broker_id') ||
      (start ? start.toISOString() : '') !==
        (oldStartRaw ? new Date(oldStartRaw.replace(' ', 'T')).toISOString() : '') ||
      (end ? end.toISOString() : '') !==
        (oldEndRaw ? new Date(oldEndRaw.replace(' ', 'T')).toISOString() : '')

    // um pedido pendente não vira Agendada num horário que já passou
    if (complete && oldStatus === 'pendente_agenda' && start.getTime() < Date.now()) {
      throw new BadRequestError('O horário já passou.')
    }

    const nowIso = new Date().toISOString()
    const oldBroker = visit.getString('broker_id')
    const oldEventId = visit.getString('google_event_id')
    const brokerChanged = !!oldBroker && brokerId !== oldBroker
    visit.set('broker_id', brokerId)
    visit.set('start_at', start ? start.toISOString() : '')
    visit.set('end_at', end ? end.toISOString() : '')
    const newStatus = complete ? 'agendada' : 'pendente_agenda'
    // visita Confirmada que não mudou nada continua Confirmada
    visit.set(
      'status',
      complete && oldStatus === 'confirmada' && !changedPlan ? 'confirmada' : newStatus,
    )
    if (visit.getString('status') === 'agendada') {
      visit.set('declined_reason', '')
      visit.set('declined_at', '')
    }
    if (changedPlan && (oldEventId || visit.getString('google_sync') === 'sincronizada')) {
      visit.set('google_sync', 'pendente')
      visit.set('google_sync_attempts', 0)
    }
    if (brokerChanged && oldEventId) visit.set('google_event_id', '')

    // a conferência do conflito e a gravação acontecem na mesma transação
    let clash = []
    $app.runInTransaction((tx) => {
      if (complete && (changedPlan || oldStatus === 'pendente_agenda')) {
        const fmt = (d) => d.toISOString().replace('T', ' ')
        const buffer = 30 * 60000
        clash = tx.findRecordsByFilter(
          'visits',
          'organization_id = {:o} && broker_id = {:b} && id != {:i} && (status = "agendada" || status = "confirmada") && start_at < {:e} && end_at > {:s}',
          'start_at',
          1,
          0,
          {
            o: orgId,
            b: brokerId,
            i: visit.id,
            e: fmt(new Date(end.getTime() + buffer)),
            s: fmt(new Date(start.getTime() - buffer)),
          },
        )
      }
      if (!clash.length) tx.save(visit)
    })
    if (clash.length) {
      return e.json(409, {
        message:
          'Conflito de agenda: o corretor já tem visita nesse horário ou a menos de 30 minutos dele.',
        conflict_start: clash[0].getString('start_at'),
        conflict_end: clash[0].getString('end_at'),
      })
    }

    if (brokerChanged && oldEventId) {
      try {
        const orphan = new Record($app.findCollectionByNameOrId('audit_log'))
        orphan.set('organization_id', orgId)
        orphan.set('actor_id', actor.id)
        orphan.set('actor_role', role)
        orphan.set('action', 'google_evento_orfao')
        orphan.set('collection_name', 'visits')
        orphan.set('record_id', visit.id)
        orphan.set('field_name', 'broker_id')
        orphan.set('reason', oldBroker + '|' + oldEventId)
        orphan.set('occurred_at', nowIso)
        $app.save(orphan)
      } catch (err) {
        $app.logger().error('visit_orphan_audit_failed', 'err', String((err && err.message) || err))
      }
    }

    if (visit.getString('status') === 'agendada') {
      try {
        const open = $app.findRecordsByFilter(
          'tasks',
          "description = {:d} && status = 'aberta'",
          'created',
          20,
          0,
          { d: 'visit:' + visit.id },
        )
        const prop = $app.findRecordById('properties', visit.getString('property_id'))
        const declinedTasks = $app.findRecordsByFilter(
          'tasks',
          "description = {:d} && status = 'aberta'",
          '',
          20,
          0,
          { d: 'visit_declined:' + visit.id },
        )
        declinedTasks.forEach((dt) => {
          dt.set('status', 'concluida')
          dt.set('closed_by', actor.id)
          dt.set('closed_at', nowIso)
          $app.save(dt)
        })
        if (!open.length) {
          const t = new Record($app.findCollectionByNameOrId('tasks'))
          t.set('organization_id', orgId)
          t.set('title', 'Confirmar visita: ' + prop.getString('code'))
          t.set('description', 'visit:' + visit.id)
          t.set('due_at', visit.getString('start_at'))
          t.set('assigned_to', brokerId)
          t.set('status', 'aberta')
          t.set('created_by', actor.id)
          if (visit.getString('lead_id')) t.set('lead_id', visit.getString('lead_id'))
          t.set('property_id', visit.getString('property_id'))
          $app.save(t)
        } else {
          open.forEach((t, i) => {
            if (i > 0) {
              t.set('status', 'cancelada')
              t.set('closed_by', actor.id)
              t.set('closed_at', nowIso)
            } else {
              t.set('assigned_to', brokerId)
              t.set('due_at', visit.getString('start_at'))
            }
            $app.save(t)
          })
        }
      } catch (err) {
        $app.logger().error('visit_task_resync_failed', 'err', String((err && err.message) || err))
      }
    }

    try {
      const label = (raw) =>
        raw ? String(raw).substring(0, 16).replace(' ', 'T').replace('T', ' ') : '(sem horário)'
      const property = $app.findRecordById('properties', visit.getString('property_id'))
      if (oldStatus !== 'pendente_agenda' && changedPlan) {
        const audit = new Record($app.findCollectionByNameOrId('audit_log'))
        audit.set('organization_id', orgId)
        audit.set('actor_id', actor.id)
        audit.set('actor_role', role)
        audit.set('action', 'visita_remarcada')
        audit.set('collection_name', 'visits')
        audit.set('record_id', visit.id)
        audit.set('field_name', 'start_at')
        audit.set(
          'reason',
          'de ' + label(oldStartRaw) + ' para ' + label(visit.getString('start_at')),
        )
        audit.set('occurred_at', nowIso)
        $app.save(audit)
      }
      const leadId = visit.getString('lead_id')
      if (leadId && (complete || changedPlan)) {
        const col = $app.findCollectionByNameOrId('lead_events')
        const ev = new Record(col)
        ev.set('organization_id', orgId)
        ev.set('lead_id', leadId)
        ev.set('type', 'visita')
        ev.set('author_id', actor.id)
        ev.set('occurred_at', nowIso)
        ev.set(
          'text',
          oldStatus === 'pendente_agenda' && !complete
            ? 'Pedido de visita atualizado: ' + property.getString('code')
            : oldStatus === 'pendente_agenda'
              ? 'Visita agendada: ' +
                property.getString('code') +
                ' em ' +
                label(visit.getString('start_at'))
              : 'Visita remarcada: ' +
                property.getString('code') +
                ' de ' +
                label(oldStartRaw) +
                ' para ' +
                label(visit.getString('start_at')),
        )
        $app.save(ev)
        if (complete && oldStatus === 'pendente_agenda') {
          const lead = $app.findRecordById('leads', leadId)
          if (['novo', 'em_atendimento'].indexOf(lead.getString('stage')) >= 0) {
            const from = lead.getString('stage')
            lead.set('stage', 'visita_marcada')
            $app.save(lead)
            const ev2 = new Record(col)
            ev2.set('organization_id', orgId)
            ev2.set('lead_id', leadId)
            ev2.set('type', 'estagio')
            ev2.set('author_id', actor.id)
            ev2.set('occurred_at', nowIso)
            ev2.set('text', from + ' → visita_marcada (visita agendada)')
            $app.save(ev2)
          }
        }
      }
    } catch (err) {
      $app.logger().error('visit_reschedule_log_failed', 'err', String((err && err.message) || err))
    }
    return e.json(200, { status: visit.getString('status') })
  },
  $apis.requireAuth(),
)
