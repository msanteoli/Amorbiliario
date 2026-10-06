// Cancela uma visita com motivo obrigatório, registrando autor e horário, sem apagá-la. Quem
// pode: SDR, admin e o corretor da visita (o corretor de outra visita recebe 404). Só visita
// pendente, agendada ou confirmada pode ser cancelada. Grava auditoria e a linha do tempo do lead.
routerAdd(
  'POST',
  '/backend/v1/visits/{id}/cancel',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'sdr', 'corretor'].indexOf(role) < 0) {
      throw new ForbiddenError('Papel sem acesso a estes dados.')
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
    if (['pendente_agenda', 'agendada', 'confirmada'].indexOf(visit.getString('status')) < 0) {
      throw new BadRequestError('Esta visita já foi encerrada.')
    }
    if (reason.length < 3) throw new BadRequestError('Informe o motivo do cancelamento.')

    const now = new Date().toISOString()
    visit.set('status', 'cancelada')
    visit.set('cancel_reason', reason.slice(0, 300))
    visit.set('cancelled_by', actor.id)
    visit.set('cancelled_at', now)
    $app.save(visit)

    try {
      const audit = new Record($app.findCollectionByNameOrId('audit_log'))
      audit.set('organization_id', orgId)
      audit.set('actor_id', actor.id)
      audit.set('actor_role', role)
      audit.set('action', 'visita_cancelada')
      audit.set('collection_name', 'visits')
      audit.set('record_id', visit.id)
      audit.set('field_name', 'status')
      audit.set('reason', reason.slice(0, 300))
      audit.set('occurred_at', now)
      $app.save(audit)
      const leadId = visit.getString('lead_id')
      if (leadId) {
        const property = $app.findRecordById('properties', visit.getString('property_id'))
        const ev = new Record($app.findCollectionByNameOrId('lead_events'))
        ev.set('organization_id', orgId)
        ev.set('lead_id', leadId)
        ev.set('type', 'visita')
        ev.set('author_id', actor.id)
        ev.set('occurred_at', now)
        ev.set(
          'text',
          'Visita cancelada: ' + property.getString('code') + '. Motivo: ' + reason.slice(0, 300),
        )
        $app.save(ev)
      }
    } catch (err) {
      $app.logger().error('visit_cancel_log_failed', 'err', String((err && err.message) || err))
    }
    return e.json(200, { status: 'cancelada' })
  },
  $apis.requireAuth(),
)
