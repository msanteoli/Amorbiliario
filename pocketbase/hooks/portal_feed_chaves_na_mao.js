// Gera o XML de imóveis da Chaves na Mão (formato do portal) para o token da URL. Público, sem login.
// Só imóveis Disponíveis, marcados em chaves_na_mao e prontos (regra única de elegibilidade do plano M12).
// A regra é repetida em admin_portals_get.js e admin_portals_pending.js (os arquivos do Skip não
// compartilham funções). Nunca inclui dados de dono, cliente, telefone ou e-mail.
routerAdd('GET', '/backend/v1/public/feeds/{token}/chavesnamao.xml', (e) => {
  const token = String(e.request.pathValue('token') || '')
  let feed = null
  if (token.length >= 32 && token.length <= 64 && /^[A-Za-z0-9]+$/.test(token)) {
    try {
      feed = $app.findFirstRecordByData('portal_feeds', 'token', token)
    } catch (_) {}
  }
  if (!feed || feed.get('active') !== true || feed.getString('portal') !== 'chaves_na_mao') {
    throw new NotFoundError('Não encontrado.')
  }
  const orgId = feed.getString('organization_id')

  // domínio do backend: o mesmo host pelo qual o feed foi pedido (o portal busca por ele)
  const proto =
    String(e.request.header.get('X-Forwarded-Proto') || 'https')
      .split(',')[0]
      .trim() || 'https'
  const base = proto + '://' + String(e.request.host || '')

  const ctrl = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g
  const esc = (v) =>
    String(v === null || v === undefined ? '' : v)
      .replace(ctrl, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  const cdata = (v) =>
    '<![CDATA[' +
    String(v || '')
      .replace(ctrl, '')
      .replace(/\]\]>/g, ']]]]><![CDATA[>') +
    ']]>'
  const num = (v) =>
    v === null || v === undefined || v === '' || !(Number(v) > 0) ? '' : Number(v).toFixed(2)
  const int = (v) =>
    v === null || v === undefined || v === '' || !(Number(v) > 0)
      ? ''
      : String(Math.floor(Number(v)))
  const when = (raw) =>
    String(raw || '')
      .substring(0, 19)
      .replace('T', ' ')
  const typeMap = (rec) => {
    const t = rec.getString('property_type')
    const cond = rec.get('in_condominium') === true
    if (t === 'casa')
      return { tipo: cond ? 'Casa / Sobrado em Condomínio' : 'Casa / Sobrado', fin: 'RE' }
    if (t === 'apartamento') return { tipo: 'Apartamento', fin: 'RE' }
    if (t === 'terreno')
      return { tipo: cond ? 'Terreno em Condomínio' : 'Terreno / Lote', fin: 'RE' }
    if (t === 'chacara') return { tipo: 'Sítio / Chácara', fin: 'RE' }
    if (t === 'comercial') return { tipo: 'Conj. Comercial / Sala', fin: 'CO' }
    if (t === 'galpao') return { tipo: 'Galpão / Depósito', fin: 'CO' }
    return null
  }
  // fotos válidas para o portal: ativas, .jpg/.jpeg/.webp (minúsculas, pelo nome), a capa (a mais antiga) primeiro
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
  // REGRA ÚNICA DE ELEGIBILIDADE (mesmos códigos e ordem em admin_portals_get.js e admin_portals_pending.js)
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

  const now = Date.now()
  const parts = []
  let count = 0
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
      const p = page[i]
      try {
        const photos = goodPhotos(p.id)
        if (reasonsOf(p, photos).length) continue
        const tm = typeMap(p)
        if (!tm) continue
        const pu = p.getString('purpose')
        const hl = p.getString('highlight_level')
        const hlUntil = p.getString('highlight_until')
        const hlOn =
          (hl === 'destaque' || hl === 'super_destaque') &&
          (!hlUntil || new Date(hlUntil.replace(' ', 'T')).getTime() >= now)
        const zip = p.getString('zip_code').replace(/\D/g, '')
        const nro = p.getString('street_number').trim()
        const fotos = photos
          .slice(0, 30)
          .map(
            (ph) =>
              '<foto><url>' +
              esc(base + '/api/files/property_photos/' + ph.id + '/' + ph.getString('file')) +
              '</url><data_atualizacao>' +
              esc(when(ph.getString('updated'))) +
              '</data_atualizacao></foto>',
          )
          .join('')
        const t = [
          ['referencia', esc(p.getString('code'))],
          ['codigo_cliente', esc(p.getString('code'))],
          ['link_cliente', ''],
          ['titulo', esc(p.getString('title'))],
          ['transacao', pu === 'locacao' ? 'L' : 'V'],
          ['transacao2', pu === 'ambos' ? 'L' : ''],
          ['finalidade', tm.fin],
          ['finalidade2', ''],
          ['destaque', hlOn ? '1' : '0'],
          ['tipo', esc(tm.tipo)],
          ['tipo2', ''],
          ['valor', num(pu === 'locacao' ? p.get('rent_price') : p.get('sale_price'))],
          ['valor_locacao', pu === 'ambos' ? num(p.get('rent_price')) : ''],
          ['valor_iptu', num(p.get('iptu'))],
          ['valor_condominio', num(p.get('condo_fee'))],
          ['area_total', ''],
          ['area_util', num(p.get('area'))],
          ['conservacao', ''],
          ['quartos', int(p.get('bedrooms'))],
          ['suites', ''],
          ['garagem', int(p.get('parking'))],
          ['banheiro', int(p.get('bathrooms'))],
          ['closet', ''],
          ['salas', ''],
          ['despensa', ''],
          ['bar', ''],
          ['cozinha', ''],
          ['quarto_empregada', ''],
          ['escritorio', ''],
          ['area_servico', ''],
          ['lareira', ''],
          ['varanda', ''],
          ['lavanderia', ''],
          ['aceita_pet', ''],
          ['estado', esc(p.getString('state'))],
          ['cidade', esc(p.getString('city'))],
          ['bairro', esc(p.getString('neighborhood'))],
          ['cep', zip.substring(0, 5) + '-' + zip.substring(5)],
          ['endereco', esc(p.getString('street').substring(0, 200))],
          ['numero', esc(!nro || nro === '0' ? 'S/N' : nro.substring(0, 10))],
          ['complemento', esc(p.getString('complement').substring(0, 20))],
          ['esconder_endereco_imovel', '1'],
          ['latitude', ''],
          ['longitude', ''],
          ['descritivo', cdata(p.getString('description').substring(0, 3000))],
          ['fotos_imovel', fotos],
          ['data_atualizacao', esc(when(p.getString('updated')))],
          ['video', ''],
          ['tour_360', ''],
          ['area_comum', ''],
          ['area_privativa', ''],
          ['aceita_troca', ''],
          ['periodo_locacao', pu === 'locacao' || pu === 'ambos' ? '1' : ''],
        ]
        parts.push(
          '<imovel>' +
            t.map((x) => '<' + x[0] + '>' + x[1] + '</' + x[0] + '>').join('') +
            '</imovel>',
        )
        count++
      } catch (_) {
        console.log(
          'feed_chaves_na_mao: imovel ignorado code=' +
            p.getString('code') +
            ' motivo=erro_montagem',
        )
      }
    }
    if (page.length < 200) break
  }

  const xml =
    '<?xml version="1.0" encoding="utf-8"?>\n<Document><imoveis>' +
    parts.join('\n') +
    '</imoveis></Document>\n'

  try {
    feed.set('last_fetched_at', new DateTime())
    feed.set('last_count', count)
    $app.save(feed)
  } catch (_) {
    console.log('feed_chaves_na_mao: leitura nao registrada motivo=erro_salvar')
  }

  e.response.header().set('Content-Type', 'application/xml; charset=utf-8')
  e.response.header().set('Cache-Control', 'no-store')
  return e.blob(200, 'application/xml; charset=utf-8', toBytes(xml))
})
