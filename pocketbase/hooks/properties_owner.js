// Vincula o proprietário a um imóvel. Cria o cliente proprietário e liga ao imóvel numa transação,
// ou liga um cliente existente (acrescentando "proprietario" ao tipo). Só o admin e o captador.
routerAdd(
  'POST',
  '/backend/v1/properties/{id}/owner',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'corretor'].indexOf(role) < 0) {
      throw new ForbiddenError('Só o admin e o captador vinculam o proprietário.')
    }
    const orgId = String(actor.get('organization_id') || '')
    let p = null
    try {
      p = $app.findRecordById('properties', e.request.pathValue('id'))
    } catch (_) {}
    if (!p || p.get('organization_id') !== orgId) throw new NotFoundError('Imóvel não encontrado.')
    if (role === 'corretor' && p.getString('captured_by') !== actor.id) {
      throw new ForbiddenError('Só quem captou o imóvel ou o admin vincula o proprietário.')
    }

    const body = e.requestInfo().body || {}
    const normPhone = (v) => {
      let d = String(v || '')
        .replace(/\D/g, '')
        .replace(/^0+/, '')
      if (d.length === 10 || d.length === 11) d = '55' + d
      return d
    }
    const hasKind = (c, k) => {
      const ks = c.getStringSlice('kind')
      for (let i = 0; i < ks.length; i++) if (ks[i] === k) return true
      return false
    }

    let clientId = ''
    if (body.client_id) {
      let c = null
      try {
        c = $app.findRecordById('clients', String(body.client_id))
      } catch (_) {}
      if (!c || c.get('organization_id') !== orgId)
        throw new NotFoundError('Cliente não encontrado.')
      if (role === 'corretor' && String(c.get('responsible_id') || '') !== actor.id) {
        throw new NotFoundError('Cliente não encontrado.')
      }
      $app.runInTransaction((tx) => {
        const cl = tx.findRecordById('clients', c.id)
        if (!hasKind(cl, 'proprietario')) {
          cl.set('kind', cl.getStringSlice('kind').concat(['proprietario']))
          tx.save(cl)
        }
        const pr = tx.findRecordById('properties', p.id)
        pr.set('owner_id', cl.id)
        pr.set('last_reviewed_at', new Date().toISOString())
        tx.save(pr)
      })
      clientId = c.id
    } else if (body.new && typeof body.new === 'object') {
      const name = String(body.new.name || '').trim()
      const phone = normPhone(body.new.phone)
      const email = String(body.new.email || '')
        .trim()
        .toLowerCase()
      if (name.length < 2) throw new BadRequestError('Informe o nome do proprietário.')
      if (!phone && !email) throw new BadRequestError('Informe telefone ou e-mail do proprietário.')
      if (phone && (phone.length < 12 || phone.length > 13)) {
        throw new BadRequestError('Telefone inválido. Use DDD e número.')
      }
      if (phone) {
        const dup = $app.findRecordsByFilter(
          'clients',
          'organization_id = {:o} && phone = {:p}',
          '',
          1,
          0,
          { o: orgId, p: phone },
        )
        if (dup.length)
          return e.json(409, {
            message: 'Já existe cliente com este telefone.',
            existing_client_id: dup[0].id,
          })
      }
      if (email) {
        const dup = $app.findRecordsByFilter(
          'clients',
          'organization_id = {:o} && email = {:m}',
          '',
          1,
          0,
          { o: orgId, m: email },
        )
        if (dup.length)
          return e.json(409, {
            message: 'Já existe cliente com este e-mail.',
            existing_client_id: dup[0].id,
          })
      }
      $app.runInTransaction((tx) => {
        const cl = new Record(tx.findCollectionByNameOrId('clients'))
        cl.set('organization_id', orgId)
        cl.set('name', name)
        if (phone) cl.set('phone', phone)
        if (email) cl.set('email', email)
        cl.set('kind', ['proprietario'])
        cl.set('responsible_id', p.getString('captured_by'))
        cl.set('consent_status', 'unknown')
        tx.save(cl)
        const pr = tx.findRecordById('properties', p.id)
        pr.set('owner_id', cl.id)
        pr.set('last_reviewed_at', new Date().toISOString())
        tx.save(pr)
        clientId = cl.id
      })
    } else {
      throw new BadRequestError('Informe client_id ou new.')
    }

    const audit = new Record($app.findCollectionByNameOrId('audit_log'))
    audit.set('organization_id', orgId)
    audit.set('actor_id', actor.id)
    audit.set('actor_role', role)
    audit.set('action', 'imovel_alterado')
    audit.set('collection_name', 'properties')
    audit.set('record_id', p.id)
    audit.set('field_name', 'owner_id')
    audit.set('occurred_at', new Date().toISOString())
    $app.save(audit)
    return e.json(200, { client_id: clientId })
  },
  $apis.requireAuth(),
)
