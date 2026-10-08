// Toda segunda-feira, 11h UTC (8h em Salvador), cria a tarefa "Backup semanal" para o SDR de cada
// organização, se ainda não houver uma aberta. A lógica espelha backup_remind.js (os arquivos do Skip
// não compartilham funções).
cronAdd('backup_weekly_reminder', '0 11 * * 1', () => {
  const title = 'Backup semanal: exportar os dados'
  const orgs = $app.findRecordsByFilter('organizations', "id != ''", 'created', 200, 0)
  orgs.forEach((org) => {
    const open = $app.findRecordsByFilter(
      'tasks',
      "organization_id = {:o} && title = {:t} && status = 'aberta'",
      '-created',
      1,
      0,
      { o: org.id, t: title },
    )
    if (open.length) return
    let assignee = null
    const sdrs = $app.findRecordsByFilter(
      'users',
      "organization_id = {:o} && role = 'sdr' && active = true",
      'created',
      1,
      0,
      { o: org.id },
    )
    if (sdrs.length) assignee = sdrs[0]
    else {
      const admins = $app.findRecordsByFilter(
        'users',
        "organization_id = {:o} && role = 'admin' && active = true",
        'created',
        1,
        0,
        { o: org.id },
      )
      if (admins.length) assignee = admins[0]
    }
    if (!assignee) return
    const task = new Record($app.findCollectionByNameOrId('tasks'))
    task.set('organization_id', org.id)
    task.set('title', title)
    task.set('description', 'Abra Backup no menu e baixe o arquivo. Guarde fora do sistema.')
    task.set('assigned_to', assignee.id)
    task.set('status', 'aberta')
    task.set('created_by', assignee.id)
    task.set('due_at', new Date(Date.now() + 24 * 3600 * 1000).toISOString())
    $app.save(task)
  })
})
