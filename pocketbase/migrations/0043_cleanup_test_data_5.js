// QUINTA LIMPEZA DOS DADOS DE TESTE (20/10). Decisão do dono, em chat: "pode forçar a exclusão quebrando a regra".
// Remove só 2 pares lead+cliente de TESTE que se bloqueiam mutuamente (o bloqueio circular cliente <-> lead, spec
// docs/superpowers/specs/2026-10-16-exclusao-admin-design.md seção 9.4, ainda não resolvido: pendência registrada).
// Trava: só apaga os 4 registros por id EXATO e só se o nome começar com "ZZ TESTE M15b"; qualquer outra coisa ligada
// a eles (visitas, tarefas, negociações, outros leads do cliente) aborta a migration inteira (transação: nada é apagado).
// Se os registros não existirem (instalação nova), não faz nada. Não toca em mais nada. Só grava contagens no audit_log.
migrate(
  (app) => {
    const PARES = [
      { lead: 'dpvn8hxtehmtu81', client: 'rbgnfg7461vgkh5' },
      { lead: 'mf06sxc42tuk6z1', client: 'zjp05qnc8fz2cy1' },
    ]
    const abort = (msg) => {
      throw new Error('Limpeza abortada (nada foi apagado): ' + msg)
    }
    let orgId = ''
    const apagar = []
    PARES.forEach((par) => {
      let lead = null
      let client = null
      try {
        lead = app.findRecordById('leads', par.lead)
      } catch (e) {
        lead = null
      }
      try {
        client = app.findRecordById('clients', par.client)
      } catch (e) {
        client = null
      }
      if (!lead && !client) return
      if (!lead || !client) abort('par incompleto')
      if (lead.getString('name').indexOf('ZZ TESTE M15b') !== 0) abort('lead não é de teste')
      if (client.getString('name').indexOf('ZZ TESTE M15b') !== 0) abort('cliente não é de teste')
      if (lead.getString('client_id') !== client.id) abort('lead não aponta para o cliente')
      orgId = lead.getString('organization_id')
      const dep = (col, filter) =>
        app.findRecordsByFilter(col, filter, '', 10, 0, { l: lead.id, c: client.id }).length
      if (dep('leads', 'client_id = {:c} && id != {:l}') > 0) abort('cliente tem outros leads')
      if (dep('visits', 'lead_id = {:l} || client_id = {:c}') > 0) abort('há visitas ligadas')
      if (dep('tasks', 'lead_id = {:l} || client_id = {:c}') > 0) abort('há tarefas ligadas')
      if (dep('negotiations', 'lead_id = {:l}') > 0) abort('há negociações ligadas')
      if (dep('negotiation_people', 'client_id = {:c}') > 0)
        abort('há pessoas de negociação ligadas')
      apagar.push({ lead: lead, client: client })
    })
    if (!apagar.length) return

    let eventos = 0
    let privados = 0
    apagar.forEach((par) => {
      app
        .findRecordsByFilter('lead_events', 'lead_id = {:l}', '', 5000, 0, { l: par.lead.id })
        .forEach((ev) => {
          app.delete(ev)
          eventos++
        })
      app
        .findRecordsByFilter('client_private', 'client_id = {:c}', '', 10, 0, { c: par.client.id })
        .forEach((pv) => {
          app.delete(pv)
          privados++
        })
      app.delete(par.lead)
      app.delete(par.client)
    })

    const audit = new Record(app.findCollectionByNameOrId('audit_log'))
    audit.set('organization_id', orgId)
    audit.set('action', 'limpeza_dados_teste_5')
    audit.set('collection_name', 'varias')
    audit.set(
      'reason',
      '0043 pares=' + apagar.length + ' lead_events=' + eventos + ' client_private=' + privados,
    )
    audit.set('occurred_at', new Date().toISOString())
    app.save(audit)
  },
  (app) => {
    // sem volta: eram dados de teste
  },
)
