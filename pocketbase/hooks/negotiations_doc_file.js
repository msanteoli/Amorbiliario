// Entrega o arquivo de um documento (o primeiro, ou ?name=<arquivo>). Admin, SDR e o corretor
// responsável. Cada abertura grava o histórico (quem, qual documento, quando; nunca o conteúdo).
// O arquivo só sai por aqui: a coleção de documentos não é legível e o campo é protegido.
routerAdd(
  'GET',
  '/backend/v1/negotiations/{id}/documents/{did}/file',
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
    let doc = null
    try {
      doc = $app.findRecordById('negotiation_documents', e.request.pathValue('did'))
    } catch (_) {}
    if (!doc || doc.getString('negotiation_id') !== neg.id || doc.get('active') !== true) {
      throw new NotFoundError('Documento não encontrado.')
    }
    const names = doc.getStringSlice('file')
    if (!names.length) throw new NotFoundError('O documento ainda não tem arquivo.')
    const asked = String(e.request.url.query().get('name') || '')
    const name = asked ? (names.indexOf(asked) >= 0 ? asked : '') : names[0]
    if (!name) throw new NotFoundError('Arquivo não encontrado.')

    try {
      const a = new Record($app.findCollectionByNameOrId('audit_log'))
      a.set('organization_id', orgId)
      a.set('actor_id', actor.id)
      a.set('actor_role', role)
      a.set('action', 'documento_aberto')
      a.set('collection_name', 'negotiations')
      a.set('record_id', doc.id)
      a.set('reason', doc.getString('doc_type'))
      a.set('occurred_at', new Date().toISOString())
      $app.save(a)
    } catch (_) {}

    const fsys = $app.newFilesystem()
    try {
      fsys.serve(e.response, e.request, doc.baseFilesPath() + '/' + name, name)
    } finally {
      fsys.close()
    }
  },
  $apis.requireAuth(),
)
