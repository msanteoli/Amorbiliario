migrate(
  (app) => {
    // Organização: dados de contato editáveis pelo admin; o identificador (slug) e o fuso não mudam.
    const orgs = app.findCollectionByNameOrId('organizations')
    if (!orgs.fields.getByName('contact_phone')) {
      orgs.fields.add(new TextField({ name: 'contact_phone', max: 30 }))
    }
    if (!orgs.fields.getByName('contact_email')) {
      orgs.fields.add(new EmailField({ name: 'contact_email' }))
    }
    if (!orgs.fields.getByName('address')) {
      orgs.fields.add(new TextField({ name: 'address', max: 300 }))
    }
    app.save(orgs)

    // :isset só vale numa coleção que já existe e foi salva: a regra vai depois do save acima.
    const orgsFinal = app.findCollectionByNameOrId('organizations')
    orgsFinal.updateRule =
      "@request.auth.active = true && @request.auth.role = 'admin' && id = @request.auth.organization_id && @request.body.slug:isset = false && @request.body.timezone:isset = false"
    app.save(orgsFinal)

    // Usuário novo só nasce pelo endpoint de convite (senha aleatória e e-mail para a pessoa criar a dela).
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.createRule = null
    app.save(users)
  },
  (app) => {
    const orgs = app.findCollectionByNameOrId('organizations')
    orgs.updateRule =
      "@request.auth.active = true && @request.auth.role = 'admin' && id = @request.auth.organization_id"
    orgs.fields.removeByName('contact_phone')
    orgs.fields.removeByName('contact_email')
    orgs.fields.removeByName('address')
    app.save(orgs)

    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.createRule =
      "@request.auth.active = true && @request.auth.role = 'admin' && @request.body.organization_id = @request.auth.organization_id"
    app.save(users)
  },
)
