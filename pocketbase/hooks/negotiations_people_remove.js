// Tira uma pessoa da negociação (muda para inativa; não apaga a pessoa nem o cliente) e esconde os
// documentos dela do checklist. Admin, SDR e o corretor responsável.
routerAdd(
  'POST',
  '/backend/v1/negotiations/{id}/people/{pid}/remove',
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
    let person = null
    try {
      person = $app.findRecordById('negotiation_people', e.request.pathValue('pid'))
    } catch (_) {}
    if (!person || person.getString('negotiation_id') !== neg.id)
      throw new NotFoundError('Pessoa não encontrada.')
    $app.runInTransaction((tx) => {
      person.set('active', false)
      tx.save(person)
      tx.findRecordsByFilter('negotiation_documents', 'person_id = {:p}', '', 50, 0, {
        p: person.id,
      }).forEach((d) => {
        d.set('active', false)
        tx.save(d)
      })
    })
    try {
      const a = new Record($app.findCollectionByNameOrId('audit_log'))
      a.set('organization_id', orgId)
      a.set('actor_id', actor.id)
      a.set('actor_role', role)
      a.set('action', 'negociacao_pessoa_removida')
      a.set('collection_name', 'negotiation_people')
      a.set('record_id', person.id)
      a.set('reason', person.getString('role'))
      a.set('occurred_at', new Date().toISOString())
      $app.save(a)
    } catch (_) {}
    return e.json(200, { person_id: person.id, active: false })
  },
  $apis.requireAuth(),
)
