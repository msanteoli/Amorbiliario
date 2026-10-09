// Devolve ao usuário de teste do segredo IMOB_TEST_OUTRO_CREDENTIALS o papel "outro" (sem acesso) e o
// nome "Teste Sem Acesso". Ele havia sido renomeado e passado a SDR pela tela de Administração (que
// não oferece o papel "outro"), e os testes de segurança perderam o usuário que prova o bloqueio.
// Trava: só mexe se o usuário for de teste (nome começando por "ZZ TESTE" ou "Teste"); nunca em
// pessoa real. Não mexe em senha, não lê nem registra o valor do segredo.
migrate(
  (app) => {
    const raw = $secrets.get('IMOB_TEST_OUTRO_CREDENTIALS') || ''
    const idx = raw.indexOf(':')
    const email = idx > 0 ? raw.slice(0, idx).trim().toLowerCase() : ''
    if (email.indexOf('@') < 1) {
      throw new Error('Segredo IMOB_TEST_OUTRO_CREDENTIALS ausente ou inválido.')
    }
    let user = null
    try {
      user = app.findAuthRecordByEmail('_pb_users_auth_', email)
    } catch (_) {}
    if (!user) return
    const name = user.getString('name')
    if (name.indexOf('ZZ TESTE') !== 0 && name.indexOf('Teste') !== 0) {
      throw new Error('Migration abortada: o usuário do segredo não parece ser de teste.')
    }
    user.set('role', 'outro')
    user.set('name', 'Teste Sem Acesso')
    user.set('active', true)
    app.save(user)
  },
  (app) => {
    // sem volta
  },
)
