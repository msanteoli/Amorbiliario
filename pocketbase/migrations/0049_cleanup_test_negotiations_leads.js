// SEXTA LIMPEZA DE DADOS DE TESTE (30/10). Decisão do dono, em chat: "se forem imóveis de teste e clientes de teste,
// encerra todas as negociações e apaga". As negociações não têm exclusão pela API (só superusuário), então esta migration
// apaga as 5 negociações de TESTE e os leads de TESTE que as prendem. Clientes e imóveis de teste saem depois, pelos
// endpoints de exclusão (que continuam conferindo vínculos).
// Trava: só apaga por id EXATO, e só se o lead tiver nome "ZZ TESTE" e o imóvel código "ZZ-TESTE". Qualquer outra coisa
// ligada aos registros (visitas, tarefas, outras negociações, outros leads do cliente) aborta a migration inteira.
// Se um registro não existir (instalação nova, produção), ignora. Só grava contagens no audit_log.
migrate(
  (app) => {
    const NEGOCIACOES = [
      '0rgjxqdhpcopdyp',
      '2fq7dkbsfuey94p',
      'du3693vivtnj9u2',
      'q7tzt1rnslqrsxr',
      'qcggp9alcj83cdl',
    ]
    const LEADS = [
      '047oh3nwee1wdgf',
      '2j8p8tpd67tmy8f',
      'dy4efhe2yvxhavn',
      'me8r9xrihh0d1iz',
      'kyn9l6lt3hna0ce',
    ]
    const abort = (msg) => {
      throw new Error('Limpeza abortada (nada foi apagado): ' + msg)
    }
    const achar = (col, id) => {
      try {
        return app.findRecordById(col, id)
      } catch (e) {
        return null
      }
    }
    const filhos = (col, filter, params) => app.findRecordsByFilter(col, filter, '', 500, 0, params)

    let orgId = ''
    const apagar = { negociacoes: [], pessoas: [], documentos: [], eventos: [], leads: [] }

    NEGOCIACOES.forEach((id) => {
      const neg = achar('negotiations', id)
      if (!neg) return
      const prop = achar('properties', neg.getString('property_id'))
      const lead = achar('leads', neg.getString('lead_id'))
      if (!lead) abort('negociação sem lead encontrado')
      if (lead.getString('name').indexOf('ZZ TESTE') !== 0)
        abort('lead da negociação não é de teste')
      if (prop && (prop.getString('code') || '').indexOf('ZZ-TESTE') !== 0)
        abort('imóvel da negociação não é de teste')
      orgId = neg.getString('organization_id')
      apagar.negociacoes.push(neg)
      filhos('negotiation_people', 'negotiation_id = {:n}', { n: neg.id }).forEach((p) => {
        apagar.pessoas.push(p)
      })
      filhos('negotiation_documents', 'negotiation_id = {:n}', { n: neg.id }).forEach((d) => {
        apagar.documentos.push(d)
      })
    })

    LEADS.forEach((id) => {
      const lead = achar('leads', id)
      if (!lead) return
      if (lead.getString('name').indexOf('ZZ TESTE') !== 0) abort('lead não é de teste')
      orgId = orgId || lead.getString('organization_id')
      const outrasNeg = filhos('negotiations', 'lead_id = {:l}', { l: lead.id }).filter(
        (n) => NEGOCIACOES.indexOf(n.id) < 0,
      )
      if (outrasNeg.length) abort('lead tem negociação fora da limpeza')
      if (filhos('visits', 'lead_id = {:l}', { l: lead.id }).length)
        abort('há visitas ligadas a um lead de teste')
      if (filhos('tasks', 'lead_id = {:l}', { l: lead.id }).length)
        abort('há tarefas ligadas a um lead de teste')
      filhos('lead_events', 'lead_id = {:l}', { l: lead.id }).forEach((e) => apagar.eventos.push(e))
      apagar.leads.push(lead)
    })

    // apaga os filhos antes dos pais
    apagar.documentos.forEach((r) => app.delete(r))
    apagar.pessoas.forEach((r) => app.delete(r))
    apagar.negociacoes.forEach((r) => app.delete(r))
    apagar.eventos.forEach((r) => app.delete(r))
    apagar.leads.forEach((r) => app.delete(r))

    const audit = new Record(app.findCollectionByNameOrId('audit_log'))
    audit.set('organization_id', orgId)
    audit.set('action', 'limpeza_dados_teste_7')
    audit.set('collection_name', 'negotiations')
    audit.set(
      'reason',
      '0049 negociacoes=' +
        apagar.negociacoes.length +
        ' pessoas=' +
        apagar.pessoas.length +
        ' documentos=' +
        apagar.documentos.length +
        ' leads=' +
        apagar.leads.length,
    )
    audit.set('occurred_at', new Date().toISOString())
    app.save(audit)
  },
  (app) => {
    // sem volta: eram dados de teste
  },
)
