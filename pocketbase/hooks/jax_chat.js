// JaX, fase 1 (spec docs/superpowers/specs/2026-11-15-jax-app-corretor-design.md): a IA do app do corretor.
// POST /backend/v1/jax/chat, com um destes corpos:
//   { conversation_id?, message }                                   -> pergunta (até 2.000 caracteres)
//   { conversation_id, acao_confirmada: { message_id, task_id } }   -> registra "Tarefa criada" (o app já gravou a tarefa)
//   { ferramenta: { nome, args } }                                  -> modo teste, só admin: executa uma ferramenta sem a IA
// Só admin e corretor. Conversas só do dono. 30 perguntas por pessoa por hora (audit_log 'jax_pergunta', sem o texto).
// Portabilidade: a IA só é chamada no bloco "ÚNICO PONTO DE CHAMADA AO MODELO"; trocar ali para sair do Skip.
// Atenção (goja): nada de função ou variável no topo do arquivo; tudo dentro do callback.
routerAdd(
  'POST',
  '/backend/v1/jax/chat',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    const orgId = String(actor.get('organization_id') || '')
    const ativo = actor.get('active') === true
    const audit = (action, recordId, reason) => {
      try {
        const a = new Record($app.findCollectionByNameOrId('audit_log'))
        a.set('organization_id', orgId)
        a.set('actor_id', actor.id)
        a.set('actor_role', role)
        a.set('action', action)
        a.set('collection_name', 'jax_messages')
        a.set('record_id', recordId || '')
        a.set('reason', reason || '')
        a.set('occurred_at', new Date().toISOString())
        $app.save(a)
      } catch (err) {
        $app.logger().error('jax_audit_failed', 'err', String((err && err.message) || err))
      }
    }
    if (!ativo || ['admin', 'corretor'].indexOf(role) < 0) {
      audit('acesso_negado', '', ativo ? 'papel_sem_permissao' : 'conta_inativa')
      throw new ForbiddenError(
        ativo ? 'Papel sem acesso a estes dados.' : 'Conta inativa. Fale com o administrador.',
      )
    }

    const body = e.requestInfo().body || {}
    const nova = (colecao) => new Record($app.findCollectionByNameOrId(colecao))
    const minhaConversa = (id) => {
      let c = null
      try {
        c = $app.findRecordById('jax_conversations', String(id || ''))
      } catch (_) {}
      if (!c || c.getString('user_id') !== actor.id || c.getString('organization_id') !== orgId)
        return null
      return c
    }
    const salvarMensagem = (conv, papel, conteudo, extra) => {
      const m = nova('jax_messages')
      m.set('organization_id', orgId)
      m.set('conversation_id', conv.id)
      m.set('user_id', actor.id)
      m.set('role', papel)
      m.set('content', String(conteudo || '').slice(0, 8000))
      const x = extra || {}
      if (x.referencias) m.set('referencias', x.referencias)
      if (x.proposta) m.set('proposta', x.proposta)
      if (x.tokens) m.set('tokens', x.tokens)
      if (x.modelo) m.set('modelo', String(x.modelo).slice(0, 120))
      $app.save(m)
      return m
    }

    // ================= FERRAMENTAS (spec §5.3) =================
    // Rodam com $app, então REPRODUZEM nas consultas as regras de acesso: sempre organization_id da pessoa e,
    // para o corretor, só o que é dele. Nunca devolvem CPF, nascimento, client_private, proprietário nem documentos.
    const soCorretor = role === 'corretor'
    const LIMITE = 20
    const txt = (s) =>
      String(s || '')
        .trim()
        .replace(/[%_]/g, '')
    const num = (v) => {
      const n = Number(v)
      return isFinite(n) && n > 0 ? n : null
    }
    const cache = {}
    const nomeDe = (colecao, id, campo) => {
      if (!id) return ''
      const k = colecao + ':' + id
      if (cache[k] === undefined) {
        try {
          cache[k] = $app.findRecordById(colecao, id).getString(campo)
        } catch (_) {
          cache[k] = ''
        }
      }
      return cache[k]
    }
    const paraArray = (rows) => {
      const arr = []
      for (let i = 0; i < rows.length; i++) arr.push(rows[i])
      return arr
    }
    const lista = (rows, mapa) => {
      const arr = paraArray(rows)
      return { itens: arr.slice(0, LIMITE).map(mapa), mais: arr.length > LIMITE }
    }
    const diaUTC = (s) => {
      // 'AAAA-MM-DD' em America/Bahia -> [inicio, fim) em UTC, no formato do banco
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''))
      let ini = null
      if (m) ini = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 3))
      else {
        const b = new Date(Date.now() - 3 * 3600000)
        ini = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate(), 3))
      }
      const fim = new Date(ini.getTime() + 86400000)
      return [ini.toISOString().replace('T', ' '), fim.toISOString().replace('T', ' ')]
    }
    const imovelItem = (p) => ({
      id: p.id,
      codigo: p.getString('code'),
      titulo: p.getString('title'),
      finalidade: p.getString('purpose'),
      tipo: p.getString('property_type'),
      venda: p.get('sale_price') || null,
      locacao: p.get('rent_price') || null,
      sob_consulta: p.get('price_on_request') === true,
      bairro: p.getString('neighborhood'),
      cidade: p.getString('city'),
      quartos: p.get('bedrooms') || null,
      area: p.get('area') || null,
      situacao: p.getString('status'),
    })
    const leadItem = (l) => {
      const ref =
        l.getString('last_contact_at') || l.getString('first_contact_at') || l.getString('created')
      const parado = ref
        ? Math.max(
            0,
            Math.floor((Date.now() - new Date(ref.replace(' ', 'T')).getTime()) / 86400000),
          )
        : 0
      return {
        id: l.id,
        nome: l.getString('name'),
        telefone: l.getString('phone'),
        etapa: l.getString('stage'),
        origem: l.getString('origin'),
        busca: {
          tipo: l.getString('search_type'),
          bairros: l.getString('search_neighborhood') || l.getString('search_neighborhoods'),
          quartos: l.get('search_bedrooms') || null,
          preco_max: l.get('search_max_price') || null,
        },
        proximo_passo: l.getString('next_step'),
        prazo_proximo_passo: l.getString('next_step_due'),
        dias_parado: parado,
        responsavel: soCorretor ? undefined : nomeDe('users', l.getString('assigned_to'), 'name'),
      }
    }
    const visitaItem = (v) => ({
      id: v.id,
      inicio: v.getString('start_at'),
      situacao: v.getString('status'),
      imovel: nomeDe('properties', v.getString('property_id'), 'code'),
      bairro: nomeDe('properties', v.getString('property_id'), 'neighborhood'),
      pessoa: v.getString('lead_id')
        ? nomeDe('leads', v.getString('lead_id'), 'name')
        : nomeDe('clients', v.getString('client_id'), 'name'),
      corretor: soCorretor ? undefined : nomeDe('users', v.getString('broker_id'), 'name'),
    })
    const tarefaItem = (t) => ({
      id: t.id,
      titulo: t.getString('title'),
      prazo: t.getString('due_at'),
      situacao: t.getString('status'),
      responsavel: soCorretor ? undefined : nomeDe('users', t.getString('assigned_to'), 'name'),
    })
    const executar = (nome, args) => {
      const a = args && typeof args === 'object' ? args : {}
      const P = { o: orgId, u: actor.id }
      if (nome === 'buscar_imoveis') {
        const f = ['organization_id = {:o}']
        const t = txt(a.texto)
        if (t) {
          f.push('(title ~ {:t} || code ~ {:t} || neighborhood ~ {:t} || city ~ {:t})')
          P.t = t
        }
        const sit = a.situacao === undefined ? 'disponivel' : txt(a.situacao)
        if (sit) {
          f.push('status = {:s}')
          P.s = sit
        }
        if (a.finalidade === 'venda' || a.finalidade === 'locacao') {
          f.push("(purpose = {:fi} || purpose = 'ambos')")
          P.fi = a.finalidade
        }
        if (txt(a.tipo)) {
          f.push('property_type = {:ti}')
          P.ti = txt(a.tipo)
        }
        if (txt(a.bairro)) {
          f.push('neighborhood ~ {:b}')
          P.b = txt(a.bairro)
        }
        if (num(a.quartos_min)) {
          f.push('bedrooms >= {:q}')
          P.q = num(a.quartos_min)
        }
        if (num(a.preco_max)) {
          f.push(
            '((sale_price > 0 && sale_price <= {:pm}) || (rent_price > 0 && rent_price <= {:pm}))',
          )
          P.pm = num(a.preco_max)
        }
        return lista(
          $app.findRecordsByFilter('properties', f.join(' && '), '-updated', LIMITE + 1, 0, P),
          imovelItem,
        )
      }
      if (nome === 'ver_imovel') {
        const rows = $app.findRecordsByFilter(
          'properties',
          'organization_id = {:o} && code = {:c}',
          '',
          1,
          0,
          { o: orgId, c: txt(a.codigo) },
        )
        if (!rows.length) return { erro: 'Imóvel não encontrado.' }
        const item = imovelItem(rows[0])
        item.descricao = rows[0].getString('description').slice(0, 1500)
        item.banheiros = rows[0].get('bathrooms') || null
        item.suites = rows[0].get('suites') || null
        item.vagas = rows[0].get('parking') || null
        item.condominio_valor = rows[0].get('condo_fee') || null
        item.captador = nomeDe('users', rows[0].getString('captured_by'), 'name')
        return { item: item }
      }
      if (nome === 'buscar_leads') {
        const f = ['organization_id = {:o}']
        if (soCorretor) f.push('assigned_to = {:u}')
        const t = txt(a.texto)
        if (t) {
          f.push('(name ~ {:t} || phone ~ {:t})')
          P.t = t
        }
        if (txt(a.etapa)) {
          f.push('stage = {:e}')
          P.e = txt(a.etapa)
        } else f.push("stage != 'ganho' && stage != 'perdido'")
        const rows = paraArray(
          $app.findRecordsByFilter('leads', f.join(' && '), '-created', 200, 0, P),
        )
        const d = num(a.parados_ha_dias)
        let itens = rows.map(leadItem)
        if (d) itens = itens.filter((x) => x.dias_parado >= d)
        return { itens: itens.slice(0, LIMITE), mais: itens.length > LIMITE }
      }
      if (nome === 'ver_lead') {
        let l = null
        if (a.id) {
          try {
            l = $app.findRecordById('leads', txt(a.id))
          } catch (_) {}
        } else if (txt(a.nome)) {
          const f =
            'organization_id = {:o} && name ~ {:n}' + (soCorretor ? ' && assigned_to = {:u}' : '')
          const rows = $app.findRecordsByFilter('leads', f, '-created', 5, 0, {
            o: orgId,
            n: txt(a.nome),
            u: actor.id,
          })
          if (rows.length > 1)
            return {
              candidatos: paraArray(rows).map((r) => ({ id: r.id, nome: r.getString('name') })),
            }
          l = rows[0] || null
        }
        if (
          !l ||
          l.getString('organization_id') !== orgId ||
          (soCorretor && l.getString('assigned_to') !== actor.id)
        ) {
          return { erro: 'Lead não encontrado.' }
        }
        const item = leadItem(l)
        item.notas = l.getString('notes').slice(0, 1000)
        item.linha_do_tempo = paraArray(
          $app.findRecordsByFilter(
            'lead_events',
            'lead_id = {:l}',
            '-occurred_at,-created',
            10,
            0,
            { l: l.id },
          ),
        ).map((ev) => ({
          tipo: ev.getString('type'),
          quando: ev.getString('occurred_at') || ev.getString('created'),
          texto: ev.getString('text').slice(0, 300),
        }))
        return { item: item }
      }
      if (nome === 'buscar_clientes') {
        const t = txt(a.texto)
        if (!t) return { erro: 'Informe o nome ou o telefone.' }
        const f =
          'organization_id = {:o} && (name ~ {:t} || phone ~ {:t})' +
          (soCorretor ? ' && responsible_id = {:u}' : '')
        const rows = $app.findRecordsByFilter('clients', f, 'name', LIMITE + 1, 0, {
          o: orgId,
          t: t,
          u: actor.id,
        })
        return lista(rows, (c) => ({
          id: c.id,
          nome: c.getString('name'),
          telefone: c.getString('phone'),
          tipo: c.getStringSlice('kind'),
        }))
      }
      if (nome === 'listar_tarefas') {
        const f = ["organization_id = {:o} && status = 'aberta'"]
        if (soCorretor) f.push('assigned_to = {:u}')
        const ate = /^\d{4}-\d{2}-\d{2}$/.test(String(a.ate || '')) ? diaUTC(a.ate)[1] : ''
        if (ate) {
          f.push("due_at != '' && due_at < {:ate}")
          P.ate = ate
        }
        return lista(
          $app.findRecordsByFilter('tasks', f.join(' && '), 'due_at,created', LIMITE + 1, 0, P),
          tarefaItem,
        )
      }
      if (nome === 'listar_visitas') {
        const ini = diaUTC(a.de)[0]
        const fim = diaUTC(a.ate || a.de)[1]
        const f = ['organization_id = {:o} && start_at >= {:a} && start_at < {:b}']
        P.a = ini
        P.b = fim
        if (soCorretor) f.push('broker_id = {:u}')
        if (txt(a.situacao)) {
          f.push('status = {:s}')
          P.s = txt(a.situacao)
        }
        return lista(
          $app.findRecordsByFilter('visits', f.join(' && '), 'start_at', LIMITE + 1, 0, P),
          visitaItem,
        )
      }
      if (nome === 'agenda_do_dia') {
        const d = diaUTC(a.data)
        const itens = []
        paraArray(
          $app.findRecordsByFilter(
            'tasks',
            "organization_id = {:o} && assigned_to = {:u} && status = 'aberta' && due_at >= {:a} && due_at < {:b}",
            'due_at',
            50,
            0,
            { o: orgId, u: actor.id, a: d[0], b: d[1] },
          ),
        ).forEach((t) =>
          itens.push({
            tipo: 'tarefa',
            id: t.id,
            quando: t.getString('due_at'),
            titulo: t.getString('title'),
          }),
        )
        paraArray(
          $app.findRecordsByFilter(
            'leads',
            "organization_id = {:o} && assigned_to = {:u} && next_step_due >= {:a} && next_step_due < {:b} && stage != 'ganho' && stage != 'perdido'",
            'next_step_due',
            50,
            0,
            { o: orgId, u: actor.id, a: d[0], b: d[1] },
          ),
        ).forEach((l) =>
          itens.push({
            tipo: 'atendimento',
            id: l.id,
            quando: l.getString('next_step_due'),
            titulo: l.getString('name') + ': ' + (l.getString('next_step') || 'próximo passo'),
          }),
        )
        paraArray(
          $app.findRecordsByFilter(
            'visits',
            "organization_id = {:o} && broker_id = {:u} && start_at >= {:a} && start_at < {:b} && status != 'cancelada'",
            'start_at',
            50,
            0,
            { o: orgId, u: actor.id, a: d[0], b: d[1] },
          ),
        ).forEach((v) => {
          const vi = visitaItem(v)
          itens.push({
            tipo: 'visita',
            id: v.id,
            quando: vi.inicio,
            titulo: 'Visita ' + vi.imovel + (vi.pessoa ? ' com ' + vi.pessoa : ''),
            situacao: vi.situacao,
          })
        })
        paraArray(
          $app.findRecordsByFilter(
            'agenda_blocks',
            "organization_id = {:o} && user_id = {:u} && ended_at = '' && end_at > {:a} && start_at < {:b}",
            'start_at',
            20,
            0,
            { o: orgId, u: actor.id, a: d[0], b: d[1] },
          ),
        ).forEach((b) =>
          itens.push({
            tipo: 'bloqueio',
            id: b.id,
            quando: b.getString('start_at'),
            titulo:
              'Bloqueio de agenda' + (b.getString('reason') ? ': ' + b.getString('reason') : ''),
          }),
        )
        itens.sort((x, y) => String(x.quando).localeCompare(String(y.quando)))
        return { itens: itens.slice(0, LIMITE), mais: itens.length > LIMITE }
      }
      if (nome === 'propor_tarefa') {
        // Não grava nada: devolve a proposta para o cartão. O app grava pelo caminho normal (regras e hook de tasks).
        const titulo = String(a.titulo || '').trim()
        if (titulo.length < 2) return { erro: 'Informe o título da tarefa.' }
        let due = ''
        if (a.prazo) {
          const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(String(a.prazo).trim())
          if (!m) return { erro: 'Prazo inválido. Use AAAA-MM-DD HH:MM.' }
          const h = m[4] === undefined ? 9 : Number(m[4])
          const mi = m[5] === undefined ? 0 : Number(m[5])
          const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), h + 3, mi))
          if (isNaN(d.getTime()) || h > 23 || mi > 59)
            return { erro: 'Prazo inválido. Use AAAA-MM-DD HH:MM.' }
          due = d.toISOString().slice(0, 19).replace('T', ' ') + 'Z'
        }
        const candidatos = []
        const escolher = (campo, rows, rotular) => {
          const arr = paraArray(rows)
          if (arr.length > 1) {
            arr
              .slice(0, 8)
              .forEach((r) => candidatos.push({ campo: campo, id: r.id, rotulo: rotular(r) }))
            return null
          }
          return arr[0] || null
        }
        // responsável: o corretor só cria para si; o admin para qualquer pessoa ativa da organização
        const resp = txt(a.responsavel).toLowerCase()
        const souEu =
          !resp ||
          ['eu', 'mim', 'me', 'você', 'voce', 'para mim'].indexOf(resp) >= 0 ||
          actor.getString('name').toLowerCase().indexOf(resp) === 0
        let assignedTo = actor.id
        let assignedName = 'você'
        if (!souEu) {
          if (soCorretor) return { erro: 'O corretor só cria tarefas para si.' }
          const rows = $app.findRecordsByFilter(
            'users',
            "organization_id = {:o} && active = true && (role = 'admin' || role = 'sdr' || role = 'corretor') && name ~ {:n}",
            'name',
            9,
            0,
            { o: orgId, n: resp },
          )
          if (!rows.length) return { erro: 'Pessoa não encontrada: ' + a.responsavel + '.' }
          const u = escolher('responsavel', rows, (r) => r.getString('name'))
          if (u) {
            assignedTo = u.id
            assignedName = u.id === actor.id ? 'você' : u.getString('name')
          }
        }
        let leadId = ''
        let leadNome = ''
        if (txt(a.lead)) {
          const f =
            'organization_id = {:o} && name ~ {:n}' + (soCorretor ? ' && assigned_to = {:u}' : '')
          const rows = $app.findRecordsByFilter('leads', f, '-created', 9, 0, {
            o: orgId,
            n: txt(a.lead),
            u: actor.id,
          })
          if (!rows.length) return { erro: 'Lead não encontrado: ' + a.lead + '.' }
          const l = escolher('lead', rows, (r) => r.getString('name'))
          if (l) {
            leadId = l.id
            leadNome = l.getString('name')
          }
        }
        let clienteId = ''
        let clienteNome = ''
        if (txt(a.cliente)) {
          const f =
            'organization_id = {:o} && name ~ {:n}' +
            (soCorretor ? ' && responsible_id = {:u}' : '')
          const rows = $app.findRecordsByFilter('clients', f, 'name', 9, 0, {
            o: orgId,
            n: txt(a.cliente),
            u: actor.id,
          })
          if (!rows.length) return { erro: 'Cliente não encontrado: ' + a.cliente + '.' }
          const c = escolher('cliente', rows, (r) => r.getString('name'))
          if (c) {
            clienteId = c.id
            clienteNome = c.getString('name')
          }
        }
        let imovelId = ''
        let imovelCodigo = ''
        if (txt(a.imovel)) {
          const rows = $app.findRecordsByFilter(
            'properties',
            'organization_id = {:o} && (code = {:c} || title ~ {:c})',
            '-updated',
            9,
            0,
            { o: orgId, c: txt(a.imovel) },
          )
          if (!rows.length) return { erro: 'Imóvel não encontrado: ' + a.imovel + '.' }
          const p = escolher(
            'imovel',
            rows,
            (r) => r.getString('code') + ' ' + r.getString('title'),
          )
          if (p) {
            imovelId = p.id
            imovelCodigo = p.getString('code')
          }
        }
        if (candidatos.length) return { candidatos: candidatos }
        return {
          proposta: {
            tipo: 'tarefa',
            title: titulo.slice(0, 200),
            due_at: due,
            assigned_to: assignedTo,
            assigned_name: assignedName,
            lead_id: leadId,
            lead_nome: leadNome,
            client_id: clienteId,
            cliente_nome: clienteNome,
            property_id: imovelId,
            imovel_codigo: imovelCodigo,
          },
        }
      }
      return null
    }
    const FERRAMENTAS = [
      {
        nome: 'agenda_do_dia',
        desc: 'Agenda de um dia de quem pergunta: tarefas, próximos passos de leads, visitas e bloqueios.',
        props: { data: { type: 'string', description: 'AAAA-MM-DD; sem ela, hoje' } },
      },
      {
        nome: 'listar_visitas',
        desc: 'Visitas num período (de/ate em AAAA-MM-DD), com horário, situação, imóvel e pessoa.',
        props: {
          de: { type: 'string' },
          ate: { type: 'string' },
          situacao: {
            type: 'string',
            description:
              'agendada, confirmada, realizada, cancelada, nao_compareceu, pendente_agenda',
          },
        },
        req: ['de'],
      },
      {
        nome: 'listar_tarefas',
        desc: 'Tarefas em aberto (opcional: com prazo até uma data AAAA-MM-DD).',
        props: { ate: { type: 'string' } },
      },
      {
        nome: 'buscar_leads',
        desc: 'Leads (busca por nome ou telefone, etapa, ou parados há N dias ou mais). Sem etapa, só os ativos.',
        props: {
          texto: { type: 'string' },
          etapa: {
            type: 'string',
            description: 'novo, em_atendimento, visita_marcada, proposta, ganho, perdido',
          },
          parados_ha_dias: { type: 'number' },
        },
      },
      {
        nome: 'ver_lead',
        desc: 'Um lead com a linha do tempo (pelo id ou pelo nome).',
        props: { id: { type: 'string' }, nome: { type: 'string' } },
      },
      {
        nome: 'buscar_clientes',
        desc: 'Clientes pelo nome ou telefone.',
        props: { texto: { type: 'string' } },
        req: ['texto'],
      },
      {
        nome: 'buscar_imoveis',
        desc: 'Imóveis do catálogo. Por padrão só os disponíveis; situacao vazia traz todos.',
        props: {
          texto: { type: 'string' },
          finalidade: { type: 'string', enum: ['venda', 'locacao'] },
          tipo: { type: 'string' },
          quartos_min: { type: 'number' },
          preco_max: { type: 'number' },
          bairro: { type: 'string' },
          situacao: { type: 'string' },
        },
      },
      {
        nome: 'ver_imovel',
        desc: 'Um imóvel pelo código (ex.: AP-0012).',
        props: { codigo: { type: 'string' } },
        req: ['codigo'],
      },
    ]
    const toolsDoModelo = FERRAMENTAS.map((t) => ({
      type: 'function',
      function: {
        name: t.nome,
        description: t.desc,
        parameters: { type: 'object', properties: t.props, required: t.req || [] },
      },
    }))
    const rodar = (nome, args) => {
      let r = null
      try {
        r = executar(nome, args)
      } catch (err) {
        $app
          .logger()
          .error('jax_tool_failed', 'tool', nome, 'err', String((err && err.message) || err))
        r = { erro: 'A consulta falhou.' }
      }
      if (r !== null) audit('jax_ferramenta', '', nome)
      return r
    }

    // ---- modo teste: só admin, executa uma ferramenta sem chamar a IA ----
    if (body.ferramenta) {
      if (role !== 'admin') throw new ForbiddenError('Só o admin usa o modo de teste.')
      const r = rodar(String(body.ferramenta.nome || ''), body.ferramenta.args || {})
      if (r === null) throw new BadRequestError('Ferramenta desconhecida.')
      return e.json(200, { resultado: r })
    }

    // ---- confirmação de ação: o app já gravou a tarefa pelo caminho normal (regras e hooks de tasks valem) ----
    if (body.acao_confirmada) {
      const conv = minhaConversa(body.conversation_id)
      if (!conv) throw new NotFoundError('Conversa não encontrada.')
      const ac = body.acao_confirmada || {}
      let msg = null
      try {
        msg = $app.findRecordById('jax_messages', String(ac.message_id || ''))
      } catch (_) {}
      if (!msg || msg.getString('conversation_id') !== conv.id)
        throw new BadRequestError('Mensagem inválida.')
      let task = null
      try {
        task = $app.findRecordById('tasks', String(ac.task_id || ''))
      } catch (_) {}
      if (
        !task ||
        task.getString('organization_id') !== orgId ||
        task.getString('created_by') !== actor.id
      ) {
        throw new BadRequestError('Tarefa inválida.')
      }
      if (msg.get('proposta_usada') === true) {
        return e.json(200, {
          conversation_id: conv.id,
          message_id: msg.id,
          evento: 'Tarefa criada',
          duplicada: true,
        })
      }
      msg.set('proposta_usada', true)
      $app.save(msg)
      const ev = salvarMensagem(conv, 'evento', 'Tarefa criada', {
        referencias: [{ tipo: 'tarefa', id: task.id, rotulo: task.getString('title') }],
      })
      conv.set('title', conv.getString('title'))
      $app.save(conv)
      audit('jax_acao_confirmada', ev.id, 'tarefa')
      return e.json(200, {
        conversation_id: conv.id,
        message_id: ev.id,
        evento: 'Tarefa criada',
        duplicada: false,
      })
    }

    // ---- pergunta ----
    const pergunta = String(body.message || '').trim()
    if (!pergunta) throw new BadRequestError('Escreva a pergunta.')
    if (pergunta.length > 2000)
      throw new BadRequestError('A pergunta pode ter até 2.000 caracteres.')

    let conv = null
    if (body.conversation_id) {
      conv = minhaConversa(body.conversation_id)
      if (!conv) throw new NotFoundError('Conversa não encontrada.')
    }

    // limite: 30 perguntas respondidas por pessoa por hora (recusas e erros da IA não contam)
    const umaHora = new Date(Date.now() - 3600000).toISOString().replace('T', ' ')
    const recentes = $app.findRecordsByFilter(
      'audit_log',
      "action = 'jax_pergunta' && actor_id = {:a} && occurred_at >= {:t}",
      '',
      31,
      0,
      { a: actor.id, t: umaHora },
    )
    if (recentes.length >= 30) {
      return e.json(429, {
        message: 'Você fez muitas perguntas agora. Tente de novo em alguns minutos.',
      })
    }

    // histórico: as 20 mensagens anteriores (pergunta e resposta), da mais antiga para a mais nova
    const historico = []
    if (conv) {
      const antigas = $app.findRecordsByFilter(
        'jax_messages',
        "conversation_id = {:c} && (role = 'user' || role = 'assistant')",
        '-created',
        20,
        0,
        { c: conv.id },
      )
      for (let i = antigas.length - 1; i >= 0; i--) {
        historico.push({
          role: antigas[i].getString('role'),
          content: antigas[i].getString('content'),
        })
      }
    }

    // data e hora em America/Bahia (UTC-3 fixo, como o today.js)
    const bahia = new Date(Date.now() - 3 * 3600000)
    const dias = [
      'domingo',
      'segunda-feira',
      'terça-feira',
      'quarta-feira',
      'quinta-feira',
      'sexta-feira',
      'sábado',
    ]
    const p2 = (n) => (n < 10 ? '0' : '') + n
    const agoraTexto =
      bahia.getUTCFullYear() +
      '-' +
      p2(bahia.getUTCMonth() + 1) +
      '-' +
      p2(bahia.getUTCDate()) +
      ' ' +
      p2(bahia.getUTCHours()) +
      ':' +
      p2(bahia.getUTCMinutes()) +
      ' (' +
      dias[bahia.getUTCDay()] +
      ', horário da Bahia)'

    const sistema = [
      'Você é o JaX, assistente do app do corretor do Amorbiliário, sistema da imobiliária.',
      'Agora é ' + agoraTexto + '. Quem pergunta: ' + actor.getString('name') + ' (' + role + ').',
      'Responda em português do Brasil, em frases curtas, sem exclamação. A IA propõe, a pessoa decide.',
      'Só afirme o que veio das ferramentas. Se a consulta voltar vazia, diga que não encontrou. Nunca complete com conhecimento próprio sobre a carteira, clientes, imóveis ou valores.',
      'Sobre mercado (preço do m², tendências, bairros em alta), responda: "Ainda não tenho dados de mercado. Posso olhar a sua carteira."',
      'Nunca peça nem repita CPF, data de nascimento ou documentos.',
      'Para criar lembrete ou tarefa, use propor_tarefa. Você não grava nada: a pessoa confere e toca em Criar no cartão. Diga em uma frase o que propôs.',
      'Converta "hoje", "amanhã", "sexta" e "daqui a 2 horas" para AAAA-MM-DD HH:MM no horário da Bahia, a partir de agora. Se faltar a hora, mande só a data.',
      'Se uma ferramenta devolver candidatos, pergunte qual deles é, sem escolher sozinho.',
    ].join('\n')

    const mensagens = [{ role: 'system', content: sistema }]
      .concat(historico)
      .concat([{ role: 'user', content: pergunta }])

    // ===== ÚNICO PONTO DE CHAMADA AO MODELO (trocar aqui para sair do Skip) =====
    const chamarModelo = (msgs, comFerramentas) =>
      $ai.chat(
        comFerramentas
          ? { model: 'fast', messages: msgs, tools: toolsDoModelo, tool_choice: 'auto' }
          : { model: 'fast', messages: msgs },
      )
    // =============================================================================

    // ciclo: até 4 rodadas de ferramentas; na última chamada, sem ferramentas, a IA responde com o que tiver
    const vistos = {}
    const guardarReferencias = (r) => {
      const add = (tipo, x, rotulo) => {
        if (x && x.id && rotulo)
          vistos[tipo + ':' + x.id] = { tipo: tipo, id: x.id, rotulo: String(rotulo) }
      }
      const um = (x, nomeF) => {
        if (!x) return
        if (nomeF === 'buscar_imoveis' || nomeF === 'ver_imovel') add('imovel', x, x.codigo)
        else if (nomeF === 'buscar_leads' || nomeF === 'ver_lead') add('lead', x, x.nome)
        else if (nomeF === 'buscar_clientes') add('cliente', x, x.nome)
        else if (nomeF === 'listar_visitas') add('visita', x, x.imovel)
        else if (nomeF === 'listar_tarefas') add('tarefa', x, x.titulo)
        else if (nomeF === 'agenda_do_dia')
          add(x.tipo === 'atendimento' ? 'lead' : x.tipo, x, x.titulo)
      }
      return (nomeF, res) => {
        if (!res) return
        if (res.item) um(res.item, nomeF)
        if (res.itens) res.itens.forEach((x) => um(x, nomeF))
      }
    }
    const registrar = guardarReferencias()
    let proposta = null
    let tokens = 0
    let modelo = 'fast'
    let resposta = ''
    try {
      for (let rodada = 0; rodada <= 4; rodada++) {
        const reply = chamarModelo(mensagens, rodada < 4)
        tokens += Number((reply && reply.usage && reply.usage.total_tokens) || 0)
        modelo = String((reply && reply.model) || modelo)
        const m = reply && reply.choices && reply.choices[0] ? reply.choices[0].message : null
        const chamadas = m && m.tool_calls && m.tool_calls.length ? m.tool_calls : null
        if (!chamadas || rodada === 4) {
          resposta = String((m && m.content) || '').trim()
          break
        }
        mensagens.push({ role: 'assistant', content: m.content || '', tool_calls: chamadas })
        chamadas.forEach((tc) => {
          const nomeF = String((tc.function && tc.function.name) || '')
          let args = {}
          try {
            args = JSON.parse((tc.function && tc.function.arguments) || '{}')
          } catch (_) {
            args = {}
          }
          const r = rodar(nomeF, args)
          registrar(nomeF, r)
          if (nomeF === 'propor_tarefa' && r && r.proposta) proposta = r.proposta
          mensagens.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(r === null ? { erro: 'Ferramenta desconhecida.' } : r),
          })
        })
      }
    } catch (err) {
      $app
        .logger()
        .error(
          'jax_ai_failed',
          'err',
          String((err && err.message) || err),
          'status',
          String((err && err.status) || ''),
        )
      return e.json(503, { message: 'O JaX não respondeu agora. Tente de novo.' })
    }
    if (!resposta) resposta = 'Não consegui responder agora. Tente reformular a pergunta.'

    if (!conv) {
      conv = nova('jax_conversations')
      conv.set('organization_id', orgId)
      conv.set('user_id', actor.id)
      conv.set('title', pergunta.slice(0, 120))
      $app.save(conv)
    } else {
      conv.set('title', conv.getString('title'))
      $app.save(conv)
    }
    salvarMensagem(conv, 'user', pergunta, null)
    // referências: só os registros que a resposta cita pelo rótulo (código do imóvel, nome, título)
    const baixa = resposta.toLowerCase()
    const referencias = Object.keys(vistos)
      .map((k) => vistos[k])
      .filter((r) => r.rotulo && baixa.indexOf(String(r.rotulo).toLowerCase()) >= 0)
      .slice(0, 12)
    const msg = salvarMensagem(conv, 'assistant', resposta, {
      referencias: referencias,
      tokens: tokens,
      modelo: modelo,
    })
    audit('jax_pergunta', msg.id, 'tokens=' + tokens)

    return e.json(200, {
      conversation_id: conv.id,
      message_id: msg.id,
      message: resposta,
      referencias: referencias,
      proposta: proposta,
    })
  },
  $apis.requireAuth(),
)
