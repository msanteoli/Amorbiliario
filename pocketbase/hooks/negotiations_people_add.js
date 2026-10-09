// Liga uma pessoa à negociação (cliente existente por client_id, ou nova em "new") com um papel, e cria
// o checklist de documentos daquele papel. Admin, SDR e o corretor responsável. Pessoa nova passa pela
// verificação de duplicidade (409 com existing_client_id). Papel repetido para o mesmo cliente: 409.
routerAdd(
  'POST',
  '/backend/v1/negotiations/{id}/people',
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

    // documentos pedidos por finalidade e papel
    const docs = {
      locacao: {
        cliente: [
          'documento_foto',
          'cpf',
          'comprovante_renda',
          'comprovante_residencia',
          'certidao_estado_civil',
        ],
        fiador: [
          'documento_foto',
          'cpf',
          'comprovante_renda_3m',
          'comprovante_residencia',
          'certidao_estado_civil',
          'matricula_garantia',
        ],
        conjuge_cliente: ['documento_foto', 'cpf'],
        conjuge_fiador: [
          'documento_foto',
          'cpf',
          'comprovante_renda_3m',
          'comprovante_residencia',
          'certidao_estado_civil',
        ],
        morador: ['documento_foto'],
      },
      venda: {
        cliente: ['documento_foto', 'cpf', 'comprovante_residencia', 'certidao_estado_civil'],
        conjuge_cliente: ['documento_foto', 'cpf'],
      },
    }
    const body = e.requestInfo().body || {}
    const pRole = String(body.role || '')
    const wanted = (docs[neg.getString('purpose')] || {})[pRole]
    if (!wanted) throw new BadRequestError('Este papel não vale para esta negociação.')

    const normPhone = (v) => {
      let d = String(v || '')
        .replace(/\D/g, '')
        .replace(/^0+/, '')
      if (d.length === 10 || d.length === 11) d = '55' + d
      return d
    }
    let client = null
    let newClient = false
    if (body.client_id) {
      try {
        client = $app.findRecordById('clients', String(body.client_id))
      } catch (_) {}
      if (!client || client.get('organization_id') !== orgId)
        throw new NotFoundError('Cliente não encontrado.')
      if (role === 'corretor' && String(client.get('responsible_id') || '') !== actor.id) {
        throw new NotFoundError('Cliente não encontrado.')
      }
    } else if (body.new && typeof body.new === 'object') {
      const name = String(body.new.name || '').trim()
      const phone = normPhone(body.new.phone)
      const email = String(body.new.email || '')
        .trim()
        .toLowerCase()
      if (name.length < 2) throw new BadRequestError('Informe o nome da pessoa.')
      if (!phone && !email) throw new BadRequestError('Informe telefone ou e-mail.')
      if (phone && (phone.length < 12 || phone.length > 13))
        throw new BadRequestError('Telefone inválido. Use DDD e número.')
      if (phone) {
        const d = $app.findRecordsByFilter(
          'clients',
          'organization_id = {:o} && phone = {:p}',
          '',
          1,
          0,
          { o: orgId, p: phone },
        )
        if (d.length)
          return e.json(409, {
            message: 'Já existe cliente com este telefone.',
            existing_client_id: d[0].id,
          })
      }
      if (email) {
        const d = $app.findRecordsByFilter(
          'clients',
          'organization_id = {:o} && email = {:m}',
          '',
          1,
          0,
          { o: orgId, m: email },
        )
        if (d.length)
          return e.json(409, {
            message: 'Já existe cliente com este e-mail.',
            existing_client_id: d[0].id,
          })
      }
      client = new Record($app.findCollectionByNameOrId('clients'))
      client.set('organization_id', orgId)
      client.set('name', name)
      if (phone) client.set('phone', phone)
      if (email) client.set('email', email)
      client.set('kind', [neg.getString('purpose') === 'venda' ? 'comprador' : 'locatario'])
      if (neg.getString('responsible_id'))
        client.set('responsible_id', neg.getString('responsible_id'))
      client.set('consent_status', 'unknown')
      newClient = true
    } else {
      throw new BadRequestError('Informe client_id ou new.')
    }

    // empresa como cliente: pede também o contrato social e o CNPJ
    const wantedFinal = wanted.slice()
    if (pRole === 'cliente' && client.getString('person_type') === 'juridica') {
      wantedFinal.push('contrato_social')
      wantedFinal.push('cnpj')
    }
    let personId = ''
    let created = 0
    try {
      $app.runInTransaction((tx) => {
        if (newClient) tx.save(client)
        const same = tx.findRecordsByFilter(
          'negotiation_people',
          'negotiation_id = {:n} && client_id = {:c} && role = {:r}',
          '',
          1,
          0,
          { n: neg.id, c: client.id, r: pRole },
        )
        let person = null
        if (same.length) {
          person = same[0]
          if (person.get('active') === true) throw new Error('duplicado')
          person.set('active', true)
          tx.save(person)
          tx.findRecordsByFilter('negotiation_documents', 'person_id = {:p}', '', 50, 0, {
            p: person.id,
          }).forEach((d) => {
            d.set('active', true)
            tx.save(d)
            created++
          })
        } else {
          person = new Record(tx.findCollectionByNameOrId('negotiation_people'))
          person.set('organization_id', orgId)
          person.set('negotiation_id', neg.id)
          person.set('client_id', client.id)
          person.set('role', pRole)
          person.set('active', true)
          tx.save(person)
          wantedFinal.forEach((t) => {
            const d = new Record(tx.findCollectionByNameOrId('negotiation_documents'))
            d.set('organization_id', orgId)
            d.set('negotiation_id', neg.id)
            d.set('person_id', person.id)
            d.set('doc_type', t)
            d.set('state', 'pendente')
            d.set('active', true)
            tx.save(d)
            created++
          })
        }
        personId = person.id
      })
    } catch (err) {
      if (String((err && err.message) || err) === 'duplicado') {
        return e.json(409, { message: 'Esta pessoa já está na negociação com este papel.' })
      }
      $app.logger().error('negotiation_person_failed', 'err', String((err && err.message) || err))
      return e.json(409, { message: 'Esta pessoa já está na negociação com este papel.' })
    }
    return e.json(200, { person_id: personId, client_id: client.id, documents: created })
  },
  $apis.requireAuth(),
)
