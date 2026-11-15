// JaX, fase 1 (spec docs/superpowers/specs/2026-11-15-jax-app-corretor-design.md): conversas da IA do app
// do corretor. Só o endpoint /backend/v1/jax/chat grava (create/update/delete nulos). Leitura só do dono da
// conversa: nem o admin lê conversas dos outros. Conversa não se apaga; "Nova" começa outra.
migrate(
  (app) => {
    const orgId = app.findCollectionByNameOrId('organizations').id
    const dono =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || @request.auth.role = 'corretor') && user_id = @request.auth.id"

    app.save(
      new Collection({
        name: 'jax_conversations',
        type: 'base',
        listRule: dono,
        viewRule: dono,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'organization_id',
            type: 'relation',
            required: true,
            collectionId: orgId,
            maxSelect: 1,
          },
          {
            name: 'user_id',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
          },
          { name: 'title', type: 'text', max: 120 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_jax_conv_user ON jax_conversations (user_id, updated)'],
      }),
    )
    const convId = app.findCollectionByNameOrId('jax_conversations').id

    app.save(
      new Collection({
        name: 'jax_messages',
        type: 'base',
        listRule: dono,
        viewRule: dono,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'organization_id',
            type: 'relation',
            required: true,
            collectionId: orgId,
            maxSelect: 1,
          },
          {
            name: 'conversation_id',
            type: 'relation',
            required: true,
            collectionId: convId,
            maxSelect: 1,
          },
          {
            name: 'user_id',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
          },
          {
            name: 'role',
            type: 'select',
            required: true,
            values: ['user', 'assistant', 'evento'],
            maxSelect: 1,
          },
          { name: 'content', type: 'text', max: 8000 },
          { name: 'referencias', type: 'json', maxSize: 20000 },
          { name: 'proposta', type: 'json', maxSize: 5000 },
          { name: 'proposta_usada', type: 'bool' },
          { name: 'tokens', type: 'number', onlyInt: true, min: 0 },
          { name: 'modelo', type: 'text', max: 120 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_jax_msg_conv ON jax_messages (conversation_id, created)'],
      }),
    )
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('jax_messages'))
    app.delete(app.findCollectionByNameOrId('jax_conversations'))
  },
)
