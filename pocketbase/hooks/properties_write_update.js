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
  const body = e.requestInfo().body || {}

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

  if (rec.get('in_condominium') === true) {
    let condo = null
    try {
      condo = $app.findRecordById('condominiums', rec.getString('condominium_id'))
    } catch (_) {}
    if (!condo || condo.get('organization_id') !== rec.get('organization_id')) {
      throw new BadRequestError('Escolha o condomínio.')
    }
  } else {
    rec.set('condominium_id', '')
  }
  // a origem do cadastro não muda por edição
  rec.set('source', orig.getString('source'))
  rec.set('import_batch_id', orig.getString('import_batch_id'))

  // destaque no site: só valida quando o destaque muda (editar outro campo de um destaque
  // vencido não pode falhar)
  const hlNew = rec.getString('highlight_level') || 'comum'
  const hlOld = orig.getString('highlight_level') || 'comum'
  const untilNew = rec.getString('highlight_until')
  if (hlNew !== hlOld || untilNew !== orig.getString('highlight_until')) {
    if (hlNew === 'comum' || hlNew === 'super_destaque') {
      rec.set('highlight_until', '') // super-destaque não tem fim por data (spec 2026-10-21)
    } else if (untilNew) {
      const until = new Date(untilNew.replace(' ', 'T'))
      if (isNaN(until.getTime()) || until.getTime() <= Date.now()) {
        throw new BadRequestError('A data de fim do destaque precisa ser futura.')
      }
    }
  }

  // M12 (portais): onde anunciar, CEP e UF
  const pubAllowed = ['site', 'chaves_na_mao', 'zap', 'vivareal', 'olx']
  const pubBody = body.publish_to
  const pubRaw = Array.isArray(pubBody)
    ? pubBody
    : typeof pubBody === 'string' && pubBody !== ''
      ? [pubBody]
      : rec.getStringSlice('publish_to')
  for (let i = 0; i < pubRaw.length; i++) {
    if (pubAllowed.indexOf(String(pubRaw[i])) < 0)
      throw new BadRequestError('Opção de anúncio inválida.')
  }
  const pubOld = orig.getStringSlice('publish_to').slice().sort().join(',')
  const pubNew = rec.getStringSlice('publish_to').slice().sort().join(',')
  if (pubOld !== pubNew && ['admin', 'corretor'].indexOf(role) < 0) {
    throw new ForbiddenError('Você não pode mudar onde o imóvel é anunciado.')
  }
  const cnmOld = orig.getStringSlice('publish_to').indexOf('chaves_na_mao') >= 0
  const cnmNew = rec.getStringSlice('publish_to').indexOf('chaves_na_mao') >= 0
  const zipDigits = String(rec.getString('zip_code') || '').replace(/[^0-9]/g, '')
  if (zipDigits === '') {
    rec.set('zip_code', '')
  } else if (zipDigits.length === 8) {
    rec.set('zip_code', zipDigits.slice(0, 5) + '-' + zipDigits.slice(5))
  } else {
    throw new BadRequestError('CEP inválido. Use 8 dígitos (00000-000).')
  }
  const uf = String(rec.getString('state') || '')
    .trim()
    .toUpperCase()
  if (uf === '') {
    // edição: UF vazia não é preenchida aqui (mudaria a data de revisão de imóveis antigos)
    rec.set('state', orig.getString('state'))
  } else if (!/^[A-Z]{2}$/.test(uf)) {
    throw new BadRequestError('UF inválida. Use a sigla de duas letras (ex.: BA).')
  } else {
    rec.set('state', uf)
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
    if (r.get('in_condominium') === true && !r.getString('condominium_id')) m.push('condomínio')
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
    'use_type',
    'in_condominium',
    'condominium_id',
    'highlight_level',
    'highlight_until',
    'zip_code',
    'state',
  ]
  const changed = watched.filter((f) => String(rec.get(f)) !== String(orig.get(f)))
  // só uma edição de verdade renova a data; o valor enviado pelo cliente nunca vale
  // o destaque no site entra no histórico, mas não conta como revisão dos dados
  const reviewed = changed.filter((f) => f !== 'highlight_level' && f !== 'highlight_until')
  rec.set(
    'last_reviewed_at',
    reviewed.length ? new Date().toISOString() : orig.get('last_reviewed_at'),
  )

  const res = e.next()
  // Super-destaque (spec 2026-10-21): o efeito é nível super_destaque E situação Disponível. Ao perder o efeito, o excedente de 20 fotos
  // é arquivado (fica a capa, depois as estreladas, depois as primeiras da ordem); ao recuperar, só as arquivadas pelo sistema reativam.
  // A mesma regra de arquivar existe em negotiations_close.js (o fechamento grava a situação sem passar por este hook).
  try {
    const wasSuper =
      orig.getString('highlight_level') === 'super_destaque' &&
      orig.getString('status') === 'disponivel'
    const isSuper =
      rec.getString('highlight_level') === 'super_destaque' &&
      rec.getString('status') === 'disponivel'
    if (wasSuper !== isSuper) {
      const photoAudit = (action, reason) => {
        const a = new Record($app.findCollectionByNameOrId('audit_log'))
        a.set('organization_id', rec.get('organization_id'))
        a.set('actor_id', e.auth.id)
        a.set('actor_role', role)
        a.set('action', action)
        a.set('collection_name', 'properties')
        a.set('record_id', rec.id)
        a.set('reason', reason)
        a.set('occurred_at', new Date().toISOString())
        $app.save(a)
      }
      const act = $app.findRecordsByFilter(
        'property_photos',
        'property_id = {:p} && is_active = true',
        'position,created',
        500,
        0,
        { p: rec.id },
      )
      if (!isSuper && act.length > 20) {
        const coverId = rec.getString('cover_photo_id')
        const keep = []
        act.forEach((r) => {
          if (r.id === coverId && keep.length < 20) keep.push(r.id)
        })
        act.forEach((r) => {
          if (r.get('is_starred') === true && keep.indexOf(r.id) < 0 && keep.length < 20)
            keep.push(r.id)
        })
        act.forEach((r) => {
          if (keep.indexOf(r.id) < 0 && keep.length < 20) keep.push(r.id)
        })
        let archived = 0
        let n = 0
        act.forEach((r) => {
          if (keep.indexOf(r.id) >= 0) {
            n++
            if (r.getInt('position') !== n) {
              r.set('position', n)
              $app.save(r)
            }
          } else {
            r.set('archived_position', r.getInt('position'))
            r.set('position', 0)
            r.set('is_active', false)
            r.set('auto_archived', true)
            $app.save(r)
            archived++
          }
        })
        if (archived) photoAudit('fotos_arquivadas', 'n=' + archived)
      } else if (isSuper) {
        const arch = $app.findRecordsByFilter(
          'property_photos',
          'property_id = {:p} && auto_archived = true && is_active = false',
          'archived_position,created',
          500,
          0,
          { p: rec.id },
        )
        let pos = act.length ? act[act.length - 1].getInt('position') : 0
        let back = 0
        arch.forEach((r) => {
          if (act.length + back >= 100) return
          pos++
          back++
          r.set('is_active', true)
          r.set('auto_archived', false)
          r.set('position', pos)
          r.set('archived_position', 0)
          $app.save(r)
        })
        if (back) photoAudit('fotos_reativadas', 'n=' + back)
      }
    }
  } catch (err) {
    $app.logger().error('super_destaque_fotos_failed', 'err', String((err && err.message) || err))
  }
  try {
    // troca de captador fecha a tarefa "Confirmar captador" aberta para este imóvel
    if (capId !== orig.getString('captured_by')) {
      const abertas = $app.findRecordsByFilter(
        'tasks',
        'organization_id = {:o} && property_id = {:p} && status = "aberta" && title ~ "Confirmar captador"',
        '',
        100,
        0,
        { o: rec.getString('organization_id'), p: rec.id },
      )
      const agora = new Date().toISOString()
      abertas.forEach((t) => {
        t.set('status', 'concluida')
        t.set('closed_by', e.auth.id)
        t.set('closed_at', agora)
        $app.save(t)
      })
    }
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
    if (cnmOld !== cnmNew) {
      const pa = new Record(col)
      pa.set('organization_id', rec.get('organization_id'))
      pa.set('actor_id', e.auth.id)
      pa.set('actor_role', role)
      pa.set('action', 'portal_alterado')
      pa.set('collection_name', 'properties')
      pa.set('record_id', rec.id)
      pa.set('reason', cnmNew ? 'chaves_na_mao:on' : 'chaves_na_mao:off')
      pa.set('occurred_at', new Date().toISOString())
      $app.save(pa)
    }
  } catch (err) {
    $app.logger().error('properties_history_failed', 'err', String((err && err.message) || err))
  }
  return res
}, 'properties')
