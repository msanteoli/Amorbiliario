// Leva a visita pedida pelo site ao novo dono do lead e a agenda com ele. Vale para qualquer
// caminho de reatribuição (edição pelo SDR ou admin, resolução de pendência), porque é um hook de
// modelo. Visita Confirmada não é mexida. Falhar aqui nunca impede a gravação do lead.
onRecordAfterUpdateSuccess((e) => {
  try {
    const lead = e.record
    const prev = String(lead.original().getString('assigned_to') || '')
    const now = String(lead.getString('assigned_to') || '')
    if (prev !== now) {
      const orgId = lead.getString('organization_id')
      const msOf = (rec, k) => {
        const s = rec.getString(k)
        return s ? new Date(s.replace(' ', 'T')).getTime() : 0
      }
      const fmt = (ms) => new Date(ms).toISOString().replace('T', ' ')
      const nowIso = new Date().toISOString()
      const evCol = $app.findCollectionByNameOrId('lead_events')
      const addEvent = (type, text) => {
        const ev = new Record(evCol)
        ev.set('organization_id', orgId)
        ev.set('lead_id', lead.id)
        ev.set('type', type)
        ev.set('occurred_at', nowIso)
        ev.set('text', text)
        $app.save(ev)
      }

      const rows = $app.findRecordsByFilter(
        'visits',
        "lead_id = {:l} && source = 'site' && (status = 'pendente_agenda' || status = 'agendada')",
        '',
        50,
        0,
        { l: lead.id },
      )
      let scheduled = false
      rows.forEach((v) => {
        const startMs = msOf(v, 'start_at')
        const endMs = msOf(v, 'end_at')
        v.set('broker_id', now)
        let text = ''
        if (!now) {
          v.set('status', 'pendente_agenda')
          text = 'Visita ficou sem corretor.'
        } else if (startMs && endMs) {
          const buffer = 30 * 60000
          const clash = $app.findRecordsByFilter(
            'visits',
            'organization_id = {:o} && broker_id = {:b} && id != {:i} && (status = "agendada" || status = "confirmada") && start_at < {:e} && end_at > {:s}',
            'start_at',
            1,
            0,
            { o: orgId, b: now, i: v.id, e: fmt(endMs + buffer), s: fmt(startMs - buffer) },
          )
          if (clash.length) {
            v.set('status', 'pendente_agenda')
            text =
              'Visita ficou pendente: o corretor já tem visita nesse horário ou a menos de 30 minutos dele. O SDR precisa reagendar.'
          } else {
            v.set('status', 'agendada')
            scheduled = true
            text = 'Visita agendada com o corretor do lead.'
          }
        }
        $app.save(v)
        if (text) addEvent('visita', text)
      })

      // spec 1.6: agendar visita com corretor leva o lead de Novo ou Em atendimento a "Visita marcada"
      if (scheduled && ['novo', 'em_atendimento'].indexOf(lead.getString('stage')) >= 0) {
        const from = lead.getString('stage')
        lead.set('stage', 'visita_marcada')
        $app.save(lead)
        addEvent('estagio', from + ' → visita_marcada (visita agendada)')
      }
    }
  } catch (err) {
    $app.logger().error('visits_follow_lead_failed', 'err', String((err && err.message) || err))
  }
  return e.next()
}, 'leads')
