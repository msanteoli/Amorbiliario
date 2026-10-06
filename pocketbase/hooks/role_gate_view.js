// Controle de papel na LEITURA INDIVIDUAL. Mesma lógica de role_gate_list.js
// (duplicada de propósito: o Skip não permite funções compartilhadas no topo).
onRecordViewRequest(
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
  'leads',
  'lead_events',
)
