// Valida o ENVIO de foto: o imóvel precisa ser da mesma organização e, para o corretor,
// ele precisa ser o captador; no máximo 20 fotos ativas por imóvel (100 se o imóvel está em super-destaque, em qualquer situação). A foto nasce ativa.
// (Versão de 22/10: limite pelo nível.) O tipo e o tamanho do arquivo são validados pelo próprio campo (JPEG e WebP; até 3 MB, desde o M12).
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
    500,
    0,
    { p: property.id },
  ).length
  const superEff = property.getString('highlight_level') === 'super_destaque'
  if (superEff && active >= 100)
    throw new BadRequestError('Limite de 100 fotos por imóvel em super-destaque.')
  if (!superEff && active >= 20)
    throw new BadRequestError(
      'Limite de 20 fotos por imóvel. Só imóvel em super-destaque aceita mais.',
    )

  // a foto nova entra no fim da ordem
  const last = $app.findRecordsByFilter(
    'property_photos',
    'property_id = {:p} && is_active = true',
    '-position',
    1,
    0,
    { p: property.id },
  )
  rec.set('position', (last.length ? last[0].getInt('position') : 0) + 1)
  rec.set('is_active', true)
  rec.set('is_starred', false)
  rec.set('auto_archived', false)
  rec.set('archived_position', 0)
  return e.next()
}, 'property_photos')
