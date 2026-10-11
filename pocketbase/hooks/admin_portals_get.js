// Endereço do XML da Chaves na Mão e contadores para a tela Portais. Só o admin.
// Na primeira chamada cria o registro de portal_feeds (ativo, código secreto novo de 32 letras e
// números). A regra de elegibilidade é a mesma de portal_feed_chaves_na_mao.js (copiada).
routerAdd(
  'GET',
  '/backend/v1/admin/portals/chaves-na-mao',
  (e) => {
    const actor = e.auth
    if (actor.get('active') !== true || String(actor.get('role') || '') !== 'admin') {
      throw new ForbiddenError('Só o admin acessa a Administração.')
    }
    const orgId = String(actor.get('organization_id') || '')

    const rows = $app.findRecordsByFilter(
      'portal_feeds',
      "organization_id = {:o} && portal = 'chaves_na_mao'",
      '',
      1,
      0,
      { o: orgId },
    )
    let feed = rows.length ? rows[0] : null
    if (!feed) {
      feed = new Record($app.findCollectionByNameOrId('portal_feeds'))
      feed.set('organization_id', orgId)
      feed.set('portal', 'chaves_na_mao')
      feed.set(
        'token',
        $security.randomStringWithAlphabet(
          32,
          'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        ),
      )
      feed.set('active', true)
      feed.set('last_count', 0)
      $app.save(feed)
    }

    // mesmo domínio do backend usado no XML: o host pelo qual a API foi chamada
    const proto =
      String(e.request.header.get('X-Forwarded-Proto') || 'https')
        .split(',')[0]
        .trim() || 'https'
    const base = proto + '://' + String(e.request.host || '')

    const goodPhotos = (pid) =>
      $app
        .findRecordsByFilter(
          'property_photos',
          'property_id = {:p} && is_active = true',
          'created',
          100,
          0,
          { p: pid },
        )
        .filter((ph) => /\.(jpg|jpeg|webp)$/.test(ph.getString('file').toLowerCase()))
    // REGRA ÚNICA DE ELEGIBILIDADE (mesmos códigos e ordem em portal_feed_chaves_na_mao.js e admin_portals_pending.js)
    const reasonsOf = (p, photos) => {
      const r = []
      const pu = p.getString('purpose')
      const sale = Number(p.get('sale_price') || 0) > 0
      const rent = Number(p.get('rent_price') || 0) > 0
      if (p.getString('property_type') === 'outro') r.push('tipo_outro')
      if (
        p.get('price_on_request') === true ||
        (pu === 'venda' && !sale) ||
        (pu === 'locacao' && !rent) ||
        (pu === 'ambos' && (!sale || !rent)) ||
        (pu !== 'venda' && pu !== 'locacao' && pu !== 'ambos')
      )
        r.push('sem_preco')
      if (!p.getString('neighborhood').trim()) r.push('sem_bairro')
      if (!p.getString('city').trim()) r.push('sem_cidade')
      if (!p.getString('state').trim()) r.push('sem_uf')
      if (p.getString('zip_code').replace(/\D/g, '').length !== 8) r.push('sem_cep')
      if (!p.getString('description').trim()) r.push('sem_descricao')
      if (!photos.length) r.push('sem_foto')
      return r
    }

    let marked = 0
    let published = 0
    for (let offset = 0; offset < 2000; offset += 200) {
      const page = $app.findRecordsByFilter(
        'properties',
        "organization_id = {:o} && status = 'disponivel' && publish_to ~ 'chaves_na_mao'",
        'code',
        200,
        offset,
        { o: orgId },
      )
      for (let i = 0; i < page.length; i++) {
        marked++
        try {
          if (!reasonsOf(page[i], goodPhotos(page[i].id)).length) published++
        } catch (_) {}
      }
      if (page.length < 200) break
    }

    return e.json(200, {
      feed_url: base + '/backend/v1/public/feeds/' + feed.getString('token') + '/chavesnamao.xml',
      active: feed.get('active') === true,
      published_count: published,
      marked_count: marked,
      pending_count: marked - published,
      last_fetched_at: feed.getString('last_fetched_at') || null,
      last_count: Number(feed.get('last_count') || 0),
    })
  },
  $apis.requireAuth(),
)
