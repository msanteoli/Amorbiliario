// Ajustes do site, Fase 1 (spec docs/superpowers/specs/2026-10-19-ajustes-do-site-design.md). Só admin. Atenção (goja): nada de função no topo do arquivo.
// Site público (rota que o projeto 65584 já consome, formato de PublicSiteConfig): devolve o snapshot ATIVO (sem login). Com ?preview=TOKEN devolve o RASCUNHO; token inválido ou expirado: 401. Sem nenhuma publicação, devolve vazio (versao 0). As URLs de imagem saem RELATIVAS (/api/files/...): o site prefixa com o endereço do backend.
routerAdd('GET', '/backend/v1/public/site/config', (e) => {
  // limite de requisições por IP (visitantes anônimos; admin logado não é limitado)
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
  // rascunho -> objeto do site (mesma forma do snapshot publicado)
  const toSnap = (r) => {
    const o = {}
    ;[
      'about_title',
      'about_text',
      'address',
      'hours',
      'phone',
      'email',
      'instagram',
      'whatsapp',
      'primary_color',
    ].forEach((k) => {
      o[k] = r ? r.getString(k) : ''
    })
    let links = []
    if (r) {
      try {
        const raw = r.getString('links')
        links = raw ? JSON.parse(raw) : []
      } catch (_) {
        links = []
      }
    }
    o.links = Array.isArray(links) ? links : []
    const url = (assetId) => {
      if (!assetId) return ''
      try {
        const a = $app.findRecordById('site_assets', assetId)
        return '/api/files/site_assets/' + a.id + '/' + a.getString('file')
      } catch (_) {
        return ''
      }
    }
    o.logo_url = r ? url(r.getString('logo_asset_id')) : ''
    o.favicon_url = r ? url(r.getString('favicon_asset_id')) : ''
    return o
  }
  const loadDraft = () => {
    const rows = $app.findRecordsByFilter('site_settings', 'organization_id = {:o}', '', 1, 0, {
      o: orgId,
    })
    return rows.length ? rows[0] : null
  }
  // snapshot interno (nomes planos) -> formato que o site já consome (PublicSiteConfig)
  const toPublic = (s, versao) => ({
    logo_url: s.logo_url || null,
    favicon_url: s.favicon_url || null,
    cor_acao: s.primary_color || null,
    links: (Array.isArray(s.links) ? s.links : []).map((l) => ({ rotulo: l.label, url: l.url })),
    sobre: { titulo: s.about_title || '', texto: s.about_text || '' },
    contato: {
      endereco: s.address || '',
      horario: s.hours || '',
      telefone: s.phone || '',
      email: s.email || '',
    },
    redes: { instagram: s.instagram || '', whatsapp: s.whatsapp || '' },
    versao: versao,
  })
  const preview = String(e.request.url.query().get('preview') || '')
  if (preview !== '') {
    const rows = $app.findRecordsByFilter(
      'site_preview_tokens',
      'organization_id = {:o} && token_hash = {:h}',
      '',
      1,
      0,
      { o: orgId, h: $security.sha256(preview) },
    )
    const valido =
      rows.length &&
      new Date(rows[0].getString('expires_at').replace(' ', 'T')).getTime() > Date.now()
    if (!valido) throw new UnauthorizedError('Prévia inválida ou expirada.')
    e.response.header().set('Cache-Control', 'no-store')
    const draft = toPublic(toSnap(loadDraft()), 0)
    draft.previa = true
    return e.json(200, draft)
  }
  const ativas = $app.findRecordsByFilter(
    'site_publications',
    "organization_id = {:o} && status = 'ativa'",
    '',
    1,
    0,
    { o: orgId },
  )
  if (!ativas.length) {
    return e.json(200, toPublic(toSnap(null), 0))
  }
  let snap = {}
  try {
    snap = JSON.parse(ativas[0].getString('snapshot'))
  } catch (_) {
    snap = toSnap(null)
  }
  return e.json(200, toPublic(snap, ativas[0].getInt('version')))
})
