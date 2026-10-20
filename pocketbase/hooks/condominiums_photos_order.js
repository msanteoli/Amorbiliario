// Ordem das fotos e capa (spec docs/superpowers/specs/2026-10-20-ordem-das-fotos-design.md). Atenção (goja): nada de função no topo do arquivo; o callback de runInTransaction NÃO devolve valor.
// Grava a ORDEM das fotos do condomínio: exatamente as fotos ativas, sem faltar nem repetir (senão 400). Admin ou corretor ativo da organização. Auditoria fotos_reordenadas (só contagem).
routerAdd(
  'PUT',
  '/backend/v1/condominiums/{id}/photos/order',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    const orgId = String(actor.get('organization_id') || '')
    const id = String(e.request.pathValue('id') || '')
    const audit = (action, reason) => {
      try {
        const a = new Record($app.findCollectionByNameOrId('audit_log'))
        a.set('organization_id', orgId)
        a.set('actor_id', actor.id)
        a.set('actor_role', role)
        a.set('action', action)
        a.set('collection_name', 'condominiums')
        a.set('record_id', id)
        a.set('reason', reason)
        a.set('occurred_at', new Date().toISOString())
        $app.save(a)
      } catch (err) {
        $app.logger().error('fotos_audit_failed', 'err', String((err && err.message) || err))
      }
    }
    if (actor.get('active') !== true || ['admin', 'corretor'].indexOf(role) < 0) {
      audit('acesso_negado', 'papel_sem_permissao')
      throw new ForbiddenError(
        'Só o admin e quem cadastra imóveis mudam a ordem e a capa das fotos.',
      )
    }
    let parent = null
    try {
      parent = $app.findRecordById('condominiums', id)
    } catch (_) {}
    if (!parent || parent.getString('organization_id') !== orgId)
      throw new NotFoundError('Registro não encontrado.')
    const body = e.requestInfo().body || {}
    if (!Array.isArray(body.ordered_ids)) throw new BadRequestError('Envie a lista ordered_ids.')
    const ids = body.ordered_ids.map((x) => String(x))
    const active = $app.findRecordsByFilter(
      'condominium_photos',
      'condominium_id = {:p} && is_active = true',
      'position,created',
      200,
      0,
      { p: id },
    )
    const activeIds = {}
    active.forEach((r) => {
      activeIds[r.id] = true
    })
    const seen = {}
    ids.forEach((x) => {
      if (!activeIds[x] || seen[x])
        throw new BadRequestError('A lista precisa ter exatamente as fotos ativas, sem repetir.')
      seen[x] = true
    })
    if (ids.length !== active.length)
      throw new BadRequestError(
        'A lista precisa ter exatamente as fotos ativas, sem faltar nenhuma.',
      )
    $app.runInTransaction((tx) => {
      ids.forEach((pid, i) => {
        tx.db()
          .newQuery('UPDATE condominium_photos SET position = {:n} WHERE id = {:i}')
          .bind({ n: i + 1, i: pid })
          .execute()
      })
    })
    audit('fotos_reordenadas', 'n=' + ids.length)
    return e.json(200, { ok: true, ordered_ids: ids })
  },
  $apis.requireAuth(),
)
