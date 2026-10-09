// O corretor da visita (ou o admin) recusa o horário de uma visita Agendada, com motivo. A visita
// continua Agendada e segura o horário até o SDR remarcar. Conclui a tarefa do corretor, cria
// uma tarefa de remarcação para o SDR, grava auditoria (sem o motivo) e a linha do tempo do lead.
routerAdd(
  'POST',
  '/backend/v1/visits/{id}/decline',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'corretor'].indexOf(role) < 0) {
      throw new ForbiddenError('Só o corretor da visita e o admin recusam visitas.')
    }
    const orgId = String(actor.get('organization_id') || '')
    const body = e.requestInfo().body || {}
    const reason = String(body.reason || '').trim()

    let visit = null
    try {
      visit = $app.findRecordById('visits', e.request.pathValue('id'))
    } catch (_) {}
    if (!visit || visit.get('organization_id') !== orgId)
      throw new NotFoundError('Visita não encontrada.')
    if (role === 'corretor' && visit.getString('broker_id') !== actor.id) {
      throw new NotFoundError('Visita não encontrada.')
    }
    if (visit.getString('status') !== 'agendada') {
      throw new BadRequestError('Só visita aguardando confirmação pode ser recusada.')
    }
    if (reason.length < 3 || reason.length > 300) {
      throw new BadRequestError('Informe o motivo (de 3 a 300 caracteres).')
    }

    const now = new Date().toISOString()
    visit.set('declined_reason', reason)
    visit.set('declined_at', now)
    $app.save(visit)

    let code = ''
    try {
      code = $app.findRecordById('properties', visit.getString('property_id')).getString('code')
    } catch (_) {}

    try {
      const open = $app.findRecordsByFilter(
        'tasks',
        "description = {:d} && status = 'aberta'",
        '',
        20,
        0,
        { d: 'visit:' + visit.id },
      )
      open.forEach((t) => {
        t.set('status', 'concluida')
        t.set('closed_by', actor.id)
        t.set('closed_at', now)
        $app.save(t)
      })
    } catch (err) {
      $app
        .logger()
        .error('visit_decline_task_close_failed', 'err', String((err && err.message) || err))
    }

    try {
      let sdr = null
      const creatorId = visit.getString('created_by')
      if (creatorId) {
        try {
          const c = $app.findRecordById('users', creatorId)
          if (
            c.getString('role') === 'sdr' &&
            c.get('active') === true &&
            c.get('organization_id') === orgId
          )
            sdr = c
        } catch (_) {}
      }
      if (!sdr) {
        const list = $app.findRecordsByFilter(
          'users',
          "organization_id = {:o} && role = 'sdr' && active = true",
          'created',
          1,
          0,
          { o: orgId },
        )
        if (list.length) sdr = list[0]
      }
      if (sdr) {
        const t = new Record($app.findCollectionByNameOrId('tasks'))
        t.set('organization_id', orgId)
        t.set('title', 'Visita recusada: remarcar ' + code)
        t.set('description', 'visit_declined:' + visit.id)
        t.set('due_at', now)
        t.set('assigned_to', sdr.id)
        t.set('status', 'aberta')
        t.set('created_by', actor.id)
        if (visit.getString('lead_id')) t.set('lead_id', visit.getString('lead_id'))
        t.set('property_id', visit.getString('property_id'))
        $app.save(t)
      }
    } catch (err) {
      $app
        .logger()
        .error('visit_decline_sdr_task_failed', 'err', String((err && err.message) || err))
    }

    try {
      const audit = new Record($app.findCollectionByNameOrId('audit_log'))
      audit.set('organization_id', orgId)
      audit.set('actor_id', actor.id)
      audit.set('actor_role', role)
      audit.set('action', 'visita_recusada')
      audit.set('collection_name', 'visits')
      audit.set('record_id', visit.id)
      audit.set('field_name', 'declined_at')
      audit.set('occurred_at', now)
      $app.save(audit)
      const leadId = visit.getString('lead_id')
      if (leadId) {
        const ev = new Record($app.findCollectionByNameOrId('lead_events'))
        ev.set('organization_id', orgId)
        ev.set('lead_id', leadId)
        ev.set('type', 'visita')
        ev.set('author_id', actor.id)
        ev.set('occurred_at', now)
        ev.set('text', 'Corretor não pode: ' + reason)
        $app.save(ev)
      }
    } catch (err) {
      $app.logger().error('visit_decline_log_failed', 'err', String((err && err.message) || err))
    }
    return e.json(200, { id: visit.id, declined: true })
  },
  $apis.requireAuth(),
)
