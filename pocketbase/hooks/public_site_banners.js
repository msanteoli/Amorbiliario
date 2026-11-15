// Site tecnológico, Parte A (spec docs/superpowers/specs/2026-11-15-site-tecnologico-design.md). Atenção (goja): nada de função no topo do arquivo.
// Site público (rota que o projeto 65584 já consome, formato PublicBannerItem): os banners da publicação ATIVA, sem login.
// A janela de datas vale na hora da leitura (banner vencido ou ainda não iniciado fica fora, sem republicar).
// URLs de imagem saem RELATIVAS (/api/files/...): o site prefixa com o endereço do backend. Campo vazio sai null.
routerAdd('GET', '/backend/v1/public/site/banners', (e) => {
  // limite de requisições por IP (o mesmo contador de public/site/config; admin logado não é limitado)
  const isAdmin =
    !!e.auth && e.auth.get('active') === true && String(e.auth.get('role') || '') === 'admin'
  if (!isAdmin) {
    const ip = e.realIP()
    const win = Math.floor(Date.now() / 60000)
    const key = 'thr:site:' + ip + ':' + win
    const n = Number($app.store().get(key) || 0) + 1
    $app.store().set(key, n)
    $app.store().remove('thr:site:' + ip + ':' + (win - 1))
    if (n > 120)
      throw new TooManyRequestsError('Muitas tentativas. Aguarde um minuto e tente de novo.')
  }
  // a imobiliária: pelo slug (?org=) ou, se houver só uma, essa
  const slug = String(e.request.url.query().get('org') || '')
  const orgs = slug
    ? $app.findRecordsByFilter('organizations', 'slug = {:s}', '', 1, 0, { s: slug })
    : $app.findRecordsByFilter('organizations', "id != ''", 'created', 2, 0)
  if (!orgs.length) throw new NotFoundError('Imobiliária não encontrada.')
  if (!slug && orgs.length > 1) throw new BadRequestError('Informe a imobiliária.')
  const orgId = orgs[0].id
  const ativas = $app.findRecordsByFilter(
    'site_publications',
    "organization_id = {:o} && status = 'ativa'",
    '',
    1,
    0,
    {
      o: orgId,
    },
  )
  let banners = []
  if (ativas.length) {
    try {
      const snap = JSON.parse(ativas[0].getString('snapshot'))
      banners = Array.isArray(snap.banners) ? snap.banners : []
    } catch (_) {
      banners = []
    }
  }
  const now = Date.now()
  const ms = (v) => (v ? new Date(String(v).replace(' ', 'T')).getTime() : NaN)
  const orNull = (v) => (v === undefined || v === null || String(v) === '' ? null : String(v))
  const items = banners
    .filter((b) => {
      const s = ms(b.start_at)
      const f = ms(b.end_at)
      if (!isNaN(s) && s > now) return false
      if (!isNaN(f) && f < now) return false
      return !!b.desktop_url
    })
    .slice(0, 5)
    .map((b) => ({
      id: String(b.id || ''),
      titulo: orNull(b.title),
      subtitulo: orNull(b.subtitle),
      texto_botao: orNull(b.button_text),
      imagem_desktop_url: String(b.desktop_url),
      imagem_celular_url: orNull(b.mobile_url),
      imagem_noite_desktop_url: orNull(b.night_desktop_url),
      imagem_noite_celular_url: orNull(b.night_mobile_url),
      link_url: null,
      destino_url: orNull(b.destino_url),
      tipo: orNull(b.tipo),
      imovel_codigo: orNull(b.imovel_codigo),
    }))
  e.response.header().set('Cache-Control', 'public, max-age=60')
  return e.json(200, items)
})
