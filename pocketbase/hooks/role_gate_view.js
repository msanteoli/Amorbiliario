// Controle de papel na LEITURA INDIVIDUAL. Mesma lógica de role_gate_list.js
// (duplicada de propósito: o Skip não permite funções compartilhadas no topo).
onRecordViewRequest(
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    if (!e.auth) throw new UnauthorizedError('Autenticação necessária.')

    const allowedByCollection = { audit_log: ['admin'] }
    const defaultAllowed = ['admin', 'sdr', 'corretor']
    const collectionName = e.collection.name
    const allowed = allowedByCollection[collectionName] || defaultAllowed
    const role = String(e.auth.get('role') || '')

    if (allowed.indexOf(role) < 0) {
      try {
        const col = $app.findCollectionByNameOrId('audit_log')
        const rec = new Record(col)
        rec.set('organization_id', e.auth.get('organization_id'))
        rec.set('actor_id', e.auth.id)
        rec.set('actor_role', role)
        rec.set('action', 'acesso_negado')
        rec.set('collection_name', collectionName)
        rec.set('reason', 'papel_sem_permissao')
        rec.set('occurred_at', new Date().toISOString())
        $app.save(rec)
      } catch (err) {
        $app.logger().error('role_gate_audit_failed', 'err', String((err && err.message) || err))
      }
      throw new ForbiddenError('Papel sem acesso a estes dados.')
    }
    return e.next()
  },
  'organizations',
  'users',
  'audit_log',
)
