import pb from '@/lib/pocketbase/client'
import { ClientResponseError, RecordModel } from 'pocketbase'

export type PropertyPurpose = 'venda' | 'locacao' | 'ambos'

export type PropertyType =
  | 'casa'
  | 'apartamento'
  | 'terreno'
  | 'comercial'
  | 'galpao'
  | 'chacara'
  | 'outro'

export type PropertyStatus =
  | 'rascunho'
  | 'disponivel'
  | 'reservado'
  | 'vendido'
  | 'alugado'
  | 'inativo'

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  casa: 'Casa',
  apartamento: 'Apartamento',
  terreno: 'Terreno',
  comercial: 'Sala ou loja comercial',
  galpao: 'Galpão',
  chacara: 'Chácara ou sítio',
  outro: 'Outro',
}

export const PROPERTY_PURPOSE_LABELS: Record<PropertyPurpose, string> = {
  venda: 'Venda',
  locacao: 'Locação',
  ambos: 'Venda ou locação',
}

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  rascunho: 'Rascunho',
  disponivel: 'Disponível',
  reservado: 'Reservado',
  vendido: 'Vendido',
  alugado: 'Alugado',
  inativo: 'Inativo',
}

export interface PropertyPhotoRecord extends RecordModel {
  organization_id: string
  property_id: string
  file: string
  is_active: boolean
}

export interface PropertyUserRecord {
  id: string
  name?: string
  email?: string
  role?: string
}

export interface PropertyRecord extends RecordModel {
  organization_id: string
  code: string
  title: string
  purpose: PropertyPurpose
  property_type: PropertyType
  status: PropertyStatus
  street?: string
  street_number?: string
  complement?: string
  neighborhood?: string
  city?: string
  bedrooms?: number
  bathrooms?: number
  parking?: number
  area?: number
  sale_price?: number
  rent_price?: number
  price_on_request?: boolean
  condo_fee?: number
  iptu?: number
  description?: string
  owner_id?: string
  captured_by: string
  last_reviewed_at?: string
  expand?: {
    captured_by?: PropertyUserRecord
    property_photos_via_property_id?: PropertyPhotoRecord[]
  }
}

export interface ListPropertiesParams {
  page?: number
  perPage?: number
  search?: string
  propertyType?: PropertyType | ''
  purpose?: PropertyPurpose | ''
  status?: PropertyStatus | ''
  minBedrooms?: number | ''
  minPrice?: number | ''
  maxPrice?: number | ''
  pendingReviewOnly?: boolean
  sort?: string
}

/**
 * Traduz mensagens de erro do backend para português amigável
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof ClientResponseError) {
    const data = error.response?.data
    if (data && typeof data === 'object') {
      const msgs: string[] = []
      for (const [field, detail] of Object.entries(data)) {
        if (
          detail &&
          typeof detail === 'object' &&
          'message' in detail &&
          typeof (detail as { message: unknown }).message === 'string'
        ) {
          const rawMsg = (detail as { message: string }).message
          msgs.push(translateFieldMessage(field, rawMsg))
        }
      }
      if (msgs.length > 0) {
        return msgs.join(' ')
      }
    }
    if (error.message) {
      return translateGenericMessage(error.message)
    }
  }
  if (error instanceof Error) {
    return translateGenericMessage(error.message)
  }
  return 'Ocorreu um erro inesperado.'
}

function translateFieldMessage(field: string, msg: string): string {
  if (msg.includes('Informe o código do imóvel')) return msg
  if (msg.includes('Captador inválido')) return msg
  if (msg.includes('Proprietário inválido')) return msg
  if (msg.includes('Valor zero não é válido')) return msg

  switch (field) {
    case 'code':
      return 'Código do imóvel inválido.'
    case 'title':
      return 'Título inválido ou incompleto.'
    case 'property_type':
      return 'Tipo de imóvel inválido.'
    case 'purpose':
      return 'Finalidade inválida.'
    case 'status':
      return 'Situação inválida.'
    case 'captured_by':
      return 'Captador inválido.'
    case 'owner_id':
      return 'Proprietário inválido.'
    case 'sale_price':
      return 'Preço de venda inválido.'
    case 'rent_price':
      return 'Preço de locação inválido.'
    default:
      return msg || 'Campo inválido.'
  }
}

function translateGenericMessage(msg: string): string {
  if (msg.includes('Papel sem acesso a estes dados.')) return 'Papel sem acesso a estes dados.'
  if (msg.includes('Conta inativa. Fale com o administrador.'))
    return 'Conta inativa. Fale com o administrador.'
  if (msg.includes('Autenticação necessária.')) return 'Autenticação necessária.'
  if (msg.includes('Informe o código do imóvel.')) return 'Informe o código do imóvel.'
  if (msg.includes('Captador inválido.')) return 'Captador inválido.'
  if (msg.includes('Proprietário inválido.')) return 'Proprietário inválido.'
  if (msg.includes('Valor zero não é válido. Deixe em branco quando não informado.')) {
    return 'Valor zero não é válido. Deixe em branco quando não informado.'
  }
  if (msg.includes('Imóvel não encontrado.')) return 'Imóvel não encontrado.'
  if (msg.includes('Failed to create record') || msg.includes('Failed to update record')) {
    return 'Não foi possível salvar os dados do imóvel. Verifique as informações fornecidas.'
  }
  return msg
}

/**
 * Retorna true se o imóvel está desatualizado (pendente de revisão):
 * está em status 'rascunho', 'disponivel' ou 'reservado' e
 * last_reviewed_at é nulo ou anterior a hoje menos 7 dias.
 */
