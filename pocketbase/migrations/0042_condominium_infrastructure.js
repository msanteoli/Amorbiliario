// Condomínio v2, Fase 1 (spec docs/superpowers/specs/2026-10-20-condominio-v2-design.md):
//   condominiums.infrastructure = itens de infraestrutura do condomínio (texto livre, um por linha, até 2000).
// Campo opcional e sem regra nova: quem já edita o condomínio (admin e corretor) edita este campo; SDR continua só lendo.
// Nada é preenchido: os condomínios existentes ficam com o campo vazio.
migrate(
  (app) => {
    const condos = app.findCollectionByNameOrId('condominiums')
    condos.fields.add(new TextField({ name: 'infrastructure', max: 2000 }))
    app.save(condos)
  },
  (app) => {
    const condos = app.findCollectionByNameOrId('condominiums')
    condos.fields.removeByName('infrastructure')
    app.save(condos)
  },
)
