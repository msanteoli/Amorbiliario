// Ordem das fotos e capa (spec docs/superpowers/specs/2026-10-20-ordem-das-fotos-design.md). Atenção (goja): nada de função no topo do arquivo; o callback de runInTransaction NÃO devolve valor.
// Escolhe a CAPA do condomínio entre as fotos ativas dele (photo_id vazio volta ao padrão: a primeira da ordem). Admin ou corretor ativo da organização. Auditoria capa_alterada.
routerAdd(
  'PUT',
  '/backend/v1/condominiums/{id}/cover',
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
    const photoId = String(
      body.photo_id === null || body.photo_id === undefined ? '' : body.photo_id,
    ).trim()
    if (photoId !== '') {
      let ph = null
      try {
        ph = $app.findRecordById('condominium_photos', photoId)
      } catch (_) {}
      if (!ph || ph.getString('condominium_id') !== id || ph.get('is_active') !== true) {
        throw new BadRequestError('A capa precisa ser uma foto ativa deste cadastro.')
      }
    }
    $app
      .db()
      .newQuery('UPDATE condominiums SET cover_photo_id = {:c} WHERE id = {:i}')
      .bind({ c: photoId, i: id })
      .execute()
    audit('capa_alterada', photoId === '' ? 'padrao' : 'definida')
    return e.json(200, { ok: true, cover_photo_id: photoId })
  },
  $apis.requireAuth(),
)
