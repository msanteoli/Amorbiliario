// Valida o ENVIO de foto: o imóvel precisa ser da mesma organização e, para o corretor,
// ele precisa ser o captador; no máximo 20 fotos ativas por imóvel. A foto nasce ativa.
// O tipo e o tamanho do arquivo são validados pelo próprio campo (JPEG e WebP; até 3 MB, desde o M12).
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const rec = e.record

  let property = null
  try {
    property = $app.findRecordById('properties', rec.getString('property_id'))
  } catch (_) {}
  if (!property || property.get('organization_id') !== e.auth.get('organization_id')) {
    throw new BadRequestError('Imóvel inválido.')
  }
  if (
    String(e.auth.get('role')) === 'corretor' &&
    property.getString('captured_by') !== e.auth.id
  ) {
    throw new ForbiddenError('Só quem captou o imóvel ou o admin envia fotos.')
  }

  const active = $app.findRecordsByFilter(
    'property_photos',
    'property_id = {:p} && is_active = true',
    '',
    100,
    0,
    { p: property.id },
  ).length
  if (active >= 20) throw new BadRequestError('Limite de 20 fotos por imóvel.')

  rec.set('is_active', true)
  return e.next()
}, 'property_photos')
