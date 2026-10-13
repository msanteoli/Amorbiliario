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
  ])

  // Finalidade
  let purpose: 'venda' | 'locacao' | 'ambos' = 'venda'
  const rawFinalidade = findPattern([
    /(?:Finalidade|Negócio|Negocio|Operação|Operacao)[\s:]+([^\n\r,]+)/i,
  ]).toLowerCase()
  if (
    rawFinalidade.includes('ambos') ||
    (rawFinalidade.includes('venda') && rawFinalidade.includes('loca'))
  ) {
    purpose = 'ambos'
  } else if (rawFinalidade.includes('loca')) {
    purpose = 'locacao'
  } else {
    purpose = 'venda'
  }

  // Tipo de construção
  const rawTipo = findPattern([
    /(?:Tipo de imóvel|Tipo do imóvel|Tipo de construção|Tipo)[\s:]+([^\n\r,]+)/i,
  ]).toLowerCase()
  let property_type = 'apartamento'
  if (rawTipo.includes('casa')) property_type = 'casa'
  else if (rawTipo.includes('apart')) property_type = 'apartamento'
  else if (rawTipo.includes('terr') || rawTipo.includes('lote')) property_type = 'terreno'
  else if (rawTipo.includes('comerc') || rawTipo.includes('sala') || rawTipo.includes('loja'))
    property_type = 'comercial'
  else if (rawTipo.includes('galp')) property_type = 'galpao'
  else if (rawTipo.includes('chac') || rawTipo.includes('sitio')) property_type = 'chacara'
  else if (rawTipo) property_type = 'outro'

  // Uso
  const rawUso = findPattern([/(?:Uso do imóvel|Uso|Destinação)[\s:]+([^\n\r,]+)/i]).toLowerCase()
  let use_type = 'residencial'
  if (rawUso.includes('comerc')) use_type = 'comercial'
  else if (rawUso.includes('indus')) use_type = 'industrial'
  else if (rawUso.includes('rural')) use_type = 'rural'

  // Endereço do imóvel
  const street = findPattern([
    /(?:Endereço|Endereco|Logradouro|Rua|Av\.?|Avenida)[\s:]+([^\n\r,]+)/i,
    /Logradouro[\s:]+([^\n\r]+)/i,
  ])
  const street_number = findPattern([/(?:Número|Numero|Nº|N°)[\s:]+([A-Za-z0-9_-]+)/i]) || 'S/N'
  const complement = findPattern([/(?:Complemento|Compl\.?)[\s:]+([^\n\r]+)/i])
  const neighborhood = findPattern([/(?:Bairro)[\s:]+([^\n\r,]+)/i])
  const city = findPattern([/(?:Cidade|Município|Municipio)[\s:]+([^\n\r,]+)/i])
  const state = (findPattern([/(?:Estado|UF)[\s:]+([A-Za-z]{2})/i]) || 'BA').toUpperCase()
  const zip_code = findPattern([/(?:CEP)[\s:]+([\d.-]+)/i]).replace(/\D/g, '')

  // Características
  const bedrooms = parseIntClean(
    findPattern([
      /(?:Dormitórios|Dormitorios|Quartos|Qts)[\s:]+(\d+)/i,
      /(\d+)\s*(?:dormitórios|quartos|dormitório|quarto)/i,
    ]),
  )
  const bathrooms = parseIntClean(
    findPattern([/(?:Banheiros|Banhos|WCs)[\s:]+(\d+)/i, /(\d+)\s*(?:banheiros|banheiro)/i]),
  )
  const parking = parseIntClean(
    findPattern([/(?:Vagas|Garagem)[\s:]+(\d+)/i, /(\d+)\s*(?:vagas|vaga|garagens)/i]),
  )
  const area = parseNumber(
    findPattern([
      /(?:Área útil|Area util|Área total|Area total|Área privativa|Area privativa|Área|Area)[\s:]+([\d.,]+)/i,
      /([\d.,]+)\s*(?:m²|m2)/i,
    ]),
  )

  // Valores
  const sale_price = parseNumber(
    findPattern([/(?:Valor de venda|Preço de venda|R\$ Venda|Venda)[\s:]+R?\$?\s*([\d.,]+)/i]),
  )
  const rent_price = parseNumber(
    findPattern([
      /(?:Valor de locação|Preço de locação|R\$ Locação|Locação|Aluguel)[\s:]+R?\$?\s*([\d.,]+)/i,
    ]),
  )
  const condo_fee = parseNumber(
    findPattern([/(?:Condomínio|Condominio|R\$ Cond\.?)[\s:]+R?\$?\s*([\d.,]+)/i]),
  )
  const iptu = parseNumber(findPattern([/(?:IPTU|R\$ IPTU)[\s:]+R?\$?\s*([\d.,]+)/i]))

  // Condomínio
  const condoName = findPattern([
    /(?:Condomínio|Condominio|Edifício|Edificio|Edf\.?|Empreendimento)[\s:]+([^\n\r]+)/i,
  ])
  const in_condominium = Boolean(
    condoName && condoName.toLowerCase() !== 'não' && condoName.toLowerCase() !== 'nao',
  )

  // Textos para compor a descrição
  const lazer = findPattern([/(?:Lazer|Área de lazer|Itens de lazer)[\s:]+([^\n\r]+)/i])
  const infraestrutura = findPattern([/(?:Infraestrutura|Estrutura)[\s:]+([^\n\r]+)/i])
  const comentario_interno = findPattern([
    /(?:Comentário interno|Comentario interno|Observações|Observacoes|Notas)[\s:]+([^\n\r]+)/i,
  ])

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
