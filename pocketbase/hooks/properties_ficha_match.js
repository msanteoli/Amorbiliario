// M13 — consulta de duplicado e de proprietário para a importação de ficha PDF. NÃO grava nada.
// Proprietário: CPF (se válido) ou telefone. Telefone que bate com nome diferente devolve pergunta_telefone = true
// e não vincula. Imóvel: endereço (CEP + número + complemento) e proprietário batendo ao mesmo tempo.
routerAdd('POST', '/backend/v1/properties/ficha/match', (e) => {
  const actor = e.auth
  const role = String(actor.get('role') || '')
  if (actor.get('active') !== true || ['admin', 'corretor'].indexOf(role) < 0) {
    throw new ForbiddenError('Só quem cadastra imóveis usa a importação de ficha.')
  }
  const orgId = String(actor.get('organization_id') || '')
  const body = e.requestInfo().body || {}
  const im = body.imovel || {}
  const pr = body.proprietario || {}

  const digits = (v) => String(v || '').replace(/\D/g, '')
  const normPhone = (v) => {
    let d = digits(v).replace(/^0+/, '')
    if (d.length === 10 || d.length === 11) d = '55' + d
    return d
  }
  const validCpf = (v) => {
    const d = digits(v)
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
    let s = 0
    for (let i = 0; i < 9; i++) s += parseInt(d[i], 10) * (10 - i)
    let r = (s * 10) % 11
    if (r === 10) r = 0
    if (r !== parseInt(d[9], 10)) return false
    s = 0
    for (let i = 0; i < 10; i++) s += parseInt(d[i], 10) * (11 - i)
    r = (s * 10) % 11
    if (r === 10) r = 0
    return r === parseInt(d[10], 10)
  }
  const sameName = (a, b) =>
    String(a || '')
      .trim()
      .toLowerCase() ===
    String(b || '')
      .trim()
      .toLowerCase()

  const name = String(pr.name || '').trim()
  if (name.length < 2 || !im.street)
    throw new BadRequestError('Ficha incompleta: informe endereço e proprietário.')
  const phone = normPhone(pr.phone)
  const cpf = validCpf(pr.cpf) ? digits(pr.cpf) : ''

  // Proprietário
  let owner = null
  let pergunta = false
  if (cpf) {
    const rows = $app.findRecordsByFilter(
      'client_private',
      'organization_id = {:o} && cpf = {:c}',
      '',
      1,
      0,
      { o: orgId, c: cpf },
    )
    if (rows.length) {
      try {
        owner = $app.findRecordById('clients', rows[0].getString('client_id'))
      } catch (_) {}
    }
  }
  if (!owner && phone) {
    const rows = $app.findRecordsByFilter(
      'clients',
      'organization_id = {:o} && phone = {:p}',
      '',
      5,
      0,
      { o: orgId, p: phone },
    )
    if (rows.length) {
      const same = rows.filter((c) => sameName(c.getString('name'), name))
      if (same.length) {
        owner = same[0]
      } else {
        pergunta = true
      }
    }
  }
  // corretor só vê proprietário que ele mesmo atende; para os outros, o endpoint só diz que existe
  if (owner && role === 'corretor' && owner.getString('responsible_id') !== actor.id) {
    owner = null
    pergunta = false
  }

  const ownerDiffs = []
  if (owner) {
    const check = (field, label, fichaValue) => {
      const cur = owner.getString(field)
      if (fichaValue && fichaValue !== cur) {
        ownerDiffs.push({
          field,
          label,
          current_value: cur || null,
          ficha_value: fichaValue,
          is_empty_in_system: cur === '',
        })
      }
    }
    check('phone', 'Telefone', phone)
    check('name', 'Nome', name)
  }

  // Imóvel: endereço e proprietário batendo ao mesmo tempo
  let property = null
  if (owner && im.zip_code) {
    const zip = digits(im.zip_code)
    const rows = $app.findRecordsByFilter(
      'properties',
      'organization_id = {:o} && owner_id = {:w} && street_number = {:n} && zip_code != "" && (zip_code = {:z} || zip_code = {:zf})',
      '',
      5,
      0,
      {
        o: orgId,
        w: owner.id,
        n: String(im.street_number || ''),
        z: zip,
        zf: zip.slice(0, 5) + '-' + zip.slice(5),
      },
    )
    if (rows.length) property = rows[0]
  }
  const propDiffs = []
  if (property) {
    const fields = [
      ['street', 'Rua', im.street],
      ['complement', 'Complemento', im.complement],
      ['neighborhood', 'Bairro', im.neighborhood],
      ['city', 'Cidade', im.city],
      ['bedrooms', 'Dormitórios', im.bedrooms],
      ['bathrooms', 'Banheiros', im.bathrooms],
      ['parking', 'Vagas', im.parking],
      ['area', 'Área', im.area],
      ['sale_price', 'Valor de venda', im.sale_price],
      ['rent_price', 'Valor de locação', im.rent_price],
      ['condo_fee', 'Condomínio', im.condo_fee],
      ['iptu', 'IPTU', im.iptu],
      ['description', 'Descrição', im.description],
    ]
    fields.forEach((f) => {
      if (f[2] === undefined || f[2] === null || f[2] === '') return
      const cur = property.get(f[0])
      const curStr = cur === null || cur === undefined ? '' : String(cur)
      propDiffs.push({
        field: f[0],
        label: f[1],
        current_value: curStr === '' || curStr === '0' ? null : cur,
        ficha_value: f[2],
        is_empty_in_system: curStr === '' || curStr === '0',
      })
    })
  }

  return e.json(200, {
    proprietario: { id: owner ? owner.id : null, diffs: ownerDiffs },
    imovel: { id: property ? property.id : null, diffs: propDiffs },
    pergunta_telefone: pergunta,
  })
})
