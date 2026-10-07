// Edita o condomínio: se o nome mudou, recalcula name_key e recusa colisão.
// O lote de origem não muda por esta via (a regra já impede; aqui restauramos por segurança).
onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const rec = e.record
  const orig = rec.original()
  const key = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/[áàâãä]/g, 'a')
      .replace(/[éèêë]/g, 'e')
      .replace(/[íìîï]/g, 'i')
      .replace(/[óòôõö]/g, 'o')
      .replace(/[úùûü]/g, 'u')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  const name = String(rec.get('name') || '').trim()
  if (name !== orig.getString('name')) {
    const k = key(name)
    if (k.length < 2) throw new BadRequestError('Informe o nome do condomínio.')
    const same = $app.findRecordsByFilter(
      'condominiums',
      'organization_id = {:o} && name_key = {:k} && id != {:i}',
      '',
      1,
      0,
      { o: rec.getString('organization_id'), k: k, i: rec.id },
    )
    if (same.length) throw new BadRequestError('Já existe um condomínio com este nome.')
    rec.set('name', name)
    rec.set('name_key', k)
  }
  rec.set('created_batch_id', orig.getString('created_batch_id'))
  return e.next()
}, 'condominiums')
