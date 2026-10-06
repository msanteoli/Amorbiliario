migrate(
  (app) => {
    const orgId = app.findCollectionByNameOrId('organizations').id
    const col = new Collection({
      name: 'audit_log',
      type: 'base',
      // Só admin lê, da própria organização. Ninguém escreve pela API: os hooks
      // gravam com $app.save. A auditoria nunca guarda o valor negado.
      listRule: "@request.auth.role = 'admin' && organization_id = @request.auth.organization_id",
      viewRule: "@request.auth.role = 'admin' && organization_id = @request.auth.organization_id",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'organization_id', type: 'relation', collectionId: orgId, maxSelect: 1 },
        { name: 'actor_id', type: 'text', max: 40 },
        { name: 'actor_role', type: 'text', max: 20 },
        { name: 'action', type: 'text', required: true, max: 60 },
        { name: 'collection_name', type: 'text', max: 60 },
        { name: 'record_id', type: 'text', max: 40 },
        { name: 'field_name', type: 'text', max: 60 },
        { name: 'reason', type: 'text', max: 300 },
        { name: 'occurred_at', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_audit_log_org_created ON audit_log (organization_id, created DESC)',
      ],
    })
    app.save(col)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('audit_log'))
  },
)
