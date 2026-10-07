// Gera o texto da ficha do imóvel para o SDR colar no WhatsApp. Só para imóvel Disponível.
// Mostra bairro e cidade; NUNCA o endereço completo nem o proprietário.
routerAdd(
  'GET',
  '/backend/v1/properties/{id}/ficha',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'sdr', 'corretor'].indexOf(role) < 0) {
      throw new ForbiddenError('Papel sem acesso a estes dados.')
    }
    let p = null
    try {
      p = $app.findRecordById('properties', e.request.pathValue('id'))
    } catch (_) {}
    if (!p || p.get('organization_id') !== actor.get('organization_id')) {
      throw new NotFoundError('Imóvel não encontrado.')
    }
    if (p.getString('status') !== 'disponivel') {
      throw new BadRequestError('Só imóveis disponíveis geram ficha.')
    }

    // dinheiro no formato brasileiro, sem depender de regras de localidade do motor
    const money = (n) => {
      const cents = Math.round(Number(n) * 100)
      let s = String(Math.floor(cents / 100))
      let out = ''
      while (s.length > 3) {
        out = '.' + s.slice(-3) + out
        s = s.slice(0, -3)
      }
      const dec = cents % 100
      return 'R$ ' + s + out + ',' + (dec < 10 ? '0' : '') + dec
    }
    const types = {
      casa: 'Casa',
      apartamento: 'Apartamento',
      terreno: 'Terreno',
      comercial: 'Sala ou loja comercial',
      galpao: 'Galpão',
      chacara: 'Chácara ou sítio',
      outro: 'Imóvel',
    }
    const purposes = { venda: 'venda', locacao: 'locação', ambos: 'venda ou locação' }
    const num = (k) => Number(p.get(k) || 0)

    const lines = []
    lines.push('*' + p.getString('title') + '*')
    lines.push('Código: ' + p.getString('code'))
    lines.push(
      (types[p.getString('property_type')] || 'Imóvel') +
        ' para ' +
        (purposes[p.getString('purpose')] || '') +
        ' em ' +
        p.getString('neighborhood') +
        ', ' +
        p.getString('city'),
    )

    const prices = []
    if (p.get('price_on_request') === true) {
      prices.push('Valor: consulte')
    } else {
      if (num('sale_price') > 0) prices.push('Venda: ' + money(num('sale_price')))
      if (num('rent_price') > 0) prices.push('Locação: ' + money(num('rent_price')) + '/mês')
    }
    if (prices.length) lines.push(prices.join(' | '))

    const feats = []
    if (num('bedrooms') > 0)
      feats.push(num('bedrooms') + (num('bedrooms') === 1 ? ' quarto' : ' quartos'))
    if (num('bathrooms') > 0) {
      feats.push(num('bathrooms') + (num('bathrooms') === 1 ? ' banheiro' : ' banheiros'))
    }
    if (num('parking') > 0) feats.push(num('parking') + (num('parking') === 1 ? ' vaga' : ' vagas'))
    if (num('area') > 0) feats.push(String(num('area')).replace('.', ',') + ' m²')
    if (feats.length) lines.push(feats.join(' · '))

    const extras = []
    if (num('condo_fee') > 0) extras.push('Condomínio: ' + money(num('condo_fee')))
    if (num('iptu') > 0) extras.push('IPTU: ' + money(num('iptu')))
    if (extras.length) lines.push(extras.join(' | '))

    if (p.get('in_condominium') === true && p.getString('condominium_id')) {
      try {
        const condo = $app.findRecordById('condominiums', p.getString('condominium_id'))
        lines.push('Condomínio: ' + condo.getString('name'))
        if (condo.getString('amenities')) lines.push('Lazer: ' + condo.getString('amenities'))
        if (condo.getString('rules')) lines.push('Regras: ' + condo.getString('rules'))
      } catch (_) {}
    }

    if (p.getString('description')) {
      lines.push('')
      lines.push(p.getString('description'))
    }
    return e.json(200, { code: p.getString('code'), text: lines.join('\n') })
  },
  $apis.requireAuth(),
)
