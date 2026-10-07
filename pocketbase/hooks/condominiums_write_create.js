// Cria o condomínio: calcula name_key (sem acento, minúsculo, sem pontuação), recusa duplicado
// na organização e marca como ativo. O papel (admin ou corretor) já é conferido pela regra.
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const rec = e.record
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
  const k = key(name)
  if (k.length < 2) throw new BadRequestError('Informe o nome do condomínio.')
  const same = $app.findRecordsByFilter(
    'condominiums',
    'organization_id = {:o} && name_key = {:k}',
    '',
    1,
    0,
    { o: rec.getString('organization_id'), k: k },
  )
  if (same.length) throw new BadRequestError('Já existe um condomínio com este nome.')
  rec.set('name', name)
  rec.set('name_key', k)
  rec.set('is_active', true)
  rec.set('created_batch_id', '')
  return e.next()
}, 'condominiums')
