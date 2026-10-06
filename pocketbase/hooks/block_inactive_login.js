// Recusa o login de usuário com active != true. Como ninguém apaga registros,
// desativar é a única forma de tirar o acesso de alguém.
// Só para a coleção users: o login do superusuário da plataforma não passa por aqui.
onRecordAuthWithPasswordRequest((e) => {
  if (e.record && e.record.get('active') !== true) {
    throw new BadRequestError('Conta inativa. Fale com o administrador.')
  }
  return e.next()
}, 'users')
