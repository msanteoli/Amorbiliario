// Edita valor, situação (em_analise, aprovada, desistiu) e observações da negociação aberta.
// Só o admin e o corretor responsável. Fechar é só por /close.
routerAdd(
  'PATCH',
  '/backend/v1/negotiations/{id}',
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
    if (role === 'sdr') throw new ForbiddenError('O SDR acompanha, mas não edita a negociação.')
    if (['em_analise', 'aprovada'].indexOf(neg.getString('status')) < 0) {
      return e.json(409, { message: 'Esta negociação já foi encerrada.' })
    }
    const body = e.requestInfo().body || {}
    if (body.status !== undefined) {
      const st = String(body.status)
      if (st === 'fechada')
        throw new BadRequestError('Para fechar, use a ação de fechar a negociação.')
      if (['em_analise', 'aprovada', 'desistiu'].indexOf(st) < 0)
        throw new BadRequestError('Situação inválida.')
      neg.set('status', st)
      if (st === 'desistiu') neg.set('closed_at', new Date().toISOString())
    }
    if (body.agreed_value !== undefined && body.agreed_value !== null && body.agreed_value !== '') {
      const v = Number(body.agreed_value)
      if (isNaN(v) || v < 0) throw new BadRequestError('Valor inválido.')
      neg.set('agreed_value', v)
    }
    if (body.notes !== undefined) {
      const n = String(body.notes)
      if (n.length > 2000) throw new BadRequestError('Observações muito longas.')
      neg.set('notes', n)
    }
    $app.save(neg)
    try {
      const a = new Record($app.findCollectionByNameOrId('audit_log'))
      a.set('organization_id', orgId)
      a.set('actor_id', actor.id)
      a.set('actor_role', role)
      a.set('action', 'negociacao_alterada')
      a.set('collection_name', 'negotiations')
      a.set('record_id', neg.id)
      a.set('reason', neg.getString('status'))
      a.set('occurred_at', new Date().toISOString())
      $app.save(a)
    } catch (_) {}
    return e.json(200, { id: neg.id, status: neg.getString('status') })
  },
  $apis.requireAuth(),
)
