// Imóveis marcados para a Chaves na Mão (e Disponíveis) que NÃO saem no XML, com os motivos.
// Só o admin. Sem paginação: até 500 itens. A regra de elegibilidade é a mesma de
// portal_feed_chaves_na_mao.js e admin_portals_get.js (copiada).
routerAdd(
  'GET',
  '/backend/v1/admin/portals/chaves-na-mao/pending',
  (e) => {
    const actor = e.auth
    if (actor.get('active') !== true || String(actor.get('role') || '') !== 'admin') {
      throw new ForbiddenError('Só o admin acessa a Administração.')
    }
    const orgId = String(actor.get('organization_id') || '')

    const goodPhotos = (pid) =>
      $app
        .findRecordsByFilter('property_photos', 'property_id = {:p} && is_active = true', 'created', 100, 0, { p: pid })
        .filter((ph) => /\.(jpg|jpeg|webp)$/.test(ph.getString('file').toLowerCase()))
    // REGRA ÚNICA DE ELEGIBILIDADE (mesmos códigos e ordem em portal_feed_chaves_na_mao.js e admin_portals_pending.js)
    const reasonsOf = (p, photos) => {
      const r = []
      const pu = p.getString('purpose')
      const sale = Number(p.get('sale_price') || 0) > 0
      const rent = Number(p.get('rent_price') || 0) > 0
      // o enum de property_type tem 7 valores; 'outro' (ou qualquer tipo sem par no portal) é tipo_outro
      if (['casa', 'apartamento', 'terreno', 'chacara', 'comercial', 'galpao'].indexOf(p.getString('property_type')) < 0) r.push('tipo_outro')
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

    const page = $app.findRecordsByFilter(
      'properties',
      "organization_id = {:o} && status = 'disponivel' && publish_to ~ 'chaves_na_mao'",
      'code',
      500,
      0,
      { o: orgId },
    )
    const items = []
    for (let i = 0; i < page.length; i++) {
      let reasons
      try {
        reasons = reasonsOf(page[i], goodPhotos(page[i].id))
      } catch (_) {
        continue
      }
      if (reasons.length)
        items.push({ id: page[i].id, code: page[i].getString('code'), title: page[i].getString('title'), reasons: reasons })
    }
    return e.json(200, { items: items })
  },
  $apis.requireAuth(),
)
