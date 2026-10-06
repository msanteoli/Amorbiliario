// Reenvia o e-mail para a pessoa criar a senha (só admin), para um usuário ativo da organização.
routerAdd(
  'POST',
  '/backend/v1/admin/users/{id}/invite',
  (e) => {
    const actor = e.auth
    if (actor.get('active') !== true || String(actor.get('role') || '') !== 'admin') {
      throw new ForbiddenError('Só o admin acessa a Administração.')
    }
    const orgId = String(actor.get('organization_id') || '')
    let user = null
    try {
      user = $app.findRecordById('users', e.request.pathValue('id'))
    } catch (_) {}
    if (!user || user.get('organization_id') !== orgId)
      throw new NotFoundError('Usuário não encontrado.')
    if (user.get('active') !== true) throw new BadRequestError('Este usuário está inativo.')

    let sent = false
    try {
      $mails.sendRecordPasswordReset($app, user)
      sent = true
    } catch (err) {
      $app.logger().error('invite_email_failed', 'err', String((err && err.message) || err))
    }
    try {
      const audit = new Record($app.findCollectionByNameOrId('audit_log'))
      audit.set('organization_id', orgId)
      audit.set('actor_id', actor.id)
      audit.set('actor_role', 'admin')
      audit.set('action', 'usuario_convite_reenviado')
      audit.set('collection_name', 'users')
      audit.set('record_id', user.id)
      audit.set('occurred_at', new Date().toISOString())
      $app.save(audit)
    } catch (err) {
      $app.logger().error('invite_audit_failed', 'err', String((err && err.message) || err))
    }
    return e.json(200, { email_sent: sent })
  },
  $apis.requireAuth(),
)
