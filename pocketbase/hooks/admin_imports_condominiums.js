// Importa condomínios de uma planilha (linhas já lidas pelo navegador). Só o admin.
// Aceito = criado; pendente = já existe (mesmo nome sem acento e maiúsculas); recusado = sem nome.
// dry_run apenas simula: nada é gravado.
routerAdd(
  'POST',
  '/backend/v1/admin/imports/condominiums',
  (e) => {
    const actor = e.auth
    if (actor.get('active') !== true || String(actor.get('role') || '') !== 'admin') {
      throw new ForbiddenError('Só o admin importa condomínios.')
    }
    const body = e.requestInfo().body || {}
    const rows = Array.isArray(body.rows) ? body.rows : []
    if (rows.length > 500) throw new BadRequestError('Envie até 500 linhas por vez.')
    const dry = body.dry_run === true
    const orgId = String(actor.get('organization_id') || '')

    const key = (s) =>
      String(s || '')
        .toLowerCase()
        .replace(/[áàâãä]/g, 'a')
        .replace(/[éèêë]/g, 'e')
        .replace(/[íìîï]/g, 'i')
        .replace(/[óòôõö]/g, 'o')
        .replace(/[úùûü]/g, 'u')
        .replace(/ç/g, 'c')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
    const pick = (r, a, b) =>
      String(r[a] !== undefined ? r[a] : r[b] !== undefined ? r[b] : '').trim()

    const counts = { aceito: 0, pendente: 0, recusado: 0 }
    const items = []
    const seen = {}
    const toCreate = []
    rows.forEach((r, i) => {
      const name = pick(r, 'Nome', 'name')
      const k = key(name)
      if (k.length < 2) {
        counts.recusado++
        items.push({ row: i + 1, name: name, outcome: 'recusado', reasons: ['sem_nome'] })
        return
      }
      if (seen[k]) {
        counts.recusado++
        items.push({
          row: i + 1,
          name: name,
          outcome: 'recusado',
          reasons: ['repetido_no_arquivo'],
        })
        return
      }
      seen[k] = true
      const exists = $app.findRecordsByFilter(
        'condominiums',
        'organization_id = {:o} && name_key = {:k}',
        '',
        1,
        0,
        { o: orgId, k: k },
      )
      if (exists.length) {
        counts.pendente++
        items.push({ row: i + 1, name: name, outcome: 'pendente', reasons: ['ja_existe'] })
        return
      }
      counts.aceito++
      items.push({ row: i + 1, name: name, outcome: 'aceito', reasons: [] })
      toCreate.push({
        name: name,
        key: k,
        street: pick(r, 'Endereço', 'street'),
        neighborhood: pick(r, 'Bairro', 'neighborhood'),
        city: pick(r, 'Cidade', 'city'),
        amenities: pick(r, 'Lazer', 'amenities'),
        rules: pick(r, 'Regras', 'rules'),
      })
    })

    let batchId = null
    if (!dry) {
      $app.runInTransaction((tx) => {
        const batch = new Record(tx.findCollectionByNameOrId('import_batches'))
        batch.set('organization_id', orgId)
        batch.set('kind', 'condominios')
        batch.set('filename', String(body.filename || '').slice(0, 200))
        batch.set('created_by', actor.id)
        batch.set('state', 'aplicada')
        batch.set('counts_accepted', counts.aceito)
        batch.set('counts_pending', counts.pendente)
        batch.set('counts_rejected', counts.recusado)
        batch.set('report', items)
        tx.save(batch)
        batchId = batch.id
        toCreate.forEach((c) => {
          const rec = new Record(tx.findCollectionByNameOrId('condominiums'))
          rec.set('organization_id', orgId)
          rec.set('name', c.name)
          rec.set('name_key', c.key)
          rec.set('street', c.street)
          rec.set('neighborhood', c.neighborhood)
          rec.set('city', c.city)
          rec.set('amenities', c.amenities)
          rec.set('rules', c.rules)
          rec.set('is_active', true)
          rec.set('created_batch_id', batch.id)
          tx.save(rec)
        })
      })
    }
    return e.json(200, { dry_run: dry, batch_id: batchId, counts: counts, items: items })
  },
  $apis.requireAuth(),
)
