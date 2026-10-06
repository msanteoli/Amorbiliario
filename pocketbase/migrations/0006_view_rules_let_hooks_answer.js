migrate(
  (app) => {
    // A 0005 deixou a leitura por id tão estrita quanto a listagem. Resultado: o
    // PocketBase escondia o registro (404) ANTES do hook rodar, e a negação não
    // era auditada nem devolvia 403. Aqui a leitura por id de users e
    // organizations volta a exigir só login e a mesma organização; o hook
    // role_gate_view.js responde 403 (papel sem acesso ou conta inativa) e audita.
    // A LISTAGEM continua estrita (é o canal do tempo real em nível de coleção).
    // Resíduo aceito: o tempo real de um registro específico só alcança o
    // registro cujo id a pessoa já conhece (a própria organização e o próprio usuário).
    // audit_log mantém a leitura por id estrita (só admin ativo).
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.viewRule = "@request.auth.id != '' && organization_id = @request.auth.organization_id"
    app.save(users)

    const orgs = app.findCollectionByNameOrId('organizations')
    orgs.viewRule = "@request.auth.id != '' && id = @request.auth.organization_id"
    app.save(orgs)
  },
  (app) => {
    const authOk =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || @request.auth.role = 'sdr' || @request.auth.role = 'corretor')"
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.viewRule = authOk + ' && organization_id = @request.auth.organization_id'
    app.save(users)

    const orgs = app.findCollectionByNameOrId('organizations')
    orgs.viewRule = authOk + ' && id = @request.auth.organization_id'
    app.save(orgs)
  },
)
