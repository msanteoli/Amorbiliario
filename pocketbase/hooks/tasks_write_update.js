// Valida a tarefa na EDIÇÃO. Quem pode editar qual linha já é decidido pela updateRule; o
// vínculo, o criador, quem encerrou e a organização nunca mudam por aqui. Concluir ou cancelar
// grava quem e quando (sempre do servidor); reabrir limpa os dois. Só o admin, ou o SDR que
// criou a tarefa, muda o responsável.
onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const rec = e.record
  const orig = rec.original()
  const role = String(e.auth.get('role'))
  const orgId = String(e.auth.get('organization_id') || '')

  const title = String(rec.get('title') || '').trim()
  if (title.length < 2) throw new BadRequestError('Informe o título da tarefa.')
  rec.set('title', title)

  const assignee = rec.getString('assigned_to')
  if (assignee !== orig.getString('assigned_to')) {
    const mayReassign =
      role === 'admin' || (role === 'sdr' && orig.getString('created_by') === e.auth.id)
    if (!mayReassign)
      throw new ForbiddenError('Só o admin ou quem criou a tarefa muda o responsável.')
    let u = null
    try {
      u = $app.findRecordById('users', assignee)
    } catch (_) {}
    const roleOk = u && ['admin', 'sdr', 'corretor'].indexOf(String(u.get('role'))) >= 0
    if (!roleOk || u.get('active') !== true || u.get('organization_id') !== orgId) {
      throw new BadRequestError('Responsável inválido.')
    }
    if (role === 'sdr' && assignee !== e.auth.id && String(u.get('role')) !== 'corretor') {
      throw new ForbiddenError('O SDR cria tarefas para si e para corretores.')
    }
  }

  const status = rec.getString('status')
  if (status !== orig.getString('status')) {
    if (status === 'aberta') {
      rec.set('closed_by', '')
      rec.set('closed_at', '')
    } else {
      rec.set('closed_by', e.auth.id)
      rec.set('closed_at', new Date().toISOString())
    }
  }
  return e.next()
}, 'tasks')
