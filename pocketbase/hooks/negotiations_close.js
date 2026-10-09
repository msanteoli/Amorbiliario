// Fecha a negociação: o imóvel vira Vendido (venda) ou Alugado (locação) e o lead vira Ganho,
// tudo ou nada. Só o admin e o corretor responsável.
routerAdd(
  'POST',
  '/backend/v1/negotiations/{id}/close',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'sdr', 'corretor'].indexOf(role) < 0) {
      throw new ForbiddenError('Papel sem acesso a estes dados.')
    }
    const orgId = String(actor.get('organization_id') || '')
    let neg = null
    try {
      neg = $app.findRecordById('negotiations', e.request.pathValue('id'))
    } catch (_) {}
    if (!neg || neg.get('organization_id') !== orgId)
      throw new NotFoundError('Negociação não encontrada.')
    if (role === 'corretor' && neg.getString('responsible_id') !== actor.id)
      throw new NotFoundError('Negociação não encontrada.')
    if (role === 'sdr')
      throw new ForbiddenError('Só o admin e o corretor responsável fecham a negociação.')
    if (['em_analise', 'aprovada'].indexOf(neg.getString('status')) < 0) {
      return e.json(409, { message: 'Esta negociação já foi encerrada.' })
    }
    const nowIso = new Date().toISOString()
    $app.runInTransaction((tx) => {
      const n = tx.findRecordById('negotiations', neg.id)
      const p = tx.findRecordById('properties', n.getString('property_id'))
      if (['inativo', 'vendido', 'alugado'].indexOf(p.getString('status')) >= 0) {
        throw new BadRequestError('O imóvel não está mais disponível para fechar.')
      }
      const l = tx.findRecordById('leads', n.getString('lead_id'))
      n.set('status', 'fechada')
      n.set('closed_at', nowIso)
      tx.save(n)
      p.set('status', n.getString('purpose') === 'venda' ? 'vendido' : 'alugado')
      tx.save(p)
      l.set('stage', 'ganho')
      tx.save(l)
    })
    try {
      const a = new Record($app.findCollectionByNameOrId('audit_log'))
      a.set('organization_id', orgId)
      a.set('actor_id', actor.id)
      a.set('actor_role', role)
      a.set('action', 'negociacao_fechada')
      a.set('collection_name', 'negotiations')
      a.set('record_id', neg.id)
      a.set('reason', neg.getString('purpose'))
      a.set('occurred_at', nowIso)
      $app.save(a)
    } catch (_) {}
    return e.json(200, { id: neg.id, status: 'fechada' })
  },
  $apis.requireAuth(),
)
