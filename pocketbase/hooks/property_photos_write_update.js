// Desativar ou reativar uma foto. Reativar respeita o limite de 20. Desativar até sobrarem
// menos de 5 fotos ativas devolve um imóvel Disponível a Rascunho (com histórico); reativar
// NÃO promove o imóvel de volta: quem decide é uma edição do imóvel.
onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const rec = e.record
  const orig = rec.original()
  const wasActive = orig.get('is_active') === true
  const willBeActive = rec.get('is_active') === true
  const pid = rec.getString('property_id')

  if (!wasActive && willBeActive) {
    const active = $app.findRecordsByFilter(
      'property_photos',
      'property_id = {:p} && is_active = true',
      '',
      100,
      0,
      { p: pid },
    ).length
    if (active >= 20) throw new BadRequestError('Limite de 20 fotos por imóvel.')
  }

  const res = e.next()

  if (wasActive && !willBeActive) {
    try {
      const property = $app.findRecordById('properties', pid)
      if (property.getString('status') === 'disponivel') {
        const left = $app.findRecordsByFilter(
          'property_photos',
          'property_id = {:p} && is_active = true',
          '',
          100,
          0,
          { p: pid },
        ).length
        if (left < 5) {
          property.set('status', 'rascunho')
          $app.save(property)
          const audit = new Record($app.findCollectionByNameOrId('audit_log'))
          audit.set('organization_id', property.get('organization_id'))
          audit.set('actor_id', e.auth.id)
          audit.set('actor_role', String(e.auth.get('role')))
          audit.set('action', 'imovel_alterado')
          audit.set('collection_name', 'properties')
          audit.set('record_id', property.id)
          audit.set('field_name', 'status')
          audit.set('reason', 'auto_rascunho_fotos')
          audit.set('occurred_at', new Date().toISOString())
          $app.save(audit)
        }
      }
    } catch (err) {
      $app
        .logger()
        .error('property_photos_revert_failed', 'err', String((err && err.message) || err))
    }
  }
  return res
}, 'property_photos')
