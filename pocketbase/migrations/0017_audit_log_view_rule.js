// A leitura individual de audit_log passa a seguir o padrão da 0006: a regra só confere login e
// organização, e o hook role_gate_view responde 403 e grava a negação quando o papel não é admin.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('audit_log')
    col.viewRule = "@request.auth.id != '' && organization_id = @request.auth.organization_id"
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('audit_log')
    col.viewRule =
      "@request.auth.active = true && @request.auth.role = 'admin' && organization_id = @request.auth.organization_id"
    app.save(col)
  },
)
