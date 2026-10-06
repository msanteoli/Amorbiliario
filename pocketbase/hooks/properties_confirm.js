// "Confirmar dados": renova a data da última revisão (sempre a do servidor) sem alterar
// mais nada. Só o admin e o captador do imóvel. Registra no histórico.
routerAdd(
  'POST',
  '/backend/v1/properties/{id}/confirm',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'corretor'].indexOf(role) < 0) {
      throw new ForbiddenError('Só o admin e o captador confirmam os dados.')
    }
    let p = null
    try {
      p = $app.findRecordById('properties', e.request.pathValue('id'))
    } catch (_) {}
    if (!p || p.get('organization_id') !== actor.get('organization_id')) {
      throw new NotFoundError('Imóvel não encontrado.')
    }
    if (role === 'corretor' && p.getString('captured_by') !== actor.id) {
      throw new ForbiddenError('Só quem captou o imóvel ou o admin confirma os dados.')
    }

    const now = new Date().toISOString()
    p.set('last_reviewed_at', now)
    $app.save(p)

    const audit = new Record($app.findCollectionByNameOrId('audit_log'))
    audit.set('organization_id', p.get('organization_id'))
    audit.set('actor_id', actor.id)
    audit.set('actor_role', role)
    audit.set('action', 'dados_confirmados')
    audit.set('collection_name', 'properties')
    audit.set('record_id', p.id)
    audit.set('occurred_at', now)
    $app.save(audit)

    return e.json(200, { last_reviewed_at: now })
  },
  $apis.requireAuth(),
)
