// Valida CPF e data de nascimento na EDIÇÃO de client_private. Mesma validação de
// client_private_write_create.js (duplicada de propósito). Quem pode editar já é
// decidido pela regra de updateRule da coleção. Nunca registra o CPF em log.
onRecordUpdateRequest((e) => {
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
  return e.next()
}, 'client_private')
