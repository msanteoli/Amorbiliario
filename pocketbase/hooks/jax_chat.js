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
    ].join('\n')

    const mensagens = [{ role: 'system', content: sistema }]
      .concat(historico)
      .concat([{ role: 'user', content: pergunta }])

    // ===== ÚNICO PONTO DE CHAMADA AO MODELO (trocar aqui para sair do Skip) =====
    let reply = null
    try {
      reply = $ai.chat({ model: 'fast', messages: mensagens })
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
    // =============================================================================

    const escolha = reply && reply.choices && reply.choices[0] ? reply.choices[0] : null
    const resposta =
      String((escolha && escolha.message && escolha.message.content) || '').trim() ||
      'Não consegui responder agora. Tente reformular a pergunta.'
    const tokens = Number((reply && reply.usage && reply.usage.total_tokens) || 0)
    const modelo = String((reply && reply.model) || 'fast')

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
    const referencias = []
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
      proposta: null,
    })
  },
  $apis.requireAuth(),
)
