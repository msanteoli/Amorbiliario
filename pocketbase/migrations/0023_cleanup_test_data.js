// LIMPEZA DOS DADOS DE TESTE (aprovada pelo dono em 2026-10-09, com backup prévio fora do Skip).
// Apaga só registros de teste da organização Janeide Xavier: imóveis e condomínios "ZZ TESTE", todos
// os clientes, leads, eventos, visitas e tarefas (todos de teste, mais o lead de teste do dono),
// lotes de importação de teste, usuários "ZZ TESTE" e o histórico de auditoria de teste.
// MANTÉM: os imóveis reais importados da Kenlo, os condomínios reais, os 3 lotes reais, os usuários
// reais e os usuários de teste de papel, e o histórico ligado a eles.
// Travas: se aparecer imóvel que não é de teste nem importado, cliente que não é de teste, ou mais de
// um lead que não é de teste, a migration falha e NADA é apagado (a migration roda em transação).
migrate(
  (app) => {
    const org = app.findFirstRecordByData('organizations', 'slug', 'janeide-xavier')
    const o = { o: org.id }
    const all = (col, filter, params) =>
      app.findRecordsByFilter(col, filter, '', 200000, 0, params || {})
    const del = (rows) => {
      rows.forEach((r) => {
        app.delete(r)
      })
    }

    const zzProps = all(
      'properties',
      "organization_id = {:o} && (code ~ 'ZZ-TESTE' || title ~ 'ZZ TESTE')",
      o,
    )
    const realProps = all(
      'properties',
      "organization_id = {:o} && code !~ 'ZZ-TESTE' && title !~ 'ZZ TESTE'",
      o,
    )
    realProps.forEach((p) => {
      if (p.getString('source') !== 'importacao') {
        throw new Error('Limpeza abortada: há imóvel que não é de teste nem importado.')
      }
    })
    const clients = all('clients', 'organization_id = {:o}', o)
    clients.forEach((c) => {
      if (c.getString('name').indexOf('ZZ TESTE') < 0) {
        throw new Error('Limpeza abortada: há cliente que não é de teste.')
      }
    })
    const leads = all('leads', 'organization_id = {:o}', o)
    const notTestLeads = leads.filter((l) => l.getString('name').indexOf('ZZ TESTE') < 0)
    if (notTestLeads.length > 1)
      throw new Error('Limpeza abortada: há mais de um lead que não é de teste.')

    // 1) o que depende de leads, clientes e imóveis
    del(all('visits', 'organization_id = {:o}', o))
    del(all('tasks', 'organization_id = {:o}', o))
    del(all('lead_events', 'organization_id = {:o}', o))
    del(leads)

    // 2) imóveis de teste e o que é deles
    zzProps.forEach((p) => {
      del(all('property_photos', 'property_id = {:p}', { p: p.id }))
      del(all('property_visit_slots', 'property_id = {:p}', { p: p.id }))
    })
    del(zzProps)

    // 3) clientes (todos de teste)
    del(all('client_private', 'organization_id = {:o}', o))
    del(clients)

    // 4) condomínios de teste
    const zzCondos = all('condominiums', "organization_id = {:o} && name ~ 'ZZ TESTE'", o)
    zzCondos.forEach((c) => {
      del(all('condominium_photos', 'condominium_id = {:c}', { c: c.id }))
    })
    del(zzCondos)

    // 5) lotes de importação que não são dos imóveis reais
    const keepBatch = {}
    realProps.forEach((p) => {
      const b = p.getString('import_batch_id')
      if (b) keepBatch[b] = true
    })
    del(all('import_batches', 'organization_id = {:o}', o).filter((b) => !keepBatch[b.id]))

    // 6) histórico de auditoria: fica só o que é dos imóveis reais e dos usuários que permanecem
    const users = all('users', 'organization_id = {:o}', o)
    const zzUsers = users.filter((u) => u.getString('name').indexOf('ZZ TESTE') >= 0)
    const keepRecord = {}
    realProps.forEach((p) => {
      keepRecord[p.id] = true
    })
    users.forEach((u) => {
      if (u.getString('name').indexOf('ZZ TESTE') < 0) keepRecord[u.id] = true
    })
    del(
      all('audit_log', 'organization_id = {:o}', o).filter(
        (a) => !keepRecord[a.getString('record_id')],
      ),
    )

    // 7) usuários de teste "ZZ TESTE" (os de papel, sem esse prefixo, ficam até a véspera do piloto)
    del(zzUsers)
  },
  (app) => {
    // sem volta: a cópia dos dados está no backup feito antes da limpeza
  },
)
