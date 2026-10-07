// O SDR ou o admin libera à mão o horário de um pedido de visita sem corretor. A visita continua
// pendente e o horário volta a ser oferecido no site. Visita com corretor ou encerrada: 400.
routerAdd(
  'POST',
  '/backend/v1/visits/{id}/release',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'sdr'].indexOf(role) < 0) {
      throw new ForbiddenError('Só o SDR e o admin liberam horários.')
    }
    const orgId = String(actor.get('organization_id') || '')
    let v = null
    try {
      v = $app.findRecordById('visits', e.request.pathValue('id'))
    } catch (_) {}
    if (!v || v.get('organization_id') !== orgId) throw new NotFoundError('Visita não encontrada.')
    if (v.getString('status') !== 'pendente_agenda' || v.getString('broker_id') !== '') {
      throw new BadRequestError('Só pedidos pendentes e sem corretor têm horário a liberar.')
    }

    const nowIso = new Date().toISOString()
    v.set('slot_released_at', nowIso)
    v.set('slot_key', '')
    $app.save(v)

    try {
      if (v.getString('lead_id')) {
        const ev = new Record($app.findCollectionByNameOrId('lead_events'))
        ev.set('organization_id', orgId)
        ev.set('lead_id', v.getString('lead_id'))
        ev.set('type', 'visita')
        ev.set('author_id', actor.id)
        ev.set('occurred_at', nowIso)
        ev.set('text', 'Horário do pedido de visita liberado manualmente.')
        $app.save(ev)
      }
    } catch (err) {
      $app.logger().error('visit_release_log_failed', 'err', String((err && err.message) || err))
    }
    return e.json(200, { released: true })
  },
  $apis.requireAuth(),
)
