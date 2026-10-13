// TERCEIRA LIMPEZA DOS DADOS DE TESTE (13/10). Hoje a base inteira é de teste (regressão do M13 e das suítes antigas).
// Só pode ser aplicada depois do backup prévio (fora do git) e do "sim" explícito do dono nos totais.
// Apaga, na organização janeide-xavier: negociações (e pessoas e documentos), visitas, tarefas, eventos de lead, leads,
// fotos e horários de imóveis, imóveis, dados privados de clientes, clientes, fotos de condomínio, condomínios, lotes
// de importação e os usuários com "ZZ TESTE" no NOME. Zera a sequência de códigos de imóvel (property_code_seq).
// NUNCA toca: organizations (só zera property_code_seq), audit_log, portal_feeds, google_connections e os usuários mantidos.
// Travas (qualquer uma lança erro; a migration roda em transação, então NADA é apagado):
//   - as contagens aprovadas pelo dono (EXPECTED) têm de bater exatamente: qualquer registro novo desde o relatório aborta;
//   - todo cliente tem de ter "ZZ TESTE" no nome;
//   - nenhum imóvel importado real (source = importacao com código que não começa por ZZ-TESTE);
//   - nenhum lead de portal sem ser contato de teste: o portal não foi ativado (dono confirmou em 12/10 e deve reconfirmar).
// Nenhum dado pessoal vai para mensagens de erro nem para o audit_log: só contagens.
migrate(
  (app) => {
    const EXPECTED = {
      users_to_delete: 2,
      clients: 129,
      properties: 186,
      condominiums: 8,
      import_batches: 9,
      leads: 120,
      tasks: 37,
      visits: 36,
      negotiations: 5,
    }
    let org = null
    try {
      org = app.findFirstRecordByData('organizations', 'slug', 'janeide-xavier')
    } catch (e) {
      org = null
    }
    if (!org) return // instalação nova: nada a limpar
    const o = { o: org.id }
    const all = (col, filter, params) =>
      app.findRecordsByFilter(col, filter || 'organization_id = {:o}', '', 500000, 0, params || o)
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

    const users = all('users')
    const zzUsers = users.filter((u) => u.getString('name').indexOf('ZZ TESTE') >= 0)
    const zzUserIds = {}
    zzUsers.forEach((u) => {
      zzUserIds[u.id] = true
    })
    const clients = all('clients')
    const props = all('properties')

    // travas de totais aprovados
    const have = {
      users_to_delete: zzUsers.length,
      clients: before.clients,
      properties: before.properties,
      condominiums: before.condominiums,
      import_batches: before.import_batches,
      leads: before.leads,
      tasks: before.tasks,
      visits: before.visits,
      negotiations: before.negotiations,
    }
    Object.keys(EXPECTED).forEach((k) => {
      if (have[k] !== EXPECTED[k]) abort(k + ': ' + have[k] + ' (aprovado ' + EXPECTED[k] + ').')
    })
    clients.forEach((c) => {
      if (c.getString('name').indexOf('ZZ TESTE') < 0) abort('há cliente que não é de teste.')
    })
    props.forEach((p) => {
      if (
        p.getString('source') === 'importacao' &&
        String(p.getString('code')).indexOf('ZZ-TESTE') !== 0
      ) {
        abort('há imóvel importado que não é de teste (possível importação real do Kenlo).')
      }
    })
    all('leads').forEach((l) => {
      if (l.getString('name').indexOf('ZZ TESTE') < 0) {
        const fromPortalTest =
          l.getString('origin') === 'portal' &&
          l.getString('origin_detail').indexOf('Chaves na Mão') === 0
        if (!fromPortalTest) abort('há lead que não é de teste nem contato de teste do portal.')
      }
    })
    zzUsers.forEach((u) => {
      if (u.getString('role') === 'admin')
        abort('há usuário de teste com papel admin no grupo a apagar.')
    })
    all('google_connections').forEach((g) => {
      if (zzUserIds[g.getString('user_id')])
        abort('há conexão Google de usuário de teste (seria mantida órfã).')
    })
    if (users.length - zzUsers.length < 1) abort('nenhum usuário seria mantido.')

    // remoção (dependentes primeiro)
    const del = (rows) => {
      rows.forEach((r) => {
        app.delete(r)
      })
    }
    del(all('negotiation_documents'))
    del(all('negotiation_people'))
    del(all('negotiations'))
    del(all('visits'))
    del(all('tasks'))
    del(all('lead_events'))
    del(all('leads'))
    del(all('property_photos'))
    del(all('property_visit_slots'))
    del(props)
    del(all('client_private'))
    del(clients)
    del(all('condominium_photos'))
    del(all('condominiums'))
    del(all('import_batches'))
    del(zzUsers)

    // zera a sequência de códigos: não há mais nenhum imóvel
    const orgRec = app.findRecordById('organizations', org.id)
    orgRec.set('property_code_seq', 0)
    app.save(orgRec)

    const after = counts()
    const short = {
      users: 'u',
      clients: 'c',
      client_private: 'cp',
      properties: 'p',
      property_photos: 'pf',
      property_visit_slots: 'ph',
      condominiums: 'co',
      condominium_photos: 'cf',
      import_batches: 'ib',
      leads: 'l',
      lead_events: 'le',
      visits: 'v',
      tasks: 't',
      negotiations: 'n',
      negotiation_people: 'np',
      negotiation_documents: 'nd',
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
    audit.set('action', 'limpeza_dados_teste_3')
    audit.set('collection_name', 'varias')
    audit.set('reason', ('0034 antes>depois: ' + parts.join('; ')).slice(0, 300))
    audit.set('occurred_at', new Date().toISOString())
    app.save(audit)
  },
  (app) => {
    // sem volta: a rede de segurança é o backup feito antes (fora do git)
  },
)
