// Desativar ou reativar foto do condomínio. Reativar respeita o limite de 10 fotos ativas.
onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const rec = e.record
  const orig = rec.original()
  if (rec.get('is_active') === true && orig.get('is_active') !== true) {
    const active = $app.findRecordsByFilter(
      'condominium_photos',
      'condominium_id = {:c} && is_active = true && id != {:i}',
      '',
      50,
      0,
      { c: rec.getString('condominium_id'), i: rec.id },
    ).length
    if (active >= 10) throw new BadRequestError('Limite de 10 fotos por condomínio.')
  }
  return e.next()
}, 'condominium_photos')
