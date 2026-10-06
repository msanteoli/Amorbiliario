// Valida CPF e data de nascimento na CRIAÇÃO de client_private e confere que o
// cliente é da mesma organização e, para o corretor, que ele é o responsável.
// Nunca registra o CPF em log.
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const rec = e.record

  const digits = String(rec.get('cpf') || '').replace(/\D/g, '')
  if (digits) {
    let ok = digits.length === 11 && !/^(\d)\1{10}$/.test(digits)
    if (ok) {
      let sum = 0
      for (let i = 0; i < 9; i++) sum += parseInt(digits[i], 10) * (10 - i)
      let r = (sum * 10) % 11
      if (r === 10) r = 0
      ok = r === parseInt(digits[9], 10)
    }
    if (ok) {
      let sum = 0
      for (let i = 0; i < 10; i++) sum += parseInt(digits[i], 10) * (11 - i)
      let r = (sum * 10) % 11
      if (r === 10) r = 0
      ok = r === parseInt(digits[10], 10)
    }
    if (!ok) throw new BadRequestError('CPF inválido.')
  }
  rec.set('cpf', digits)

  const bd = rec.getString('birth_date')
  if (bd && new Date(bd.replace(' ', 'T')).getTime() > Date.now()) {
    throw new BadRequestError('Data de nascimento inválida.')
  }

  let client = null
  try {
    client = $app.findRecordById('clients', String(rec.get('client_id') || ''))
  } catch (_) {}
  if (!client || client.get('organization_id') !== e.auth.get('organization_id')) {
    throw new BadRequestError('Cliente inválido.')
  }
  if (
    String(e.auth.get('role')) === 'corretor' &&
    String(client.get('responsible_id') || '') !== e.auth.id
  ) {
    throw new ForbiddenError('Somente o responsável ou o admin informa os dados pessoais.')
  }
  return e.next()
}, 'client_private')