export function isPropertyPendingReview(property: PropertyRecord, now: Date = new Date()): boolean {
  const eligibleStatuses: PropertyStatus[] = ['rascunho', 'disponivel', 'reservado']
  if (!eligibleStatuses.includes(property.status)) {
    return false
  }

  if (!property.last_reviewed_at) {
    return true
  }

  const reviewDate = new Date(property.last_reviewed_at)
  if (Number.isNaN(reviewDate.getTime())) {
    return true
  }

  // 7 dias atrás
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  return reviewDate < sevenDaysAgo
}

/**
 * Formata valor em dinheiro brasileiro (R$ 1.250,00)
 */
export function formatCurrencyBRL(value?: number): string {
  if (value === undefined || value === null || Number.isNaN(value) || value <= 0) {
    return 'Não informado'
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

/**
 * Retorna o texto formatado dos preços do imóvel considerando:
 * - price_on_request -> "Consulte"
 * - sale_price e rent_price -> se ambos existirem e > 0, mostra venda e locação
 * - se nenhum valor informado ou 0 -> "Não informado"
 */
export function formatPropertyPrice(property: {
  price_on_request?: boolean
  sale_price?: number
  rent_price?: number
}): string {
  if (property.price_on_request) {
    return 'Consulte'
  }

  const sale = Number(property.sale_price) || 0
  const rent = Number(property.rent_price) || 0

  if (sale <= 0 && rent <= 0) {
    return 'Não informado'
  }

  const parts: string[] = []
  if (sale > 0) {
    parts.push(`Venda: ${formatCurrencyBRL(sale)}`)
  }
  if (rent > 0) {
    parts.push(`Locação: ${formatCurrencyBRL(rent)}/mês`)
  }

  return parts.join(' | ')
}

/**
 * Obtém a primeira foto ativa do imóvel a partir do expand do PocketBase
 */
export function getFirstActivePhoto(property: PropertyRecord): PropertyPhotoRecord | null {
  const photos = property.expand?.property_photos_via_property_id
  if (!Array.isArray(photos) || photos.length === 0) {
    return null
  }
  const activePhotos = photos.filter((p) => p.is_active)
  return activePhotos[0] || null
}

/**
 * Monta URL completa do arquivo no PocketBase
 */
export function getPhotoFileUrl(photo: PropertyPhotoRecord, thumb?: string): string {
  return pb.files.getURL(photo, photo.file, { thumb })
}

/**
 * Lista imóveis com paginação, busca e filtros
 */
export async function listProperties(params: ListPropertiesParams = {}) {
  const {
    page = 1,
    perPage = 10,
    search,
    propertyType,
    purpose,
    status,
    minBedrooms,
    minPrice,
    maxPrice,
    pendingReviewOnly,
    sort = '-created',
  } = params

  const filterParts: string[] = []

  // Busca textual por código, título ou bairro
  if (search && search.trim()) {
    const term = search.trim().replace(/['"\\]/g, '')
    filterParts.push(`(code ~ "${term}" || title ~ "${term}" || neighborhood ~ "${term}")`)
  }

  // Tipo de imóvel
  if (propertyType) {
    filterParts.push(`property_type = "${propertyType}"`)
  }

  // Finalidade
  if (purpose) {
    filterParts.push(`purpose = "${purpose}"`)
  }

  // Situação (status)
  if (status) {
    filterParts.push(`status = "${status}"`)
  }

  // Quartos (mínimo)
  if (typeof minBedrooms === 'number' && minBedrooms > 0) {
    filterParts.push(`bedrooms >= ${minBedrooms}`)
  }

  // Faixa de preço (mínimo e máximo aplicada a venda ou locação)
  // "um imóvel aparece se algum dos dois preços cair na faixa"
  // Valores zero no banco significam "não informado", então preços válidos devem ser > 0
  const hasMin = typeof minPrice === 'number' && minPrice > 0
  const hasMax = typeof maxPrice === 'number' && maxPrice > 0

  if (hasMin && hasMax) {
    filterParts.push(
      `((sale_price >= ${minPrice} && sale_price <= ${maxPrice}) || (rent_price >= ${minPrice} && rent_price <= ${maxPrice}))`,
    )
  } else if (hasMin) {
    filterParts.push(`(sale_price >= ${minPrice} || rent_price >= ${minPrice})`)
  } else if (hasMax) {
    filterParts.push(
      `((sale_price > 0 && sale_price <= ${maxPrice}) || (rent_price > 0 && rent_price <= ${maxPrice}))`,
    )
  }

  // Aba "Pendentes de revisão": status em (rascunho, disponivel, reservado) e last_reviewed_at < hoje menos 7 dias
  if (pendingReviewOnly) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    // Formato PocketBase para data: 'YYYY-MM-DD HH:mm:ss.SSSZ' ou ISO
    const thresholdIso = sevenDaysAgo.toISOString().replace('T', ' ')
    filterParts.push(`(status = "rascunho" || status = "disponivel" || status = "reservado")`)
    filterParts.push(
      `(last_reviewed_at = null || last_reviewed_at = "" || last_reviewed_at < "${thresholdIso}")`,
    )
  }

  const filter = filterParts.join(' && ')

  return await pb.collection('properties').getList<PropertyRecord>(page, perPage, {
    filter: filter || undefined,
    sort,
    expand: 'property_photos_via_property_id,captured_by',
  })
}

/**
 * Obtém os detalhes de um imóvel por ID
 */
export async function getPropertyById(id: string): Promise<PropertyRecord> {
  return await pb.collection('properties').getOne<PropertyRecord>(id, {
    expand: 'property_photos_via_property_id,captured_by',
  })
}
