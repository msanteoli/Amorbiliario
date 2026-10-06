migrate(
  (app) => {
    // Reforça as regras de coleção (segunda barreira, além dos hooks):
    //  - conta precisa estar ativa (desativar é a única forma de tirar acesso);
    //  - leitura só para admin, sdr e corretor. Vale também para o tempo real
    //    (SSE), que aplica só as regras e não passa pelos hooks.
    const authOk =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || @request.auth.role = 'sdr' || @request.auth.role = 'corretor')"

    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.listRule = authOk + ' && organization_id = @request.auth.organization_id'
    users.viewRule = authOk + ' && organization_id = @request.auth.organization_id'
    users.createRule =
      "@request.auth.active = true && @request.auth.role = 'admin' && @request.body.organization_id = @request.auth.organization_id"
    users.updateRule =
      authOk +
      " && organization_id = @request.auth.organization_id && ((@request.auth.role = 'admin' && (@request.body.organization_id:isset = false || @request.body.organization_id = @request.auth.organization_id)) || (id = @request.auth.id && @request.body.role:isset = false && @request.body.organization_id:isset = false && @request.body.active:isset = false))"
    app.save(users)

    const orgs = app.findCollectionByNameOrId('organizations')
    orgs.listRule = authOk + ' && id = @request.auth.organization_id'
    orgs.viewRule = authOk + ' && id = @request.auth.organization_id'
    orgs.updateRule =
      "@request.auth.active = true && @request.auth.role = 'admin' && id = @request.auth.organization_id"
    app.save(orgs)

    const audit = app.findCollectionByNameOrId('audit_log')
    audit.listRule =
      "@request.auth.active = true && @request.auth.role = 'admin' && organization_id = @request.auth.organization_id"
    audit.viewRule =
      "@request.auth.active = true && @request.auth.role = 'admin' && organization_id = @request.auth.organization_id"
    app.save(audit)
  },
  (app) => {
    // volta às regras da 0001 e da 0002
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.listRule = "@request.auth.id != '' && organization_id = @request.auth.organization_id"
    users.viewRule = "@request.auth.id != '' && organization_id = @request.auth.organization_id"
    users.createRule =
      "@request.auth.role = 'admin' && @request.body.organization_id = @request.auth.organization_id"
    users.updateRule =
      "organization_id = @request.auth.organization_id && ((@request.auth.role = 'admin' && (@request.body.organization_id:isset = false || @request.body.organization_id = @request.auth.organization_id)) || (id = @request.auth.id && @request.body.role:isset = false && @request.body.organization_id:isset = false && @request.body.active:isset = false))"
    app.save(users)

    const orgs = app.findCollectionByNameOrId('organizations')
    orgs.listRule = "@request.auth.id != '' && id = @request.auth.organization_id"
    orgs.viewRule = "@request.auth.id != '' && id = @request.auth.organization_id"
    orgs.updateRule = "@request.auth.role = 'admin' && id = @request.auth.organization_id"
    app.save(orgs)

    const audit = app.findCollectionByNameOrId('audit_log')
    audit.listRule =
      "@request.auth.role = 'admin' && organization_id = @request.auth.organization_id"
    audit.viewRule =
      "@request.auth.role = 'admin' && organization_id = @request.auth.organization_id"
    app.save(audit)
  },
)
