// Mantém visits.slot_key, a chave que segura o horário de um imóvel (índice único parcial).
// Vale para qualquer visita e qualquer endpoint (criar, remarcar, cancelar, mudar situação),
// porque é um hook de modelo. A visita segura o horário quando tem início e: está Agendada ou
// Confirmada; ou está Pendente com corretor; ou está Pendente sem corretor, pedida há menos de
// 12 horas e sem liberação manual. Falhar aqui nunca impede a gravação da visita.
// (a lógica aparece duas vezes, uma em cada callback: o Skip não compartilha funções entre hooks)

onRecordAfterCreateSuccess((e) => {
  try {
    const rec = e.record
    const msOf = (k) => {
      const s = rec.getString(k)
      return s ? new Date(s.replace(' ', 'T')).getTime() : 0
    }
    const status = rec.getString('status')
    const startMs = msOf('start_at')
    let holding = false
    if (startMs) {
      if (status === 'agendada' || status === 'confirmada') holding = true
      else if (status === 'pendente_agenda') {
        const requestedMs = msOf('requested_at')
        const recent = requestedMs > 0 && Date.now() - requestedMs <= 12 * 3600000
        holding =
          rec.getString('broker_id') !== '' || (recent && rec.getString('slot_released_at') === '')
      }
    }
    const desired = holding
      ? rec.getString('property_id') + '|' + new Date(startMs).toISOString()
      : ''
    if (rec.getString('slot_key') !== desired) {
      // outra visita já segura esse horário: esta não o segura (e nunca regrava, para não entrar em laço)
      const clash = desired
        ? $app.findRecordsByFilter('visits', 'slot_key = {:k} && id != {:i}', '', 1, 0, {
            k: desired,
            i: rec.id,
          })
        : []
      if (clash.length) {
        if (rec.getString('slot_key') !== '') {
          rec.set('slot_key', '')
          $app.save(rec)
        }
      } else {
        rec.set('slot_key', desired)
        $app.save(rec)
      }
    }
  } catch (err) {
    $app.logger().error('visits_slot_key_failed', 'err', String((err && err.message) || err))
  }
  return e.next()
}, 'visits')

onRecordAfterUpdateSuccess((e) => {
  try {
    const rec = e.record
    const msOf = (k) => {
      const s = rec.getString(k)
      return s ? new Date(s.replace(' ', 'T')).getTime() : 0
    }
    const status = rec.getString('status')
    const startMs = msOf('start_at')
    let holding = false
    if (startMs) {
      if (status === 'agendada' || status === 'confirmada') holding = true
      else if (status === 'pendente_agenda') {
        const requestedMs = msOf('requested_at')
        const recent = requestedMs > 0 && Date.now() - requestedMs <= 12 * 3600000
        holding =
          rec.getString('broker_id') !== '' || (recent && rec.getString('slot_released_at') === '')
      }
    }
    const desired = holding
      ? rec.getString('property_id') + '|' + new Date(startMs).toISOString()
      : ''
    if (rec.getString('slot_key') !== desired) {
      // outra visita já segura esse horário: esta não o segura (e nunca regrava, para não entrar em laço)
      const clash = desired
        ? $app.findRecordsByFilter('visits', 'slot_key = {:k} && id != {:i}', '', 1, 0, {
            k: desired,
            i: rec.id,
          })
        : []
      if (clash.length) {
        if (rec.getString('slot_key') !== '') {
          rec.set('slot_key', '')
          $app.save(rec)
        }
      } else {
        rec.set('slot_key', desired)
        $app.save(rec)
      }
    }
  } catch (err) {
    $app.logger().error('visits_slot_key_failed', 'err', String((err && err.message) || err))
  }
  return e.next()
}, 'visits')
