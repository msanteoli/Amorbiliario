// Travas na edição de usuários pela coleção (quando quem edita é admin; a pessoa que edita o
// próprio nome continua limitada pela updateRule): só os papéis admin, sdr e corretor; o e-mail
// e a senha de outra pessoa não mudam por aqui (a senha é da própria pessoa, criada pelo e-mail
// de convite); o admin não muda o próprio papel nem se desativa. Como quem age é sempre um admin
// ativo e não pode tirar a si mesmo, a organização nunca fica sem admin ativo. Mudança de papel
// e de situação (ativo) grava auditoria, só com o nome do campo.
onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const actor = e.auth
  if (String(actor.get('role')) !== 'admin') return e.next()
  const rec = e.record
  const orig = rec.original()
  const body = e.requestInfo().body || {}

  const role = rec.getString('role')
  if (role !== orig.getString('role') && ['admin', 'sdr', 'corretor'].indexOf(role) < 0) {
    throw new BadRequestError('Papel inválido.')
  }
  if (rec.getString('email') !== orig.getString('email')) {
    throw new BadRequestError('O e-mail não pode ser alterado aqui.')
  }
  if (rec.id !== actor.id && (body.password !== undefined || body.passwordConfirm !== undefined)) {
    throw new ForbiddenError('A senha só é trocada pela própria pessoa.')
  }
  if (rec.id === actor.id) {
    const changedRole = role !== orig.getString('role')
    const deactivated = orig.get('active') === true && rec.get('active') !== true
    if (changedRole || deactivated) {
      throw new ForbiddenError('O admin não pode mudar o próprio papel nem se desativar.')
    }
  }
  const roleChanged = role !== orig.getString('role')
  const activeChanged = (orig.get('active') === true) !== (rec.get('active') === true)
  const res = e.next()
  try {
    const col = $app.findCollectionByNameOrId('audit_log')
    const fields = []
    if (roleChanged) fields.push('role')
    if (activeChanged) fields.push('active')
    fields.forEach((f) => {
      const audit = new Record(col)
      audit.set('organization_id', rec.get('organization_id'))
      audit.set('actor_id', actor.id)
      audit.set('actor_role', 'admin')
      audit.set('action', 'usuario_alterado')
      audit.set('collection_name', 'users')
      audit.set('record_id', rec.id)
      audit.set('field_name', f)
      audit.set('occurred_at', new Date().toISOString())
      $app.save(audit)
    })
  } catch (err) {
    $app.logger().error('user_audit_failed', 'err', String((err && err.message) || err))
  }
  return res
}, 'users')
