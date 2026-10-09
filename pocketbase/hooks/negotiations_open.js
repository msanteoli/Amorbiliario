// Abre a negociação de um lead (uma aberta por vez). Admin, SDR e o corretor dono do lead.
// Abrir move o lead para "proposta" (se ainda estava antes dela).
routerAdd(
  'POST',
  '/backend/v1/leads/{id}/negotiation',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'sdr', 'corretor'].indexOf(role) < 0) {
      throw new ForbiddenError('Papel sem acesso a estes dados.')
    }
    const orgId = String(actor.get('organization_id') || '')
    let lead = null
    try {
      lead = $app.findRecordById('leads', e.request.pathValue('id'))
    } catch (_) {}
    if (!lead || lead.get('organization_id') !== orgId)
      throw new NotFoundError('Lead não encontrado.')
    if (role === 'corretor' && lead.getString('assigned_to') !== actor.id)
      throw new NotFoundError('Lead não encontrado.')
    if (lead.getString('stage') === 'perdido')
      throw new BadRequestError('Lead perdido não negocia.')

    const body = e.requestInfo().body || {}
    const purpose = String(body.purpose || '')
    if (['venda', 'locacao'].indexOf(purpose) < 0) throw new BadRequestError('Finalidade inválida.')
    let value = 0
    if (body.agreed_value !== undefined && body.agreed_value !== null && body.agreed_value !== '') {
      value = Number(body.agreed_value)
      if (isNaN(value) || value < 0) throw new BadRequestError('Valor inválido.')
    }
    let prop = null
    try {
      prop = $app.findRecordById('properties', String(body.property_id || ''))
    } catch (_) {}
    if (!prop || prop.get('organization_id') !== orgId)
      throw new NotFoundError('Imóvel não encontrado.')
    if (['inativo', 'vendido', 'alugado'].indexOf(prop.getString('status')) >= 0) {
      throw new BadRequestError('Este imóvel não está disponível para negociar.')
    }
    const pp = prop.getString('purpose')
    if (pp !== 'ambos' && pp !== purpose)
      throw new BadRequestError('O imóvel não é anunciado para essa finalidade.')

    const open = $app.findRecordsByFilter(
      'negotiations',
      "lead_id = {:l} && (status = 'em_analise' || status = 'aprovada')",
      '',
      1,
      0,
      { l: lead.id },
    )
    if (open.length)
      return e.json(409, {
        message: 'Este lead já tem uma negociação aberta.',
        negotiation_id: open[0].id,
      })

    let neg = null
    try {
      $app.runInTransaction((tx) => {
        neg = new Record(tx.findCollectionByNameOrId('negotiations'))
        neg.set('organization_id', orgId)
        neg.set('lead_id', lead.id)
        neg.set('property_id', prop.id)
        neg.set('purpose', purpose)
        if (value > 0) neg.set('agreed_value', value)
        neg.set('status', 'em_analise')
        neg.set(
          'responsible_id',
          lead.getString('assigned_to') || (role === 'corretor' ? actor.id : ''),
        )
        tx.save(neg)
        const l = tx.findRecordById('leads', lead.id)
        if (['novo', 'em_atendimento', 'visita_marcada'].indexOf(l.getString('stage')) >= 0) {
          l.set('stage', 'proposta')
          tx.save(l)
        }
      })
    } catch (err) {
      $app.logger().error('negotiation_open_failed', 'err', String((err && err.message) || err))
      return e.json(409, { message: 'Não foi possível abrir a negociação. Tente de novo.' })
    }
    try {
      const a = new Record($app.findCollectionByNameOrId('audit_log'))
      a.set('organization_id', orgId)
      a.set('actor_id', actor.id)
      a.set('actor_role', role)
      a.set('action', 'negociacao_aberta')
      a.set('collection_name', 'negotiations')
      a.set('record_id', neg.id)
      a.set('reason', purpose)
      a.set('occurred_at', new Date().toISOString())
      $app.save(a)
    } catch (_) {}
    return e.json(200, { id: neg.id, status: 'em_analise', purpose: purpose, property_id: prop.id })
  },
  $apis.requireAuth(),
)
