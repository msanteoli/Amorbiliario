// Estrelas de "manter" nas fotos do imóvel (spec docs/superpowers/specs/2026-10-21-super-destaque-design.md). Atenção (goja): nada de função no topo do arquivo.
// Define EXATAMENTE quais fotos ativas têm estrela (0 a 20). Admin, ou corretor captador. Auditoria fotos_estrelas (só contagem).
// As estrelas decidem quais fotos ficam ativas quando o imóvel sai do super-destaque (a capa sempre fica).
routerAdd(
  'PUT',
  '/backend/v1/properties/{id}/photos/stars',
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
        a.set('collection_name', 'properties')
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
      throw new ForbiddenError('Só o admin e quem cadastra imóveis marcam as estrelas das fotos.')
    }
    let parent = null
    try {
      parent = $app.findRecordById('properties', id)
    } catch (_) {}
    if (!parent || parent.getString('organization_id') !== orgId)
      throw new NotFoundError('Registro não encontrado.')
    if (role === 'corretor' && parent.getString('captured_by') !== actor.id) {
      audit('acesso_negado', 'so_captador_ou_admin')
      throw new ForbiddenError('Só quem captou o imóvel ou o admin marca as estrelas das fotos.')
    }
    const body = e.requestInfo().body || {}
    if (!Array.isArray(body.photo_ids)) throw new BadRequestError('Envie a lista photo_ids.')
    const ids = body.photo_ids.map((x) => String(x))
    if (ids.length > 20) throw new BadRequestError('No máximo 20 fotos com estrela.')
    const active = $app.findRecordsByFilter(
      'property_photos',
      'property_id = {:p} && is_active = true',
      'position,created',
      500,
      0,
      { p: id },
    )
    const activeIds = {}
    active.forEach((r) => {
      activeIds[r.id] = true
    })
    const want = {}
    ids.forEach((x) => {
      if (!activeIds[x] || want[x])
        throw new BadRequestError('Use só fotos ativas deste imóvel, sem repetir.')
      want[x] = true
    })
    let changed = 0
    active.forEach((r) => {
      const should = want[r.id] === true
      if ((r.get('is_starred') === true) !== should) {
        r.set('is_starred', should)
        $app.save(r)
        changed++
      }
    })
    audit('fotos_estrelas', 'n=' + ids.length + ' mudou=' + changed)
    return e.json(200, { ok: true, photo_ids: ids })
  },
  $apis.requireAuth(),
)
