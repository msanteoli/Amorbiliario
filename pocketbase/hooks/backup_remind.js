// Cria (uma vez) a tarefa "Backup semanal: exportar os dados" para o primeiro SDR ativo da organização
// (ou para quem chamou, se não houver SDR). Só o admin. Não duplica: se já existe uma aberta, devolve
// a mesma. O mesmo comportamento roda toda segunda-feira em backup_weekly_cron.js.
routerAdd(
  'POST',
  '/backend/v1/backup/remind',
  (e) => {
    const actor = e.auth
    if (actor.get('active') !== true || String(actor.get('role') || '') !== 'admin') {
      throw new ForbiddenError('Só o admin cria o lembrete de backup.')
    }
    const orgId = String(actor.get('organization_id') || '')
    const title = 'Backup semanal: exportar os dados'

    const open = $app.findRecordsByFilter(
      'tasks',
      "organization_id = {:o} && title = {:t} && status = 'aberta'",
      '-created',
      1,
      0,
      { o: orgId, t: title },
    )
    if (open.length) return e.json(200, { created: false, task_id: open[0].id })

    const sdrs = $app.findRecordsByFilter(
      'users',
      "organization_id = {:o} && role = 'sdr' && active = true",
      'created',
      1,
      0,
      { o: orgId },
    )
    const assignee = sdrs.length ? sdrs[0].id : actor.id

    const task = new Record($app.findCollectionByNameOrId('tasks'))
    task.set('organization_id', orgId)
    task.set('title', title)
    task.set('description', 'Abra Backup no menu e baixe o arquivo. Guarde fora do sistema.')
    task.set('assigned_to', assignee)
    task.set('status', 'aberta')
    task.set('created_by', actor.id)
    task.set('due_at', new Date(Date.now() + 24 * 3600 * 1000).toISOString())
    $app.save(task)
    return e.json(200, { created: true, task_id: task.id })
  },
  $apis.requireAuth(),
)
