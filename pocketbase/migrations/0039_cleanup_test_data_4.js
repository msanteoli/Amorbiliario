// QUARTA LIMPEZA DOS DADOS DE TESTE (18/10). Aprovada pelo dono: clientes, imóveis e o que depende deles são todos de teste.
// Só pode ser aplicada depois do backup prévio (fora do git) e do "sim" explícito do dono nos totais.
// Apaga, na organização janeide-xavier: negociações (e pessoas e documentos), visitas, tarefas, eventos de lead, leads,
// fotos e horários de imóveis, imóveis, dados privados de clientes, clientes, fotos de condomínio, condomínios e lotes
// de importação. Zera a sequência de códigos de imóvel (property_code_seq).
// NUNCA toca: users, organizations (só zera property_code_seq), audit_log, portal_feeds, google_connections,
// agenda_blocks e mcp_keys.
// Travas (qualquer uma lança erro; a migration roda em transação, então NADA é apagado):
//   - as contagens aprovadas pelo dono (EXPECTED) têm de bater exatamente: qualquer registro novo desde o relatório aborta.
// Nenhum dado pessoal vai para mensagens de erro nem para o audit_log: só contagens.
migrate(
  (app) => {
    const EXPECTED = {
      clients: 11,
      client_private: 4,
      properties: 8,
      property_photos: 33,
      leads: 28,
      lead_events: 84,
      tasks: 1,
      negotiations: 1,
      visits: 0,
      condominiums: 0,
      import_batches: 0,
    }
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
      'users',
      'clients',
      'client_private',
      'properties',
      'property_photos',
      'property_visit_slots',
      'condominiums',
      'condominium_photos',
      'import_batches',
      'leads',
      'lead_events',
      'visits',
      'tasks',
      'negotiations',
      'negotiation_people',
      'negotiation_documents',
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
    Object.keys(EXPECTED).forEach((k) => {
      if (before[k] !== EXPECTED[k])
        abort(k + ': ' + before[k] + ' (aprovado ' + EXPECTED[k] + ').')
    })

    const del = (rows) => {
      rows.forEach((r) => {
        app.delete(r)
      })
    }
    // dependentes primeiro
    del(all('negotiation_documents'))
    del(all('negotiation_people'))
    del(all('negotiations'))
    del(all('visits'))
    del(all('tasks'))
    del(all('lead_events'))
    del(all('leads'))
    del(all('property_photos'))
    del(all('property_visit_slots'))
    del(all('properties'))
    del(all('client_private'))
    del(all('clients'))
    del(all('condominium_photos'))
    del(all('condominiums'))
    del(all('import_batches'))

    // zera a sequência de códigos: não há mais nenhum imóvel
    const orgRec = app.findRecordById('organizations', org.id)
    orgRec.set('property_code_seq', 0)
    app.save(orgRec)

    const after = counts()
    const parts = []
    COLS.forEach((n) => {
      parts.push(n + ' ' + before[n] + '>' + after[n])
    })
    const audit = new Record(app.findCollectionByNameOrId('audit_log'))
    audit.set('organization_id', org.id)
    audit.set('action', 'limpeza_dados_teste_4')
    audit.set('collection_name', 'varias')
    audit.set('reason', ('0039 antes>depois: ' + parts.join('; ')).slice(0, 300))
    audit.set('occurred_at', new Date().toISOString())
    app.save(audit)
  },
  (app) => {
    // sem volta: a rede de segurança é o backup feito antes (fora do git)
  },
)
