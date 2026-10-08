// Remove a organização de teste "ZZ TESTE Org B" e o administrador de teste dela (criados pela 0020),
// depois do teste de isolamento. Só apaga usuários DESSA organização com o nome de teste, e só apaga
// a organização se ela ficar vazia. Não toca em nada da Janeide Xavier.
migrate(
  (app) => {
    let orgB = null
    try {
      orgB = app.findFirstRecordByData('organizations', 'slug', 'zz-teste-org-b')
    } catch (_) {}
    if (!orgB) return

    const inB = app.findRecordsByFilter('users', 'organization_id = {:o}', '', 50, 0, {
      o: orgB.id,
    })
    inB.forEach((u) => {
      if (u.getString('name') === 'ZZ TESTE Admin Org B') app.delete(u)
    })

    const left = app.findRecordsByFilter('users', 'organization_id = {:o}', '', 1, 0, {
      o: orgB.id,
    })
    if (left.length === 0) app.delete(orgB)
  },
  (app) => {
    // sem volta: a organização de teste só existe durante o teste de isolamento
  },
)
