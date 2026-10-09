// Envia um arquivo (JPG, PNG, WebP ou PDF, até 10 MB) para um documento do checklist. Admin, SDR e o
// corretor responsável. O documento passa a "recebido" (e volta de "conferido" para "recebido").
routerAdd(
  'POST',
  '/backend/v1/negotiations/{id}/documents/{did}/upload',
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
    if (['em_analise', 'aprovada'].indexOf(neg.getString('status')) < 0) {
      return e.json(409, { message: 'Esta negociação já foi encerrada.' })
    }
    let doc = null
    try {
      doc = $app.findRecordById('negotiation_documents', e.request.pathValue('did'))
    } catch (_) {}
    if (!doc || doc.getString('negotiation_id') !== neg.id || doc.get('active') !== true) {
      throw new NotFoundError('Documento não encontrado.')
    }
    const files = e.findUploadedFiles('file')
    if (!files || !files.length) throw new BadRequestError('Envie o arquivo no campo "file".')
    if (doc.getStringSlice('file').length + files.length > 5)
      throw new BadRequestError('Limite de 5 arquivos por documento.')
    try {
      doc.set('file+', files)
      doc.set('state', 'recebido')
      doc.set('checked_by', '')
      doc.set('checked_at', '')
      $app.save(doc)
    } catch (err) {
      $app.logger().error('negotiation_upload_failed', 'err', String((err && err.message) || err))
      throw new BadRequestError('Arquivo inválido: use JPG, PNG, WebP ou PDF de até 10 MB.')
    }
    try {
      const a = new Record($app.findCollectionByNameOrId('audit_log'))
      a.set('organization_id', orgId)
      a.set('actor_id', actor.id)
      a.set('actor_role', role)
      a.set('action', 'documento_enviado')
      a.set('collection_name', 'negotiations')
      a.set('record_id', doc.id)
      a.set('reason', doc.getString('doc_type'))
      a.set('occurred_at', new Date().toISOString())
      $app.save(a)
    } catch (_) {}
    return e.json(200, {
      id: doc.id,
      state: doc.getString('state'),
      files: doc.getStringSlice('file'),
    })
  },
  $apis.requireAuth(),
)
