// Painel personalizável (spec docs/superpowers/specs/2026-10-23-painel-personalizar-design.md): o arranjo dos quadros de cada pessoa.
// Uma linha por usuário (índice único). O arranjo é um texto JSON { version, blocks:[{id,w}] }, validado pelos endpoints /backend/v1/panel/layout.
// SEM acesso direto pela coleção (regras nulas): ler e gravar só pelos endpoints.
migrate(
  (app) => {
    const col = new Collection({
      type: 'base',
      name: 'panel_layouts',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'organization_id', type: 'text', required: true, max: 50 },
        { name: 'user_id', type: 'text', required: true, max: 50 },
        { name: 'layout', type: 'text', max: 9000 },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_panel_layouts_user ON panel_layouts (user_id)'],
    })
    app.save(col)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('panel_layouts'))
  },
)
