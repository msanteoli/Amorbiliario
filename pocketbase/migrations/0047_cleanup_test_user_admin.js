// SEXTA LIMPEZA DE DADOS DE TESTE (26/10): remove o usuário de teste "Teste Admin" (admin INATIVO), criado pelos testes de usuários.
// Decisão do dono, em chat ("Opção 1"): apagar só os usuários de teste que as suítes não usam. "Teste Sem Acesso" (papel "outro")
// FICA: ele é o controle negativo de ~13 suítes. "Teste SDR" e "Teste Corretor com Acesso" ficam pelo mesmo motivo.
// Trava: só apaga o usuário de id EXATO, se o nome for "Teste Admin", o papel admin e a conta estiver inativa; se alguma coisa
// apontar para ele (lead, imóvel, visita, tarefa, negociação, bloqueio de agenda) ou se não restar outro admin ativo, a migration
// inteira aborta e nada é apagado. Se o usuário não existir (instalação nova ou produção), não faz nada.
// Só grava a contagem no audit_log (nenhum dado pessoal).
migrate(
  (app) => {
    const ID = 'thmghwbddvgqn1t'
    let user = null
    try {
      user = app.findRecordById('users', ID)
    } catch (e) {
      user = null
    }
    if (!user) return
    const abort = (msg) => {
      throw new Error('Limpeza abortada (nada foi apagado): ' + msg)
    }
    if (user.getString('name') !== 'Teste Admin') abort('não é o usuário de teste esperado')
    if (user.getString('role') !== 'admin') abort('o papel não é admin')
    if (user.get('active') === true) abort('a conta está ativa')
    const orgId = user.getString('organization_id')
    const outros = app.findRecordsByFilter(
      'users',
      "organization_id = {:o} && role = 'admin' && active = true && id != {:u}",
      '',
      1,
      0,
      { o: orgId, u: user.id },
    )
    if (!outros.length) abort('não restaria outro admin ativo')
    const dep = (col, filter) =>
      app.findRecordsByFilter(col, filter, '', 1, 0, { u: user.id }).length
    if (dep('leads', 'assigned_to = {:u}') > 0) abort('há leads atribuídos')
    if (dep('properties', 'captured_by = {:u}') > 0) abort('há imóveis captados')
    if (dep('visits', 'broker_id = {:u}') > 0) abort('há visitas')
    if (dep('tasks', 'assigned_to = {:u}') > 0) abort('há tarefas')
    if (dep('negotiations', 'responsible_id = {:u}') > 0) abort('há negociações')
    if (dep('agenda_blocks', 'user_id = {:u}') > 0) abort('há bloqueios de agenda')

    app.delete(user)

    const audit = new Record(app.findCollectionByNameOrId('audit_log'))
    audit.set('organization_id', orgId)
    audit.set('action', 'limpeza_dados_teste_6')
    audit.set('collection_name', 'users')
    audit.set('reason', '0047 usuarios=1')
    audit.set('occurred_at', new Date().toISOString())
    app.save(audit)
  },
  (app) => {
    // sem volta: era uma conta de teste inativa
  },
)
