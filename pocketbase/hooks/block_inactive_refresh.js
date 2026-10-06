// Recusa a RENOVAÇÃO de sessão (auth-refresh) de usuário com active != true.
// block_inactive_login.js só cobre o login por senha; sem este hook, uma conta
// desativada renovaria o token para sempre. Só para a coleção users.
onRecordAuthRefreshRequest((e) => {
  if (e.record && e.record.get('active') !== true) {
    throw new BadRequestError('Conta inativa. Fale com o administrador.')
  }
  return e.next()
}, 'users')
