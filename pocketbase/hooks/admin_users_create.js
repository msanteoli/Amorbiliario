// Convida um usuário novo (só admin): cria a conta com uma senha aleatória que ninguém conhece e
// dispara o e-mail para a pessoa criar a própria senha. Se o e-mail falhar, a conta fica criada
// e a resposta traz email_sent = false (o admin reenvia pelo endpoint de convite).
routerAdd(
  'POST',
  '/backend/v1/admin/users',
  (e) => {
    const actor = e.auth
    if (actor.get('active') !== true || String(actor.get('role') || '') !== 'admin') {
      throw new ForbiddenError('Só o admin acessa a Administração.')
    }
    const orgId = String(actor.get('organization_id') || '')
    const body = e.requestInfo().body || {}

    const name = String(body.name || '').trim()
    if (name.length < 2) throw new BadRequestError('Informe o nome da pessoa.')
    const email = String(body.email || '')
      .trim()
      .toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new BadRequestError('Informe um e-mail válido.')
    const role = String(body.role || '')
    if (['admin', 'sdr', 'corretor'].indexOf(role) < 0) throw new BadRequestError('Papel inválido.')

    // convite: por padrão envia o e-mail; send_invite=false cria a conta sem enviar nada (a pessoa
    // só entra depois que o admin reenviar o convite)
    if (body.send_invite !== undefined && typeof body.send_invite !== 'boolean') {
      throw new BadRequestError('send_invite deve ser verdadeiro ou falso.')
    }
    const invite = body.send_invite !== false

    const same = $app.findRecordsByFilter('users', 'email = {:m}', '', 1, 0, { m: email })
    if (same.length) throw new BadRequestError('Já existe um usuário com este e-mail.')

    const user = new Record($app.findCollectionByNameOrId('users'))
    user.set('email', email)
    user.set('name', name)
    user.set('role', role)
    user.set('organization_id', orgId)
    user.set('active', true)
    user.setPassword($security.randomString(40))
    user.setVerified(true)
    $app.save(user)

    let sent = false
    if (invite) {
      try {
        $mails.sendRecordPasswordReset($app, user)
        sent = true
      } catch (err) {
        $app.logger().error('invite_email_failed', 'err', String((err && err.message) || err))
      }
    }

    try {
      const audit = new Record($app.findCollectionByNameOrId('audit_log'))
      audit.set('organization_id', orgId)
      audit.set('actor_id', actor.id)
      audit.set('actor_role', 'admin')
      audit.set('action', 'usuario_convidado')
      audit.set('collection_name', 'users')
      audit.set('record_id', user.id)
      audit.set('field_name', 'role')
      audit.set('reason', 'papel: ' + role + (invite ? '' : '; sem convite'))
      audit.set('occurred_at', new Date().toISOString())
      $app.save(audit)
    } catch (err) {
      $app.logger().error('invite_audit_failed', 'err', String((err && err.message) || err))
    }
    return e.json(200, { id: user.id, email_sent: sent, invited: invite })
  },
  $apis.requireAuth(),
)
