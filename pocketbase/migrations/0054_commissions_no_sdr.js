// Comissões (0050): o SDR deixa de ler regras, comissões e parcelas (decisão do dono, 14/11/2026).
// Só o admin (a organização toda) e o corretor (as próprias) leem. Escrita continua só do admin.
// A mesma trava está em role_gate_list.js e role_gate_view.js (403 com auditoria).
// Só muda regras de leitura: nenhum dado é criado, alterado ou apagado.
migrate(
  (app) => {
    const base =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || @request.auth.role = 'corretor') && organization_id = @request.auth.organization_id"

    const regras = app.findCollectionByNameOrId('commission_rules')
    regras.listRule = base
    regras.viewRule = base
    app.save(regras)

    const comissoes = app.findCollectionByNameOrId('commissions')
    const proprias = base + " && (@request.auth.role = 'admin' || broker_id = @request.auth.id)"
    comissoes.listRule = proprias
    comissoes.viewRule = proprias
    app.save(comissoes)

    const parcelas = app.findCollectionByNameOrId('commission_installments')
    const daComissao =
      base + " && (@request.auth.role = 'admin' || commission_id.broker_id = @request.auth.id)"
    parcelas.listRule = daComissao
    parcelas.viewRule = daComissao
    app.save(parcelas)
  },
  (app) => {
    const antiga =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || @request.auth.role = 'sdr' || @request.auth.role = 'corretor') && organization_id = @request.auth.organization_id"

    const regras = app.findCollectionByNameOrId('commission_rules')
    regras.listRule = antiga
    regras.viewRule = antiga
    app.save(regras)

    const comissoes = app.findCollectionByNameOrId('commissions')
    const c = antiga + " && (@request.auth.role != 'corretor' || broker_id = @request.auth.id)"
    comissoes.listRule = c
    comissoes.viewRule = c
    app.save(comissoes)

    const parcelas = app.findCollectionByNameOrId('commission_installments')
    const p =
      antiga +
      " && (@request.auth.role != 'corretor' || commission_id.broker_id = @request.auth.id)"
    parcelas.listRule = p
    parcelas.viewRule = p
    app.save(parcelas)
  },
)
