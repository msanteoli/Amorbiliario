// CORREÇÃO da 0018: o e-mail do segredo IMOB_TEST_ORGB_CREDENTIALS era o do administrador inicial,
// e a 0018 reaproveitou esse usuário (movendo-o para a organização B e renomeando-o).
// Esta migration devolve o administrador à Janeide Xavier, com o nome original, e só apaga a
// organização de teste se ela ficar sem nenhum usuário. Não toca em senhas e não lê segredos.
migrate(
  (app) => {
    const orgA = app.findFirstRecordByData('organizations', 'slug', 'janeide-xavier')
    let orgB = null
    try {
      orgB = app.findFirstRecordByData('organizations', 'slug', 'zz-teste-org-b')
    } catch (_) {}
    if (!orgB) return

    const inB = app.findRecordsByFilter('users', 'organization_id = {:o}', '', 50, 0, {
      o: orgB.id,
    })
    inB.forEach((u) => {
      if (u.getString('name') === 'ZZ TESTE Admin Org B') {
        u.set('name', 'Administrador')
        u.set('organization_id', orgA.id)
        app.save(u)
      }
    })

    const left = app.findRecordsByFilter('users', 'organization_id = {:o}', '', 1, 0, {
      o: orgB.id,
    })
    if (left.length === 0) app.delete(orgB)
  },
  (app) => {
    // não há volta: a 0018 foi um erro de e-mail repetido
  },
)
