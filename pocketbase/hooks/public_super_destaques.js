// Seção "Super destaques" do site (spec docs/superpowers/specs/2026-10-21-super-destaque-design.md). Sem login. Só imóvel Disponível,
// anunciado no site e em super-destaque; devolve TODAS as fotos ativas (do imóvel e depois as do condomínio). Nunca dono, captador nem endereço completo.
routerAdd('GET', '/backend/v1/public/super-destaques', (e) => {
  const isAdmin =
    !!e.auth && e.auth.get('active') === true && String(e.auth.get('role') || '') === 'admin'
  if (!isAdmin) {
    const ip = e.realIP()
    const win = Math.floor(Date.now() / 60000)
    const key = 'thr:super:' + ip + ':' + win
    const n = Number($app.store().get(key) || 0) + 1
    $app.store().set(key, n)
    $app.store().remove('thr:super:' + ip + ':' + (win - 1))
    if (n > 120)
      throw new TooManyRequestsError('Muitas tentativas. Aguarde um minuto e tente de novo.')
  }
  const slug = String(e.request.url.query().get('org') || '')
  const orgs = slug
    ? $app.findRecordsByFilter('organizations', 'slug = {:s}', '', 1, 0, { s: slug })
    : $app.findRecordsByFilter('organizations', "id != ''", 'created', 2, 0)
  if (!orgs.length) throw new NotFoundError('Imobiliária não encontrada.')
  if (!slug && orgs.length > 1) throw new BadRequestError('Informe a imobiliária.')
  const org = orgs[0]

  const rows = $app.findRecordsByFilter(
    'properties',
    "organization_id = {:o} && status = 'disponivel' && publish_to ~ 'site' && highlight_level = 'super_destaque'",
    '-updated',
    50,
    0,
    { o: org.id },
  )
  const price = (p, field, hasPurpose) => {
    if (!hasPurpose) return null
    if (p.get('price_on_request') === true) return { state: 'consulte', value: null }
    const v = Number(p.get(field) || 0)
    return v > 0 ? { state: 'informado', value: v } : { state: 'nao_informado', value: null }
  }
  const items = rows.map((p) => {
    const pu = p.getString('purpose')
    const recs = $app.findRecordsByFilter(
      'property_photos',
      'property_id = {:p} && is_active = true',
      'position,created',
      100,
      0,
      { p: p.id },
    )
    const photos = recs.map(
      (ph) => '/api/files/property_photos/' + ph.id + '/' + ph.getString('file'),
    )
    const own = photos.length
    const ci = recs.map((ph) => ph.id).indexOf(p.getString('cover_photo_id'))
    if (p.get('in_condominium') === true && p.getString('condominium_id')) {
      try {
        $app
          .findRecordsByFilter(
            'condominium_photos',
            'condominium_id = {:c} && is_active = true',
            'position,created',
            10,
            0,
            {
              c: p.getString('condominium_id'),
            },
          )
          .forEach((cp) =>
            photos.push('/api/files/condominium_photos/' + cp.id + '/' + cp.getString('file')),
          )
      } catch (_) {}
    }
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
      sale: price(p, 'sale_price', pu === 'venda' || pu === 'ambos'),
      rent: price(p, 'rent_price', pu === 'locacao' || pu === 'ambos'),
      highlight: 'super_destaque',
      cover: own ? photos[ci >= 0 ? ci : 0] : null,
      photos: photos,
      own_photos_count: own,
    }
  })
  return e.json(200, { items: items, total: items.length })
})
