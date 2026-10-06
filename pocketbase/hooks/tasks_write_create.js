// Valida a tarefa na CRIAÇÃO. O criador é sempre quem chama; a tarefa nasce Aberta. O corretor
// só cria para si; o SDR para si e para corretores; o admin para qualquer usuário ativo da
// organização (admin, sdr ou corretor). Os vínculos (lead, cliente, imóvel) precisam ser da
// organização, e o corretor só vincula lead dele ou cliente do qual é responsável.
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const rec = e.record
  const role = String(e.auth.get('role'))
  const orgId = String(e.auth.get('organization_id') || '')

  const title = String(rec.get('title') || '').trim()
  if (title.length < 2) throw new BadRequestError('Informe o título da tarefa.')
  rec.set('title', title)
  rec.set('description', String(rec.get('description') || '').trim())

  // responsável: sem escolha, a tarefa é de quem a criou
  const assignee = rec.getString('assigned_to') || e.auth.id
  let u = null
  try {
    u = $app.findRecordById('users', assignee)
  } catch (_) {}
  const roleOk = u && ['admin', 'sdr', 'corretor'].indexOf(String(u.get('role'))) >= 0
  if (!roleOk || u.get('active') !== true || u.get('organization_id') !== orgId) {
    throw new BadRequestError('Responsável inválido.')
  }
  if (role === 'corretor' && assignee !== e.auth.id) {
    throw new ForbiddenError('O corretor só cria tarefas para si.')
  }
  if (role === 'sdr' && assignee !== e.auth.id && String(u.get('role')) !== 'corretor') {
    throw new ForbiddenError('O SDR cria tarefas para si e para corretores.')
  }
  rec.set('assigned_to', assignee)

  // vínculos
  const leadId = rec.getString('lead_id')
  if (leadId) {
    let l = null
    try {
      l = $app.findRecordById('leads', leadId)
    } catch (_) {}
    if (!l || l.get('organization_id') !== orgId) throw new BadRequestError('Vínculo inválido.')
    if (role === 'corretor' && l.getString('assigned_to') !== e.auth.id) {
      throw new BadRequestError('Vínculo inválido.')
    }
  }
  const clientId = rec.getString('client_id')
  if (clientId) {
    let c = null
    try {
      c = $app.findRecordById('clients', clientId)
    } catch (_) {}
    if (!c || c.get('organization_id') !== orgId) throw new BadRequestError('Vínculo inválido.')
    if (role === 'corretor' && String(c.get('responsible_id') || '') !== e.auth.id) {
      throw new BadRequestError('Vínculo inválido.')
    }
  }
  const propertyId = rec.getString('property_id')
  if (propertyId) {
    let p = null
    try {
      p = $app.findRecordById('properties', propertyId)
    } catch (_) {}
    if (!p || p.get('organization_id') !== orgId) throw new BadRequestError('Vínculo inválido.')
  }

  rec.set('status', 'aberta')
  rec.set('created_by', e.auth.id)
  rec.set('closed_by', '')
  rec.set('closed_at', '')
  return e.next()
}, 'tasks')
