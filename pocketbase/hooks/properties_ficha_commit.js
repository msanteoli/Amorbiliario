// M13 — grava o imóvel e o proprietário da ficha PDF numa transação só (DIAGNÓSTICO: cada passo diz em qual falhou).
routerAdd('POST', '/backend/v1/properties/ficha/commit', (e) => {
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
  const isEmpty = (v) => v === null || v === undefined || v === '' || v === 0
  const TYPE_CODE = {
    casa: 'CA',
    apartamento: 'AP',
    terreno: 'TE',
    comercial: 'CO',
    galpao: 'GA',
    chacara: 'CH',
    outro: 'OU',
  }
  const TYPE_LABEL = {
    casa: 'Casa',
    apartamento: 'Apartamento',
    terreno: 'Terreno',
    comercial: 'Sala comercial',
    galpao: 'Galpão',
    chacara: 'Chácara',
    outro: 'Imóvel',
  }

  const name = String(pr.name || '').trim()
  if (name.length < 2) throw new BadRequestError('Informe o nome do proprietário.')
  if (!im.street || String(im.street).trim().length < 2)
    throw new BadRequestError('Informe a rua do imóvel.')
  if (String(im.description || '').length > 5000)
    throw new BadRequestError('Descrição longa demais (máximo 5000 caracteres).')
  const type = TYPE_CODE[im.property_type] ? im.property_type : 'outro'
  const purpose = ['venda', 'locacao', 'ambos'].indexOf(im.purpose) >= 0 ? im.purpose : 'venda'
  const phone = normPhone(pr.phone)
  const cpf = validCpf(pr.cpf) ? digits(pr.cpf) : ''
  const pendencias = []
  if (pr.cpf && !cpf) pendencias.push('cpf do proprietário inválido')
  if (!cpf) pendencias.push('cpf do proprietário')
  if (!phone) pendencias.push('telefone do proprietário')
  if (!im.area) pendencias.push('área')
  if (!im.parking && im.parking !== 0) pendencias.push('vagas')
  if (!im.condo_fee) pendencias.push('condomínio')
  if (!im.iptu) pendencias.push('IPTU')
  if (!im.zip_code) pendencias.push('CEP')
  if (!im.state) pendencias.push('UF')

  let fase = 'inicio'
  let res = null
  try {
    res = $app.runInTransaction((tx) => {
      const S = (label, r) => {
        fase = 'save:' + label
        tx.save(r)
      }
      fase = 'owner-busca'
      let owner = null
      if (body.owner_id) {
        try {
          owner = tx.findRecordById('clients', String(body.owner_id))
        } catch (_) {}
        if (!owner || owner.getString('organization_id') !== orgId)
          throw new NotFoundError('Proprietário não encontrado.')
      }
      if (!owner && cpf) {
        const rows = tx.findRecordsByFilter(
          'client_private',
          'organization_id = {:o} && cpf = {:c}',
          '',
          1,
          0,
          { o: orgId, c: cpf },
        )
        if (rows.length) {
          try {
            owner = tx.findRecordById('clients', rows[0].getString('client_id'))
          } catch (_) {}
        }
      }
      if (!owner && phone) {
        const rows = tx.findRecordsByFilter(
          'clients',
          'organization_id = {:o} && phone = {:p}',
          '',
          5,
          0,
          { o: orgId, p: phone },
        )
        const same = rows.filter((c) => sameName(c.getString('name'), name))
        if (same.length) owner = same[0]
        else if (rows.length && body.vincular_proprietario_existente === true) owner = rows[0]
      }
      if (owner && role === 'corretor' && owner.getString('responsible_id') !== actor.id) {
        throw new ForbiddenError('Este proprietário é atendido por outro corretor.')
      }
      const ownerNew = !owner
      if (!owner) {
        fase = 'owner-criar-collection'
        const cl = new Record(tx.findCollectionByNameOrId('clients'))
        cl.set('organization_id', orgId)
        cl.set('name', name)
        if (phone) cl.set('phone', phone)
        cl.set('kind', ['proprietario'])
        cl.set('responsible_id', actor.id)
        S('cliente', cl)
        owner = cl
      } else if (!owner.getString('phone') && phone) {
        owner.set('phone', phone)
        S('cliente-telefone', owner)
      }
      if (cpf) {
        fase = 'cpf-busca'
        const cp = tx.findRecordsByFilter(
          'client_private',
          'organization_id = {:o} && client_id = {:c}',
          '',
          1,
          0,
          { o: orgId, c: owner.id },
        )
        if (cp.length) {
          if (!cp[0].getString('cpf')) {
            cp[0].set('cpf', cpf)
            S('client_private-atualiza', cp[0])
          }
        } else {
          fase = 'cpf-criar-collection'
          const rec = new Record(tx.findCollectionByNameOrId('client_private'))
          rec.set('organization_id', orgId)
          rec.set('client_id', owner.id)
          rec.set('cpf', cpf)
          S('client_private', rec)
        }
      }

      fase = 'imovel-busca'
      let prop = null
      if (body.property_id) {
        try {
          prop = tx.findRecordById('properties', String(body.property_id))
        } catch (_) {}
        if (!prop || prop.getString('organization_id') !== orgId)
          throw new NotFoundError('Imóvel não encontrado.')
      }
      if (!prop && !ownerNew && im.zip_code) {
        const zip = digits(im.zip_code)
        const rows = tx.findRecordsByFilter(
          'properties',
          'organization_id = {:o} && owner_id = {:w} && street_number = {:n} && zip_code != "" && (zip_code = {:z} || zip_code = {:zf})',
          '',
          1,
          0,
          {
            o: orgId,
            w: owner.id,
            n: String(im.street_number || ''),
            z: zip,
            zf: zip.slice(0, 5) + '-' + zip.slice(5),
          },
        )
        if (rows.length) prop = rows[0]
      }
      const fields = {
        street: im.street,
        street_number: String(im.street_number || 'S/N'),
        complement: im.complement,
        neighborhood: im.neighborhood,
        city: im.city,
        state: im.state,
        zip_code: im.zip_code,
        bedrooms: im.bedrooms,
        bathrooms: im.bathrooms,
        parking: im.parking,
        area: im.area,
        sale_price: im.sale_price,
        rent_price: im.rent_price,
        condo_fee: im.condo_fee,
        iptu: im.iptu,
        description: im.description,
      }
      const wanted = Array.isArray(body.selected_imovel_fields) ? body.selected_imovel_fields : null
      if (prop) {
        Object.keys(fields).forEach((k) => {
          const v = fields[k]
          if (isEmpty(v)) return
          const explicit = wanted && wanted.indexOf(k) >= 0
          if (isEmpty(prop.get(k)) || explicit) prop.set(k, v)
        })
        prop.set('owner_id', prop.getString('owner_id') || owner.id)
        S('imovel-atualiza', prop)
        return { prop, owner, criado: false, ownerNew }
      }

      fase = 'codigo-org'
      const orgRec = tx.findRecordById('organizations', orgId)
      const seq = orgRec.getInt('property_code_seq') + 1
      orgRec.set('property_code_seq', seq)
      S('organizacao-sequencia', orgRec)
      const code = TYPE_CODE[type] + '-' + String(seq).padStart(4, '0')

      fase = 'imovel-criar-collection'
      const np = new Record(tx.findCollectionByNameOrId('properties'))
      np.set('organization_id', orgId)
      np.set('code', code)
      np.set(
        'title',
        TYPE_LABEL[type] +
          ' · ' +
          (im.neighborhood || im.city || 'Feira de Santana') +
          ' · ' +
          code,
      )
      np.set('purpose', purpose)
      np.set('property_type', type)
      np.set('use_type', 'residencial')
      np.set('status', 'rascunho')
      np.set('source', 'ficha_pdf')
      np.set('captured_by', actor.id)
      np.set('owner_id', owner.id)
      np.set('publish_to', ['site'])
      np.set('last_reviewed_at', new Date().toISOString())
      Object.keys(fields).forEach((k) => {
        if (!isEmpty(fields[k])) np.set(k, fields[k])
      })
      S('imovel', np)
      return { prop: np, owner, criado: true, ownerNew }
    })
  } catch (err) {
    return e.json(400, {
      fase: fase,
      detalhe: String(
        (err && err.message) || (err && err.value && err.value.message) || 'sem mensagem',
      ),
    })
  }

  try {
    const audit = new Record($app.findCollectionByNameOrId('audit_log'))
    audit.set('organization_id', orgId)
    audit.set('actor_id', actor.id)
    audit.set('actor_role', role)
    audit.set('action', 'ficha_pdf_importada')
    audit.set('collection_name', 'properties')
    audit.set('record_id', res.prop.id)
    audit.set(
      'reason',
      'criado=' +
        res.criado +
        '; proprietario_novo=' +
        res.ownerNew +
        '; pendencias=' +
        pendencias.length,
    )
    audit.set('occurred_at', new Date().toISOString())
    $app.save(audit)
  } catch (_) {}

  return e.json(res.criado ? 201 : 200, {
    property_id: res.prop.id,
    owner_id: res.owner.id,
    code: res.prop.getString('code'),
    criado: res.criado,
    pendencias: pendencias,
  })
})
