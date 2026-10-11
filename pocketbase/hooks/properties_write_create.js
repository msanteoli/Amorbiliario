// Valida o imóvel na CRIAÇÃO: código, dinheiro (zero e negativo recusados), proprietário e
// captador válidos. O imóvel sempre nasce em Rascunho e a data de revisão é do servidor.
// Grava o histórico no audit_log (só nomes de campos, nunca valores).
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const rec = e.record
  const body = e.requestInfo().body || {}
  const role = String(e.auth.get('role'))

  const moneyFields = ['sale_price', 'rent_price', 'condo_fee', 'iptu']
  moneyFields.forEach((f) => {
    const v = body[f]
    // o motor troca nulo e texto inválido por 0 antes do hook; na criação a tela omite o campo
    const isNum = typeof v === 'number'
    const isStr = typeof v === 'string' && v.trim() !== ''
    if (isNum || isStr) {
      const n = Number(v)
      if (isNaN(n)) throw new BadRequestError('Valor inválido.')
      if (n === 0) {
        throw new BadRequestError('Valor zero não é válido. Deixe em branco quando não informado.')
      }
    }
  })

  rec.set('code', String(rec.get('code') || '').trim())
  if (!rec.getString('code')) throw new BadRequestError('Informe o código do imóvel.')
  const sameCode = $app.findRecordsByFilter(
    'properties',
    'organization_id = {:o} && code = {:c}',
    '',
    1,
    0,
    { o: rec.getString('organization_id'), c: rec.getString('code') },
  )
  if (sameCode.length) throw new BadRequestError('Já existe um imóvel com este código.')

  // captador: usuário ativo da mesma organização, com papel corretor ou admin
  let cap = null
  try {
    cap = $app.findRecordById('users', rec.getString('captured_by'))
  } catch (_) {}
  const capOk = cap && ['corretor', 'admin'].indexOf(String(cap.get('role'))) >= 0
  if (
    !capOk ||
    cap.get('active') !== true ||
    cap.get('organization_id') !== rec.get('organization_id')
  ) {
    throw new BadRequestError('Captador inválido.')
  }

  // proprietário: cliente do tipo proprietário, da mesma organização; o corretor só
  // pode apontar cliente que ele mesmo enxerga (do qual é responsável)
  const oid = rec.getString('owner_id')
  if (oid) {
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

  // condomínio: com "em condomínio" marcado, o condomínio é obrigatório e da mesma organização
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
  // origem: só a importação grava estes campos
  rec.set('source', 'manual')
  rec.set('import_batch_id', '')

  // destaque no site: nível opcional; data de fim, se houver, precisa ser futura
  const hl = rec.getString('highlight_level') || 'comum'
  if (hl === 'comum') {
    rec.set('highlight_until', '')
  } else if (rec.getString('highlight_until')) {
    const until = new Date(rec.getString('highlight_until').replace(' ', 'T'))
    if (isNaN(until.getTime()) || until.getTime() <= Date.now()) {
      throw new BadRequestError('A data de fim do destaque precisa ser futura.')
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
  if (!pubRaw.length) rec.set('publish_to', ['site'])
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
    rec.set('state', 'BA')
  } else if (!/^[A-Z]{2}$/.test(uf)) {
    throw new BadRequestError('UF inválida. Use a sigla de duas letras (ex.: BA).')
  } else {
    rec.set('state', uf)
  }

  rec.set('status', 'rascunho')
  rec.set('last_reviewed_at', new Date().toISOString())

  const res = e.next()
  try {
    const col = $app.findCollectionByNameOrId('audit_log')
    const audit = new Record(col)
    audit.set('organization_id', rec.get('organization_id'))
    audit.set('actor_id', e.auth.id)
    audit.set('actor_role', role)
    audit.set('action', 'imovel_criado')
    audit.set('collection_name', 'properties')
    audit.set('record_id', rec.id)
    audit.set('occurred_at', new Date().toISOString())
    $app.save(audit)
    if (rec.getStringSlice('publish_to').indexOf('chaves_na_mao') >= 0) {
      const pa = new Record(col)
      pa.set('organization_id', rec.get('organization_id'))
      pa.set('actor_id', e.auth.id)
      pa.set('actor_role', role)
      pa.set('action', 'portal_alterado')
      pa.set('collection_name', 'properties')
      pa.set('record_id', rec.id)
      pa.set('reason', 'chaves_na_mao:on')
      pa.set('occurred_at', new Date().toISOString())
      $app.save(pa)
    }
  } catch (err) {
    $app.logger().error('properties_history_failed', 'err', String((err && err.message) || err))
  }
  return res
}, 'properties')
