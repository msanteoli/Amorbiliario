// Painel personalizável (spec 2026-10-23): devolve o arranjo dos quadros da pessoa logada, ou { layout: null } (vale o padrão da tela).
routerAdd(
  'GET',
  '/backend/v1/panel/layout',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'sdr', 'corretor'].indexOf(role) < 0) {
      throw new ForbiddenError('Papel sem acesso a estes dados.')
    }
    let rec = null
    try {
      rec = $app.findFirstRecordByData('panel_layouts', 'user_id', actor.id)
    } catch (_) {}
    let layout = null
    if (rec && rec.getString('layout')) {
      try {
        layout = JSON.parse(rec.getString('layout'))
      } catch (_) {
        layout = null
      }
    }
    return e.json(200, { layout: layout })
  },
  $apis.requireAuth(),
)
