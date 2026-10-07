// SÓ PARA OS TESTES AUTOMATIZADOS. O M7 REMOVE ESTE ARQUIVO (CA-M7-04).
// backdate: envelhece em 13 horas o pedido de uma visita (para testar a liberação de 12 horas
// sem esperar). Exige admin.
routerAdd(
  'POST',
  '/backend/v1/test/visits/{action}',
  (e) => {
    const actor = e.auth
    if (actor.get('active') !== true || String(actor.get('role') || '') !== 'admin') {
      throw new ForbiddenError('Endpoint de teste.')
    }
    const orgId = String(actor.get('organization_id') || '')
    const body = e.requestInfo().body || {}
    if (e.request.pathValue('action') !== 'backdate') throw new NotFoundError('Ação desconhecida.')
    let v = null
    try {
      v = $app.findRecordById('visits', String(body.visit_id || ''))
    } catch (_) {}
    if (!v || v.get('organization_id') !== orgId) throw new NotFoundError('Visita não encontrada.')
    v.set('requested_at', new Date(Date.now() - 13 * 3600000).toISOString())
    $app.save(v)
    return e.json(200, { ok: true })
  },
  $apis.requireAuth(),
)
