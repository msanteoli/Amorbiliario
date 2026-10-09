// Lista as visitas Agendadas que aguardam confirmação do corretor (admin e SDR veem todas da
// organização; o corretor só as suas). Atraso = criada há mais de 24 h (1440 min); o parâmetro
// overdue_after_minutes só vale para o admin (teste). Traz também a situação da conexão Google
// de quem chama. Sem telefone e sem token.
routerAdd(
  'GET',
  '/backend/v1/visits/pending-confirmation',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'sdr', 'corretor'].indexOf(role) < 0) {
      throw new ForbiddenError('Papel sem acesso a estes dados.')
    }
    const orgId = String(actor.get('organization_id') || '')
    let minutes = 1440
    if (role === 'admin') {
      const raw = String(e.request.url.query().get('overdue_after_minutes') || '')
      if (raw !== '' && !isNaN(Number(raw)) && Number(raw) >= 0) minutes = Number(raw)
    }
    const cutoff = Date.now() - minutes * 60000

    let filter = "organization_id = {:o} && status = 'agendada'"
    const params = { o: orgId }
    if (role === 'corretor') {
      filter += ' && broker_id = {:b}'
      params.b = actor.id
    }
    const rows = $app.findRecordsByFilter('visits', filter, 'start_at', 200, 0, params)

    const cache = {}
    const nameOf = (coll, id, field) => {
      if (!id) return ''
      const k = coll + ':' + id
      if (cache[k] === undefined) {
        try {
          cache[k] = $app.findRecordById(coll, id).getString(field)
        } catch (_) {
          cache[k] = ''
        }
      }
      return cache[k]
    }

    const items = rows.map((v) => {
      const created = v.getString('created')
      const createdMs = new Date(created.replace(' ', 'T')).getTime()
      const declinedAt = v.getString('declined_at')
      return {
        id: v.id,
        property_id: v.getString('property_id'),
        property_code: nameOf('properties', v.getString('property_id'), 'code'),
        lead_id: v.getString('lead_id'),
        lead_name: nameOf('leads', v.getString('lead_id'), 'name'),
        broker_id: v.getString('broker_id'),
        broker_name: nameOf('users', v.getString('broker_id'), 'name'),
        start_at: v.getString('start_at'),
        end_at: v.getString('end_at'),
        created: created,
        overdue: !isNaN(createdMs) && createdMs <= cutoff,
        declined: declinedAt !== '',
        declined_reason: v.getString('declined_reason'),
        declined_at: declinedAt,
        google_sync: v.getString('google_sync') || 'nao_aplicavel',
      }
    })

    let gstatus = 'nao_conectado'
    try {
      const c = $app.findRecordsByFilter('google_connections', 'user_id = {:u}', '', 1, 0, {
        u: actor.id,
      })
      if (c.length) gstatus = c[0].getString('status') === 'conectado' ? 'conectado' : 'reconectar'
    } catch (_) {}

    return e.json(200, { items: items, google: { status: gstatus } })
  },
  $apis.requireAuth(),
)
