// Fecha a negociação: o imóvel vira Vendido (venda) ou Alugado (locação) e o lead vira Ganho,

// tudo ou nada. Só o admin e o corretor responsável. Com documento pendente no checklist, devolve 409
// com a lista do que falta; só o admin fecha assim mesmo, com {force:true, reason}.
routerAdd(
  'POST',
  '/backend/v1/negotiations/{id}/close',
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
      throw new ForbiddenError('Só o admin e o corretor responsável fecham a negociação.')
    if (['em_analise', 'aprovada'].indexOf(neg.getString('status')) < 0) {
      return e.json(409, { message: 'Esta negociação já foi encerrada.' })
    }
    const body = e.requestInfo().body || {}
    const force = body.force === true
    const forceReason = String(body.reason || '').trim()
    if (force && role !== 'admin')
      throw new ForbiddenError('Só o admin fecha com documentos pendentes.')
    if (force && !forceReason)
      throw new BadRequestError('Informe o motivo de fechar com documentos pendentes.')
    const pend = $app.findRecordsByFilter(
      'negotiation_documents',
      "negotiation_id = {:n} && active = true && state = 'pendente'",
      '',
      200,
      0,
      { n: neg.id },
    )
    if (pend.length && !force) {
      return e.json(409, {
        message: 'Há documentos pendentes. Complete o checklist antes de fechar.',
        missing: pend.map((d) => ({
          person_id: d.getString('person_id'),
          doc_type: d.getString('doc_type'),
        })),
      })
    }
    const nowIso = new Date().toISOString()
    $app.runInTransaction((tx) => {
      const n = tx.findRecordById('negotiations', neg.id)
      if (['em_analise', 'aprovada'].indexOf(n.getString('status')) < 0) {
        throw new BadRequestError('Esta negociação já foi encerrada.')
      }
      const p = tx.findRecordById('properties', n.getString('property_id'))
      if (['inativo', 'vendido', 'alugado'].indexOf(p.getString('status')) >= 0) {
        throw new BadRequestError('O imóvel não está mais disponível para fechar.')
      }
      const l = tx.findRecordById('leads', n.getString('lead_id'))
      if (l.getString('stage') === 'perdido')
        throw new BadRequestError('O lead está perdido. Reabra o lead antes de fechar.')
      n.set('status', 'fechada')
      n.set('closed_at', nowIso)
      tx.save(n)
      p.set('status', n.getString('purpose') === 'venda' ? 'vendido' : 'alugado')
      tx.save(p)
      l.set('stage', 'ganho')
      tx.save(l)
    })
    // super-destaque (spec 2026-10-21): o imóvel deixou de ser Disponível, então o excedente de 20 fotos é arquivado
    // (fica a capa, depois as estreladas, depois as primeiras da ordem). Mesma regra de properties_write_update.js.
    try {
      const prop = $app.findRecordById('properties', neg.getString('property_id'))
      if (prop.getString('highlight_level') === 'super_destaque') {
        const act = $app.findRecordsByFilter(
          'property_photos',
          'property_id = {:p} && is_active = true',
          'position,created',
          500,
          0,
          { p: prop.id },
        )
        if (act.length > 20) {
          const coverId = prop.getString('cover_photo_id')
          const keep = []
          act.forEach((r) => {
            if (r.id === coverId && keep.length < 20) keep.push(r.id)
          })
          act.forEach((r) => {
            if (r.get('is_starred') === true && keep.indexOf(r.id) < 0 && keep.length < 20)
              keep.push(r.id)
          })
          act.forEach((r) => {
            if (keep.indexOf(r.id) < 0 && keep.length < 20) keep.push(r.id)
          })
          let archived = 0
          let n = 0
          act.forEach((r) => {
            if (keep.indexOf(r.id) >= 0) {
              n++
              if (r.getInt('position') !== n) {
                r.set('position', n)
                $app.save(r)
              }
            } else {
              r.set('archived_position', r.getInt('position'))
              r.set('position', 0)
              r.set('is_active', false)
              r.set('auto_archived', true)
              $app.save(r)
              archived++
            }
          })
          if (archived) {
            const pa = new Record($app.findCollectionByNameOrId('audit_log'))
            pa.set('organization_id', orgId)
            pa.set('actor_id', actor.id)
            pa.set('actor_role', role)
            pa.set('action', 'fotos_arquivadas')
            pa.set('collection_name', 'properties')
            pa.set('record_id', prop.id)
            pa.set('reason', 'n=' + archived)
            pa.set('occurred_at', new Date().toISOString())
            $app.save(pa)
          }
        }
      }
    } catch (err) {
      $app.logger().error('super_destaque_fotos_failed', 'err', String((err && err.message) || err))
    }
    try {
      const a = new Record($app.findCollectionByNameOrId('audit_log'))
      a.set('organization_id', orgId)
      a.set('actor_id', actor.id)
      a.set('actor_role', role)
      a.set('action', 'negociacao_fechada')
      a.set('collection_name', 'negotiations')
      a.set('record_id', neg.id)
      a.set('reason', neg.getString('purpose') + (pend.length ? ' | forçado: ' + forceReason : ''))
      a.set('occurred_at', nowIso)
      $app.save(a)
    } catch (_) {}
    return e.json(200, { id: neg.id, status: 'fechada' })
  },
  $apis.requireAuth(),
)
