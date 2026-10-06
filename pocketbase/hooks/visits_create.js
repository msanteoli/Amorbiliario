// Cria uma visita (só SDR e admin). Com corretor e horário ela nasce Agendada e a agenda do
// corretor é conferida: o servidor recusa (409) a visita que se sobreponha a outra do mesmo
// corretor ou que fique a menos de 30 minutos dela (visitas canceladas, realizadas e "não
// compareceu" não contam). Sem corretor ou sem horário ela nasce "pendente de agenda". Agendar
// com lead leva o lead de Novo ou Em atendimento para Visita marcada e grava a linha do tempo.
routerAdd(
  'POST',
  '/backend/v1/visits',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'sdr'].indexOf(role) < 0) {
      throw new ForbiddenError('Só o SDR e o admin agendam visitas.')
    }
    const orgId = String(actor.get('organization_id') || '')
    const body = e.requestInfo().body || {}

    const leadId = String(body.lead_id || '')
    const clientId = String(body.client_id || '')
    if ((leadId ? 1 : 0) + (clientId ? 1 : 0) !== 1) {
      throw new BadRequestError('Informe o lead ou o cliente da visita.')
    }
    let lead = null
    if (leadId) {
      try {
        lead = $app.findRecordById('leads', leadId)
      } catch (_) {}
      if (!lead || lead.get('organization_id') !== orgId)
        throw new BadRequestError('Lead inválido.')
    }
    if (clientId) {
      let c = null
      try {
        c = $app.findRecordById('clients', clientId)
      } catch (_) {}
      if (!c || c.get('organization_id') !== orgId) throw new BadRequestError('Cliente inválido.')
    }

    let property = null
    try {
      property = $app.findRecordById('properties', String(body.property_id || ''))
    } catch (_) {}
    if (
      !property ||
      property.get('organization_id') !== orgId ||
      ['disponivel', 'reservado'].indexOf(property.getString('status')) < 0
    ) {
      throw new BadRequestError('Imóvel inválido para visita.')
    }

    const brokerId = String(body.broker_id || '')
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

    // horário: o fim é opcional (1 hora); no máximo 8 horas; nunca no passado
    let start = null
    let end = null
    const startRaw = String(body.start_at || '').trim()
    const endRaw = String(body.end_at || '').trim()
    if (startRaw) {
      start = new Date(startRaw)
      if (isNaN(start.getTime())) throw new BadRequestError('Horário inválido.')
      end = endRaw ? new Date(endRaw) : new Date(start.getTime() + 3600000)
      if (isNaN(end.getTime())) throw new BadRequestError('Horário inválido.')
      if (end.getTime() <= start.getTime())
        throw new BadRequestError('O fim deve ser depois do início.')
      if (end.getTime() - start.getTime() > 8 * 3600000) {
        throw new BadRequestError('A visita não pode passar de 8 horas.')
      }
      if (start.getTime() < Date.now()) throw new BadRequestError('O horário já passou.')
    } else if (endRaw) {
      throw new BadRequestError('Informe o início da visita.')
    }

    const scheduled = !!brokerId && !!start

    const visit = new Record($app.findCollectionByNameOrId('visits'))
    visit.set('organization_id', orgId)
    if (leadId) visit.set('lead_id', leadId)
    if (clientId) visit.set('client_id', clientId)
    visit.set('property_id', property.id)
    if (brokerId) visit.set('broker_id', brokerId)
    if (start) {
      visit.set('start_at', start.toISOString())
      visit.set('end_at', end.toISOString())
    }
    visit.set('status', scheduled ? 'agendada' : 'pendente_agenda')
    visit.set('created_by', actor.id)

    // a conferência do conflito e a gravação acontecem na mesma transação: duas chamadas
    // simultâneas para o mesmo corretor e horário não passam juntas
    let clash = []
    $app.runInTransaction((tx) => {
      if (scheduled) {
        const fmt = (d) => d.toISOString().replace('T', ' ')
        const buffer = 30 * 60000
        clash = tx.findRecordsByFilter(
          'visits',
          'organization_id = {:o} && broker_id = {:b} && (status = "agendada" || status = "confirmada") && start_at < {:e} && end_at > {:s}',
          'start_at',
          1,
          0,
          {
            o: orgId,
            b: brokerId,
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

    if (lead) {
      try {
        const col = $app.findCollectionByNameOrId('lead_events')
        const ev = new Record(col)
        ev.set('organization_id', orgId)
        ev.set('lead_id', lead.id)
        ev.set('type', 'visita')
        ev.set('author_id', actor.id)
        ev.set('occurred_at', new Date().toISOString())
        ev.set(
          'text',
          scheduled
            ? 'Visita agendada: ' +
                property.getString('code') +
                ' em ' +
                start.toISOString().substring(0, 16).replace('T', ' ')
            : 'Pedido de visita registrado: ' + property.getString('code'),
        )
        $app.save(ev)
        if (scheduled && ['novo', 'em_atendimento'].indexOf(lead.getString('stage')) >= 0) {
          const from = lead.getString('stage')
          lead.set('stage', 'visita_marcada')
          $app.save(lead)
          const ev2 = new Record(col)
          ev2.set('organization_id', orgId)
          ev2.set('lead_id', lead.id)
          ev2.set('type', 'estagio')
          ev2.set('author_id', actor.id)
          ev2.set('occurred_at', new Date().toISOString())
          ev2.set('text', from + ' → visita_marcada (visita agendada)')
          $app.save(ev2)
        }
      } catch (err) {
        $app.logger().error('visit_lead_sync_failed', 'err', String((err && err.message) || err))
      }
    }
    return e.json(200, { id: visit.id, status: visit.getString('status') })
  },
  $apis.requireAuth(),
)
