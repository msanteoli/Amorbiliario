// MCP (spec docs/superpowers/specs/2026-10-16-mcp-sistema-design.md): o sistema vira servidor MCP.
// Chaves de acesso vinculadas a um usuário, guardadas só como hash (token_hash é oculto).
// Só o admin lê; escrita fica fechada na coleção e acontece pelos endpoints /backend/v1/admin/mcp...
// Acrescenta organizations.mcp_enabled (padrão desligado).
migrate(
  (app) => {
    const org = app.findCollectionByNameOrId('organizations')
    org.fields.add(new BoolField({ name: 'mcp_enabled' }))
    app.save(org)

    const col = new Collection({
      type: 'base',
      name: 'mcp_keys',
      listRule:
        "@request.auth.id != '' && @request.auth.role = 'admin' && @request.auth.active = true && organization_id = @request.auth.organization_id",
      viewRule:
        "@request.auth.id != '' && @request.auth.role = 'admin' && @request.auth.active = true && organization_id = @request.auth.organization_id",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'organization_id', type: 'text', required: true, max: 50 },
        { name: 'user_id', type: 'text', required: true, max: 50 },
        { name: 'name', type: 'text', required: true, min: 2, max: 120 },
        { name: 'token_prefix', type: 'text', required: true, max: 12 },
        { name: 'token_hash', type: 'text', required: true, max: 128, hidden: true },
        {
          name: 'scope',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['leitura', 'leitura_escrita'],
        },
        { name: 'active', type: 'bool' },
        { name: 'created_by', type: 'text', max: 50 },
        { name: 'revoked_at', type: 'date' },
        { name: 'last_used_at', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_mcp_keys_hash ON mcp_keys (token_hash)'],
    })
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('mcp_keys')
    app.delete(col)
    const org = app.findCollectionByNameOrId('organizations')
    org.fields.removeByName('mcp_enabled')
    app.save(org)
  },
)
