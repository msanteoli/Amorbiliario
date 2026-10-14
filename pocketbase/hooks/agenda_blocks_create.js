// M14 — Bloqueio de agenda do corretor: período em que ele não recebe leads nem pedidos de visita.
// O corretor cria para si; o admin cria para qualquer corretor da organização (user_id no corpo).
// O SDR não cria. Gera auditoria. Não apaga nada (encerrar é em agenda_blocks_end.js).
routerAdd(
  'POST',
  '/backend/v1/agenda-blocks',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || (role !== 'admin' && role !== 'corretor')) {
      throw new ForbiddenError('Só o corretor ou o admin cria bloqueio de agenda.')
    }
    const orgId = String(actor.get('organization_id') || '')
    const body = e.requestInfo().body || {}

    let userId = actor.id
    if (role === 'admin' && body.user_id) {
      let target = null
      try {
        target = $app.findRecordById('users', String(body.user_id))
      } catch (_) {}
      if (!target || target.get('organization_id') !== orgId)
        throw new NotFoundError('Corretor não encontrado.')
      userId = target.id
    }

    const start = new Date(String(body.start_at || ''))
    const end = new Date(String(body.end_at || ''))
    if (isNaN(start.getTime()) || isNaN(end.getTime()))
      throw new BadRequestError('Informe início e fim válidos.')
    if (end.getTime() <= start.getTime())
      throw new BadRequestError('O fim precisa ser depois do início.')

    const reason = String(body.reason || '')
      .trim()
      .slice(0, 200)
    const now = new Date().toISOString()

    const rec = new Record($app.findCollectionByNameOrId('agenda_blocks'))
    rec.set('organization_id', orgId)
    rec.set('user_id', userId)
    rec.set('start_at', start.toISOString())
    rec.set('end_at', end.toISOString())
    rec.set('reason', reason)
    rec.set('created_by', actor.id)
    $app.save(rec)

    const audit = new Record($app.findCollectionByNameOrId('audit_log'))
    audit.set('organization_id', orgId)
    audit.set('actor_id', actor.id)
    audit.set('actor_role', role)
    audit.set('action', 'bloqueio_agenda_criado')
    audit.set('collection_name', 'agenda_blocks')
    audit.set('record_id', rec.id)
    audit.set('occurred_at', now)
    $app.save(audit)

    return e.json(200, {
      id: rec.id,
      user_id: userId,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
    })
  },
  $apis.requireAuth(),
)
