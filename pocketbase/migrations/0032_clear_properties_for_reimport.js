// LIMPEZA TOTAL DOS IMÓVEIS PARA REIMPORTAR (decisão do dono em 12/10: "apagar tudo e subir de novo as planilhas do Kenlo").
// Só pode ser aplicada depois do backup prévio (fora do git) e do "sim" explícito do dono nos totais.
// Apaga, na organização janeide-xavier: fotos de imóveis, horários de visita, imóveis, fotos de condomínios,
// condomínios e lotes de importação. NUNCA toca: organizations, users, audit_log, portal_feeds, google_connections.
// Travas (qualquer uma lança erro e, como a migration roda em transação, NADA é apagado):
//   - leads, clientes, visitas, tarefas, negociações têm de estar zerados (senão apareceu dado novo que dependeria de imóvel);
//   - as contagens esperadas (imóveis, condomínios, lotes) têm de bater com o que o dono aprovou.
// Nenhum dado pessoal vai para mensagens de erro nem para o audit_log: só contagens.
migrate(
  (app) => {
    const EXPECTED = { properties: 181, condominiums: 94, import_batches: 3 }
    let org = null
    try {
      org = app.findFirstRecordByData('organizations', 'slug', 'janeide-xavier')
    } catch (e) {
      org = null
    }
    if (!org) return // instalação nova: nada a limpar
    const o = { o: org.id }
    const all = (col) => app.findRecordsByFilter(col, 'organization_id = {:o}', '', 500000, 0, o)
    const abort = (msg) => {
      throw new Error('Limpeza abortada (nada foi apagado): ' + msg)
    }
    const COLS = [
      'properties',
      'property_photos',
      'property_visit_slots',
      'condominiums',
      'condominium_photos',
      'import_batches',
      'leads',
      'clients',
      'visits',
      'tasks',
      'negotiations',
      'users',
      'audit_log',
      'portal_feeds',
      'google_connections',
      'organizations',
    ]
    const counts = () => {
      const c = {}
      COLS.forEach((n) => {
        c[n] = app.countRecords(n)
      })
      return c
    }
    const before = counts()

    ;['leads', 'clients', 'visits', 'tasks', 'negotiations'].forEach((n) => {
      if (before[n] !== 0) abort('há registros em ' + n + ' (' + before[n] + '); esperado zero.')
    })
    Object.keys(EXPECTED).forEach((n) => {
      if (before[n] !== EXPECTED[n]) {
        abort(n + ': ' + before[n] + ' (aprovado ' + EXPECTED[n] + ').')
      }
    })
    if (before.users < 1) abort('nenhum usuário na base.')

    const del = (rows) => {
      rows.forEach((r) => {
        app.delete(r)
      })
    }
    del(all('property_photos'))
    del(all('property_visit_slots'))
    del(all('properties'))
    del(all('condominium_photos'))
    del(all('condominiums'))
    del(all('import_batches'))

    const after = counts()
    const short = {
      properties: 'p',
      property_photos: 'pf',
      property_visit_slots: 'ph',
      condominiums: 'co',
      condominium_photos: 'cf',
      import_batches: 'ib',
      leads: 'l',
      clients: 'c',
      visits: 'v',
      tasks: 't',
      negotiations: 'n',
      users: 'u',
      audit_log: 'a',
      portal_feeds: 'pt',
      google_connections: 'g',
      organizations: 'o',
    }
    const parts = []
    COLS.forEach((n) => {
      parts.push(short[n] + ' ' + before[n] + '>' + after[n])
    })
    const audit = new Record(app.findCollectionByNameOrId('audit_log'))
    audit.set('organization_id', org.id)
    audit.set('action', 'limpeza_total_imoveis')
    audit.set('collection_name', 'varias')
    audit.set('reason', ('0032 antes>depois: ' + parts.join('; ')).slice(0, 300))
    audit.set('occurred_at', new Date().toISOString())
    app.save(audit)
  },
  (app) => {
    // sem volta: a rede de segurança é o backup feito antes (fora do git) e a reimportação das planilhas
  },
)
