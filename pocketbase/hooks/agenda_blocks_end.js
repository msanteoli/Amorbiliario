// M14 — Encerra um bloqueio de agenda: preenche ended_at, sem apagar. Só o dono do bloqueio
// (corretor) ou o admin da organização. Gera auditoria.
routerAdd(
  'POST',
  '/backend/v1/agenda-blocks/{id}/end',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || (role !== 'admin' && role !== 'corretor')) {
      throw new ForbiddenError('Sem permissão para encerrar bloqueio.')
    }
    const orgId = String(actor.get('organization_id') || '')

    let rec = null
    try {
      rec = $app.findRecordById('agenda_blocks', e.request.pathValue('id'))
    } catch (_) {}
    if (!rec || rec.get('organization_id') !== orgId)
      throw new NotFoundError('Bloqueio não encontrado.')
    if (role === 'corretor' && rec.get('user_id') !== actor.id) {
      throw new ForbiddenError('Só o dono do bloqueio pode encerrá-lo.')
    }
    if (String(rec.get('ended_at') || '') !== '')
      throw new BadRequestError('Este bloqueio já foi encerrado.')

    const now = new Date().toISOString()
    rec.set('ended_at', now)
    $app.save(rec)

    const audit = new Record($app.findCollectionByNameOrId('audit_log'))
    audit.set('organization_id', orgId)
    audit.set('actor_id', actor.id)
    audit.set('actor_role', role)
    audit.set('action', 'bloqueio_agenda_encerrado')
    audit.set('collection_name', 'agenda_blocks')
    audit.set('record_id', rec.id)
    audit.set('occurred_at', now)
    $app.save(audit)

    return e.json(200, { id: rec.id, ended_at: now })
  },
  $apis.requireAuth(),
)
