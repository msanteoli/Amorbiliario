// Contato do site público. Sem login. Cria o lead com origem Site (ou acrescenta o interesse a
// um lead que já existe), com a mesma deduplicação do cadastro manual (leads_intake.js): lead
// existente não é duplicado, telefone ou e-mail de cliente liga o lead ao cliente, conflito
// ambíguo vira pendência para o SDR. A resposta ao visitante é sempre a mesma, para ele nunca
// descobrir se já existia cadastro. Origem, etapa, dono e data do consentimento são do servidor.
routerAdd('POST', '/backend/v1/public/leads', (e) => {
  // limite de requisições por IP (o segredo PUBLIC_RATE_BYPASS é só dos testes)
  const bypass = String($secrets.get('PUBLIC_RATE_BYPASS') || '')
  const given = String(e.request.header.get('X-Rate-Bypass') || '')
  if (!bypass || given !== bypass) {
    const ip = e.realIP()
    const win = Math.floor(Date.now() / 60000)
    const key = 'thr:leads:' + ip + ':' + win
    const n = Number($app.store().get(key) || 0) + 1
    $app.store().set(key, n)
    $app.store().remove('thr:leads:' + ip + ':' + (win - 1))
    if (n > 5)
      throw new TooManyRequestsError('Muitas tentativas. Aguarde um minuto e tente de novo.')
  }

  const body = e.requestInfo().body || {}
  const clean = (v, max) =>
    String(v == null ? '' : v)
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .trim()
      .slice(0, max)

  // campo isca: robôs preenchem; fingimos sucesso e não gravamos nada
  if (clean(body.website, 200) !== '') return e.json(200, { ok: true, whatsapp_url: null })

  const slug = clean(body.org, 60)
  const orgs = slug
    ? $app.findRecordsByFilter('organizations', 'slug = {:s}', '', 1, 0, { s: slug })
    : $app.findRecordsByFilter('organizations', "id != ''", 'created', 2, 0)
  if (!orgs.length) throw new NotFoundError('Imobiliária não encontrada.')
  if (!slug && orgs.length > 1) throw new BadRequestError('Informe a imobiliária.')
  const org = orgs[0]
  const orgId = org.id

  const name = clean(body.name, 160)
  if (name.length < 2) throw new BadRequestError('Informe o seu nome.')
  // tira também os zeros à esquerda (prefixo de DDD, ex.: 075 99999-0001)
  let phone = String(body.phone || '')
    .replace(/\D/g, '')
    .replace(/^0+/, '')
  if (!phone) throw new BadRequestError('Informe o WhatsApp com DDD.')
  if (phone.length === 10 || phone.length === 11) phone = '55' + phone
  if (phone.length < 12 || phone.length > 13) {
    throw new BadRequestError('WhatsApp inválido. Informe DDD e número.')
  }
  const email = clean(body.email, 160).toLowerCase()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new BadRequestError('E-mail inválido.')
  if (body.consent !== true)
    throw new BadRequestError('Para enviar, marque a autorização de contato.')
  const submission = clean(body.submission_id, 70)
  if (submission.length < 8) throw new BadRequestError('Envio inválido. Recarregue a página.')
  const intentKey = 'site:' + submission

  // imóvel de interesse: só vale se existir e estiver Disponível; senão o lead nasce sem imóvel
  const propertyCode = clean(body.property_code, 40)
  let property = null
  if (propertyCode) {
    const prows = $app.findRecordsByFilter(
      'properties',
      "organization_id = {:o} && code = {:c} && status = 'disponivel'",
      '',
      1,
      0,
      { o: orgId, c: propertyCode },
    )
    if (prows.length) property = prows[0]
  }

  // link do WhatsApp (o número vem da organização)
  const waNumber = String(org.getString('whatsapp_number') || '').replace(/\D/g, '')
  let waUrl = null
  if (waNumber) {
    const msg = property
      ? 'Olá! Vi o imóvel ' +
        property.getString('code') +
        ' no site e gostaria de mais informações.'
      : 'Olá! Fiz uma busca no site e gostaria de ajuda.'
    waUrl = 'https://wa.me/' + waNumber + '?text=' + encodeURIComponent(msg)
  }

  // o mesmo envio repetido (clique duplo, reenvio) não cria nada de novo
  const replay = $app.findRecordsByFilter(
    'lead_events',
    'organization_id = {:o} && intent_key = {:k}',
    '',
    1,
    0,
    { o: orgId, k: intentKey },
  )
  if (replay.length) return e.json(200, { ok: true, whatsapp_url: waUrl })

  // histórico da busca desta visita (tudo é texto não confiável: limpo e cortado)
  const search = body.search && typeof body.search === 'object' ? body.search : {}
  const f = search.filters && typeof search.filters === 'object' ? search.filters : {}
  const types = ['casa', 'apartamento', 'terreno', 'comercial', 'galpao', 'chacara', 'outro']
  const sNeighborhood = clean(f.neighborhood, 80)
  const sType = types.indexOf(clean(f.type, 20)) >= 0 ? clean(f.type, 20) : ''
  const sPurpose =
    ['venda', 'locacao'].indexOf(clean(f.purpose, 20)) >= 0 ? clean(f.purpose, 20) : ''
  let sBedrooms = Math.floor(Number(f.bedrooms) || 0)
  if (sBedrooms < 0 || sBedrooms > 99) sBedrooms = 0
  let sMaxPrice = Number(f.max_price) || 0
  if (sMaxPrice < 0 || sMaxPrice > 10000000000) sMaxPrice = 0
  const viewed = Array.isArray(search.viewed)
    ? search.viewed
        .slice(0, 20)
        .map((c) => clean(c, 40))
        .filter((c) => c !== '')
    : []
  const searchParts = []
  if (sPurpose) searchParts.push('finalidade ' + sPurpose)
  if (sType) searchParts.push('tipo ' + sType)
  if (sNeighborhood) searchParts.push('bairro ' + sNeighborhood)
  if (sBedrooms) searchParts.push(sBedrooms + '+ quartos')
  if (sMaxPrice) searchParts.push('até R$ ' + sMaxPrice)
  let searchText = ''
  if (searchParts.length) searchText = 'Busca no site: ' + searchParts.join(', ') + '.'
  if (viewed.length)
    searchText += (searchText ? ' ' : '') + 'Imóveis vistos: ' + viewed.join(', ') + '.'

  // campanha
  const utmSource = clean(body.utm_source, 120)
  const utmMedium = clean(body.utm_medium, 120)
  const utmCampaign = clean(body.utm_campaign, 120)
  const gclid = clean(body.gclid, 200)
  const fbclid = clean(body.fbclid, 200)
  const clickType = gclid ? 'gclid' : fbclid ? 'fbclid' : ''
  const clickId = gclid || fbclid
  const campaignParts = []
  if (utmSource) campaignParts.push('origem ' + utmSource)
  if (utmMedium) campaignParts.push('meio ' + utmMedium)
  if (utmCampaign) campaignParts.push('campanha ' + utmCampaign)
  if (clickType) campaignParts.push(clickType)
  const campaignText = campaignParts.length ? 'Campanha: ' + campaignParts.join(', ') + '.' : ''

  const nowIso = new Date().toISOString()
  const addEvent = (leadId, type, text, key) => {
    const ev = new Record($app.findCollectionByNameOrId('lead_events'))
    ev.set('organization_id', orgId)
    ev.set('lead_id', leadId)
    ev.set('type', type)
    ev.set('occurred_at', nowIso)
    ev.set('text', text.slice(0, 2000))
    if (key) ev.set('intent_key', key)
    $app.save(ev)
  }
  const audit = (action, leadId) => {
    try {
      const rec = new Record($app.findCollectionByNameOrId('audit_log'))
      rec.set('organization_id', orgId)
      rec.set('actor_id', 'site_publico')
      rec.set('actor_role', 'site_publico')
      rec.set('action', action)
      rec.set('collection_name', 'leads')
      rec.set('record_id', leadId)
      rec.set('reason', 'origem=site')
      rec.set('occurred_at', nowIso)
      $app.save(rec)
    } catch (err) {
      $app.logger().error('public_lead_audit_failed', 'err', String((err && err.message) || err))
    }
  }

  // deduplicação contra os leads existentes (mesma regra do cadastro manual)
  const parts = ['phone = {:p}']
  const params = { o: orgId, p: phone }
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
    const samePhone = lp === phone
    const sameEmail = !!email && le === email
    const isConflict =
      (samePhone && !!email && !!le && le !== email) || (sameEmail && !!lp && lp !== phone)
    if (isConflict) {
      if (!conflict) conflict = l
    } else if (samePhone || sameEmail) {
      if (!consistent) consistent = l
    }
  })

  if (consistent) {
    addEvent(
      consistent.id,
      'interesse_site',
      (
        'Novo interesse pelo site' +
        (property ? ' no imóvel ' + property.getString('code') : '') +
        '. ' +
        searchText +
        ' ' +
        campaignText
      ).trim(),
      intentKey,
    )
    consistent.set('last_site_interest_at', nowIso)
    const cs = consistent.getString('consent_status')
    if (cs === '' || cs === 'unknown') {
      consistent.set('consent_status', 'opt_in')
      consistent.set('consent_at', nowIso)
      consistent.set('consent_channel', 'site')
    }
    if (property && !consistent.getString('property_id')) consistent.set('property_id', property.id)
    if (consistent.getString('stage') === 'perdido') {
      consistent.set('stage', 'novo')
      consistent.set('lost_reason', '')
      addEvent(consistent.id, 'estagio', 'perdido → novo (novo contato pelo site)', '')
    }
    $app.save(consistent)
    audit('lead_interesse_site', consistent.id)
    return e.json(200, { ok: true, whatsapp_url: waUrl })
  }

  // cliente já cadastrado com o mesmo telefone ou e-mail
  const cparts = ['phone = {:p}']
  const cparams = { o: orgId, p: phone }
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
  const client = crows.length ? crows[0] : null

  const lead = new Record($app.findCollectionByNameOrId('leads'))
  lead.set('organization_id', orgId)
  lead.set('name', name)
  lead.set('phone', phone)
  lead.set('email', email)
  lead.set('origin', 'site_redes_outros')
  lead.set('origin_detail', 'Site')
  lead.set('stage', 'novo')
  lead.set('consent_status', 'opt_in')
  lead.set('consent_at', nowIso)
  lead.set('consent_channel', 'site')
  lead.set('last_site_interest_at', nowIso)
  if (property) lead.set('property_id', property.id)
  if (sNeighborhood) lead.set('search_neighborhood', sNeighborhood)
  if (sType) lead.set('search_type', sType)
  if (sBedrooms > 0) lead.set('search_bedrooms', sBedrooms)
  if (sMaxPrice > 0) lead.set('search_max_price', sMaxPrice)
  if (utmSource) lead.set('utm_source', utmSource)
  if (utmMedium) lead.set('utm_medium', utmMedium)
  if (utmCampaign) lead.set('utm_campaign', utmCampaign)
  if (clickType) {
    lead.set('click_id_type', clickType)
    lead.set('click_id', clickId)
  }
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
    'Lead criado pelo site' +
      (property ? ' (imóvel ' + property.getString('code') + ')' : '') +
      (client ? '. Já é cliente.' : '') +
      (campaignText ? ' ' + campaignText : ''),
    intentKey,
  )
  if (searchText) addEvent(lead.id, 'busca_site', searchText, '')
  if (conflict) {
    addEvent(
      lead.id,
      'pendencia_dedupe',
      'Possível duplicidade com outro lead: telefone ou e-mail iguais com o outro dado diferente.',
      '',
    )
    addEvent(
      conflict.id,
      'pendencia_dedupe',
      'Um lead novo do site ficou como possível duplicidade deste.',
      '',
    )
  }
  audit('lead_criado_site', lead.id)

  return e.json(200, { ok: true, whatsapp_url: waUrl })
})
