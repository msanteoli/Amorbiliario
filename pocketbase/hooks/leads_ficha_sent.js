// Registra na linha do tempo do lead que a ficha de um imóvel Disponível foi enviada. É
// idempotente: a mesma chave de intenção (intent_key) repetida não cria segundo registro. O
// texto da ficha em si é gerado por /backend/v1/properties/{id}/ficha; aqui só fica o registro,
// com o código do imóvel e nunca o endereço.
routerAdd(
  'POST',
  '/backend/v1/leads/{id}/ficha-sent',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'sdr', 'corretor'].indexOf(role) < 0) {
      throw new ForbiddenError('Papel sem acesso a estes dados.')
    }
    const orgId = String(actor.get('organization_id') || '')
    const body = e.requestInfo().body || {}

    const intentKey = String(body.intent_key || '').trim()
    if (intentKey.length < 8 || intentKey.length > 80) {
      throw new BadRequestError('Informe a chave da intenção de envio.')
    }

    let lead = null
    try {
      lead = $app.findRecordById('leads', e.request.pathValue('id'))
    } catch (_) {}
    if (!lead || lead.get('organization_id') !== orgId)
      throw new NotFoundError('Lead não encontrado.')
    if (role === 'corretor' && lead.getString('assigned_to') !== actor.id) {
      throw new NotFoundError('Lead não encontrado.')
    }

    let property = null
    try {
      property = $app.findRecordById('properties', String(body.property_id || ''))
    } catch (_) {}
    if (!property || property.get('organization_id') !== orgId)
      throw new BadRequestError('Imóvel inválido.')
    if (property.getString('status') !== 'disponivel') {
      throw new BadRequestError('Só imóveis disponíveis geram ficha.')
    }

    const already = $app.findRecordsByFilter(
      'lead_events',
      'lead_id = {:l} && intent_key = {:k}',
      '',
      1,
      0,
      { l: lead.id, k: intentKey },
    )
    if (already.length) return e.json(200, { duplicate: true })

    try {
      const ev = new Record($app.findCollectionByNameOrId('lead_events'))
      ev.set('organization_id', orgId)
      ev.set('lead_id', lead.id)
      ev.set('type', 'ficha_enviada')
      ev.set('author_id', actor.id)
      ev.set('occurred_at', new Date().toISOString())
      ev.set('text', 'Ficha enviada: ' + property.getString('code'))
      ev.set('intent_key', intentKey)
      $app.save(ev)
    } catch (err) {
      // dois cliques simultâneos: o índice único barra o segundo registro
      const again = $app.findRecordsByFilter(
        'lead_events',
        'lead_id = {:l} && intent_key = {:k}',
        '',
        1,
        0,
        { l: lead.id, k: intentKey },
      )
      if (again.length) return e.json(200, { duplicate: true })
      throw err
    }
    return e.json(200, { duplicate: false })
  },
  $apis.requireAuth(),
)
