// Site tecnológico, Parte A (spec docs/superpowers/specs/2026-11-15-site-tecnologico-design.md). Só admin. Atenção (goja): nada de função no topo do arquivo.
// Edita um banner do RASCUNHO: só os campos enviados mudam (ativar e ordenar têm rotas próprias).
routerAdd(
  'PATCH',
  '/backend/v1/admin/site/banners/{id}',
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
        a.set('collection_name', 'site_banners')
        a.set('record_id', orgId)
        a.set('reason', 'so_admin_ajusta_o_site')
        a.set('occurred_at', new Date().toISOString())
        $app.save(a)
      } catch (err) {
        $app.logger().error('site_audit_failed', 'err', String((err && err.message) || err))
      }
      throw new ForbiddenError('Só o admin ajusta o site.')
    }
    // banner -> forma do admin (com as URLs das imagens já resolvidas)
    const url = (assetId) => {
      if (!assetId) return ''
      try {
        const a = $app.findRecordById('site_assets', assetId)
        return '/api/files/site_assets/' + a.id + '/' + a.getString('file')
      } catch (_) {
        return ''
      }
    }
    const ser = (r) => ({
      id: r.id,
      title: r.getString('title'),
      subtitle: r.getString('subtitle'),
      button_text: r.getString('button_text'),
      tipo: r.getString('tipo'),
      destino_url: r.getString('destino_url'),
      imovel_codigo: r.getString('imovel_codigo'),
      desktop_asset_id: r.getString('desktop_asset_id'),
      mobile_asset_id: r.getString('mobile_asset_id'),
      night_desktop_asset_id: r.getString('night_desktop_asset_id'),
      night_mobile_asset_id: r.getString('night_mobile_asset_id'),
      start_at: r.getString('start_at'),
      end_at: r.getString('end_at'),
      position: r.getInt('position'),
      active: r.getBool('active'),
      desktop_url: url(r.getString('desktop_asset_id')),
      mobile_url: url(r.getString('mobile_asset_id')),
      night_desktop_url: url(r.getString('night_desktop_asset_id')),
      night_mobile_url: url(r.getString('night_mobile_asset_id')),
    })
    // validação dos campos enviados; "cur" é o banner atual (null ao criar). Devolve só os campos que mudam.
    const validate = (body, cur) => {
      const has = (k) => Object.prototype.hasOwnProperty.call(body, k)
      const str = (k) => String(body[k] === null || body[k] === undefined ? '' : body[k]).trim()
      const limit = (k, max) => {
        const v = str(k)
        if (v.length > max)
          throw new BadRequestError('O campo "' + k + '" passa de ' + max + ' caracteres.')
        return v
      }
      const out = {}
      if (has('title')) out.title = limit('title', 80)
      if (has('subtitle')) out.subtitle = limit('subtitle', 120)
      if (has('button_text')) out.button_text = limit('button_text', 30)
      if (has('tipo') || !cur) {
        const t = has('tipo') ? str('tipo') : 'campanha'
        if (['campanha', 'lancamento', 'super_destaque'].indexOf(t) < 0)
          throw new BadRequestError('Tipo de banner inválido.')
        out.tipo = t
      }
      if (has('destino_url')) {
        const d = limit('destino_url', 300)
        if (d !== '' && !(/^\/(?!\/)\S*$/.test(d) || /^https:\/\/\S+$/.test(d)))
          throw new BadRequestError('O destino precisa começar com / (página do site) ou https://')
        out.destino_url = d
      }
      if (has('imovel_codigo')) {
        const c = limit('imovel_codigo', 20)
        if (c !== '' && !/^[A-Za-z0-9-]+$/.test(c))
          throw new BadRequestError('Código de imóvel inválido.')
        out.imovel_codigo = c
      }
      const asset = (k, kind, required) => {
        const id = str(k)
        if (id === '') {
          if (required) throw new BadRequestError('Envie a imagem para computador.')
          return ''
        }
        let a = null
        try {
          a = $app.findRecordById('site_assets', id)
        } catch (_) {}
        if (!a || a.getString('organization_id') !== orgId || a.getString('kind') !== kind)
          throw new BadRequestError('Imagem inválida para este campo do banner.')
        return a.id
      }
      if (has('desktop_asset_id') || !cur)
        out.desktop_asset_id = asset('desktop_asset_id', 'banner_desktop', true)
      if (has('mobile_asset_id'))
        out.mobile_asset_id = asset('mobile_asset_id', 'banner_mobile', false)
      if (has('night_desktop_asset_id'))
        out.night_desktop_asset_id = asset('night_desktop_asset_id', 'banner_desktop', false)
      if (has('night_mobile_asset_id'))
        out.night_mobile_asset_id = asset('night_mobile_asset_id', 'banner_mobile', false)
      const when = (k) => {
        const v = str(k)
        if (v === '') return ''
        const t = new Date(v).getTime()
        if (isNaN(t)) throw new BadRequestError('Data inválida em "' + k + '".')
        return new Date(t).toISOString()
      }
      if (has('start_at')) out.start_at = when('start_at')
      if (has('end_at')) out.end_at = when('end_at')
      // regras entre campos, com o valor final de cada um
      const fin = (k) =>
        Object.prototype.hasOwnProperty.call(out, k) ? out[k] : cur ? cur.getString(k) : ''
      const ms = (v) => (v ? new Date(String(v).replace(' ', 'T')).getTime() : NaN)
      if (fin('button_text') !== '' && fin('destino_url') === '')
        throw new BadRequestError('O texto do botão só vale com um destino.')
      const s = ms(fin('start_at'))
      const f = ms(fin('end_at'))
      if (!isNaN(s) && !isNaN(f) && f < s)
        throw new BadRequestError('O fim não pode ser antes do início.')
      return out
    }
    const activeOthers = (exceptId) =>
      $app.findRecordsByFilter(
        'site_banners',
        'organization_id = {:o} && active = true && id != {:x}',
        '',
        10,
        0,
        { o: orgId, x: exceptId || '' },
      ).length
    let r = null
    try {
      r = $app.findRecordById('site_banners', e.request.pathValue('id'))
    } catch (_) {}
    if (!r || r.getString('organization_id') !== orgId)
      throw new NotFoundError('Banner não encontrado.')
    const body = e.requestInfo().body || {}
    const out = validate(body, r)
    Object.keys(out).forEach((k) => r.set(k, out[k]))
    r.set('updated_by', actor.id)
    try {
      $app.save(r)
    } catch (err) {
      throw new BadRequestError('Não foi possível salvar o banner: confira os campos.')
    }
    return e.json(200, { banner: ser(r) })
  },
  $apis.requireAuth(),
)
