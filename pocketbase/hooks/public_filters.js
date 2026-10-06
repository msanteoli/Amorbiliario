// Filtros do site público: bairros e tipos que têm imóvel Disponível, para a tela não mostrar
// opções vazias. Sem login. Devolve só contagens e o nome da imobiliária.
routerAdd('GET', '/backend/v1/public/filters', (e) => {
  // limite de requisições por IP (o segredo PUBLIC_RATE_BYPASS é só dos testes)
  const bypass = String($secrets.get('PUBLIC_RATE_BYPASS') || '')
  const given = String(e.request.header.get('X-Rate-Bypass') || '')
  if (!bypass || given !== bypass) {
    const ip = e.realIP()
    const win = Math.floor(Date.now() / 60000)
    const key = 'thr:filters:' + ip + ':' + win
    const n = Number($app.store().get(key) || 0) + 1
    $app.store().set(key, n)
    $app.store().remove('thr:filters:' + ip + ':' + (win - 1))
    if (n > 120)
      throw new TooManyRequestsError('Muitas tentativas. Aguarde um minuto e tente de novo.')
  }

  // a imobiliária: pelo slug (?org=) ou, se houver só uma, essa
  const slug = String(e.request.url.query().get('org') || '')
  const orgs = slug
    ? $app.findRecordsByFilter('organizations', 'slug = {:s}', '', 1, 0, { s: slug })
    : $app.findRecordsByFilter('organizations', "id != ''", 'created', 2, 0)
  if (!orgs.length) throw new NotFoundError('Imobiliária não encontrada.')
  if (!slug && orgs.length > 1) throw new BadRequestError('Informe a imobiliária.')
  const org = orgs[0]

  const rows = $app.findRecordsByFilter(
    'properties',
    "organization_id = {:o} && status = 'disponivel'",
    '',
    2000,
    0,
    { o: org.id },
  )
  const hoods = {}
  const types = {}
  const purposes = { venda: 0, locacao: 0 }
  rows.forEach((p) => {
    const h = p.getString('neighborhood').trim()
    if (h) hoods[h] = (hoods[h] || 0) + 1
    const t = p.getString('property_type')
    if (t) types[t] = (types[t] || 0) + 1
    const pu = p.getString('purpose')
    if (pu === 'venda' || pu === 'ambos') purposes.venda += 1
    if (pu === 'locacao' || pu === 'ambos') purposes.locacao += 1
  })

  return e.json(200, {
    organization: {
      name: org.getString('name'),
      whatsapp_enabled: String(org.getString('whatsapp_number') || '') !== '',
    },
    neighborhoods: Object.keys(hoods)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map((k) => ({ name: k, count: hoods[k] })),
    types: Object.keys(types)
      .sort()
      .map((k) => ({ value: k, count: types[k] })),
    purposes: purposes,
  })
})
