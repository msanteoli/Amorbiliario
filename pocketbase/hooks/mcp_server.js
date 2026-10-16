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
  }

  audit('mcp_chamada', tool.name)
  return out(result)
})
