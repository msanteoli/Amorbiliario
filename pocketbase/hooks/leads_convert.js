// Converte um lead em cliente (mode "create", o padrão) ou liga o lead a um cliente que já
// existe (mode "link"). O histórico do lead é preservado. Quem pode: admin, sdr e o corretor
// do lead. Na criação, a verificação de duplicidade de clientes devolve 409 quando já existe
// cliente com o telefone ou o e-mail; o corretor nunca recebe dados de cliente de outro.
routerAdd(
  'POST',
  '/backend/v1/leads/{id}/convert',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'sdr', 'corretor'].indexOf(role) < 0) {
      throw new ForbiddenError('Papel sem acesso a estes dados.')
    }
    const orgId = String(actor.get('organization_id') || '')
    const body = e.requestInfo().body || {}

    let lead = null
    try {
      lead = $app.findRecordById('leads', e.request.pathValue('id'))
    } catch (_) {}
    if (!lead || lead.get('organization_id') !== orgId)
      throw new NotFoundError('Lead não encontrado.')
    if (role === 'corretor' && lead.getString('assigned_to') !== actor.id) {
      throw new NotFoundError('Lead não encontrado.')
    }
    if (lead.getString('client_id')) {
      return e.json(409, {
        status: 'already_linked',
        matches: [],
        message: 'Este lead já está ligado a um cliente.',
      })
    }

    const canSee = (c) => role !== 'corretor' || String(c.get('responsible_id') || '') === actor.id
    const addEvent = (text) => {
      const ev = new Record($app.findCollectionByNameOrId('lead_events'))
      ev.set('organization_id', orgId)
      ev.set('lead_id', lead.id)
      ev.set('type', 'convertido')
      ev.set('author_id', actor.id)
      ev.set('occurred_at', new Date().toISOString())
      ev.set('text', text)
      $app.save(ev)
    }

    const mode = String(body.mode || 'create')
    if (['create', 'link'].indexOf(mode) < 0) throw new BadRequestError('Modo inválido.')

    if (mode === 'link') {
      let c = null
      try {
        c = $app.findRecordById('clients', String(body.client_id || ''))
      } catch (_) {}
      if (!c || c.get('organization_id') !== orgId || !canSee(c)) {
        throw new BadRequestError('Cliente inválido.')
      }
      lead.set('client_id', c.id)
      $app.save(lead)
      addEvent('Lead ligado a um cliente já cadastrado.')
      return e.json(200, { client_id: c.id })
    }

    const kinds = ['comprador', 'locatario', 'proprietario', 'investidor']
    const kind =
      Array.isArray(body.kind) && body.kind.length ? body.kind.map((k) => String(k)) : ['comprador']
    kind.forEach((k) => {
      if (kinds.indexOf(k) < 0) throw new BadRequestError('Tipo de cliente inválido.')
    })

    // responsável: o corretor fica fixo nele mesmo; admin e sdr escolhem (ou usam o dono do lead)
    let responsibleId = ''
    if (role === 'corretor') {
      responsibleId = actor.id
    } else {
      responsibleId = String(body.responsible_id || lead.getString('assigned_to') || '')
      if (!responsibleId) throw new BadRequestError('Escolha o responsável.')
      let u = null
      try {
        u = $app.findRecordById('users', responsibleId)
      } catch (_) {}
      const roleOk = u && ['corretor', 'admin'].indexOf(String(u.get('role'))) >= 0
      if (!roleOk || u.get('active') !== true || u.get('organization_id') !== orgId) {
        throw new BadRequestError('Responsável inválido.')
      }
    }

    // verificação de duplicidade de clientes (mesma regra do M1, sem CPF)
    const phone = lead.getString('phone')
    const email = lead.getString('email')
    const leadName = lead.getString('name').trim().toLowerCase()
    const parts = []
    const params = { o: orgId }
    if (phone) {
      parts.push('phone = {:p}')
      params.p = phone
    }
    if (email) {
      parts.push('email = {:m}')
      params.m = email
    }
    const rows = $app.findRecordsByFilter(
      'clients',
      'organization_id = {:o} && (' + parts.join(' || ') + ')',
      '-created',
      5,
      0,
      params,
    )
    if (rows.length) {
      const matches = rows.map((c) => {
        const visible = canSee(c)
        return {
          match_by: phone && c.get('phone') === phone ? 'phone' : 'email',
          same_name:
            String(c.get('name') || '')
              .trim()
              .toLowerCase() === leadName,
          visible: visible,
          client: visible ? { id: c.id, name: c.get('name'), phone: c.get('phone') } : null,
        }
      })
      return e.json(409, {
        status: matches.some((m) => m.same_name) ? 'same_person' : 'maybe_same',
        matches: matches,
      })
    }

    const consent = lead.getString('consent_status') || 'unknown'
    const client = new Record($app.findCollectionByNameOrId('clients'))
    client.set('organization_id', orgId)
    client.set('name', lead.getString('name'))
    client.set('phone', phone)
    client.set('email', email)
    client.set('kind', kind)
    client.set('responsible_id', responsibleId)
    client.set('consent_status', consent)
    client.set('consent_at', consent !== 'unknown' ? new Date().toISOString() : '')
    client.set('consent_channel', 'lead')
    $app.save(client)

    lead.set('client_id', client.id)
    $app.save(lead)
    addEvent('Lead convertido em cliente.')
    return e.json(200, { client_id: client.id })
  },
  $apis.requireAuth(),
)
