migrate(
  (app) => {
    // Reaplica os segredos IMOB_* aos usuários iniciais: cria quem faltar e
    // REDEFINE a senha de quem já existe. Existe porque a 0003 não mexe em
    // senha de usuário já criado; se um segredo foi digitado errado na primeira
    // aplicação, esta migration conserta depois que o segredo for corrigido.
    // Nunca registra valores.
    const seeds = [
      { key: 'IMOB_ADMIN_CREDENTIALS', role: 'admin', name: 'Administrador' },
      { key: 'IMOB_TEST_SDR_CREDENTIALS', role: 'sdr', name: 'Teste SDR' },
      { key: 'IMOB_TEST_CORRETOR_CREDENTIALS', role: 'corretor', name: 'Teste Corretor' },
      { key: 'IMOB_TEST_OUTRO_CREDENTIALS', role: 'outro', name: 'Teste Sem Acesso' },
    ]

    const readCreds = (key) => {
      const raw = $secrets.get(key) || ''
      const idx = raw.indexOf(':')
      const email = idx > 0 ? raw.slice(0, idx).trim().toLowerCase() : ''
      const password = idx > 0 ? raw.slice(idx + 1) : ''
      if (email.indexOf('@') < 1 || password.length < 8) {
        throw new Error(
          'Segredo ' + key + ' ausente ou inválido (formato email:senha, senha com 8+ caracteres)',
        )
      }
      return { email: email, password: password }
    }
    // valida os quatro antes de gravar qualquer coisa
    const creds = seeds.map((s) => readCreds(s.key))

    const org = app.findFirstRecordByData('organizations', 'slug', 'janeide-xavier')
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    seeds.forEach((s, i) => {
      let rec
      try {
        rec = app.findAuthRecordByEmail('_pb_users_auth_', creds[i].email)
      } catch (_) {
        rec = new Record(users)
        rec.setEmail(creds[i].email)
        rec.setVerified(true)
      }
      rec.setPassword(creds[i].password)
      rec.set('name', s.name)
      rec.set('role', s.role)
      rec.set('organization_id', org.id)
      rec.set('active', true)
      app.save(rec)
    })
  },
  (app) => {
    // sem reversão: não há como restaurar senhas anteriores
  },
)
