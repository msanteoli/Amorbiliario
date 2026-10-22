// Ficha pública de um imóvel pelo código. Sem login. Só imóvel Disponível; qualquer outro
// status (ou código que não existe) devolve 404, sem revelar que o imóvel existe.
routerAdd('GET', '/backend/v1/public/properties/{code}', (e) => {
  // admin logado (testes automatizados) não é limitado; visitantes anônimos são
  const isAdmin =
    !!e.auth && e.auth.get('active') === true && String(e.auth.get('role') || '') === 'admin'
  if (!isAdmin) {
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
        "organization_id = {:o} && code = {:c} && status = 'disponivel' && publish_to ~ 'site'",
        '',
        1,
        0,
        { o: org.id, c: code },
      )
    : []
  if (!rows.length) throw new NotFoundError('Imóvel não encontrado.')
  const p = rows[0]

  // super-destaque mostra todas as fotos (até 100); fora dele, no máximo 20 (mesmo antes de o arquivamento rodar)
  const photoCap = p.getString('highlight_level') === 'super_destaque' ? 100 : 20
  const photoRecs = $app.findRecordsByFilter(
    'property_photos',
    'property_id = {:p} && is_active = true',
    'position,created',
    photoCap,
    0,
    {
      p: p.id,
    },
  )
  const photos = photoRecs.map(
    (ph) => '/api/files/property_photos/' + ph.id + '/' + ph.getString('file'),
  )
  const ownPhotosCount = photos.length
  const coverIdx = photoRecs.map((ph) => ph.id).indexOf(p.getString('cover_photo_id'))

  const pu = p.getString('purpose')
  const price = (field, hasPurpose) => {
    if (!hasPurpose) return null
    if (p.get('price_on_request') === true) return { state: 'consulte', value: null }
    const v = Number(p.get(field) || 0)
    return v > 0 ? { state: 'informado', value: v } : { state: 'nao_informado', value: null }
  }

  let condominium = null
  if (p.get('in_condominium') === true && p.getString('condominium_id')) {
    try {
      const condo = $app.findRecordById('condominiums', p.getString('condominium_id'))
      condominium = {
        name: condo.getString('name'),
        amenities: condo.getString('amenities'),
        rules: condo.getString('rules'),
        infrastructure: condo.getString('infrastructure'),
      }
      // fotos herdadas: as do condomínio entram DEPOIS das do imóvel (nada é copiado; a capa segue sendo do imóvel)
      $app
        .findRecordsByFilter(
          'condominium_photos',
          'condominium_id = {:c} && is_active = true',
          'position,created',
          10,
          0,
          { c: condo.id },
        )
        .forEach((cp) =>
          photos.push('/api/files/condominium_photos/' + cp.id + '/' + cp.getString('file')),
        )
    } catch (_) {}
  }

  let highlight = p.getString('highlight_level') || 'comum'
  const hlUntil = p.getString('highlight_until')
  if (hlUntil && new Date(hlUntil.replace(' ', 'T')).getTime() < Date.now()) highlight = 'comum'

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
    condominium: condominium,
    highlight: highlight,
    photos: photos,
    own_photos_count: ownPhotosCount,
    cover: photos.length ? photos[coverIdx >= 0 ? coverIdx : 0] : null,
  })
})
