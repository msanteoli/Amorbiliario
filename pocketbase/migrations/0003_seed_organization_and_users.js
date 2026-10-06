migrate(
  (app) => {
    // Lê "email:senha" de um segredo. A senha pode conter ':' (vale o primeiro).
    // Se o segredo faltar ou for inválido, a migration FALHA, o que é recuperável
    // (corrige-se o segredo e reenvia-se o mesmo arquivo). Nunca registra valores.
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

    const seeds = [
      { key: 'IMOB_ADMIN_CREDENTIALS', role: 'admin', name: 'Administrador' },
      { key: 'IMOB_TEST_SDR_CREDENTIALS', role: 'sdr', name: 'Teste SDR' },
      { key: 'IMOB_TEST_CORRETOR_CREDENTIALS', role: 'corretor', name: 'Teste Corretor' },
      { key: 'IMOB_TEST_OUTRO_CREDENTIALS', role: 'outro', name: 'Teste Sem Acesso' },
    ]
    // valida os quatro antes de gravar qualquer coisa
    const creds = seeds.map((s) => readCreds(s.key))

    let org
    try {
      org = app.findFirstRecordByData('organizations', 'slug', 'janeide-xavier')
    } catch (_) {
      org = new Record(app.findCollectionByNameOrId('organizations'))
      org.set('name', 'Imobiliária Janeide Xavier')
      org.set('slug', 'janeide-xavier')
      org.set('timezone', 'America/Bahia')
      app.save(org)
    }

    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    seeds.forEach((s, i) => {
      let rec
      try {
        rec = app.findAuthRecordByEmail('_pb_users_auth_', creds[i].email)
      } catch (_) {
        rec = new Record(users)
        rec.setEmail(creds[i].email)
        rec.setPassword(creds[i].password)
        rec.setVerified(true)
      }
      rec.set('name', s.name)
      rec.set('role', s.role)
      rec.set('organization_id', org.id)
      rec.set('active', true)
      app.save(rec)
    })
  },
  (app) => {
    const keys = [
      'IMOB_ADMIN_CREDENTIALS',
      'IMOB_TEST_SDR_CREDENTIALS',
      'IMOB_TEST_CORRETOR_CREDENTIALS',
      'IMOB_TEST_OUTRO_CREDENTIALS',
    ]
    keys.forEach((key) => {
      try {
        const raw = $secrets.get(key) || ''
        const email = raw.slice(0, raw.indexOf(':')).trim().toLowerCase()
        app.delete(app.findAuthRecordByEmail('_pb_users_auth_', email))
      } catch (_) {}
    })
    try {
      app.delete(app.findFirstRecordByData('organizations', 'slug', 'janeide-xavier'))
    } catch (_) {}
  },
)
