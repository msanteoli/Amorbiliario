// Muda a situação da visita para Confirmada, Realizada ou Não compareceu. Quem pode: SDR
// (não confirma), admin e o corretor da visita (o corretor de outra visita recebe 404). Visita pendente de
// agenda não sai dali por aqui (precisa de corretor e horário, por /reschedule). Realizada exige
// o resultado em texto, que vai para a linha do tempo do lead; "não compareceu" também registra.
routerAdd(
  'POST',
  '/backend/v1/visits/{id}/status',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'sdr', 'corretor'].indexOf(role) < 0) {
      throw new ForbiddenError('Papel sem acesso a estes dados.')
    }
    const orgId = String(actor.get('organization_id') || '')
    const body = e.requestInfo().body || {}
    const next = String(body.status || '')
    const allowedFrom = {
      confirmada: ['agendada'],
      realizada: ['agendada', 'confirmada'],
      nao_compareceu: ['agendada', 'confirmada'],
    }
    if (!allowedFrom[next]) throw new BadRequestError('Situação inválida.')

    let visit = null
    try {
      visit = $app.findRecordById('visits', e.request.pathValue('id'))
    } catch (_) {}
    if (!visit || visit.get('organization_id') !== orgId)
      throw new NotFoundError('Visita não encontrada.')
    if (role === 'corretor' && visit.getString('broker_id') !== actor.id) {
      throw new NotFoundError('Visita não encontrada.')
    }
    const current = visit.getString('status')
    if (current === 'pendente_agenda') {
      throw new BadRequestError('Escolha o corretor e o horário antes de mudar a situação.')
    }
    if (allowedFrom[next].indexOf(current) < 0) {
      throw new BadRequestError('Mudança de situação não permitida.')
    }

    if (next === 'confirmada' && role === 'sdr') {
      throw new ForbiddenError('Só o corretor responsável ou o admin confirmam a visita.')
    }

    const result = String(body.result || '').trim()
    if (next === 'realizada' && result.length < 3) {
      throw new BadRequestError('Informe o resultado da visita.')
    }
    if (next === 'confirmada' && role === 'corretor' && visit.getString('declined_at')) {
      throw new BadRequestError('A visita foi recusada. Aguarde a remarcação.')
    }
    let hasGoogle = false
    if (next === 'confirmada') {
      try {
        hasGoogle =
          $app.findRecordsByFilter(
            'google_connections',
            "user_id = {:u} && status = 'conectado'",
            '',
            1,
            0,
            { u: visit.getString('broker_id') },
          ).length > 0
      } catch (err) {
        $app.logger().error('visit_google_check_failed', 'err', String((err && err.message) || err))
      }
    }
    // leitura, conferência e gravação na mesma transação: confirmar e recusar ao mesmo tempo
    // não deixam a visita em estado misto
    let lost = ''
    $app.runInTransaction((tx) => {
      const v = tx.findRecordById('visits', visit.id)
      if (allowedFrom[next].indexOf(v.getString('status')) < 0) {
        lost = 'Mudança de situação não permitida.'
        return
      }
      if (next === 'confirmada' && role === 'corretor' && v.getString('declined_at')) {
        lost = 'A visita foi recusada. Aguarde a remarcação.'
        return
      }
      v.set('status', next)
      if (hasGoogle) {
        v.set('google_sync', 'pendente')
        v.set('google_sync_attempts', 0)
      }
      if (result) v.set('result_text', result.slice(0, 1000))
      tx.save(v)
      visit = v
    })
    if (lost) return e.json(400, { message: lost })

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
        t.set('closed_at', new Date().toISOString())
        $app.save(t)
      })
    } catch (err) {
      $app.logger().error('visit_task_close_failed', 'err', String((err && err.message) || err))
    }

    const leadId = visit.getString('lead_id')
    if (leadId) {
      try {
        const property = $app.findRecordById('properties', visit.getString('property_id'))
        const ev = new Record($app.findCollectionByNameOrId('lead_events'))
        ev.set('organization_id', orgId)
        ev.set('lead_id', leadId)
        ev.set('type', 'visita')
        ev.set('author_id', actor.id)
        ev.set('occurred_at', new Date().toISOString())
        const label = {
          confirmada: 'Visita confirmada',
          realizada: 'Visita realizada',
          nao_compareceu: 'Cliente não compareceu à visita',
        }[next]
        ev.set(
          'text',
          label + ': ' + property.getString('code') + (result ? '. ' + result.slice(0, 500) : ''),
        )
        $app.save(ev)
      } catch (err) {
        $app.logger().error('visit_status_log_failed', 'err', String((err && err.message) || err))
      }
    }
    return e.json(200, { status: next })
  },
  $apis.requireAuth(),
)
