// Busca pública de imóveis. Sem login. Só imóvel Disponível; só campos públicos (nunca
// endereço completo, proprietário, captador nem data de revisão).
routerAdd('GET', '/backend/v1/public/properties', (e) => {
  // admin logado (testes automatizados) não é limitado; visitantes anônimos são
  const isAdmin =
    !!e.auth && e.auth.get('active') === true && String(e.auth.get('role') || '') === 'admin'
  if (!isAdmin) {
    const ip = e.realIP()
    const win = Math.floor(Date.now() / 60000)
    const key = 'thr:props:' + ip + ':' + win
    const n = Number($app.store().get(key) || 0) + 1
    $app.store().set(key, n)
    $app.store().remove('thr:props:' + ip + ':' + (win - 1))
    if (n > 120)
      throw new TooManyRequestsError('Muitas tentativas. Aguarde um minuto e tente de novo.')
  }

  const q = e.request.url.query()
  const slug = String(q.get('org') || '')
  const orgs = slug
    ? $app.findRecordsByFilter('organizations', 'slug = {:s}', '', 1, 0, { s: slug })
    : $app.findRecordsByFilter('organizations', "id != ''", 'created', 2, 0)
  if (!orgs.length) throw new NotFoundError('Imobiliária não encontrada.')
  if (!slug && orgs.length > 1) throw new BadRequestError('Informe a imobiliária.')
  const org = orgs[0]

  // números inteiros não negativos; vazio vale 0 (sem filtro)
  const int = (k) => {
    const raw = String(q.get(k) || '').trim()
    if (raw === '') return 0
    if (!/^\d{1,9}$/.test(raw)) throw new BadRequestError('Valor inválido no filtro ' + k + '.')
    return Number(raw)
  }
  const purpose = String(q.get('purpose') || '')
  if (purpose && ['venda', 'locacao'].indexOf(purpose) < 0)
    throw new BadRequestError('Finalidade inválida.')
  const type = String(q.get('type') || '')
  if (
    type &&
    ['casa', 'apartamento', 'terreno', 'comercial', 'galpao', 'chacara', 'outro'].indexOf(type) < 0
  ) {
    throw new BadRequestError('Tipo de imóvel inválido.')
  }
  const neighborhood = String(q.get('neighborhood') || '')
    .trim()
    .slice(0, 80)
  const minPrice = int('min_price')
  const maxPrice = int('max_price')
  const bedrooms = int('bedrooms')
  const parking = int('parking')
  if ((minPrice || maxPrice) && !purpose)
    throw new BadRequestError('Informe a finalidade para filtrar por preço.')
  if (maxPrice && minPrice > maxPrice) throw new BadRequestError('Faixa de preço inválida.')
  const sort = String(q.get('sort') || 'recent')
  if (['recent', 'price_asc', 'price_desc'].indexOf(sort) < 0)
    throw new BadRequestError('Ordenação inválida.')
  if (sort !== 'recent' && !purpose)
    throw new BadRequestError('Informe a finalidade para ordenar por preço.')
  const featuredRaw = String(q.get('featured') || '')
  if (featuredRaw && featuredRaw !== '1' && featuredRaw !== '0')
    throw new BadRequestError('Valor inválido em featured.')

  const pageRaw = String(q.get('page') || '1')
  if (!/^\d{1,6}$/.test(pageRaw) || Number(pageRaw) < 1)
    throw new BadRequestError('Página inválida.')
  const page = Number(pageRaw)
  const perRaw = String(q.get('per_page') || '12')
  if (!/^\d{1,6}$/.test(perRaw) || Number(perRaw) < 1)
    throw new BadRequestError('Tamanho de página inválido.')
  const perPage = Math.min(Number(perRaw), 24)

  const priceField = purpose === 'locacao' ? 'rent_price' : 'sale_price'
  const conds = ['organization_id = {:o}', "status = 'disponivel'"]
  const params = { o: org.id }
  if (featuredRaw === '1') {
    conds.push(
      "highlight_level != '' && highlight_level != 'comum' && (highlight_until = '' || highlight_until >= @now)",
    )
  }
  if (purpose === 'venda') conds.push("(purpose = 'venda' || purpose = 'ambos')")
  if (purpose === 'locacao') conds.push("(purpose = 'locacao' || purpose = 'ambos')")
  if (type) {
    conds.push('property_type = {:t}')
    params.t = type
  }
  if (neighborhood) {
    conds.push('neighborhood = {:n}')
    params.n = neighborhood
  }
  if (bedrooms) {
    conds.push('bedrooms >= {:b}')
    params.b = bedrooms
  }
  if (parking) {
    conds.push('parking >= {:v}')
    params.v = parking
  }
  if (minPrice || maxPrice) {
    conds.push('price_on_request = false')
    if (minPrice) {
      conds.push(priceField + ' >= {:pmin}')
      params.pmin = minPrice
    }
    if (maxPrice) {
      conds.push(priceField + ' <= {:pmax}')
      params.pmax = maxPrice
    }
    conds.push(priceField + ' > 0')
  }
  const filter = conds.join(' && ')
  const order =
    sort === 'price_asc' ? priceField : sort === 'price_desc' ? '-' + priceField : '-created'

  const total = $app.findRecordsByFilter('properties', filter, '', 2000, 0, params).length
  const rows = $app.findRecordsByFilter(
    'properties',
    filter,
    order,
    perPage,
    (page - 1) * perPage,
    params,
  )

  // fotos ativas das linhas desta página, numa consulta só
  const photosBy = {}
  if (rows.length) {
    const fparams = {}
    const parts = []
    rows.forEach((r, i) => {
      parts.push('property_id = {:p' + i + '}')
      fparams['p' + i] = r.id
    })
    const photos = $app.findRecordsByFilter(
      'property_photos',
      '(' + parts.join(' || ') + ') && is_active = true',
      'created',
      500,
      0,
      fparams,
    )
    photos.forEach((ph) => {
      const pid = ph.getString('property_id')
      if (!photosBy[pid]) photosBy[pid] = []
      photosBy[pid].push('/api/files/property_photos/' + ph.id + '/' + ph.getString('file'))
    })
  }

  const price = (p, field, hasPurpose) => {
    if (!hasPurpose) return null
    if (p.get('price_on_request') === true) return { state: 'consulte', value: null }
    const v = Number(p.get(field) || 0)
    return v > 0 ? { state: 'informado', value: v } : { state: 'nao_informado', value: null }
  }
  const items = rows.map((p) => {
    const pu = p.getString('purpose')
    const ph = photosBy[p.id] || []
    return {
      code: p.getString('code'),
      title: p.getString('title'),
      purpose: pu,
      type: p.getString('property_type'),
      neighborhood: p.getString('neighborhood'),
      city: p.getString('city'),
      bedrooms: Number(p.get('bedrooms') || 0),
      bathrooms: Number(p.get('bathrooms') || 0),
      parking: Number(p.get('parking') || 0),
      area: Number(p.get('area') || 0),
      condo_fee: Number(p.get('condo_fee') || 0),
      iptu: Number(p.get('iptu') || 0),
      sale: price(p, 'sale_price', pu === 'venda' || pu === 'ambos'),
      rent: price(p, 'rent_price', pu === 'locacao' || pu === 'ambos'),
      cover: ph.length ? ph[0] : null,
      highlight: (() => {
        const lv = p.getString('highlight_level')
        if (!lv || lv === 'comum') return 'comum'
        const until = p.getString('highlight_until')
        if (until && new Date(until.replace(' ', 'T')).getTime() < Date.now()) return 'comum'
        return lv
      })(),
    }
  })

  return e.json(200, {
    items: items,
    total: total,
    page: page,
    per_page: perPage,
    total_pages: Math.ceil(total / perPage),
  })
})
