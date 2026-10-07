// Sugere 3 títulos para o imóvel com IA. Não grava nada: quem aceita grava pela edição normal.
// Só o admin e o captador do imóvel. Usa só dados que já aparecem no anúncio (nunca dono, CPF,
// telefone nem endereço completo).
routerAdd(
  'POST',
  '/backend/v1/properties/{id}/suggest-title',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'corretor'].indexOf(role) < 0) {
      throw new ForbiddenError('Só o admin e o captador sugerem título.')
    }
    let p = null
    try {
      p = $app.findRecordById('properties', e.request.pathValue('id'))
    } catch (_) {}
    if (!p || p.get('organization_id') !== actor.get('organization_id')) {
      throw new NotFoundError('Imóvel não encontrado.')
    }
    if (role === 'corretor' && p.getString('captured_by') !== actor.id) {
      throw new ForbiddenError('Só quem captou o imóvel ou o admin sugere o título.')
    }

    const types = {
      casa: 'casa',
      apartamento: 'apartamento',
      terreno: 'terreno',
      comercial: 'imóvel comercial',
      galpao: 'galpão',
      chacara: 'chácara',
      outro: 'imóvel',
    }
    const purposes = { venda: 'à venda', locacao: 'para alugar', ambos: 'para venda ou aluguel' }
    const num = (k) => Number(p.get(k) || 0)
    const facts = []
    facts.push('Tipo: ' + (types[p.getString('property_type')] || 'imóvel'))
    facts.push('Finalidade: ' + (purposes[p.getString('purpose')] || ''))
    if (p.getString('neighborhood')) facts.push('Bairro: ' + p.getString('neighborhood'))
    if (p.getString('city')) facts.push('Cidade: ' + p.getString('city'))
    if (num('bedrooms') > 0) facts.push('Quartos: ' + num('bedrooms'))
    if (num('bathrooms') > 0) facts.push('Banheiros: ' + num('bathrooms'))
    if (num('parking') > 0) facts.push('Vagas: ' + num('parking'))
    if (num('area') > 0) facts.push('Área construída: ' + num('area') + ' m²')
    if (p.get('in_condominium') === true && p.getString('condominium_id')) {
      try {
        const condo = $app.findRecordById('condominiums', p.getString('condominium_id'))
        facts.push('Condomínio: ' + condo.getString('name'))
        if (condo.getString('amenities'))
          facts.push('Lazer do condomínio: ' + condo.getString('amenities'))
      } catch (_) {}
    }
    if (p.getString('description'))
      facts.push('Descrição: ' + p.getString('description').slice(0, 600))

    try {
      const reply = $ai.chat({
        model: 'fast',
        messages: [
          {
            role: 'system',
            content:
              'Você escreve títulos de anúncios de imóveis em português do Brasil para uma imobiliária. ' +
              'Responda SOMENTE com um JSON no formato {"titulos":["...","...","..."]}, com exatamente 3 títulos ' +
              'diferentes, de 30 a 90 caracteres, sem emojis, sem preço, sem endereço, sem exageros e sem ' +
              'inventar características que não estejam nos dados.',
          },
          { role: 'user', content: facts.join('\n') },
        ],
      })
      const raw = String(reply.choices[0].message.content || '')
      const start = raw.indexOf('{')
      const end = raw.lastIndexOf('}')
      let list = []
      try {
        list = JSON.parse(raw.slice(start, end + 1)).titulos || []
      } catch (_) {}
      const clean = list
        .map((t) =>
          String(t || '')
            .replace(/\s+/g, ' ')
            .trim(),
        )
        .filter((t) => t.length >= 5 && t.length <= 160)
        .slice(0, 3)
      if (clean.length < 3)
        return e.json(503, { message: 'A sugestão não ficou boa. Tente de novo.' })
      return e.json(200, { suggestions: clean })
    } catch (err) {
      return e.json(503, {
        message: 'A sugestão de título está indisponível agora. Tente em instantes.',
      })
    }
  },
  $apis.requireAuth(),
)
