// Verifica se já existe cliente com o CPF, telefone ou e-mail informados.
// Nunca devolve CPF nem data de nascimento. Para o corretor, clientes de outros
// corretores aparecem só como "existe" (visible=false, client=null).
routerAdd(
  'POST',
  '/backend/v1/clients/match',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'sdr', 'corretor'].indexOf(role) < 0) {
      throw new ForbiddenError('Papel sem acesso a estes dados.')
    }
    const orgId = String(actor.get('organization_id') || '')
    const body = e.requestInfo().body || {}

    const name = String(body.name || '')
      .trim()
      .toLowerCase()
    // tira também os zeros à esquerda (prefixo de DDD, ex.: 011 98765-4321)
    let phone = String(body.phone || '')
      .replace(/\D/g, '')
      .replace(/^0+/, '')
    if (phone.length === 10 || phone.length === 11) phone = '55' + phone
    const email = String(body.email || '')
      .trim()
      .toLowerCase()
    // o SDR não vê CPF; ignorar o CPF dele impede que ele teste CPFs
    const cpf = role === 'sdr' ? '' : String(body.cpf || '').replace(/\D/g, '')

    if (!phone && !email && !cpf) {
      throw new BadRequestError('Informe telefone, e-mail ou CPF.')
    }

    const canSee = (c) => role !== 'corretor' || String(c.get('responsible_id') || '') === actor.id
    const present = (c) => ({
      id: c.id,
      name: c.get('name'),
      phone: c.get('phone'),
      email: c.get('email'),
      kind: c.get('kind'),
      responsible_id: c.get('responsible_id'),
    })

    const matches = []
    const seen = {}

    if (cpf) {
      let priv = null
      try {
        priv = $app.findFirstRecordByFilter(
          'client_private',
          'organization_id = {:o} && cpf = {:c}',
          { o: orgId, c: cpf },
        )
      } catch (_) {}
      if (priv) {
        let c = null
        try {
          c = $app.findRecordById('clients', String(priv.get('client_id')))
        } catch (_) {}
        if (c) {
          seen[c.id] = true
          const visible = canSee(c)
          matches.push({
            match_by: 'cpf',
            same_name: true,
            visible: visible,
            client: visible ? present(c) : null,
          })
        }
      }
    }

    if (phone || email) {
      const parts = []
      const params = { o: orgId }
      if (phone) {
        parts.push('phone = {:p}')
        params.p = phone
      }
      if (email) {
        parts.push('email = {:m}')
        params.m = email
      }
      const rows = $app.findRecordsByFilter(
        'clients',
        'organization_id = {:o} && (' + parts.join(' || ') + ')',
        '-created',
        5,
        0,
        params,
      )
      rows.forEach((c) => {
        if (seen[c.id]) return
        seen[c.id] = true
        const sameName =
          !!name &&
          String(c.get('name') || '')
            .trim()
            .toLowerCase() === name
        const by = phone && c.get('phone') === phone ? 'phone' : 'email'
        const visible = canSee(c)
        matches.push({
          match_by: by,
          same_name: sameName,
          visible: visible,
          client: visible ? present(c) : null,
        })
      })
    }

    let status = 'none'
    if (matches.length) {
      status = matches.some((m) => m.match_by === 'cpf' || m.same_name)
        ? 'same_person'
        : 'maybe_same'
    }
    return e.json(200, { status: status, matches: matches })
  },
  $apis.requireAuth(),
)
