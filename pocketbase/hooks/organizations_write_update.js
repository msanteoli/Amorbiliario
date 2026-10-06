// Grava na auditoria quais campos da organização o admin mudou (só os nomes dos campos, nunca
// os valores). Quem pode editar e o que não pode mudar (identificador e fuso) já é decidido
// pela updateRule da coleção.
onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const rec = e.record
  const orig = rec.original()
  const watched = ['name', 'contact_phone', 'contact_email', 'address']
  const changed = watched.filter((f) => String(rec.get(f)) !== String(orig.get(f)))

  const res = e.next()
  try {
    const col = $app.findCollectionByNameOrId('audit_log')
    changed.forEach((f) => {
      const audit = new Record(col)
      audit.set('organization_id', rec.id)
      audit.set('actor_id', e.auth.id)
      audit.set('actor_role', String(e.auth.get('role')))
      audit.set('action', 'organizacao_alterada')
      audit.set('collection_name', 'organizations')
      audit.set('record_id', rec.id)
      audit.set('field_name', f)
      audit.set('occurred_at', new Date().toISOString())
      $app.save(audit)
    })
  } catch (err) {
    $app.logger().error('organization_audit_failed', 'err', String((err && err.message) || err))
  }
  return res
}, 'organizations')
