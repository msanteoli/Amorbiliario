// Controle de papel na LISTAGEM. A regra da coleção filtra linhas (lista vazia
// quando não bate); este hook garante 401 sem login e 403 para papel sem acesso
// ou conta inativa, e registra a negação no audit_log SEM o valor negado.
// Ao criar uma coleção nova, acrescente-a aos argumentos finais e ao mapa abaixo
// (e faça o mesmo em role_gate_view.js).
onRecordsListRequest(
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    if (!e.auth) throw new UnauthorizedError('Autenticação necessária.')

    const allowedByCollection = { audit_log: ['admin'], client_private: ['admin', 'corretor'] }
    const defaultAllowed = ['admin', 'sdr', 'corretor']
    const collectionName = e.collection.name
    const allowed = allowedByCollection[collectionName] || defaultAllowed
    const role = String(e.auth.get('role') || '')

    const isActive = e.auth.get('active') === true

    if (!isActive || allowed.indexOf(role) < 0) {
      try {
        const col = $app.findCollectionByNameOrId('audit_log')
        const rec = new Record(col)
        rec.set('organization_id', e.auth.get('organization_id'))
        rec.set('actor_id', e.auth.id)
        rec.set('actor_role', role)
        rec.set('action', 'acesso_negado')
        rec.set('collection_name', collectionName)
        rec.set('reason', isActive ? 'papel_sem_permissao' : 'conta_inativa')
        rec.set('occurred_at', new Date().toISOString())
        $app.save(rec)
      } catch (err) {
        $app.logger().error('role_gate_audit_failed', 'err', String((err && err.message) || err))
      }
      throw new ForbiddenError(
        isActive ? 'Papel sem acesso a estes dados.' : 'Conta inativa. Fale com o administrador.',
      )
    }
    return e.next()
  },
  'organizations',
  'users',
  'audit_log',
  'clients',
  'client_private',
  'properties',
  'property_photos',
)
