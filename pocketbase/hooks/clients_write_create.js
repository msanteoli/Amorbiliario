// Normaliza e valida o cliente na CRIAÇÃO: telefone só dígitos com prefixo 55,
// e-mail em minúsculas, ao menos um contato, responsável válido e data do
// consentimento. A lógica é duplicada em clients_write_update.js de propósito
// (o Skip não permite funções compartilhadas no topo do arquivo).
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const rec = e.record

  const kinds = rec.getStringSlice('kind')
  if (kinds.indexOf('proprietario') >= 0)
    throw new BadRequestError(
      'Proprietário só nasce ligado a um imóvel. Cadastre o imóvel e vincule o proprietário nele.',
    )

  // tira também os zeros à esquerda (prefixo de DDD, ex.: 011 98765-4321)
  let phone = String(rec.get('phone') || '')
    .replace(/\D/g, '')
    .replace(/^0+/, '')
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

  // responsável: usuário ativo da mesma organização, com papel corretor ou admin
  const rid = String(rec.get('responsible_id') || '')
  if (rid) {
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
  // a data do consentimento é sempre do servidor: o valor enviado é ignorado
  rec.set('consent_at', status !== 'unknown' ? new Date().toISOString() : '')
  return e.next()
}, 'clients')
