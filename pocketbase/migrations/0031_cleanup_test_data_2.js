// SEGUNDA LIMPEZA DOS DADOS DE TESTE (plano docs/superpowers/plans/2026-10-12-limpeza-dados-teste-2.md, T3).
// Só pode ser aplicada depois do backup da T1, da simulação da T4 e do "sim" explícito do dono (T5).
// Filtros: os do cabeçalho de scripts/relatorio-limpeza.sh, com duas decisões do controlador:
//   - usuários: só os que têm "ZZ TESTE" no NOME (os filtros por e-mail não são avaliáveis com segurança);
//   - tarefas: todas da organização (as travas provam que nenhuma está ligada a dado que fica).
// Travas primeiro, remoção depois. Qualquer trava lança erro e, como a migration roda em transação,
// NADA é apagado. Nunca toca: organizations, audit_log (decisão 2: histórico inteiro mantido),
// portal_feeds, google_connections, imóveis/condomínios/lotes reais e os usuários mantidos.
// Efeito conhecido: as 4 tarefas de lembrete 'Backup semanal' são apagadas (o cron semanal recria uma na segunda).
// Nenhum dado pessoal vai para mensagens de erro ou para o registro de auditoria: só contagens.
migrate(
  (app) => {
    const CUT = '2026-10-13 00:00:00.000Z'
    // Contatos de teste do portal (leads sem 'ZZ TESTE'). Rodar scripts/relatorio-limpeza.sh logo antes de
    // aplicar e ajustar esta constante se a contagem mudou por causa de testes.
    const EXPECTED_PORTAL_TEST_LEADS = 10
    let org = null
    try {
      org = app.findFirstRecordByData('organizations', 'slug', 'janeide-xavier')
    } catch (e) {
      org = null
    }
    if (!org) return // instalação nova: nada a limpar
    const o = { o: org.id }
    const all = (col, filter, params) =>
      app.findRecordsByFilter(col, filter, '', 500000, 0, params || {})
    const abort = (msg) => {
      throw new Error('Limpeza abortada (nada foi apagado): ' + msg)
    }
    const idSet = (rows) => {
      const s = {}
      rows.forEach((r) => {
        s[r.id] = true
      })
      return s
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

    // ------------------------------------------------------------------ conjuntos
    const zzProps = all(
      'properties',
      "organization_id = {:o} && (code ~ 'ZZ-TESTE' || title ~ 'ZZ TESTE')",
      o,
    )
    const keptProps = all(
      'properties',
      "organization_id = {:o} && code !~ 'ZZ-TESTE' && title !~ 'ZZ TESTE'",
      o,
    )
    const zzPropIds = idSet(zzProps)
    const keptPropIds = idSet(keptProps)
    const clients = all('clients', 'organization_id = {:o}', o)
    const leads = all('leads', 'organization_id = {:o}', o)
    const zzCondos = all('condominiums', "organization_id = {:o} && name ~ 'ZZ TESTE'", o)
    const zzCondoIds = idSet(zzCondos)
    const delBatches = all(
      'import_batches',
      "organization_id = {:o} && (filename ~ 'zz-teste' || filename = '')",
      o,
    )
    const delBatchIds = idSet(delBatches)
    const keptBatches = all(
      'import_batches',
      "organization_id = {:o} && filename !~ 'zz-teste' && filename != ''",
      o,
    )
    const users = all('users', 'organization_id = {:o}', o)
    const zzUsers = users.filter((u) => u.getString('name').indexOf('ZZ TESTE') >= 0)
    const zzUserIds = idSet(zzUsers)
    const tasks = all('tasks', 'organization_id = {:o}', o)
    const visits = all('visits', 'organization_id = {:o}', o)
    const negs = all('negotiations', 'organization_id = {:o}', o)

    // ------------------------------------------------------------------ travas
    // 1) imóvel que fica tem de ser importado; e não pode apontar para cliente, condomínio ou lote apagados
    keptProps.forEach((p) => {
      if (p.getString('source') !== 'importacao')
        abort('há imóvel que não é de teste nem importado.')
      if (p.getString('owner_id') !== '')
        abort('há imóvel mantido ligado a um proprietário (cliente) que seria apagado.')
      if (zzCondoIds[p.getString('condominium_id')])
        abort('há imóvel mantido ligado a condomínio de teste.')
      if (delBatchIds[p.getString('import_batch_id')])
        abort('há imóvel mantido ligado a lote de importação de teste.')
      if (zzUserIds[p.getString('captured_by')])
        abort('há imóvel mantido captado por usuário de teste.')
    })
    zzProps.forEach((p) => {
      if (p.getString('source') === 'importacao' && !delBatchIds[p.getString('import_batch_id')]) {
        abort('há imóvel de teste importado fora de um lote de teste.')
      }
    })
    all('condominiums', "organization_id = {:o} && name !~ 'ZZ TESTE'", o).forEach((c) => {
      if (delBatchIds[c.getString('created_batch_id')])
        abort('há condomínio mantido ligado a lote de importação de teste.')
    })
    if (keptBatches.length !== 3)
      abort('lotes reais mantidos diferentes de 3 (' + keptBatches.length + ').')
    keptBatches.forEach((b) => {
      const f = b.getString('filename')
      if (f === '' || f.indexOf('zz-teste') >= 0) abort('lote mantido com nome inválido.')
    })
    if (delBatches.length < 1) abort('nenhum lote de teste encontrado.')
    // 2) todos os clientes têm de ser de teste
    clients.forEach((c) => {
      if (c.getString('name').indexOf('ZZ TESTE') < 0) abort('há cliente que não é de teste.')
    })
    // 3) e 4) leads
    const isPortalTest = (l) =>
      l.getString('origin') === 'portal' &&
      l.getString('origin_detail').indexOf('Chaves na Mão') === 0 &&
      l.getString('created') < CUT
    let portalTests = 0
    leads.forEach((l) => {
      if (l.getString('name').indexOf('ZZ TESTE') < 0 && isPortalTest(l)) portalTests++
      if (l.getString('origin') === 'portal' && l.getString('created') >= CUT) {
        abort('há lead de portal criado a partir de 13/10 (o portal pode ter sido ativado).')
      }
      if (l.getString('name').indexOf('ZZ TESTE') < 0 && !isPortalTest(l)) {
        abort('há lead que não é de teste nem contato de teste do portal.')
      }
    })
    if (portalTests !== EXPECTED_PORTAL_TEST_LEADS) {
      abort(
        'contatos de teste do portal: ' +
          portalTests +
          ' (esperado ' +
          EXPECTED_PORTAL_TEST_LEADS +
          ').',
      )
    }
    // a partir daqui todos os leads e clientes da organização são de teste (serão todos apagados)
    // 5) usuários a apagar
    const secretEmails = {}
    ;[
      'IMOB_ADMIN_CREDENTIALS',
      'IMOB_TEST_SDR_CREDENTIALS',
      'IMOB_TEST_CORRETOR_CREDENTIALS',
      'IMOB_TEST_OUTRO_CREDENTIALS',
    ].forEach((k) => {
      let raw = ''
      try {
        raw = $secrets.has(k) ? $secrets.get(k) || '' : ''
      } catch (e) {
        raw = ''
      }
      const i = raw.indexOf(':')
      if (i > 0) secretEmails[raw.slice(0, i).trim().toLowerCase()] = true
    })
    if (Object.keys(secretEmails).length === 0)
      abort('nenhum dos 4 segredos de login pôde ser lido.')
    zzUsers.forEach((u) => {
      if (u.getString('role') === 'admin')
        abort('há usuário de teste com papel admin no grupo a apagar.')
      if (secretEmails[u.getString('email').trim().toLowerCase()])
        abort('um login usado pelos segredos está no grupo a apagar.')
    })
    keptBatches.forEach((b) => {
      if (zzUserIds[b.getString('created_by')])
        abort('há lote de importação real criado por usuário de teste.')
    })
    all('google_connections', 'organization_id = {:o}', o).forEach((g) => {
      if (zzUserIds[g.getString('user_id')])
        abort('há conexão Google de usuário de teste (seria mantida órfã).')
    })
    // 6) tarefas, visitas e negociações só podem estar ligadas ao que sai
    const linkedToKept = (r) => !!keptPropIds[r.getString('property_id')]
    tasks.forEach((t) => {
      if (linkedToKept(t)) abort('há tarefa ligada a imóvel que fica.')
    })
    visits.forEach((v) => {
      if (linkedToKept(v)) abort('há visita ligada a imóvel que fica.')
    })
    negs.forEach((n) => {
      if (linkedToKept(n)) abort('há negociação ligada a imóvel que fica.')
    })
    // forma esperada (desvios grandes abortam)
    if (zzUsers.length > 20) abort('usuários a apagar acima do esperado (' + zzUsers.length + ').')
    if (users.length - zzUsers.length < 1) abort('nenhum usuário seria mantido.')
    if (keptProps.length < 100)
      abort('imóveis mantidos abaixo do esperado (' + keptProps.length + ').')

    // ------------------------------------------------------------------ remoção (dependentes primeiro)
    const del = (rows) => {
      rows.forEach((r) => {
        app.delete(r)
      })
    }
    del(all('negotiation_documents', 'organization_id = {:o}', o))
    del(all('negotiation_people', 'organization_id = {:o}', o))
    del(negs)
    del(visits)
    del(tasks)
    del(all('lead_events', 'organization_id = {:o}', o))
    del(leads)
    del(
      all('property_photos', 'organization_id = {:o}', o).filter(
        (r) => zzPropIds[r.getString('property_id')],
      ),
    )
    del(
      all('property_visit_slots', 'organization_id = {:o}', o).filter(
        (r) => zzPropIds[r.getString('property_id')],
      ),
    )
    del(zzProps)
    del(all('client_private', 'organization_id = {:o}', o))
    del(clients)
    del(
      all('condominium_photos', 'organization_id = {:o}', o).filter(
        (r) => zzCondoIds[r.getString('condominium_id')],
      ),
    )
    del(zzCondos)
    del(delBatches)
    del(zzUsers)

    // ------------------------------------------------------------------ auditoria (só contagens)
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
    audit.set('action', 'limpeza_dados_teste')
    audit.set('collection_name', 'varias')
    audit.set('reason', ('0031 antes>depois: ' + parts.join('; ')).slice(0, 300))
    audit.set('occurred_at', new Date().toISOString())
    app.save(audit)
  },
  (app) => {
    // sem volta: a limpeza não é reversível; a rede de segurança é o backup feito na T1 (fora do git)
  },
)
