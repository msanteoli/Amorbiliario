// M11 — Google Agenda: campos de sincronização em visits e a coleção google_connections.
// google_connections não é legível por ninguém (regras null); só os endpoints e a rotina leem.
migrate(
  (app) => {
    const orgId = app.findCollectionByNameOrId('organizations').id
    const visits = app.findCollectionByNameOrId('visits')
    visits.fields.add(new TextField({ name: 'google_event_id', max: 200 }))
    visits.fields.add(
      new SelectField({
        name: 'google_sync',
        values: ['nao_aplicavel', 'pendente', 'sincronizada', 'falhou'],
        maxSelect: 1,
      }),
    )
    visits.fields.add(new NumberField({ name: 'google_sync_attempts', min: 0 }))
    visits.fields.add(new TextField({ name: 'declined_reason', max: 300 }))
    visits.fields.add(new DateField({ name: 'declined_at' }))
    app.save(visits)

    app.save(
      new Collection({
        name: 'google_connections',
        type: 'base',
        listRule: null,
        viewRule: null,
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
          { name: 'refresh_token_enc', type: 'text', required: true, max: 2000 },
          { name: 'google_email', type: 'text', max: 200 },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['conectado', 'reconectar'],
            maxSelect: 1,
          },
          { name: 'connected_at', type: 'date' },
          { name: 'last_error', type: 'text', max: 80 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_google_connections_user ON google_connections (user_id)',
        ],
      }),
    )
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('google_connections'))
    const visits = app.findCollectionByNameOrId('visits')
    ;[
      'google_event_id',
      'google_sync',
      'google_sync_attempts',
      'declined_reason',
      'declined_at',
    ].forEach((n) => visits.fields.removeByName(n))
    app.save(visits)
  },
)
