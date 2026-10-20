// Servidor MCP do sistema (spec docs/superpowers/specs/2026-10-16-mcp-sistema-design.md).
// Uma rota, JSON-RPC: initialize, tools/list, tools/call e notificações (202).
// Autenticação: Authorization: Bearer <chave>. A chave é de um usuário; o assistente só vê o
// que esse usuário vê. Sem chave válida, organização desligada, chave revogada ou usuário inativo: 401.
// Limite: 60 chamadas por minuto por chave (contadas no audit_log, sem valores). Cada chamada gera
// 'mcp_chamada' (ferramenta, sem argumentos nem resultado). Nada apaga registros.
// Tudo que vai para o modelo é o mínimo: CPF, e-mail e telefone só para quem é responsável pelo cliente.
routerAdd('POST', '/backend/v1/mcp', (e) => {
  const send = (id, result) => e.json(200, { jsonrpc: '2.0', id: id, result: result })
  const fail = (id, code, message) =>
    e.json(200, { jsonrpc: '2.0', id: id, error: { code: code, message: message } })
  const denied = () => e.json(401, { error: 'Chave MCP inválida ou desligada.' })

  const auth = String(e.request.header.get('Authorization') || '')
  if (auth.indexOf('Bearer ') !== 0) return denied()
  const token = auth.slice(7).trim()
  if (token.length < 20) return denied()
  let key = null
  try {
    key = $app.findFirstRecordByData('mcp_keys', 'token_hash', $security.sha256(token))
  } catch (_) {
    key = null
  }
  if (!key || key.get('active') !== true || key.getString('revoked_at') !== '') return denied()
  const orgId = key.getString('organization_id')
  let org = null
  let actor = null
  try {
    org = $app.findRecordById('organizations', orgId)
    actor = $app.findRecordById('users', key.getString('user_id'))
  } catch (_) {}
  if (!org || org.get('mcp_enabled') !== true) return denied()
  const role = actor ? String(actor.get('role') || '') : ''
  if (
    !actor ||
    actor.get('active') !== true ||
    actor.get('organization_id') !== orgId ||
    ['admin', 'corretor'].indexOf(role) < 0
  ) {
    return denied()
  }

  const body = e.requestInfo().body || {}
  const id = body.id === undefined ? null : body.id
  if (body.method === undefined || String(body.method).indexOf('notifications/') === 0) {
    return e.json(202, {})
  }

  const audit = (action, reason) => {
    try {
      const a = new Record($app.findCollectionByNameOrId('audit_log'))
      a.set('organization_id', orgId)
      a.set('actor_id', actor.id)
      a.set('actor_role', role)
      a.set('action', action)
      a.set('collection_name', 'mcp_keys')
      a.set('record_id', key.id)
      a.set('reason', reason)
      a.set('occurred_at', new Date().toISOString())
      $app.save(a)
    } catch (err) {
      $app.logger().error('mcp_audit_failed', 'err', String((err && err.message) || err))
    }
  }

  if (body.method === 'initialize') {
    return send(id, {
      protocolVersion: '2025-03-26',
      capabilities: { tools: {} },
      serverInfo: { name: 'Amorbiliário', version: '1' },
    })
  }

  const tools = [
    {
      name: 'buscar_imoveis',
      description:
        'Lista imóveis da organização (código, título, finalidade, preços, bairro, cidade, status). Não traz proprietário.',
      inputSchema: { type: 'object', properties: { texto: { type: 'string' } } },
      scope: 'leitura',
    },
    {
      name: 'buscar_clientes',
      description: 'Busca clientes pelo nome. Corretor vê só os que são dele.',
      inputSchema: {
        type: 'object',
        properties: { texto: { type: 'string' } },
        required: ['texto'],
      },
      scope: 'leitura',
    },
    {
      name: 'listar_tarefas',
      description: 'Tarefas abertas. Corretor vê só as dele.',
      inputSchema: { type: 'object', properties: {} },
      scope: 'leitura',
    },
    {
      name: 'criar_tarefa',
      description: 'Cria uma tarefa para você mesmo. Precisa de chave com escopo leitura_escrita.',
      inputSchema: {
        type: 'object',
        properties: {
          titulo: { type: 'string' },
          prazo: { type: 'string', description: 'AAAA-MM-DD HH:MM:SS (UTC), opcional' },
        },
        required: ['titulo'],
      },
      scope: 'leitura_escrita',
    },
    {
      name: 'editar_imovel',
      description:
        'Edita campos de anúncio de um imóvel pelo código (só admin; chave leitura_escrita). Campos: title, description, bedrooms, bathrooms, parking, area, sale_price, rent_price, condo_fee, iptu, street, street_number, complement, neighborhood, city. Não muda status, dono nem fotos.',
      inputSchema: {
        type: 'object',
        properties: { codigo: { type: 'string' }, campos: { type: 'object' } },
        required: ['codigo', 'campos'],
      },
      scope: 'leitura_escrita',
      admin: true,
    },
    {
      name: 'definir_anuncio_imovel',
      description:
        'Define onde o imóvel é anunciado (só admin; chave leitura_escrita). publicar_em: lista de site, chaves_na_mao, zap, vivareal, olx. Lista vazia despublica de tudo.',
      inputSchema: {
        type: 'object',
        properties: {
          codigo: { type: 'string' },
          publicar_em: { type: 'array', items: { type: 'string' } },
        },
        required: ['codigo', 'publicar_em'],
      },
      scope: 'leitura_escrita',
      admin: true,
    },
    {
      name: 'editar_condominio',
      description:
        'Edita um condomínio pelo nome exato (só admin; chave leitura_escrita). Campos: street, neighborhood, city, amenities, infrastructure, rules. Não renomeia.',
      inputSchema: {
        type: 'object',
        properties: { nome: { type: 'string' }, campos: { type: 'object' } },
        required: ['nome', 'campos'],
      },
      scope: 'leitura_escrita',
      admin: true,
    },
  ]

  if (body.method === 'tools/list') {
    return send(id, {
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    })
  }
  if (body.method !== 'tools/call') return fail(id, -32601, 'Método não suportado.')

  const params = body.params || {}
  const tool = tools.filter((t) => t.name === String(params.name || ''))[0]
  if (!tool) return fail(id, -32602, 'Ferramenta desconhecida.')
  if (tool.scope === 'leitura_escrita' && key.getString('scope') !== 'leitura_escrita') {
    audit('mcp_negado', 'escopo_somente_leitura')
    return fail(id, -32001, 'Esta chave é só de leitura.')
  }
  if (tool.admin === true && role !== 'admin') {
    audit('mcp_negado', 'so_admin_edita')
    return fail(id, -32003, 'Só o admin edita pelo MCP.')
  }

  // limite: 60 chamadas por minuto por chave
  const umMinuto = new Date(Date.now() - 60000).toISOString().replace('T', ' ')
  const recentes = $app.findRecordsByFilter(
    'audit_log',
    "action = 'mcp_chamada' && record_id = {:k} && occurred_at >= {:m}",
    '',
    61,
    0,
    { k: key.id, m: umMinuto },
  )
  if (recentes.length >= 60) {
    audit('mcp_limite', '')
    return e.json(429, {
      jsonrpc: '2.0',
      id: id,
      error: { code: -32029, message: 'Limite de 60 chamadas por minuto.' },
    })
  }

  $app
    .db()
    .newQuery('UPDATE mcp_keys SET last_used_at = {:n} WHERE id = {:id}')
    .bind({ n: new Date().toISOString(), id: key.id })
    .execute()
  const args = params.arguments || {}
  const soCorretor = role === 'corretor'
  const texto = (s) =>
    String(s || '')
      .trim()
      .replace(/[%_]/g, '')
  const out = (obj) => send(id, { content: [{ type: 'text', text: JSON.stringify(obj) }] })

  let result = null
  if (tool.name === 'buscar_imoveis') {
    const t = texto(args.texto)
    const filtro =
      'organization_id = {:o}' +
      (t ? ' && (title ~ {:t} || code ~ {:t} || neighborhood ~ {:t} || city ~ {:t})' : '')
    const rows = $app.findRecordsByFilter('properties', filtro, '-created', 50, 0, {
      o: orgId,
      t: t,
    })
    result = rows.map((p) => ({
      codigo: p.getString('code'),
      titulo: p.getString('title'),
      finalidade: p.getString('purpose'),
      venda: p.get('sale_price') || null,
      locacao: p.get('rent_price') || null,
      bairro: p.getString('neighborhood'),
      cidade: p.getString('city'),
      status: p.getString('status'),
    }))
  } else if (tool.name === 'buscar_clientes') {
    const t = texto(args.texto)
    if (!t) return fail(id, -32602, 'Informe o nome.')
    const filtro =
      'organization_id = {:o} && name ~ {:t}' + (soCorretor ? ' && responsible_id = {:u}' : '')
    const rows = $app.findRecordsByFilter('clients', filtro, 'name', 20, 0, {
      o: orgId,
      t: t,
      u: actor.id,
    })
    result = rows.map((c) => ({ nome: c.getString('name'), tipo: c.getStringSlice('kind') }))
  } else if (tool.name === 'listar_tarefas') {
    const filtro =
      'organization_id = {:o} && status = "aberta"' + (soCorretor ? ' && assigned_to = {:u}' : '')
    const rows = $app.findRecordsByFilter('tasks', filtro, 'due_at', 50, 0, {
      o: orgId,
      u: actor.id,
    })
    result = rows.map((t) => ({ titulo: t.getString('title'), prazo: t.getString('due_at') }))
  } else if (tool.name === 'criar_tarefa') {
    const titulo = String(args.titulo || '').trim()
    if (titulo.length < 2) return fail(id, -32602, 'Informe o título da tarefa.')
    const col = $app.findCollectionByNameOrId('tasks')
    const t = new Record(col)
    t.set('organization_id', orgId)
    t.set('title', titulo)
    t.set('status', 'aberta')
    t.set('assigned_to', actor.id)
    t.set('created_by', actor.id)
    if (args.prazo) t.set('due_at', String(args.prazo))
    $app.save(t)
    result = { id: t.id, titulo: titulo }
  } else if (tool.name === 'editar_imovel' || tool.name === 'definir_anuncio_imovel') {
    const rows = $app.findRecordsByFilter(
      'properties',
      'organization_id = {:o} && code = {:c}',
      '',
      1,
      0,
      { o: orgId, c: String(args.codigo || '').trim() },
    )
    if (!rows.length) return fail(id, -32004, 'Imóvel não encontrado.')
    const p = rows[0]
    const orig = p.original()
    const changed = []
    let cnm = false
    if (tool.name === 'definir_anuncio_imovel') {
      const allowed = ['site', 'chaves_na_mao', 'zap', 'vivareal', 'olx']
      const list = Array.isArray(args.publicar_em) ? args.publicar_em.map((x) => String(x)) : null
      if (!list) return fail(id, -32602, 'Informe publicar_em como lista.')
      for (let i = 0; i < list.length; i++) {
        if (allowed.indexOf(list[i]) < 0)
          return fail(id, -32602, 'Opção de anúncio inválida. Use: ' + allowed.join(', ') + '.')
      }
      const before = p.getStringSlice('publish_to')
      cnm = before.indexOf('chaves_na_mao') >= 0 !== list.indexOf('chaves_na_mao') >= 0
      if (before.slice().sort().join(',') !== list.slice().sort().join(','))
        changed.push('publish_to')
      p.set('publish_to', list)
    } else {
      const campos =
        args.campos && typeof args.campos === 'object' && !Array.isArray(args.campos)
          ? args.campos
          : null
      if (!campos) return fail(id, -32602, 'Informe campos como objeto.')
      const textos = {
        title: 200,
        description: 5000,
        street: 160,
        street_number: 20,
        complement: 160,
        neighborhood: 160,
        city: 160,
      }
      const inteiros = ['bedrooms', 'bathrooms', 'parking']
      const decimais = ['area', 'sale_price', 'rent_price', 'condo_fee', 'iptu']
      const keys = Object.keys(campos)
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i]
        const v = campos[k]
        if (textos[k] !== undefined) {
          const t = String(v === null || v === undefined ? '' : v).trim()
          if (t.length > textos[k]) return fail(id, -32602, 'Texto grande demais em ' + k + '.')
          p.set(k, t)
        } else if (inteiros.indexOf(k) >= 0) {
          const n = Number(v)
          if (
            typeof v === 'boolean' ||
            v === '' ||
            v === null ||
            !isFinite(n) ||
            n < 0 ||
            Math.floor(n) !== n
          )
            return fail(id, -32602, 'Valor inválido em ' + k + '.')
          p.set(k, n)
        } else if (decimais.indexOf(k) >= 0) {
          const n = Number(v)
          if (typeof v === 'boolean' || v === '' || v === null || !isFinite(n) || n < 0)
            return fail(id, -32602, 'Valor inválido em ' + k + '.')
          p.set(k, n)
        } else {
          return fail(
            id,
            -32602,
            'Campo não permitido: ' +
              k +
              '. Permitidos: ' +
              Object.keys(textos).concat(inteiros, decimais).join(', ') +
              '.',
          )
        }
      }
      // imóvel Disponível continua completo (o save dentro do endpoint não dispara a validação da edição normal)
      if (p.getString('status') === 'disponivel') {
        const pu = p.getString('purpose')
        const consult = p.get('price_on_request') === true
        const falta = []
        if (!p.getString('title')) falta.push('título')
        if (!p.getString('description')) falta.push('descrição')
        if (!p.getString('street')) falta.push('rua')
        if (!p.getString('street_number')) falta.push('número')
        if (!p.getString('neighborhood')) falta.push('bairro')
        if (!p.getString('city')) falta.push('cidade')
        if (!(Number(p.get('area') || 0) > 0)) falta.push('área')
        if (
          (pu === 'venda' || pu === 'ambos') &&
          !(Number(p.get('sale_price') || 0) > 0 || consult)
        )
          falta.push('preço de venda')
        if (
          (pu === 'locacao' || pu === 'ambos') &&
          !(Number(p.get('rent_price') || 0) > 0 || consult)
        )
          falta.push('preço de locação')
        if (falta.length)
          return fail(
            id,
            -32602,
            'Imóvel Disponível precisa continuar completo. Falta: ' + falta.join(', ') + '.',
          )
      }
      const watched = Object.keys(textos).concat(inteiros, decimais)
      watched.forEach((f) => {
        if (String(p.get(f)) !== String(orig.get(f))) changed.push(f)
      })
      if (changed.length) p.set('last_reviewed_at', new Date().toISOString())
    }
    if (changed.length) {
      $app.save(p)
      const col = $app.findCollectionByNameOrId('audit_log')
      const rec = (action, field, reason) => {
        const a = new Record(col)
        a.set('organization_id', orgId)
        a.set('actor_id', actor.id)
        a.set('actor_role', role)
        a.set('action', action)
        a.set('collection_name', 'properties')
        a.set('record_id', p.id)
        if (field) a.set('field_name', field)
        a.set('reason', reason)
        a.set('occurred_at', new Date().toISOString())
        $app.save(a)
      }
      try {
        changed.forEach((f) => rec('imovel_alterado', f, 'mcp'))
        if (cnm)
          rec(
            'portal_alterado',
            '',
            p.getStringSlice('publish_to').indexOf('chaves_na_mao') >= 0
              ? 'chaves_na_mao:on'
              : 'chaves_na_mao:off',
          )
      } catch (err) {
        $app.logger().error('mcp_audit_failed', 'err', String((err && err.message) || err))
      }
    }
    result = { codigo: p.getString('code'), alterados: changed }
  } else if (tool.name === 'editar_condominio') {
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
    const rows = $app.findRecordsByFilter(
      'condominiums',
      'organization_id = {:o} && name_key = {:k}',
      '',
      1,
      0,
      { o: orgId, k: key(args.nome) },
    )
    if (!rows.length) return fail(id, -32004, 'Condomínio não encontrado.')
    const c = rows[0]
    const campos =
      args.campos && typeof args.campos === 'object' && !Array.isArray(args.campos)
        ? args.campos
        : null
    if (!campos) return fail(id, -32602, 'Informe campos como objeto.')
    const max = {
      street: 160,
      neighborhood: 160,
      city: 160,
      amenities: 2000,
      infrastructure: 2000,
      rules: 2000,
    }
    const changed = []
    const keys = Object.keys(campos)
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]
      if (max[k] === undefined)
        return fail(
          id,
          -32602,
          'Campo não permitido: ' + k + '. Permitidos: ' + Object.keys(max).join(', ') + '.',
        )
      const t = String(campos[k] === null || campos[k] === undefined ? '' : campos[k]).trim()
      if (t.length > max[k]) return fail(id, -32602, 'Texto grande demais em ' + k + '.')
      if (t !== c.getString(k)) changed.push(k)
      c.set(k, t)
    }
    if (changed.length) {
      $app.save(c)
      try {
        const col = $app.findCollectionByNameOrId('audit_log')
        changed.forEach((f) => {
          const a = new Record(col)
          a.set('organization_id', orgId)
          a.set('actor_id', actor.id)
          a.set('actor_role', role)
          a.set('action', 'condominio_alterado')
          a.set('collection_name', 'condominiums')
          a.set('record_id', c.id)
          a.set('field_name', f)
          a.set('reason', 'mcp')
          a.set('occurred_at', new Date().toISOString())
          $app.save(a)
        })
      } catch (err) {
        $app.logger().error('mcp_audit_failed', 'err', String((err && err.message) || err))
      }
    }
    result = { condominio: c.getString('name'), alterados: changed }
  }

  audit('mcp_chamada', tool.name)
  return out(result)
})
