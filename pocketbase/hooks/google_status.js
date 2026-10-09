// M11 — Situação da conexão do próprio usuário com o Google. Nunca devolve token.
routerAdd(
  'GET',
  '/backend/v1/google/status',
  (e) => {
    let conn = null
    try {
      conn = $app.findFirstRecordByFilter('google_connections', 'user_id = {:u}', { u: e.auth.id })
    } catch (_) {}
    if (!conn) return e.json(200, { status: 'nao_conectado', google_email: '' })
    return e.json(200, {
      status: conn.getString('status') || 'reconectar',
      google_email: conn.getString('google_email'),
    })
  },
  $apis.requireAuth(),
)
