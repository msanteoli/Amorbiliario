// Travas na edição de usuários pela coleção (quando quem edita é admin; a pessoa que edita o
// próprio nome continua limitada pela updateRule): só os papéis admin, sdr e corretor; o e-mail
// e a senha de outra pessoa não mudam por aqui (a senha é da própria pessoa, criada pelo e-mail
// de convite); o admin não muda o próprio papel nem se desativa. Como quem age é sempre um admin
// ativo e não pode tirar a si mesmo, a organização nunca fica sem admin ativo.
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
  return e.next()
}, 'users')
