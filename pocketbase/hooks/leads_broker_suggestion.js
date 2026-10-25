// M14 — Sugestão de corretor para um lead. Só sugere; quem atribui é o SDR (leads_assign.js).
// Ordem: 1) corretor ativo com o tipo ou a finalidade do imóvel na lista intake_types;
// 2) corretor ativo da fila, pelo último lead recebido (last_intake_at mais antigo primeiro).
// Corretor com bloqueio de agenda agora nunca é sugerido. Sem ninguém elegível: reason "fila_vazia".
// Lead de captação (interest_kind = captacao): considera só a etiqueta "captacao" em intake_types.
routerAdd(
  'GET',
  '/backend/v1/leads/{id}/broker-suggestion',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || (role !== 'admin' && role !== 'sdr')) {
      throw new ForbiddenError('Só o SDR ou o admin vê a sugestão de corretor.')
    }
    const orgId = String(actor.get('organization_id') || '')

    let lead = null
    try {
      lead = $app.findRecordById('leads', e.request.pathValue('id'))
    } catch (_) {}
    if (!lead || lead.get('organization_id') !== orgId)
      throw new NotFoundError('Lead não encontrado.')

    let type = ''
    let purpose = ''
    const propId = lead.getString('property_id')
    if (propId) {
      try {
        const prop = $app.findRecordById('properties', propId)
        type = prop.getString('property_type')
        purpose = prop.getString('purpose')
      } catch (_) {}
    }

    const nowMs = Date.now()
    const corretores = $app.findRecordsByFilter(
      'users',
      "organization_id = {:o} && role = 'corretor' && active = true",
      'last_intake_at',
      200,
      0,
      { o: orgId },
    )
    // disponível = sem bloqueio de agenda que cubra o momento atual (comparação em JS, sem depender do formato da data no banco)
    const elegiveis = corretores.filter((u) => {
      const blocos = $app.findRecordsByFilter('agenda_blocks', 'user_id = {:u}', '', 200, 0, {
        u: u.id,
      })
      return !blocos.some((b) => {
        if (String(b.get('ended_at') || '') !== '') return false
        const ini = new Date(b.getString('start_at').replace(' ', 'T')).getTime()
        const fim = new Date(b.getString('end_at').replace(' ', 'T')).getTime()
        return ini <= nowMs && fim > nowMs
      })
    })

    // lead de captação (spec 2026-10-25): só quem tem a etiqueta "captacao"; sem ninguém, cai na fila geral
    const isCaptacao = lead.getString('interest_kind') === 'captacao'
    const aceitaTipo = (u) => {
      const tipos = u
        .getString('intake_types')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      if (isCaptacao) return tipos.indexOf('captacao') >= 0
      return (
        (type !== '' && tipos.indexOf(type) >= 0) || (purpose !== '' && tipos.indexOf(purpose) >= 0)
      )
    }
    const porTipo = elegiveis.filter(aceitaTipo)
    const escolhido = porTipo.length ? porTipo[0] : elegiveis[0]
    if (!escolhido) return e.json(200, { user_id: null, name: '', reason: 'fila_vazia' })

    return e.json(200, {
      user_id: escolhido.id,
      name: escolhido.getString('name'),
      reason: porTipo.length ? 'tipo' : 'fila',
    })
  },
  $apis.requireAuth(),
)
