// Linha do tempo pela API: só notas e contatos. Os eventos de sistema (etapa, atribuição,
// conversão, ficha enviada, origem corrigida, duplicidade) são gravados pelos hooks e pelos
// endpoints. O autor e o horário são sempre os do servidor. Um contato preenche o primeiro e
// o último contato do lead.
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const rec = e.record
  const role = String(e.auth.get('role'))

  const type = rec.getString('type')
  if (['nota', 'contato'].indexOf(type) < 0) {
    throw new BadRequestError('Só notas e contatos podem ser registrados aqui.')
  }

  let lead = null
  try {
    lead = $app.findRecordById('leads', rec.getString('lead_id'))
  } catch (_) {}
  if (!lead || lead.get('organization_id') !== e.auth.get('organization_id')) {
    throw new BadRequestError('Lead inválido.')
  }
  if (role === 'corretor' && lead.getString('assigned_to') !== e.auth.id) {
    throw new ForbiddenError('Lead de outro corretor.')
  }

  const text = String(rec.get('text') || '').trim()
  if (!text) throw new BadRequestError('Escreva o texto do registro.')
  rec.set('text', text)
  rec.set('author_id', e.auth.id)
  rec.set('occurred_at', new Date().toISOString())
  rec.set('intent_key', '')

  const res = e.next()
  if (type === 'contato') {
    try {
      const now = new Date().toISOString()
      if (!lead.getString('first_contact_at')) lead.set('first_contact_at', now)
      lead.set('last_contact_at', now)
      $app.save(lead)
    } catch (err) {
      $app.logger().error('lead_contact_failed', 'err', String((err && err.message) || err))
    }
  }
  return res
}, 'lead_events')
