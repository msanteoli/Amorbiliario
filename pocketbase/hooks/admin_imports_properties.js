// Importa imóveis da planilha da Kenlo (só os ativos). Só o admin.
// O navegador lê o arquivo e manda as linhas com os cabeçalhos originais; o mapeamento é feito aqui.
// aceito = criado em Rascunho (sem dono e sem título); pendente = precisa de decisão (já existe);
// recusado = dado inválido. dry_run simula e não grava nada.
routerAdd(
  'POST',
  '/backend/v1/admin/imports/properties',
  (e) => {
    const actor = e.auth
    if (actor.get('active') !== true || String(actor.get('role') || '') !== 'admin') {
      throw new ForbiddenError('Só o admin importa imóveis.')
    }
    const body = e.requestInfo().body || {}
    const rows = Array.isArray(body.rows) ? body.rows : []
    if (rows.length > 500) throw new BadRequestError('Envie até 500 linhas por vez.')
    const dry = body.dry_run === true
    const orgId = String(actor.get('organization_id') || '')

    const key = (s) =>
      String(s || '')
        .toLowerCase()
        .replace(/[áàâãä]/g, 'a')
        .replace(/[éèêë]/g, 'e')
        .replace(/[íìîï]/g, 'i')
        .replace(/[óòôõö]/g, 'o')
        .replace(/[úùûü]/g, 'u')
        .replace(/ç/g, 'c')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
    const loose = (s) => {
      const stop = { condominio: 1, residencial: 1, edificio: 1, edf: 1, cond: 1 }
      return key(s)
        .split(' ')
        .filter((w) => !stop[w])
        .join(' ')
    }
    const text = (v) => String(v === undefined || v === null ? '' : v).trim()
    const money = (v) => {
      const n = Number(typeof v === 'string' ? v.replace(/\./g, '').replace(',', '.') : v)
      return isNaN(n) || n <= 0 ? 0 : n
    }
    const intOrZero = (v) => {
      const n = Math.round(Number(v))
      return isNaN(n) || n < 0 ? 0 : n
    }
    const dateIso = (s) => {
      const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text(s))
      return m ? m[3] + '-' + m[2] + '-' + m[1] : ''
    }

    const typeMap = {
      casa: 'casa',
      apartamento: 'apartamento',
      'apartamento duplex': 'apartamento',
      studio: 'apartamento',
      kitnet: 'apartamento',
      loft: 'apartamento',
      village: 'casa',
      terreno: 'terreno',
      sala: 'comercial',
      loja: 'comercial',
      ponto: 'comercial',
      predio: 'comercial',
      hotel: 'comercial',
      galpao: 'galpao',
      chacara: 'chacara',
    }
    const useMap = {
      residencial: 'residencial',
      comercial: 'comercial',
      rural: 'rural',
      temporada: 'temporada',
    }

    // endereço padrão: "Rua X, nº 271" ou "Av Y, 100"; sem número => S/N
    const parseAddress = (full) => {
      const s = text(full)
      let m = /^(.*?),?\s*n[º°o]\.?\s*([^\s,]+)\s*$/i.exec(s)
      if (!m) m = /^(.*?),\s*(\d+[A-Za-z]?)\s*$/.exec(s)
      if (m && m[1].trim()) return { street: m[1].trim(), number: m[2].trim(), sn: false }
      const noNumber = s.replace(/,?\s*s\/?n\s*$/i, '').trim()
      return { street: noNumber, number: 'S/N', sn: true }
    }

    const users = $app.findRecordsByFilter(
      'users',
      'organization_id = {:o} && active = true',
      '',
      500,
      0,
      { o: orgId },
    )
    const byName = {}
    users.forEach((u) => {
      const r = String(u.get('role') || '')
      if (r === 'corretor' || r === 'admin') byName[key(u.getString('name'))] = u.id
    })

    const counts = { aceito: 0, pendente: 0, recusado: 0 }
    const items = []
    const plan = []
    const seenCodes = {}
    const seenAddr = {}
    const condoPlan = {} // name_key -> { name, neighborhood, city, existingId }
    const similar = []

    rows.forEach((r, i) => {
      const code = text(r['Referência'])
      const out = { row: i + 1, code: code, outcome: 'aceito', reasons: [], notas: [] }
      const refuse = (reason) => {
        out.outcome = 'recusado'
        out.reasons.push(reason)
        counts.recusado++
        items.push(out)
      }
      if (text(r['Status']) !== 'Ativo') return refuse('status_nao_ativo')
      if (!code) return refuse('codigo_vazio')
      if (seenCodes[code]) return refuse('codigo_repetido_no_arquivo')
      seenCodes[code] = true

      const addr = parseAddress(r['Endereço'])
      if (!addr.street) return refuse('endereco_vazio')
      if (addr.sn) out.notas.push('numero_sn')

      // condomínio: "Nome / Bloco 2" => nome e bloco (o bloco vai para o complemento)
      const cond = text(r['Edf. / Cond.'])
      let condName = ''
      let block = ''
      if (cond) {
        const parts = cond.split(' / ')
        condName = parts[0].trim()
        block = parts.slice(1).join(' / ').trim()
      }
      let complement = text(r['Compl.'])
      if (block) complement = complement ? complement + ' - ' + block : block

      const rawType = key(r['Tipo'])
      const mappedType = typeMap[rawType] || 'outro'
      if (
        !typeMap[rawType] ||
        [
          'apartamento duplex',
          'studio',
          'kitnet',
          'loft',
          'village',
          'sala',
          'loja',
          'ponto',
          'predio',
          'hotel',
        ].indexOf(rawType) >= 0
      ) {
        out.notas.push('tipo_mapeado:' + text(r['Tipo']))
      }

      const sale = money(r['R$ Venda'])
      const rent = money(r['R$ Locação'])
      let purpose = 'venda'
      if (sale > 0 && rent > 0) purpose = 'ambos'
      else if (rent > 0) purpose = 'locacao'
      else if (sale === 0) out.notas.push('sem_preco')

      const capKey = key(r['Captador(es)'])
      let captor = byName[capKey]
      if (!captor) {
        captor = actor.id
        out.notas.push('captador_nao_encontrado')
      }

      const prop = {
        code: code,
        title: '',
        purpose: purpose,
        property_type: mappedType,
        use_type: useMap[key(r['Finalidade'])] || '',
        street: addr.street,
        street_number: addr.number,
        complement: complement,
        neighborhood: text(r['Bairro']),
        city: text(r['Cidade']),
        bedrooms: intOrZero(r['Dormitórios']),
        parking: intOrZero(r['Vagas']),
        area: money(r['Área']),
        sale_price: sale,
        rent_price: rent,
        condo_fee: money(r['R$ Cond.']),
        iptu: money(r['R$ Iptu']),
        captured_by: captor,
        condName: condName,
        registered: dateIso(r['Data de cadastro']),
        reviewed: dateIso(r['Data de atualização']),
      }

      // já existe: mesmo código, ou mesmo endereço + complemento + bairro
      const sameCode = $app.findRecordsByFilter(
        'properties',
        'organization_id = {:o} && code = {:c}',
        '',
        1,
        0,
        { o: orgId, c: code },
      )
      const snap = (p) => ({
        code: p.getString('code'),
        status: p.getString('status'),
        street: p.getString('street'),
        street_number: p.getString('street_number'),
        complement: p.getString('complement'),
        neighborhood: p.getString('neighborhood'),
        sale_price: Number(p.get('sale_price') || 0),
        rent_price: Number(p.get('rent_price') || 0),
      })
      const incoming = {
        code: prop.code,
        street: prop.street,
        street_number: prop.street_number,
        complement: prop.complement,
        neighborhood: prop.neighborhood,
        sale_price: prop.sale_price,
        rent_price: prop.rent_price,
      }
      if (sameCode.length) {
        out.outcome = 'pendente'
        out.reasons.push('codigo_existente')
        out.comparison = { existing: snap(sameCode[0]), incoming: incoming }
        counts.pendente++
        items.push(out)
        return
      }
      const addrKey = [
        key(prop.street),
        key(prop.street_number),
        key(prop.complement),
        key(prop.neighborhood),
      ].join('|')
      const sameAddr = $app
        .findRecordsByFilter(
          'properties',
          'organization_id = {:o} && neighborhood = {:b} && street_number = {:n}',
          '',
          200,
          0,
          { o: orgId, b: prop.neighborhood, n: prop.street_number },
        )
        .filter(
          (p) =>
            [
              key(p.getString('street')),
              key(p.getString('street_number')),
              key(p.getString('complement')),
              key(p.getString('neighborhood')),
            ].join('|') === addrKey,
        )
      if (sameAddr.length || seenAddr[addrKey]) {
        out.outcome = 'pendente'
        out.reasons.push('endereco_existente')
        out.comparison = {
          existing: sameAddr.length ? snap(sameAddr[0]) : { code: seenAddr[addrKey] },
          incoming: incoming,
        }
        counts.pendente++
        items.push(out)
        return
      }
      seenAddr[addrKey] = code

      if (condName) {
        const ck = key(condName)
        if (!condoPlan[ck]) {
          const ex = $app.findRecordsByFilter(
            'condominiums',
            'organization_id = {:o} && name_key = {:k}',
            '',
            1,
            0,
            { o: orgId, k: ck },
          )
          condoPlan[ck] = {
            name: condName,
            neighborhood: prop.neighborhood,
            city: prop.city,
            existingId: ex.length ? ex[0].id : '',
            loose: loose(condName),
          }
        }
      }
      counts.aceito++
      items.push(out)
      plan.push({ prop: prop, out: out, condKey: condName ? key(condName) : '' })
    })

    // condomínios parecidos (nome sem "condominio", "residencial"...): criados, mas avisados
    const allCondos = $app.findRecordsByFilter(
      'condominiums',
      'organization_id = {:o}',
      '',
      2000,
      0,
      { o: orgId },
    )
    const looseIndex = {}
    allCondos.forEach((c) => {
      looseIndex[loose(c.getString('name'))] = c.getString('name')
    })
    let created = 0
    let reused = 0
    Object.keys(condoPlan).forEach((ck) => {
      const c = condoPlan[ck]
      if (c.existingId) {
        reused++
        return
      }
      created++
      if (c.loose && looseIndex[c.loose])
        similar.push({ novo: c.name, existente: looseIndex[c.loose] })
    })

    let batchId = null
    if (!dry) {
      $app.runInTransaction((tx) => {
        const batch = new Record(tx.findCollectionByNameOrId('import_batches'))
        batch.set('organization_id', orgId)
        batch.set('kind', 'imoveis')
        batch.set('filename', String(body.filename || '').slice(0, 200))
        batch.set('created_by', actor.id)
        batch.set('state', 'aplicada')
        batch.set('counts_accepted', counts.aceito)
        batch.set('counts_pending', counts.pendente)
        batch.set('counts_rejected', counts.recusado)
        batch.set('report', items)
        tx.save(batch)
        batchId = batch.id

        const condoIds = {}
        Object.keys(condoPlan).forEach((ck) => {
          const c = condoPlan[ck]
          if (c.existingId) {
            condoIds[ck] = c.existingId
            return
          }
          const rec = new Record(tx.findCollectionByNameOrId('condominiums'))
          rec.set('organization_id', orgId)
          rec.set('name', c.name)
          rec.set('name_key', ck)
          rec.set('neighborhood', c.neighborhood)
          rec.set('city', c.city)
          rec.set('is_active', true)
          rec.set('created_batch_id', batch.id)
          tx.save(rec)
          condoIds[ck] = rec.id
        })

        const now = new Date().toISOString()
        plan.forEach((p) => {
          const rec = new Record(tx.findCollectionByNameOrId('properties'))
          rec.set('organization_id', orgId)
          rec.set('code', p.prop.code)
          rec.set('title', '')
          rec.set('purpose', p.prop.purpose)
          rec.set('property_type', p.prop.property_type)
          rec.set('use_type', p.prop.use_type)
          rec.set('status', 'rascunho')
          rec.set('street', p.prop.street)
          rec.set('street_number', p.prop.street_number)
          rec.set('complement', p.prop.complement)
          rec.set('neighborhood', p.prop.neighborhood)
          rec.set('city', p.prop.city)
          if (p.prop.bedrooms > 0) rec.set('bedrooms', p.prop.bedrooms)
          if (p.prop.parking > 0) rec.set('parking', p.prop.parking)
          if (p.prop.area > 0) rec.set('area', p.prop.area)
          if (p.prop.sale_price > 0) rec.set('sale_price', p.prop.sale_price)
          if (p.prop.rent_price > 0) rec.set('rent_price', p.prop.rent_price)
          if (p.prop.condo_fee > 0) rec.set('condo_fee', p.prop.condo_fee)
          if (p.prop.iptu > 0) rec.set('iptu', p.prop.iptu)
          rec.set('captured_by', p.prop.captured_by)
          rec.set('in_condominium', !!p.condKey)
          rec.set('condominium_id', p.condKey ? condoIds[p.condKey] : '')
          rec.set('source', 'importacao')
          rec.set('import_batch_id', batch.id)
          rec.set('last_reviewed_at', p.prop.reviewed ? p.prop.reviewed + ' 00:00:00.000Z' : now)
          tx.save(rec)

          const audit = new Record(tx.findCollectionByNameOrId('audit_log'))
          audit.set('organization_id', orgId)
          audit.set('actor_id', actor.id)
          audit.set('actor_role', 'admin')
          audit.set('action', 'imovel_importado')
          audit.set('collection_name', 'properties')
          audit.set('record_id', rec.id)
          audit.set(
            'reason',
            'cadastro_original=' + (p.prop.registered || 'desconhecido') + '; lote=' + batch.id,
          )
          audit.set('occurred_at', now)
          tx.save(audit)
        })
      })
    }

    return e.json(200, {
      dry_run: dry,
      batch_id: batchId,
      counts: counts,
      items: items,
      condominios: { criados: created, reaproveitados: reused, parecidos: similar },
    })
  },
  $apis.requireAuth(),
)
