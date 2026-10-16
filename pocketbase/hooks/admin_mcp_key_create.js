// Cria uma chave MCP vinculada a um usuário ativo da organização (admin ou corretor; SDR não entra).
// A chave aparece SÓ nesta resposta; no banco fica o hash SHA-256. Auditoria 'mcp_chave_criada' (sem a chave).
routerAdd(
  'POST',
  '/backend/v1/admin/mcp/keys',
  (e) => {
    const actor = e.auth
    if (actor.get('active') !== true || String(actor.get('role') || '') !== 'admin') {
      throw new ForbiddenError('Só o admin acessa a Administração.')
    }
    const orgId = String(actor.get('organization_id') || '')
    const body = e.requestInfo().body || {}
    const name = String(body.name || '').trim()
    if (name.length < 2) throw new BadRequestError('Dê um nome para a chave.')
    const scope = String(body.scope || 'leitura')
    if (['leitura', 'leitura_escrita'].indexOf(scope) < 0)
      throw new BadRequestError('Escopo inválido.')
    const userId = String(body.user_id || '')
    let u = null
    try {
      u = $app.findRecordById('users', userId)
    } catch (_) {}
    if (
      !u ||
      u.get('active') !== true ||
      u.get('organization_id') !== orgId ||
      ['admin', 'corretor'].indexOf(String(u.get('role'))) < 0
    ) {
      throw new BadRequestError(
        'Usuário inválido para a chave (use um admin ou corretor ativo da organização).',
      )
    }
    const org = $app.findRecordById('organizations', orgId)
    if (org.get('mcp_enabled') !== true)
      throw new BadRequestError('Ligue o acesso MCP antes de criar chaves.')

    const token =
      'amb_' +
      $security.randomStringWithAlphabet(
        40,
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      )
    const col = $app.findCollectionByNameOrId('mcp_keys')
    const rec = new Record(col)
    rec.set('organization_id', orgId)
    rec.set('user_id', userId)
    rec.set('name', name)
    rec.set('token_prefix', token.slice(0, 8))
    rec.set('token_hash', $security.sha256(token))
    rec.set('scope', scope)
    rec.set('active', true)
    rec.set('created_by', actor.id)
    $app.save(rec)

    try {
      const audit = new Record($app.findCollectionByNameOrId('audit_log'))
      audit.set('organization_id', orgId)
      audit.set('actor_id', actor.id)
      audit.set('actor_role', 'admin')
      audit.set('action', 'mcp_chave_criada')
      audit.set('collection_name', 'mcp_keys')
      audit.set('record_id', rec.id)
      audit.set('reason', scope)
      audit.set('occurred_at', new Date().toISOString())
      $app.save(audit)
    } catch (err) {
      $app.logger().error('mcp_key_audit_failed', 'err', String((err && err.message) || err))
    }
    return e.json(200, { id: rec.id, token_prefix: token.slice(0, 8), token: token, scope: scope })
  },
  $apis.requireAuth(),
)
