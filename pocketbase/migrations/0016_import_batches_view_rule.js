// A leitura individual de import_batches passa a seguir o padrão das outras coleções (0006):
// a regra só confere login e organização, e o hook role_gate_view responde 403 e grava a
// negação no audit_log quando o papel não é admin.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('import_batches')
    col.viewRule = "@request.auth.id != '' && organization_id = @request.auth.organization_id"
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('import_batches')
    col.viewRule =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin' && organization_id = @request.auth.organization_id"
    app.save(col)
  },
)
