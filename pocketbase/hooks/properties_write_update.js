// Valida o imóvel na EDIÇÃO e aplica a regra de Rascunho e imóvel completo:
//  - pedir Disponível com o imóvel incompleto é recusado, com a lista do que falta;
//  - um imóvel Disponível que perde um item volta para Rascunho;
//  - a data de revisão é sempre do servidor (o valor enviado é ignorado).
// Grava o histórico no audit_log (só nomes de campos, nunca valores). A lista de itens da
// completude NÃO é compartilhada com outros arquivos (o Skip não permite funções no topo);
// properties_ficha.js só lê, e property_photos_write_update.js só conta fotos.
onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const rec = e.record
  const orig = rec.original()
  const role = String(e.auth.get('role'))

  // Dinheiro: o motor troca nulo e texto inválido por 0 antes do hook, então aqui 0 só pode
  // significar "limpar" ou "sem valor"; a recusa de zero explícito vale na criação.

  rec.set('code', String(rec.get('code') || '').trim())
  if (rec.getString('code') !== orig.getString('code')) {
    const sameCode = $app.findRecordsByFilter(
      'properties',
      'organization_id = {:o} && code = {:c} && id != {:i}',
      '',
      1,
      0,
      { o: rec.getString('organization_id'), c: rec.getString('code'), i: rec.id },
    )
    if (sameCode.length) throw new BadRequestError('Já existe um imóvel com este código.')
  }

  const capId = rec.getString('captured_by')
  if (capId !== orig.getString('captured_by')) {
    if (role !== 'admin') throw new ForbiddenError('Só o admin muda o captador.')
    let cap = null
    try {
      cap = $app.findRecordById('users', capId)
    } catch (_) {}
    const capOk = cap && ['corretor', 'admin'].indexOf(String(cap.get('role'))) >= 0
    if (
      !capOk ||
      cap.get('active') !== true ||
      cap.get('organization_id') !== rec.get('organization_id')
    ) {
      throw new BadRequestError('Captador inválido.')
    }
  }

  const oid = rec.getString('owner_id')
  if (oid && oid !== orig.getString('owner_id')) {
    let owner = null
    try {
      owner = $app.findRecordById('clients', oid)
    } catch (_) {}
    let isOwnerKind = false
    if (owner) {
      const ks = owner.getStringSlice('kind')
      for (let i = 0; i < ks.length; i++) if (ks[i] === 'proprietario') isOwnerKind = true
    }
    if (
      !owner ||
      !isOwnerKind ||
      owner.get('organization_id') !== rec.get('organization_id') ||
      (role === 'corretor' && String(owner.get('responsible_id') || '') !== e.auth.id)
    ) {
      throw new BadRequestError('Proprietário inválido.')
    }
  }

  const missingItems = (r, photoCount) => {
    const m = []
    const num = (k) => Number(r.get(k) || 0)
    if (!r.getString('code')) m.push('código')
    if (!r.getString('title')) m.push('título')
    const purpose = r.getString('purpose')
    const consult = r.get('price_on_request') === true
    if ((purpose === 'venda' || purpose === 'ambos') && !(num('sale_price') > 0 || consult)) {
      m.push('preço de venda')
    }
    if ((purpose === 'locacao' || purpose === 'ambos') && !(num('rent_price') > 0 || consult)) {
      m.push('preço de locação')
    }
    if (!r.getString('neighborhood')) m.push('bairro')
    if (!r.getString('city')) m.push('cidade')
    if (!r.getString('street')) m.push('rua')
    if (!r.getString('street_number')) m.push('número')
    if (!(num('area') > 0)) m.push('área')
    const residential =
      ['casa', 'apartamento', 'chacara'].indexOf(r.getString('property_type')) >= 0
    if (residential && !(num('bedrooms') >= 1)) m.push('quartos')
    if (residential && !(num('bathrooms') >= 1)) m.push('banheiros')
    if (!r.getString('description')) m.push('descrição')
    if (!r.getString('owner_id')) m.push('proprietário')
    if (photoCount < 5) m.push('pelo menos 5 fotos')
    return m
  }

  let autoDraft = false
  if (rec.getString('status') === 'disponivel') {
    const photos = $app.findRecordsByFilter(
      'property_photos',
      'property_id = {:p} && is_active = true',
      '',
      100,
      0,
      { p: rec.id },
    ).length
    const missing = missingItems(rec, photos)
    if (missing.length) {
      if (orig.getString('status') === 'disponivel') {
        rec.set('status', 'rascunho')
        autoDraft = true
      } else {
        throw new BadRequestError('Imóvel incompleto. Falta: ' + missing.join(', ') + '.')
      }
    }
  }

  const watched = [
    'code',
    'title',
    'purpose',
    'property_type',
    'status',
    'street',
    'street_number',
    'complement',
    'neighborhood',
    'city',
    'bedrooms',
    'bathrooms',
    'parking',
    'area',
    'sale_price',
    'rent_price',
    'price_on_request',
    'condo_fee',
    'iptu',
    'description',
    'owner_id',
    'captured_by',
  ]
  const changed = watched.filter((f) => String(rec.get(f)) !== String(orig.get(f)))
  // só uma edição de verdade renova a data; o valor enviado pelo cliente nunca vale
  rec.set(
    'last_reviewed_at',
    changed.length ? new Date().toISOString() : orig.get('last_reviewed_at'),
  )

  const res = e.next()
  try {
    const col = $app.findCollectionByNameOrId('audit_log')
    changed.forEach((f) => {
      const audit = new Record(col)
      audit.set('organization_id', rec.get('organization_id'))
      audit.set('actor_id', e.auth.id)
      audit.set('actor_role', role)
      audit.set('action', 'imovel_alterado')
      audit.set('collection_name', 'properties')
      audit.set('record_id', rec.id)
      audit.set('field_name', f)
      audit.set('reason', f === 'status' && autoDraft ? 'auto_rascunho_incompleto' : '')
      audit.set('occurred_at', new Date().toISOString())
      $app.save(audit)
    })
  } catch (err) {
    $app.logger().error('properties_history_failed', 'err', String((err && err.message) || err))
  }
  return res
}, 'properties')
