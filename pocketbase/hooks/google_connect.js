// M11 — Conexão com o Google: devolve o endereço de autorização (só o escopo de eventos da agenda).
// Só corretor e admin ativos. Sem os segredos IMOB_GOOGLE_* configurados, responde 503 (nada é montado).
// state = base64(JSON{u,n,e}) + '.' + hs256(base64, IMOB_GOOGLE_TOKEN_KEY); validade de 10 minutos.
routerAdd(
  'GET',
  '/backend/v1/google/connect',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'corretor'].indexOf(role) < 0) {
      throw new ForbiddenError('Só o corretor e o admin conectam a agenda do Google.')
    }
    const clientId = String($secrets.get('IMOB_GOOGLE_CLIENT_ID') || '')
    const clientSecret = String($secrets.get('IMOB_GOOGLE_CLIENT_SECRET') || '')
    const key = String($secrets.get('IMOB_GOOGLE_TOKEN_KEY') || '')
    const appUrl = String($secrets.get('IMOB_APP_URL') || '')
    if (!clientId || !clientSecret || key.length !== 32 || !appUrl) {
      return e.json(503, { message: 'Integração com o Google ainda não configurada.' })
    }
    let base = appUrl
    while (base.endsWith('/')) base = base.slice(0, -1)
    const redirectUri = base + '/google/retorno' // tela do sistema que chama POST /google/finish
    const payload = btoa(
      JSON.stringify({
        u: actor.id,
        n: $security.randomString(16),
        e: Date.now() + 10 * 60 * 1000,
      }),
    )
    const state = payload + '.' + $security.hs256(payload, key)
    const url =
      'https://accounts.google.com/o/oauth2/v2/auth?client_id=' +
      encodeURIComponent(clientId) +
      '&redirect_uri=' +
      encodeURIComponent(redirectUri) +
      '&response_type=code&scope=' +
      encodeURIComponent('https://www.googleapis.com/auth/calendar.events') +
      '&access_type=offline&prompt=consent&include_granted_scopes=false&state=' +
      encodeURIComponent(state)
    return e.json(200, { url: url })
  },
  $apis.requireAuth(),
)
