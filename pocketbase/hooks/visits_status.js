// Muda a situação da visita para Confirmada, Realizada ou Não compareceu. Quem pode: SDR,
// admin e o corretor da visita (o corretor de outra visita recebe 404). Visita pendente de
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

    const result = String(body.result || '').trim()
    if (next === 'realizada' && result.length < 3) {
      throw new BadRequestError('Informe o resultado da visita.')
    }
    visit.set('status', next)
    if (result) visit.set('result_text', result.slice(0, 1000))
    $app.save(visit)

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
