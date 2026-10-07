// Desfaz um lote de importação sem apagar nada: imóveis do lote que continuam em Rascunho viram
// Inativos; os que já saíram do Rascunho são ignorados. Condomínios criados pelo lote e sem
// nenhum imóvel ativo ficam inativos. Só o admin.
routerAdd(
  'POST',
  '/backend/v1/admin/imports/{id}/undo',
  (e) => {
    const actor = e.auth
    if (actor.get('active') !== true || String(actor.get('role') || '') !== 'admin') {
      throw new ForbiddenError('Só o admin desfaz importações.')
    }
    const orgId = String(actor.get('organization_id') || '')
    let batch = null
    try {
      batch = $app.findRecordById('import_batches', e.request.pathValue('id'))
    } catch (_) {}
    if (!batch || batch.get('organization_id') !== orgId)
      throw new NotFoundError('Importação não encontrada.')
    if (batch.getString('state') === 'desfeita') {
      return e.json(409, { message: 'Esta importação já foi desfeita.' })
    }

    let undone = 0
    let skipped = 0
    let deactivated = 0
    $app.runInTransaction((tx) => {
      const props = tx.findRecordsByFilter(
        'properties',
        'organization_id = {:o} && import_batch_id = {:b}',
        '',
        1000,
        0,
        { o: orgId, b: batch.id },
      )
      const now = new Date().toISOString()
      props.forEach((p) => {
        if (p.getString('status') === 'rascunho' && p.getString('source') === 'importacao') {
          p.set('status', 'inativo')
          tx.save(p)
          undone++
          const audit = new Record(tx.findCollectionByNameOrId('audit_log'))
          audit.set('organization_id', orgId)
          audit.set('actor_id', actor.id)
          audit.set('actor_role', 'admin')
          audit.set('action', 'importacao_desfeita')
          audit.set('collection_name', 'properties')
          audit.set('record_id', p.id)
          audit.set('reason', 'lote=' + batch.id)
          audit.set('occurred_at', now)
          tx.save(audit)
        } else {
          skipped++
        }
      })

      const condos = tx.findRecordsByFilter(
        'condominiums',
        'organization_id = {:o} && created_batch_id = {:b} && is_active = true',
        '',
        1000,
        0,
        { o: orgId, b: batch.id },
      )
      condos.forEach((c) => {
        const used = tx.findRecordsByFilter(
          'properties',
          "condominium_id = {:c} && status != 'inativo'",
          '',
          1,
          0,
          { c: c.id },
        )
        if (!used.length) {
          c.set('is_active', false)
          tx.save(c)
          deactivated++
        }
      })

      batch.set('state', 'desfeita')
      tx.save(batch)
    })
    return e.json(200, { undone: undone, skipped: skipped, condominiums_deactivated: deactivated })
  },
  $apis.requireAuth(),
)
