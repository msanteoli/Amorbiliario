// Valida o imóvel na CRIAÇÃO: dinheiro (zero e negativo recusados), proprietário e
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

  // Cadastro livre (spec 2026-10-21): nenhum dado é obrigatório. Sem código, o servidor gera um pela sequência da organização
  // (mesmo formato da importação da ficha: prefixo do tipo + 4 dígitos); sem título, usa um provisório. O que falta vira pendência.
  rec.set('code', String(rec.get('code') || '').trim())
  if (!rec.getString('code')) {
    const prefixes = {
      casa: 'CA',
      apartamento: 'AP',
      terreno: 'TE',
      comercial: 'CO',
      galpao: 'GA',
      chacara: 'CH',
      outro: 'OU',
    }
    const pre = prefixes[rec.getString('property_type')] || 'OU'
    let gen = ''
    $app.runInTransaction((tx) => {
      const orgRec = tx.findRecordById('organizations', rec.getString('organization_id'))
      let seq = orgRec.getInt('property_code_seq')
      for (let tries = 0; tries < 200; tries++) {
        seq++
        const cand = pre + '-' + String(seq).padStart(4, '0')
        const taken = tx.findRecordsByFilter(
          'properties',
          'organization_id = {:o} && code = {:c}',
          '',
          1,
          0,
          {
            o: rec.getString('organization_id'),
            c: cand,
          },
        )
        if (!taken.length) {
          gen = cand
          break
        }
      }
      orgRec.set('property_code_seq', seq)
      tx.save(orgRec)
    })
    rec.set('code', gen)
  }
  if (!String(rec.get('title') || '').trim())
    rec.set('title', 'Imóvel sem título ' + rec.getString('code'))
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
  // Pendências (spec 2026-10-21-cadastro-livre): cada dado ausente vira uma tarefa para o captador (prazo de 3 dias; description
  // "pend:<chave>"); preencher o dado fecha a tarefa. A MESMA lógica existe em properties_write_create.js, properties_write_update.js e
  // properties_pending_cron.js (o Skip não compartilha funções entre arquivos): mexeu aqui, mexa nos outros dois.
  try {
    const p = rec
    const live = ['rascunho', 'disponivel', 'reservado'].indexOf(p.getString('status')) >= 0
    const labels = {
      titulo: 'o título',
      preco_venda: 'o preço de venda',
      preco_locacao: 'o preço de locação',
      bairro: 'o bairro',
      cidade: 'a cidade',
      rua: 'a rua',
      numero: 'o número',
      area: 'a área',
      quartos: 'os quartos',
      banheiros: 'os banheiros',
      descricao: 'a descrição',
      proprietario: 'o proprietário',
      condominio: 'o condomínio',
      fotos: 'as fotos (pelo menos 5)',
    }
    const missing = {}
    if (live) {
      const num = (k) => Number(p.get(k) || 0)
      const pu = p.getString('purpose')
      const consult = p.get('price_on_request') === true
      const t = p.getString('title')
      if (!t || t.indexOf('Imóvel sem título') === 0) missing.titulo = true
      if ((pu === 'venda' || pu === 'ambos') && !(num('sale_price') > 0 || consult))
        missing.preco_venda = true
      if ((pu === 'locacao' || pu === 'ambos') && !(num('rent_price') > 0 || consult))
        missing.preco_locacao = true
      if (!p.getString('neighborhood')) missing.bairro = true
      if (!p.getString('city')) missing.cidade = true
      if (!p.getString('street')) missing.rua = true
      if (!p.getString('street_number')) missing.numero = true
      if (!(num('area') > 0)) missing.area = true
      const residential =
        ['casa', 'apartamento', 'chacara'].indexOf(p.getString('property_type')) >= 0
      if (residential && !(num('bedrooms') >= 1)) missing.quartos = true
      if (residential && !(num('bathrooms') >= 1)) missing.banheiros = true
      if (!p.getString('description')) missing.descricao = true
      if (!p.getString('owner_id')) missing.proprietario = true
      if (p.get('in_condominium') === true && !p.getString('condominium_id'))
        missing.condominio = true
      const nPhotos = $app.findRecordsByFilter(
        'property_photos',
        'property_id = {:p} && is_active = true',
        '',
        100,
        0,
        { p: p.id },
      ).length
      if (nPhotos < 5) missing.fotos = true
    }
    const open = $app.findRecordsByFilter(
      'tasks',
      "property_id = {:p} && status = 'aberta' && description ~ 'pend:'",
      '',
      300,
      0,
      { p: p.id },
    )
    const byKey = {}
    const agora = new Date().toISOString()
    open.forEach((t) => {
      const m = /^pend:([a-z_]+)/.exec(t.getString('description'))
      if (!m) return
      const dup = !!byKey[m[1]]
      if (dup || !missing[m[1]]) {
        t.set('status', dup || !live ? 'cancelada' : 'concluida')
        t.set('closed_at', agora)
        t.set('closed_by', e.auth.id)
        $app.save(t)
      } else {
        byKey[m[1]] = t
      }
    })
    Object.keys(missing).forEach((k) => {
      if (byKey[k]) return
      const nt = new Record($app.findCollectionByNameOrId('tasks'))
      nt.set('organization_id', p.getString('organization_id'))
      nt.set('title', 'Preencher ' + labels[k] + ' do imóvel ' + p.getString('code'))
      nt.set('description', 'pend:' + k)
      nt.set('assigned_to', p.getString('captured_by'))
      nt.set('status', 'aberta')
      nt.set('property_id', p.id)
      nt.set('created_by', e.auth.id)
      nt.set('due_at', new Date(Date.now() + 3 * 86400000).toISOString())
      $app.save(nt)
    })
  } catch (err) {
    $app.logger().error('pendencias_failed', 'err', String((err && err.message) || err))
  }
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
