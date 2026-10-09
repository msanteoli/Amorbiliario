// Cadastro de lead com deduplicação. É o único caminho de criação de lead (a coleção não
// aceita criação direta). Telefone ou e-mail iguais a um lead existente, sem contradição,
// não criam segundo lead (devolve o existente e registra o novo contato; lead perdido é
// reaberto como Novo). Telefone igual com e-mail diferente, ou o inverso, cria o lead marcado
// como pendência para o SDR, sem mesclar. Telefone ou e-mail de um cliente cadastrado ligam o
// lead a esse cliente.
routerAdd(
  'POST',
  '/backend/v1/leads/intake',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'sdr'].indexOf(role) < 0) {
      throw new ForbiddenError('Só o SDR e o admin cadastram leads.')
    }
    const orgId = String(actor.get('organization_id') || '')
    const body = e.requestInfo().body || {}

    const name = String(body.name || '').trim()
    if (name.length < 2) throw new BadRequestError('Informe o nome do lead.')
    // tira também os zeros à esquerda (prefixo de DDD, ex.: 011 98765-4321)
    let phone = String(body.phone || '')
      .replace(/\D/g, '')
      .replace(/^0+/, '')
    if (phone.length === 10 || phone.length === 11) phone = '55' + phone
    if (phone && (phone.length < 12 || phone.length > 13)) {
      throw new BadRequestError('Telefone inválido. Informe DDD e número.')
    }
    const email = String(body.email || '')
      .trim()
      .toLowerCase()
    if (!phone && !email) throw new BadRequestError('Informe ao menos telefone ou e-mail.')

    const origin = String(body.origin || '')
    const origins = [
      'whatsapp',
      'portal',
      'indicacao_balcao',
      'site_redes_outros',
      'ligacao',
      'site',
      'redes_sociais',
    ]
    if (origins.indexOf(origin) < 0) {
      throw new BadRequestError('Origem inválida.')
    }
    const consent = String(body.consent_status || 'unknown')
    if (['unknown', 'opt_in', 'opt_out'].indexOf(consent) < 0) {
      throw new BadRequestError('Consentimento inválido.')
    }

    const propertyId = String(body.property_id || '')
    if (propertyId) {
      let p = null
      try {
        p = $app.findRecordById('properties', propertyId)
      } catch (_) {}
      if (!p || p.get('organization_id') !== orgId) throw new BadRequestError('Imóvel inválido.')
    }
    const searchType = String(body.search_type || '')
    if (
      searchType &&
      ['casa', 'apartamento', 'terreno', 'comercial', 'galpao', 'chacara', 'outro'].indexOf(
        searchType,
      ) < 0
    ) {
      throw new BadRequestError('Tipo de imóvel inválido.')
    }
    const bedrooms = Number(body.search_bedrooms) || 0
    const maxPrice = Number(body.search_max_price) || 0
    const minPrice = Number(body.search_min_price) || 0
    if (bedrooms < 0 || maxPrice < 0 || minPrice < 0)
      throw new BadRequestError('Perfil de busca inválido.')
    if (minPrice > 0 && maxPrice > 0 && minPrice > maxPrice)
      throw new BadRequestError('A faixa de valor está invertida.')
    const neighborhoods = String(body.search_neighborhoods || '')
      .trim()
      .slice(0, 300)
    const notes = String(body.notes || '')
      .trim()
      .slice(0, 2000)

    let dueIso = ''
    const dueRaw = String(body.next_step_due || '').trim()
    if (dueRaw) {
      const d = new Date(dueRaw)
      if (isNaN(d.getTime())) throw new BadRequestError('Prazo inválido.')
      dueIso = d.toISOString()
    }

    const addEvent = (leadId, type, text) => {
      const ev = new Record($app.findCollectionByNameOrId('lead_events'))
      ev.set('organization_id', orgId)
      ev.set('lead_id', leadId)
      ev.set('type', type)
      ev.set('author_id', actor.id)
      ev.set('occurred_at', new Date().toISOString())
      ev.set('text', text)
      $app.save(ev)
    }

    // deduplicação contra os leads existentes
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
      'leads',
      'organization_id = {:o} && (' + parts.join(' || ') + ')',
      '-created',
      20,
      0,
      params,
    )
    let consistent = null
    let conflict = null
    rows.forEach((l) => {
      // lead encerrado como duplicado nunca recebe recontato: vale o lead que ficou
      if (l.getString('lost_reason') === 'duplicado') return
      const lp = l.getString('phone')
      const le = l.getString('email')
      const samePhone = !!phone && lp === phone
      const sameEmail = !!email && le === email
      const isConflict =
        (samePhone && !!email && !!le && le !== email) ||
        (sameEmail && !!phone && !!lp && lp !== phone)
      if (isConflict) {
        if (!conflict) conflict = l
      } else if (samePhone || sameEmail) {
        if (!consistent) consistent = l
      }
    })

    if (consistent) {
      addEvent(consistent.id, 'contato_repetido', 'Novo contato recebido (origem: ' + origin + ')')
      // quem foi perdido e voltou a falar não pode ficar escondido: o lead é reaberto como Novo
      let reopened = false
      if (consistent.getString('stage') === 'perdido') {
        consistent.set('stage', 'novo')
        consistent.set('lost_reason', '')
        $app.save(consistent)
        addEvent(consistent.id, 'estagio', 'perdido → novo (novo contato)')
        reopened = true
      }
      return e.json(200, {
        status: 'existing',
        lead_id: consistent.id,
        already_client: !!consistent.getString('client_id'),
        reopened: reopened,
      })
    }

    // cliente já cadastrado com o mesmo telefone ou e-mail
    let client = null
    const cparts = []
    const cparams = { o: orgId }
    if (phone) {
      cparts.push('phone = {:p}')
      cparams.p = phone
    }
    if (email) {
      cparts.push('email = {:m}')
      cparams.m = email
    }
    const crows = $app.findRecordsByFilter(
      'clients',
      'organization_id = {:o} && (' + cparts.join(' || ') + ')',
      '-created',
      1,
      0,
      cparams,
    )
    if (crows.length) client = crows[0]

    const lead = new Record($app.findCollectionByNameOrId('leads'))
    lead.set('organization_id', orgId)
    lead.set('name', name)
    lead.set('phone', phone)
    lead.set('email', email)
    lead.set('origin', origin)
    lead.set(
      'origin_detail',
      String(body.origin_detail || '')
        .trim()
        .slice(0, 80),
    )
    lead.set('stage', 'novo')
    lead.set('consent_status', consent)
    if (propertyId) lead.set('property_id', propertyId)
    lead.set(
      'search_neighborhood',
      String(body.search_neighborhood || '')
        .trim()
        .slice(0, 80),
    )
    if (searchType) lead.set('search_type', searchType)
    if (bedrooms > 0) lead.set('search_bedrooms', bedrooms)
    if (maxPrice > 0) lead.set('search_max_price', maxPrice)
    if (minPrice > 0) lead.set('search_min_price', minPrice)
    if (neighborhoods) lead.set('search_neighborhoods', neighborhoods)
    if (notes) lead.set('notes', notes)

    lead.set(
      'next_step',
      String(body.next_step || '')
        .trim()
        .slice(0, 200),
    )
    if (dueIso) lead.set('next_step_due', dueIso)
    if (client) lead.set('client_id', client.id)
    if (conflict) {
      lead.set('dedupe_status', 'pendente')
      lead.set('dedupe_of', conflict.id)
    }
    $app.save(lead)

    // duas chamadas simultâneas podem não se enxergar antes de gravar: relê depois de gravar
    // e, se achar outro lead com o mesmo telefone ou e-mail, marca este como pendência
    if (!conflict) {
      const late = $app.findRecordsByFilter(
        'leads',
        'organization_id = {:o} && id != {:s} && (' + parts.join(' || ') + ')',
        'created',
        1,
        0,
        Object.assign({ s: lead.id }, params),
      )
      if (late.length) {
        conflict = late[0]
        lead.set('dedupe_status', 'pendente')
        lead.set('dedupe_of', conflict.id)
        $app.save(lead)
      }
    }

    addEvent(
      lead.id,
      'criado',
      'Lead criado (origem: ' + origin + ')' + (client ? '. Já é cliente.' : ''),
    )
    if (conflict) {
      addEvent(
        lead.id,
        'pendencia_dedupe',
        'Possível duplicidade com outro lead: telefone ou e-mail iguais com o outro dado diferente.',
      )
      addEvent(
        conflict.id,
        'pendencia_dedupe',
        'Um lead novo ficou como possível duplicidade deste.',
      )
    }

    const out = {
      status: conflict ? 'pending_review' : 'created',
      lead_id: lead.id,
      already_client: !!client,
    }
    if (conflict) out.existing_lead_id = conflict.id
    return e.json(200, out)
  },
  $apis.requireAuth(),
)
