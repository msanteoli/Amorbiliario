// Resolve uma pendência de duplicidade de lead. "separate": são pessoas diferentes, nada
// mais muda. "same_person": o lead mais novo é encerrado como Perdido com o motivo de sistema
// "duplicado"; nada é mesclado. Só o SDR e o admin.
routerAdd(
  'POST',
  '/backend/v1/leads/{id}/dedupe-resolve',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'sdr'].indexOf(role) < 0) {
      throw new ForbiddenError('Só o SDR e o admin resolvem pendências.')
    }
    const orgId = String(actor.get('organization_id') || '')
    const body = e.requestInfo().body || {}
    const resolution = String(body.resolution || '')
    if (['separate', 'same_person'].indexOf(resolution) < 0) {
      throw new BadRequestError('Resolução inválida.')
    }
    let lead = null
    try {
      lead = $app.findRecordById('leads', e.request.pathValue('id'))
    } catch (_) {}
    if (!lead || lead.get('organization_id') !== orgId)
      throw new NotFoundError('Lead não encontrado.')
    if (lead.getString('dedupe_status') !== 'pendente') {
      throw new BadRequestError('Este lead não tem pendência de duplicidade.')
    }

    const addEvent = (leadId, text) => {
      const ev = new Record($app.findCollectionByNameOrId('lead_events'))
      ev.set('organization_id', orgId)
      ev.set('lead_id', leadId)
      ev.set('type', 'dedupe_resolvido')
      ev.set('author_id', actor.id)
      ev.set('occurred_at', new Date().toISOString())
      ev.set('text', text)
      $app.save(ev)
    }

    const otherId = lead.getString('dedupe_of')
    if (resolution === 'separate') {
      lead.set('dedupe_status', 'resolvido_separado')
      $app.save(lead)
      addEvent(lead.id, 'Pendência resolvida: são pessoas diferentes.')
      if (otherId) addEvent(otherId, 'Pendência de duplicidade resolvida: são pessoas diferentes.')
    } else {
      lead.set('dedupe_status', 'resolvido_mesma_pessoa')
      lead.set('stage', 'perdido')
      lead.set('lost_reason', 'duplicado')
      $app.save(lead)
      addEvent(lead.id, 'Pendência resolvida: é a mesma pessoa. Lead encerrado como duplicado.')
      if (otherId)
        addEvent(
          otherId,
          'Pendência de duplicidade resolvida: era a mesma pessoa. O lead duplicado foi encerrado.',
        )
    }
    return e.json(200, { dedupe_status: lead.getString('dedupe_status') })
  },
  $apis.requireAuth(),
)
