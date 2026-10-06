// Quantos itens abertos uma pessoa tem (leads não encerrados, visitas pendentes, agendadas ou
// confirmadas e tarefas abertas), para o admin reatribuir antes de desativar. Só o admin.
routerAdd(
  'GET',
  '/backend/v1/admin/users/{id}/open-items',
  (e) => {
    const actor = e.auth
    if (actor.get('active') !== true || String(actor.get('role') || '') !== 'admin') {
      throw new ForbiddenError('Só o admin acessa a Administração.')
    }
    const orgId = String(actor.get('organization_id') || '')
    const id = e.request.pathValue('id')
    let user = null
    try {
      user = $app.findRecordById('users', id)
    } catch (_) {}
    if (!user || user.get('organization_id') !== orgId)
      throw new NotFoundError('Usuário não encontrado.')

    const p = { o: orgId, u: id }
    const leads = $app.findRecordsByFilter(
      'leads',
      'organization_id = {:o} && assigned_to = {:u} && stage != "ganho" && stage != "perdido"',
      '',
      500,
      0,
      p,
    ).length
    const visits = $app.findRecordsByFilter(
      'visits',
      'organization_id = {:o} && broker_id = {:u} && (status = "pendente_agenda" || status = "agendada" || status = "confirmada")',
      '',
      500,
      0,
      p,
    ).length
    const tasks = $app.findRecordsByFilter(
      'tasks',
      'organization_id = {:o} && assigned_to = {:u} && status = "aberta"',
      '',
      500,
      0,
      p,
    ).length
    return e.json(200, { leads: leads, visits: visits, tasks: tasks })
  },
  $apis.requireAuth(),
)
