// SÓ PARA TESTE (M7, isolamento entre organizações): cria a organização fictícia "ZZ TESTE Org B"
// e um administrador dela, a partir do segredo IMOB_TEST_ORGB_CREDENTIALS (formato email:senha).
// TRAVA (lição do incidente da 0018): se o e-mail já pertence a um usuário que NÃO é da organização
// B, a migration falha em vez de reaproveitar ou mover esse usuário. Nunca registra valores.
// A migration 0021 remove a organização e o usuário antes do piloto.
migrate(
  (app) => {
    const raw = $secrets.get('IMOB_TEST_ORGB_CREDENTIALS') || ''
    const idx = raw.indexOf(':')
    const email = idx > 0 ? raw.slice(0, idx).trim().toLowerCase() : ''
    const password = idx > 0 ? raw.slice(idx + 1) : ''
    if (email.indexOf('@') < 1 || password.length < 8) {
      throw new Error(
        'Segredo IMOB_TEST_ORGB_CREDENTIALS ausente ou inválido (formato email:senha, senha com 8+ caracteres)',
      )
    }

    let org
    try {
      org = app.findFirstRecordByData('organizations', 'slug', 'zz-teste-org-b')
    } catch (_) {
      org = new Record(app.findCollectionByNameOrId('organizations'))
      org.set('name', 'ZZ TESTE Organização B')
      org.set('slug', 'zz-teste-org-b')
      org.set('timezone', 'America/Bahia')
      app.save(org)
    }

    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    let rec = null
    try {
      rec = app.findAuthRecordByEmail('_pb_users_auth_', email)
    } catch (_) {}
    if (rec && rec.getString('organization_id') !== org.id) {
      throw new Error(
        'O e-mail do segredo IMOB_TEST_ORGB_CREDENTIALS já pertence a um usuário de outra organização. Use um e-mail novo.',
      )
    }
    if (!rec) {
      rec = new Record(users)
      rec.setEmail(email)
      rec.setVerified(true)
    }
    rec.setPassword(password)
    rec.set('name', 'ZZ TESTE Admin Org B')
    rec.set('role', 'admin')
    rec.set('organization_id', org.id)
    rec.set('active', true)
    app.save(rec)
  },
  (app) => {
    // a remoção é feita pela migration 0021, depois do teste
  },
)
