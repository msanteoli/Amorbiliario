// Lead de captação (spec docs/superpowers/specs/2026-10-25-lead-captacao-design.md): o proprietário que quer anunciar um imóvel
// chega pela página /vender do site e vira um lead com tipo de interesse "captacao".
//   leads.interest_kind        = compra_locacao | captacao (vazio vale como compra_locacao: nenhum lead existente é alterado)
//   leads.owner_address        = endereço do imóvel do proprietário (dado pessoal; só quem já vê o lead vê o campo)
//   leads.owner_property_type  = tipo do imóvel do proprietário (mesma lista de properties.property_type)
// Sem coleção nova e sem regra nova: as regras de acesso de leads já limitam admin, SDR e corretor responsável.
migrate(
  (app) => {
    const leads = app.findCollectionByNameOrId('leads')
    leads.fields.add(
      new SelectField({
        name: 'interest_kind',
        values: ['compra_locacao', 'captacao'],
        maxSelect: 1,
      }),
    )
    leads.fields.add(new TextField({ name: 'owner_address', max: 300 }))
    leads.fields.add(
      new SelectField({
        name: 'owner_property_type',
        values: ['casa', 'apartamento', 'terreno', 'comercial', 'galpao', 'chacara', 'outro'],
        maxSelect: 1,
      }),
    )
    app.save(leads)
  },
  (app) => {
    const leads = app.findCollectionByNameOrId('leads')
    leads.fields.removeByName('interest_kind')
    leads.fields.removeByName('owner_address')
    leads.fields.removeByName('owner_property_type')
    app.save(leads)
  },
)
