// Tipo de transação do lead (pedido de Janeide, 2026-11-10): a SDR registra se o lead busca compra ou aluguel.
//   leads.transaction_type = '' (não informado) | compra | aluguel
// Campo novo, sem regra nova: as regras de acesso de leads já limitam admin, SDR e corretor responsável,
// e o campo não entra na lista de campos proibidos do updateRule (SDR pode escrever).
migrate(
  (app) => {
    const leads = app.findCollectionByNameOrId('leads')
    leads.fields.add(
      new SelectField({
        name: 'transaction_type',
        values: ['compra', 'aluguel'],
        maxSelect: 1,
      }),
    )
    app.save(leads)
  },
  (app) => {
    const leads = app.findCollectionByNameOrId('leads')
    leads.fields.removeByName('transaction_type')
    app.save(leads)
  },
)
