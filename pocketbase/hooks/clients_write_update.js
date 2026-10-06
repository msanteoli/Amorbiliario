// Normaliza e valida o cliente na EDIÇÃO. Mesma lógica de clients_write_create.js
// (duplicada de propósito), com duas diferenças: o responsável só é conferido
// quando muda, e a data do consentimento só é preenchida quando o status muda.
onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const rec = e.record
  const orig = rec.original()

  let phone = String(rec.get('phone') || '').replace(/\D/g, '')
  if (phone.length === 10 || phone.length === 11) phone = '55' + phone
  if (phone && (phone.length < 12 || phone.length > 13)) {
    throw new BadRequestError('Telefone inválido. Informe DDD e número.')
  }
  const email = String(rec.get('email') || '')
    .trim()
    .toLowerCase()
  if (!phone && !email) throw new BadRequestError('Informe ao menos telefone ou e-mail.')
  rec.set('phone', phone)
  rec.set('email', email)

  const rid = String(rec.get('responsible_id') || '')
  if (rid && rid !== String(orig.get('responsible_id') || '')) {
    let resp = null
    try {
      resp = $app.findRecordById('users', rid)
    } catch (_) {}
    const roleOk = resp && ['corretor', 'admin'].indexOf(String(resp.get('role'))) >= 0
    if (
      !roleOk ||
      resp.get('active') !== true ||
      resp.get('organization_id') !== rec.get('organization_id')
    ) {
      throw new BadRequestError('Responsável inválido.')
    }
  }

  let status = String(rec.get('consent_status') || '')
  if (!status) {
    status = 'unknown'
    rec.set('consent_status', status)
  }
  const before = orig.getString('consent_status') || 'unknown'
  if (status !== before && status !== 'unknown') {
    rec.set('consent_at', new Date().toISOString())
  }
  return e.next()
}, 'clients')
