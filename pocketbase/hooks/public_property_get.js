// Ficha pública de um imóvel pelo código. Sem login. Só imóvel Disponível; qualquer outro
// status (ou código que não existe) devolve 404, sem revelar que o imóvel existe.
routerAdd('GET', '/backend/v1/public/properties/{code}', (e) => {
  const bypass = String($secrets.get('PUBLIC_RATE_BYPASS') || '')
  const given = String(e.request.header.get('X-Rate-Bypass') || '')
  if (!bypass || given !== bypass) {
    const ip = e.realIP()
    const win = Math.floor(Date.now() / 60000)
    const key = 'thr:prop:' + ip + ':' + win
    const n = Number($app.store().get(key) || 0) + 1
    $app.store().set(key, n)
    $app.store().remove('thr:prop:' + ip + ':' + (win - 1))
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

  const code = String(e.request.pathValue('code') || '')
    .trim()
    .slice(0, 40)
  const rows = code
    ? $app.findRecordsByFilter(
        'properties',
        "organization_id = {:o} && code = {:c} && status = 'disponivel'",
        '',
        1,
        0,
        { o: org.id, c: code },
      )
    : []
  if (!rows.length) throw new NotFoundError('Imóvel não encontrado.')
  const p = rows[0]

  const photos = $app
    .findRecordsByFilter(
      'property_photos',
      'property_id = {:p} && is_active = true',
      'created',
      50,
      0,
      {
        p: p.id,
      },
    )
    .map((ph) => '/api/files/property_photos/' + ph.id + '/' + ph.getString('file'))

  const pu = p.getString('purpose')
  const price = (field, hasPurpose) => {
    if (!hasPurpose) return null
    if (p.get('price_on_request') === true) return { state: 'consulte', value: null }
    const v = Number(p.get(field) || 0)
    return v > 0 ? { state: 'informado', value: v } : { state: 'nao_informado', value: null }
  }

  return e.json(200, {
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
    sale: price('sale_price', pu === 'venda' || pu === 'ambos'),
    rent: price('rent_price', pu === 'locacao' || pu === 'ambos'),
    description: p.getString('description'),
    photos: photos,
    cover: photos.length ? photos[0] : null,
  })
})
