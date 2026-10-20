// Envio de foto do condomínio: no máximo 10 fotos ativas por condomínio, da mesma organização.
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const rec = e.record
  let condo = null
  try {
    condo = $app.findRecordById('condominiums', rec.getString('condominium_id'))
  } catch (_) {}
  if (!condo || condo.get('organization_id') !== rec.get('organization_id')) {
    throw new BadRequestError('Condomínio inválido.')
  }
  const active = $app.findRecordsByFilter(
    'condominium_photos',
    'condominium_id = {:c} && is_active = true',
    '',
    50,
    0,
    { c: condo.id },
  ).length
  if (active >= 10) throw new BadRequestError('Limite de 10 fotos por condomínio.')
  // a foto nova entra no fim da ordem
  const last = $app.findRecordsByFilter(
    'condominium_photos',
    'condominium_id = {:c} && is_active = true',
    '-position',
    1,
    0,
    { c: condo.id },
  )
  rec.set('position', (last.length ? last[0].getInt('position') : 0) + 1)
  rec.set('is_active', true)
  return e.next()
}, 'condominium_photos')
