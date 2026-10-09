// Marca o documento como conferido (precisa ter arquivo). Só o admin e o corretor responsável.
routerAdd(
  'POST',
  '/backend/v1/negotiations/{id}/documents/{did}/check',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'sdr', 'corretor'].indexOf(role) < 0) {
      throw new ForbiddenError('Papel sem acesso a estes dados.')
    }
    const orgId = String(actor.get('organization_id') || '')
    let neg = null
    try {
      neg = $app.findRecordById('negotiations', e.request.pathValue('id'))
    } catch (_) {}
    if (!neg || neg.get('organization_id') !== orgId)
      throw new NotFoundError('Negociação não encontrada.')
    if (role === 'corretor' && neg.getString('responsible_id') !== actor.id)
      throw new NotFoundError('Negociação não encontrada.')
    if (role === 'sdr')
      throw new ForbiddenError('Só o admin e o corretor responsável conferem documentos.')
    let doc = null
    try {
      doc = $app.findRecordById('negotiation_documents', e.request.pathValue('did'))
    } catch (_) {}
    if (!doc || doc.getString('negotiation_id') !== neg.id || doc.get('active') !== true) {
      throw new NotFoundError('Documento não encontrado.')
    }
    if (!doc.getStringSlice('file').length)
      throw new BadRequestError('O documento ainda não tem arquivo.')
    doc.set('state', 'conferido')
    doc.set('checked_by', actor.id)
    doc.set('checked_at', new Date().toISOString())
    $app.save(doc)
    try {
      const a = new Record($app.findCollectionByNameOrId('audit_log'))
      a.set('organization_id', orgId)
      a.set('actor_id', actor.id)
      a.set('actor_role', role)
      a.set('action', 'documento_conferido')
      a.set('collection_name', 'negotiations')
      a.set('record_id', doc.id)
      a.set('reason', doc.getString('doc_type'))
      a.set('occurred_at', new Date().toISOString())
      $app.save(a)
    } catch (_) {}
    return e.json(200, { id: doc.id, state: 'conferido' })
  },
  $apis.requireAuth(),
)
