// Ajustes do site, Fase 1 (spec docs/superpowers/specs/2026-10-19-ajustes-do-site-design.md). Só admin. Atenção (goja): nada de função no topo do arquivo.
// Grava o RASCUNHO (só os campos enviados mudam). Não altera o site público até Publicar.
routerAdd(
  'PUT',
  '/backend/v1/admin/site/settings',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    const orgId = String(actor.get('organization_id') || '')
    if (actor.get('active') !== true || role !== 'admin') {
      try {
        const a = new Record($app.findCollectionByNameOrId('audit_log'))
        a.set('organization_id', orgId)
        a.set('actor_id', actor.id)
        a.set('actor_role', role)
        a.set('action', 'acesso_negado')
        a.set('collection_name', 'site_settings')
        a.set('record_id', orgId)
        a.set('reason', 'so_admin_ajusta_o_site')
        a.set('occurred_at', new Date().toISOString())
        $app.save(a)
      } catch (err) {
        $app.logger().error('site_audit_failed', 'err', String((err && err.message) || err))
      }
      throw new ForbiddenError('Só o admin ajusta o site.')
    }
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
    const body = e.requestInfo().body || {}
    const has = (k) => Object.prototype.hasOwnProperty.call(body, k)
    const str = (k) => String(body[k] === null || body[k] === undefined ? '' : body[k]).trim()
    const limit = (k, max) => {
      const v = str(k)
      if (v.length > max)
        throw new BadRequestError('O campo "' + k + '" passa de ' + max + ' caracteres.')
      return v
    }
    const httpsUrl = (k, v) => {
      if (v !== '' && !/^https:\/\/\S+$/.test(v))
        throw new BadRequestError('O campo "' + k + '" precisa ser um link que comece com https://')
      return v
    }
    const out = {}
    if (has('about_title')) out.about_title = limit('about_title', 160)
    if (has('about_text')) out.about_text = limit('about_text', 2000)
    if (has('address')) out.address = limit('address', 200)
    if (has('hours')) out.hours = limit('hours', 200)
    if (has('phone')) {
      const v = limit('phone', 30)
      if (v !== '' && !/^[0-9+()\-\s]+$/.test(v)) throw new BadRequestError('Telefone inválido.')
      out.phone = v
    }
    if (has('email')) {
      const v = limit('email', 120)
      if (v !== '' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v))
        throw new BadRequestError('E-mail inválido.')
      out.email = v
    }
    if (has('instagram')) out.instagram = httpsUrl('instagram', limit('instagram', 200))
    if (has('whatsapp')) out.whatsapp = httpsUrl('whatsapp', limit('whatsapp', 200))
    if (has('primary_color')) {
      const v = str('primary_color')
      if (v !== '' && !/^#[0-9a-fA-F]{6}$/.test(v))
        throw new BadRequestError('A cor precisa ser no formato #RRGGBB.')
      out.primary_color = v
    }
    if (has('links')) {
      if (!Array.isArray(body.links) || body.links.length > 10)
        throw new BadRequestError('Informe até 10 links.')
      out.links = body.links.map((l) => {
        const label = String((l && l.label) || '').trim()
        const url = String((l && l.url) || '').trim()
        if (label.length < 1 || label.length > 60)
          throw new BadRequestError('Cada link precisa de um nome de até 60 caracteres.')
        if (url.length > 200) throw new BadRequestError('Link longo demais.')
        httpsUrl('links', url)
        if (url === '') throw new BadRequestError('Cada link precisa de um endereço https://')
        return { label: label, url: url }
      })
    }
    const asset = (k, kind) => {
      const id = str(k)
      if (id === '') return ''
      let a = null
      try {
        a = $app.findRecordById('site_assets', id)
      } catch (_) {}
      if (!a || a.getString('organization_id') !== orgId || a.getString('kind') !== kind)
        throw new BadRequestError('Imagem inválida para ' + kind + '.')
      return a.id
    }
    if (has('logo_asset_id')) out.logo_asset_id = asset('logo_asset_id', 'logo')
    if (has('favicon_asset_id')) out.favicon_asset_id = asset('favicon_asset_id', 'favicon')

    let r = loadDraft()
    if (!r) {
      r = new Record($app.findCollectionByNameOrId('site_settings'))
      r.set('organization_id', orgId)
    }
    Object.keys(out).forEach((k) => r.set(k, out[k]))
    r.set('updated_by', actor.id)
    try {
      $app.save(r)
    } catch (err) {
      throw new BadRequestError('Não foi possível salvar: confira os campos.')
    }
    const settings = toSnap(r)
    settings.logo_asset_id = r.getString('logo_asset_id')
    settings.favicon_asset_id = r.getString('favicon_asset_id')
    return e.json(200, { settings: settings })
  },
  $apis.requireAuth(),
)
