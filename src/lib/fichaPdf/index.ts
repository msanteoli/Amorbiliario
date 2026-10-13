export interface FichaImovelParsed {
  code?: string
  title?: string
  purpose?: 'venda' | 'locacao' | 'ambos'
  property_type?: string
  use_type?: string
  street?: string
  street_number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  zip_code?: string
  bedrooms?: number
  bathrooms?: number
  parking?: number
  area?: number
  sale_price?: number
  rent_price?: number
  condo_fee?: number
  iptu?: number
  price_on_request?: boolean
  description?: string
  in_condominium?: boolean
  condominium_name?: string
  lazer?: string
  infraestrutura?: string
  comentario_interno?: string
}

export interface FichaProprietarioParsed {
  name?: string
  cpf?: string
  rg?: string
  email?: string
  phone?: string
  phone2?: string
  person_type?: 'pf' | 'pj'
  street?: string
  street_number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  zip_code?: string
}

export interface FichaNaoImportado {
  garantia?: string
  fgts?: string
  permuta?: string
  financiamento?: string
  posicao?: string
  pacote?: string
  local_da_chave?: string
  [key: string]: string | undefined
}

export type ParseFichaResult =
  | {
      ok: true
      imovel: FichaImovelParsed
      proprietario: FichaProprietarioParsed
      nao_importado: FichaNaoImportado
    }
  | {
      ok: false
      motivo: 'sem_texto' | 'nao_e_ficha'
    }

function cleanVal(val: string | undefined | null): string {
  if (!val) return ''
  return val.replace(/\s+/g, ' ').trim()
}

function parseNumber(val: string | undefined | null): number | undefined {
  if (!val) return undefined
  const digits = val.replace(/[^\d.,]/g, '')
  if (!digits) return undefined
  // Formato brasileiro: 1.250,50 -> 1250.50
  if (digits.includes(',') && digits.includes('.')) {
    const norm = digits.replace(/\./g, '').replace(',', '.')
    const n = parseFloat(norm)
    return isNaN(n) ? undefined : n
  }
  if (digits.includes(',')) {
    const norm = digits.replace(',', '.')
    const n = parseFloat(norm)
    return isNaN(n) ? undefined : n
  }
  const n = parseFloat(digits)
  return isNaN(n) ? undefined : n
}

function parseIntClean(val: string | undefined | null): number | undefined {
  if (!val) return undefined
  const m = /(\d+)/.exec(val)
  return m ? parseInt(m[1], 10) : undefined
}

export function parseFichaPdfText(rawText: string): ParseFichaResult {
  if (!rawText || !rawText.trim()) {
    return { ok: false, motivo: 'sem_texto' }
  }

  const text = rawText.replace(/\r/g, '')

  // Verificação de Kenlo ou Ficha de captação/imóvel
  const lower = text.toLowerCase()
  const isKenlo =
    lower.includes('kenlo') ||
    lower.includes('ficha de captação') ||
    lower.includes('ficha de imóvel') ||
    lower.includes('ficha cadastral') ||
    (lower.includes('referência') &&
      lower.includes('proprietário') &&
      lower.includes('endereço')) ||
    (lower.includes('referencia') && lower.includes('proprietario') && lower.includes('endereco'))

  if (!isKenlo) {
    return { ok: false, motivo: 'nao_e_ficha' }
  }

  const findPattern = (patterns: RegExp[]): string => {
    for (const pat of patterns) {
      const match = pat.exec(text)
      if (match && match[1]) {
        return cleanVal(match[1])
      }
    }
    return ''
  }

  // 1. Extração dos dados do Imóvel
  const code = findPattern([
    /(?:Referência|Referencia|Ref\.?|Código|Codigo)[\s:]+([A-Za-z0-9_-]+)/i,
    /Código do imóvel[\s:]+([A-Za-z0-9_-]+)/i,
    /Ficha de Imóvel\s+([A-Za-z0-9_-]+)/i,
  ])

  // Tipo de construção
  const headerTypeMatch = /Ficha de Imóvel\s+[A-Za-z0-9_-]+\s*\(([^)]+)\)/i.exec(text)
  const rawHeaderType = headerTypeMatch ? headerTypeMatch[1] : ''
  const rawTipo = (
    rawHeaderType ||
    findPattern([/(?:Tipo de imóvel|Tipo do imóvel|Tipo de construção|Tipo)[\s:]+([^\n\r,]+)/i])
  ).toLowerCase()

  let property_type = 'apartamento'
  if (rawTipo.includes('casa')) property_type = 'casa'
  else if (rawTipo.includes('apart')) property_type = 'apartamento'
  else if (rawTipo.includes('terr') || rawTipo.includes('lote')) property_type = 'terreno'
  else if (rawTipo.includes('comerc') || rawTipo.includes('sala') || rawTipo.includes('loja'))
    property_type = 'comercial'
  else if (rawTipo.includes('galp')) property_type = 'galpao'
  else if (rawTipo.includes('chac') || rawTipo.includes('sitio')) property_type = 'chacara'
  else if (rawTipo) property_type = 'outro'

  // Uso (Uso do imóvel, Destinação ou Finalidade quando contiver Residencial/Comercial)
  const rawUso = findPattern([
    /(?:Uso do imóvel|Uso|Destinação)[\s:]+([^\n\r,]+)/i,
    /(?:Finalidade)[\s:]+([^\n\r,]+)/i,
  ]).toLowerCase()
  let use_type = 'residencial'
  if (rawUso.includes('comerc')) use_type = 'comercial'
  else if (rawUso.includes('indus')) use_type = 'industrial'
  else if (rawUso.includes('rural')) use_type = 'rural'

  // Valores
  const rawSale = parseNumber(
    findPattern([/(?:Valor de venda|Preço de venda|R\$ Venda|Venda)[\s:]+R?\$?\s*([\d.,]+)/i]),
  )
  const sale_price = rawSale && rawSale > 0 ? rawSale : undefined

  const rawRent = parseNumber(
    findPattern([
      /(?:Valor de locação|Preço de locação|R\$ Locação|Locação|Aluguel)[\s:]+R?\$?\s*([\d.,]+)/i,
    ]),
  )
  const rent_price = rawRent && rawRent > 0 ? rawRent : undefined

  // Finalidade: pelos valores, não pelo texto.
  // Se houver valor de venda e de locação maiores que zero: 'ambos'.
  // Só venda: 'venda'. Só locação: 'locacao'. Se nenhum valor: mantenha 'venda'.
  let purpose: 'venda' | 'locacao' | 'ambos' = 'venda'
  if (sale_price !== undefined && rent_price !== undefined) {
    purpose = 'ambos'
  } else if (sale_price !== undefined) {
    purpose = 'venda'
  } else if (rent_price !== undefined) {
    purpose = 'locacao'
  } else {
    purpose = 'venda'
  }

  // Taxa de condomínio e IPTU: apenas pelos rótulos certos. Zero continua undefined (nunca 0).
  const rawCondoFee = parseNumber(findPattern([/R\$\s*cond\.?\s*([\d.,]+)/i]))
  const condo_fee = rawCondoFee && rawCondoFee > 0 ? rawCondoFee : undefined

  const rawIptu = parseNumber(findPattern([/Valor do IPTU[\s:]+R?\$?\s*([\d.,]+)/i]))
  const iptu = rawIptu && rawIptu > 0 ? rawIptu : undefined

  // Condomínio ou Edifício:
  // Use só linhas que comecem com o rótulo: ^(?:Condomínio|Condominio|Edifício|Edificio)\s*:\s*(.+)$ (flag m)
  // Ignora linhas como "Pacote (locação + condomínio + IPTU): 12.000,00"
  let condoName = ''
  const condoRegex = /^(?:Condomínio|Condominio|Edifício|Edificio)\s*:\s*(.+)$/gim
  let condoMatch: RegExpExecArray | null = null
  while ((condoMatch = condoRegex.exec(text)) !== null) {
    if (condoMatch[1]) {
      let rawCName = condoMatch[1].trim()
      // Se tiver "R$" ou "Empreendimento:", corta antes de "R$"
      const rDollarIdx = rawCName.indexOf('R$')
      if (rDollarIdx !== -1) {
        rawCName = rawCName.substring(0, rDollarIdx).trim()
      }
      // Remove prefixos redundantes repetidos como "Condomínio:", "Edifício:", "Condomínio", "Edifício"
      rawCName = rawCName.replace(/^(?:Condomínio|Condominio|Edifício|Edificio)[\s:]*/i, '').trim()
      const cleaned = cleanVal(rawCName)
      if (cleaned) {
        condoName = cleaned
        break
      }
    }
  }

  // in_condominium = true quando houver nome. Edifício é condomínio quando o imóvel for apartamento
  const in_condominium = Boolean(
    condoName && condoName.toLowerCase() !== 'não' && condoName.toLowerCase() !== 'nao',
  )

  // Endereço do imóvel:
  // No PDF real o endereço do imóvel vem quebrado em linhas depois do proprietário.
  // Regra B1: depois da linha do proprietário (Proprietário:), procure a primeira linha que contenha ", nº <algo>" (ou ", n° <algo>");
  // junte essa linha com as duas linhas seguintes (separadas por espaço) e aplique a expressão de endereço sobre o texto juntado.
  // O fallback por "Rua" deve ignorar as linhas anteriores à linha do proprietário.
  let street: string | undefined
  let street_number: string | undefined
  let complement: string | undefined
  let neighborhood: string | undefined
  let city: string | undefined
  let state: string = 'BA'
  let zip_code: string | undefined

  const lines = text.split('\n')
  const propLineIndex = lines.findIndex((l) =>
    /^(?:Proprietário|Proprietario|Nome do proprietário|Cliente)[\s:]/i.test(l.trim()),
  )
  const linesAfterProp = propLineIndex !== -1 ? lines.slice(propLineIndex + 1) : lines

  const addressCandidateIdx = linesAfterProp.findIndex((l) => /,\s*n[º°o]\s*\S+/i.test(l))

  const fullAddressRegex =
    /([^\n\r]+?)(?:,\s*(?:nº|n°|número|numero)\s*([0-9A-Za-z]+|\bS\/N\b))\s*([^-\n\r]*?)\s*-\s*([^\n\r/-]+)\s*\/\s*([A-Za-z]{2})\s*CEP:?\s*([\d.-]+)/i

  let addrMatch: RegExpExecArray | null = null

  if (addressCandidateIdx !== -1) {
    const chunk = linesAfterProp
      .slice(addressCandidateIdx, addressCandidateIdx + 3)
      .map((l) => l.trim())
      .filter(Boolean)
      .join(' ')
    addrMatch = fullAddressRegex.exec(chunk)
  }

  if (!addrMatch) {
    // Tenta encontrar em qualquer texto após o proprietário
    const afterPropText = linesAfterProp.join('\n')
    addrMatch = fullAddressRegex.exec(afterPropText)
  }

  if (addrMatch) {
    let rawStreet = addrMatch[1].trim()
    // Remove prefixo "Endereço:" se houver
    rawStreet = rawStreet.replace(/^(?:Endereço|Endereco|Logradouro)[\s:]+/i, '').trim()
    // "Rua Teste" -> street = "Teste"
    const cleanedStreet = rawStreet
      .replace(/^(?:Rua|Avenida|Av\.?|Travessa|Alameda|Praça|Praca|Rodovia)\s+/i, '')
      .trim()
    street = cleanedStreet || rawStreet

    street_number = addrMatch[2].trim()

    let rawMiddle = addrMatch[3].trim()
    // Remove vírgula inicial se houver
    rawMiddle = rawMiddle.replace(/^,\s*/, '').trim()

    if (rawMiddle) {
      const parts = rawMiddle
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
      if (parts.length > 1) {
        // O último segmento é o bairro (ex: "BAIRRO TESTE")
        neighborhood = parts[parts.length - 1]
        // Os segmentos anteriores compõem o complemento (ex: "Cond. Teste Lumiere, Casa 66")
        complement = parts.slice(0, parts.length - 1).join(', ')
      } else if (parts.length === 1) {
        // Se só tem um pedaço:
        // Se for indicativo de complemento ("Apto...", "Casa...", etc.), vira complemento
        if (
          /^(?:Apto|Apartamento|Casa|Cond|Condomínio|Bloco|Bl|Sala|Lote|Quadra|Qd|Lt|Fundos|Frente|Andar|Cobertura)\b/i.test(
            parts[0],
          )
        ) {
          complement = parts[0]
        } else {
          neighborhood = parts[0]
        }
      }
    }

    city = cleanVal(addrMatch[4])
    state = (addrMatch[5] || 'BA').toUpperCase()
    zip_code = addrMatch[6].replace(/\D/g, '')
  } else {
    // Fallback para campos individuais ignorando linhas anteriores à linha do proprietário
    const afterPropText = linesAfterProp.join('\n')
    const findPatternAfterProp = (patterns: RegExp[]): string => {
      for (const pat of patterns) {
        const match = pat.exec(afterPropText)
        if (match && match[1]) {
          return cleanVal(match[1])
        }
      }
      return ''
    }

    const rawSt = findPatternAfterProp([
      /(?:Endereço|Endereco|Logradouro|Rua|Av\.?|Avenida)[\s:]+([^\n\r,]+)/i,
      /Logradouro[\s:]+([^\n\r]+)/i,
    ])
    street =
      rawSt.replace(/^(?:Rua|Avenida|Av\.?|Travessa|Alameda|Praça|Praca|Rodovia)\s+/i, '').trim() ||
      rawSt ||
      undefined
    street_number =
      findPatternAfterProp([/(?:Número|Numero|Nº|N°)[\s:]+([A-Za-z0-9_-]+)/i]) || 'S/N'
    complement = findPatternAfterProp([/(?:Complemento|Compl\.?)[\s:]+([^\n\r]+)/i]) || undefined
    neighborhood = findPatternAfterProp([/(?:Bairro)[\s:]+([^\n\r,]+)/i]) || undefined
    city = findPatternAfterProp([/(?:Cidade|Município|Municipio)[\s:]+([^\n\r,]+)/i]) || undefined
    state = (findPatternAfterProp([/(?:Estado|UF)[\s:]+([A-Za-z]{2})/i]) || 'BA').toUpperCase()
    const rawZip = findPatternAfterProp([/(?:CEP)[\s:]+([\d.-]+)/i]).replace(/\D/g, '')
    zip_code = rawZip || undefined
  }

  // Características: quartos, banheiros e vagas
  // Aceite (N)Rótulo e também Rótulo: N.
  // Rótulos:
  // - dormitórios/quartos (bedrooms)
  // - "banheiros" (bathrooms) -> Nº de banheiros ou Banheiros
  // - "vagas" (parking, quando houver número antes de "vagas cobertas" ou "vagas")
  // Atenção: "Suítes" não é quartos; ignore. Tipo "Não informado" não traz número.
  const extractFeatureCount = (regexes: RegExp[]): number | undefined => {
    for (const rx of regexes) {
      const m = rx.exec(text)
      if (m && m[1]) {
        const val = parseInt(m[1], 10)
        if (!isNaN(val)) return val
      }
    }
    return undefined
  }

  const bedrooms = extractFeatureCount([
    /\((\d+)\)\s*(?:Dormitórios|Dormitorios|Quartos)/i,
    /(?:Dormitórios|Dormitorios|Quartos|Qts)[\s:]+(\d+)/i,
  ])

  const bathrooms = extractFeatureCount([
    /\((\d+)\)\s*(?:Nº de banheiros|N° de banheiros|Banheiros|Banhos|WCs)/i,
    /(?:Nº de banheiros|N° de banheiros|Banheiros|Banhos|WCs)[\s:]+(\d+)/i,
  ])

  const parking = extractFeatureCount([
    /\((\d+)\)\s*(?:Vagas cobertas|Vagas descobertas|Vagas|Garagem)/i,
    /(?:Vagas cobertas|Vagas descobertas|Vagas|Garagem)[\s:]+(\d+)/i,
  ])

  // Área:
  // Prefira "Área construída" quando tiver valor maior que zero.
  // Se ela for zero ou não existir, use "Área útil" (maior que zero).
  // Se nenhuma for maior que zero, area fica undefined.
  // Não use "Área do terreno" nem "Área total" em nenhum caso.
  const rawConstruida = parseNumber(
    findPattern([/(?:Área construída|Area construida)[\s:]+([\d.,]+)/i]),
  )
  const rawUtil = parseNumber(
    findPattern([/(?:Área útil|Area util|Área privativa|Area privativa)[\s:]+([\d.,]+)/i]),
  )

  let area: number | undefined = undefined
  if (rawConstruida && rawConstruida > 0) {
    area = rawConstruida
  } else if (rawUtil && rawUtil > 0) {
    area = rawUtil
  }

  // Textos para compor a descrição
  const lazer = findPattern([/(?:Lazer|Área de lazer|Itens de lazer)[\s:]+([^\n\r]+)/i])
  const infraestrutura = findPattern([/(?:Infraestrutura|Estrutura)[\s:]+([^\n\r]+)/i])

  // B3. Comentários internos:
  // Aceite Coment[áa]rios? internos?.
  // Valor = texto depois do : na mesma linha, mais a linha imediatamente acima do rótulo (só se ela não tiver :),
  // mais todas as linhas abaixo até o fim da página (ou fim do texto / quebra de página).
  let comentario_interno: string | undefined = undefined

  // Trabalhar sobre páginas se houver quebra de página (\n\n) ou no texto inteiro
  const pages = text.split(/\n\s*\n/)
  for (const page of pages) {
    const pageLines = page.split('\n')
    const commentLineIdx = pageLines.findIndex((l) => /Coment[áa]rios?\s+internos?\s*:/i.test(l))
    if (commentLineIdx !== -1) {
      const commentLine = pageLines[commentLineIdx]
      const afterColonMatch = /Coment[áa]rios?\s+internos?\s*:\s*(.*)$/i.exec(commentLine)
      const afterColon = afterColonMatch ? afterColonMatch[1].trim() : ''

      const collectedParts: string[] = []

      // Linha imediatamente acima (só se ela não tiver :)
      if (commentLineIdx > 0) {
        const prevLine = pageLines[commentLineIdx - 1].trim()
        if (prevLine && !prevLine.includes(':')) {
          collectedParts.push(prevLine)
        }
      }

      // Texto depois do : na mesma linha
      if (afterColon) {
        collectedParts.push(afterColon)
      }

      // Linhas abaixo até o fim da página
      for (let i = commentLineIdx + 1; i < pageLines.length; i++) {
        const nextLine = pageLines[i].trim()
        if (nextLine) {
          collectedParts.push(nextLine)
        }
      }

      if (collectedParts.length > 0) {
        comentario_interno = cleanVal(collectedParts.join(' '))
      }
      break
    }
  }

  // Fallback caso não encontre "Comentários internos": busca por observações/notas
  if (!comentario_interno) {
    comentario_interno =
      findPattern([
        /(?:Comentário interno|Comentario interno|Observações|Observacoes|Notas)[\s:]+([^\n\r]+)/i,
      ]) || undefined
  }

  const descParts: string[] = []
  if (lazer) descParts.push(`Lazer: ${lazer}`)
  if (infraestrutura) descParts.push(`Infraestrutura: ${infraestrutura}`)
  if (comentario_interno) descParts.push(`Observações: ${comentario_interno}`)
  const description = descParts.join('\n\n')

  // 2. Extração dos dados do Proprietário
  const propName = findPattern([
    /(?:Proprietário|Proprietario|Nome do proprietário|Cliente)[\s:]+([^\n\r,]+)/i,
  ])
  const propCpf = findPattern([/(?:CPF)[\s:]+([\d.-]+)/i])
  const propRg = findPattern([/(?:RG)[\s:]+([\d.-A-Za-z]+)/i])
  const propEmail = findPattern([
    /(?:E-mail|Email)[\s:]+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
  ])
  const propPhone = findPattern([/(?:Telefone|Celular|Tel\.?|Fone|Contato)[\s:]+([(\d\s).-]+)/i])
  const propPhone2 = findPattern([/(?:Telefone 2|Celular 2|Tel 2|Fone 2)[\s:]+([(\d\s).-]+)/i])

  // 3. Bloco "Não importado"
  const garantia = findPattern([
    /(?:Garantia|Garantias aceitas|Garantia locatícia)[\s:]+([^\n\r]+)/i,
  ])
  const fgts = findPattern([/(?:FGTS|Aceita FGTS)[\s:]+([^\n\r]+)/i])
  const permuta = findPattern([/(?:Permuta|Aceita permuta)[\s:]+([^\n\r]+)/i])
  const financiamento = findPattern([/(?:Financiamento|Aceita financiamento)[\s:]+([^\n\r]+)/i])
  const posicao = findPattern([/(?:Posição|Posicao|Posição solar|Sol)[\s:]+([^\n\r]+)/i])
  const pacote = findPattern([/(?:Pacote|Valor do pacote|Locação pacote)[\s:]+([^\n\r]+)/i])
  const local_da_chave = findPattern([
    /(?:Local da chave|Local das chaves|Chaves|Chave com)[\s:]+([^\n\r]+)/i,
  ])

  const imovel: FichaImovelParsed = {
    code: code || undefined,
    purpose,
    property_type,
    use_type,
    street: street || undefined,
    street_number: street_number || 'S/N',
    complement: complement || undefined,
    neighborhood: neighborhood || undefined,
    city: city || undefined,
    state,
    zip_code: zip_code || undefined,
    bedrooms: bedrooms || undefined,
    bathrooms: bathrooms || undefined,
    parking: parking || undefined,
    area: area || undefined,
    sale_price: sale_price || undefined,
    rent_price: rent_price || undefined,
    condo_fee: condo_fee || undefined,
    iptu: iptu || undefined,
    description: description || undefined,
    in_condominium,
    condominium_name: condoName || undefined,
    lazer: lazer || undefined,
    infraestrutura: infraestrutura || undefined,
    comentario_interno: comentario_interno || undefined,
  }

  const proprietario: FichaProprietarioParsed = {
    name: propName || undefined,
    cpf: propCpf || undefined,
    rg: propRg || undefined,
    email: propEmail || undefined,
    phone: propPhone || undefined,
    phone2: propPhone2 || undefined,
    person_type: 'pf',
  }

  const nao_importado: FichaNaoImportado = {
    garantia: garantia || 'Não informado na ficha',
    fgts: fgts || 'Não informado na ficha',
    permuta: permuta || 'Não informado na ficha',
    financiamento: financiamento || 'Não informado na ficha',
    posicao: posicao || 'Não informado na ficha',
    pacote: pacote || 'Não informado na ficha',
    local_da_chave: local_da_chave || 'Não informado na ficha',
  }

  return {
    ok: true,
    imovel,
    proprietario,
    nao_importado,
  }
}
