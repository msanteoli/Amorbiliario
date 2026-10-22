import pb from '@/lib/pocketbase/client'
import { ClientResponseError, RecordModel } from 'pocketbase'

export type PropertyPurpose = 'venda' | 'locacao' | 'ambos'

export type PropertyUseType = 'residencial' | 'comercial' | 'rural' | 'temporada'

export type PropertySource = 'manual' | 'importacao'

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

export const PROPERTY_USE_TYPE_LABELS: Record<PropertyUseType, string> = {
  residencial: 'Residencial',
  comercial: 'Comercial',
  rural: 'Rural',
  temporada: 'Temporada',
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
  is_starred?: boolean
  auto_archived?: boolean
  position?: number
  created?: string
  updated?: string
}

export interface PropertyUserRecord {
  id: string
  name?: string
  email?: string
  role?: string
}

export interface PropertyOwnerRecord {
  id: string
  name: string
  phone?: string
  email?: string
  kind?: string[]
}

export interface PropertyHistoryItem {
  action: string
  field?: string
  reason?: string
  occurred_at: string
  actor: string
}

export interface PropertyCondominiumRecord extends RecordModel {
  name: string
  amenities?: string
  infrastructure?: string
  rules?: string
  street?: string
  neighborhood?: string
  city?: string
  cover_photo_id?: string
  expand?: {
    condominium_photos_via_condominium_id?: {
      id: string
      file: string
      is_active: boolean
      position?: number
      created?: string
    }[]
  }
}

export type PublishDestination = 'site' | 'chaves_na_mao' | 'zap' | 'vivareal' | 'olx'

export interface PropertyRecord extends RecordModel {
  organization_id: string
  code: string
  title: string
  purpose: PropertyPurpose
  property_type: PropertyType
  use_type?: PropertyUseType
  in_condominium?: boolean
  condominium_id?: string
  source?: PropertySource
  import_batch_id?: string
  status: PropertyStatus
  cover_photo_id?: string
  highlight_level?: string
  highlight_until?: string
  street?: string
  street_number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  zip_code?: string
  publish_to?: string[]
  bedrooms?: number
  suites?: number
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
    owner_id?: PropertyOwnerRecord
    condominium_id?: PropertyCondominiumRecord
    property_photos_via_property_id?: PropertyPhotoRecord[]
  }
}

export interface CreatePropertyInput {
  code: string
  title: string
  purpose: PropertyPurpose
  property_type: PropertyType
  use_type?: PropertyUseType
  in_condominium?: boolean
  condominium_id?: string
  street?: string
  street_number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  zip_code?: string
  publish_to?: string[]
  bedrooms?: number
  suites?: number
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
  highlight_level?: 'comum' | 'destaque' | 'super_destaque'
  highlight_until?: string
}

export interface UpdatePropertyInput {
  code?: string
  title?: string
  purpose?: PropertyPurpose
  property_type?: PropertyType
  use_type?: PropertyUseType
  in_condominium?: boolean
  condominium_id?: string
  status?: PropertyStatus
  street?: string
  street_number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  zip_code?: string
  publish_to?: string[]
  bedrooms?: number
  suites?: number
  bathrooms?: number
  parking?: number
  area?: number
  sale_price?: number | null
  rent_price?: number | null
  price_on_request?: boolean
  condo_fee?: number | null
  iptu?: number | null
  description?: string
  owner_id?: string
  captured_by?: string
  highlight_level?: 'comum' | 'destaque' | 'super_destaque'
  highlight_until?: string
}

/**
 * 27 Estados brasileiros (UF) com nome e sigla
 */
export const BRAZIL_STATES = [
  { uf: 'AC', name: 'Acre' },
  { uf: 'AL', name: 'Alagoas' },
  { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' },
  { uf: 'BA', name: 'Bahia' },
  { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' },
  { uf: 'ES', name: 'Espírito Santo' },
  { uf: 'GO', name: 'Goiás' },
  { uf: 'MA', name: 'Maranhão' },
  { uf: 'MT', name: 'Mato Grosso' },
  { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' },
  { uf: 'PA', name: 'Pará' },
  { uf: 'PB', name: 'Paraíba' },
  { uf: 'PR', name: 'Paraná' },
  { uf: 'PE', name: 'Pernambuco' },
  { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' },
  { uf: 'RN', name: 'Rio Grande do Norte' },
  { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondônia' },
  { uf: 'RR', name: 'Roraima' },
  { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SP', name: 'São Paulo' },
  { uf: 'SE', name: 'Sergipe' },
  { uf: 'TO', name: 'Tocantins' },
] as const

/**
 * Avalia se uma foto é PNG pelo nome do arquivo
 */
export function isPngPhoto(fileNameOrUrl?: string): boolean {
  if (!fileNameOrUrl) return false
  const clean = fileNameOrUrl.split('?')[0].toLowerCase()
  return clean.endsWith('.png')
}

/**
 * Avalia se uma foto é aceita pelo portal (JPEG ou WebP)
 */
export function isPortalEligiblePhoto(fileNameOrUrl?: string): boolean {
  if (!fileNameOrUrl) return false
  const clean = fileNameOrUrl.split('?')[0].toLowerCase()
  return /\.(jpg|jpeg|webp)$/.test(clean)
}

/**
 * Calcula os motivos pelos quais o imóvel não está pronto para o portal Chaves na Mão.
 * Regra calculada NA PRÓPRIA TELA:
 * - Se não for Disponível: "Só imóveis Disponíveis saem no portal"
 * - tipo Outro → "Tipo Outro não é aceito pelo portal"
 * - preço da finalidade em branco ou zero, ou "preço sob consulta" → "Informe o preço"
 * - sem bairro → "Informe o bairro"; sem cidade → "Informe a cidade"; sem UF → "Informe a UF"
 * - CEP sem 8 dígitos → "Informe o CEP"
 * - sem descrição → "Informe a descrição"
 * - nenhuma foto JPEG ou WebP → "Envie ao menos uma foto JPEG ou WebP"
 */
export function getPortalPendingReasons(params: {
  status?: string
  property_type?: string
  purpose?: string
  sale_price?: number | string | null
  rent_price?: number | string | null
  price_on_request?: boolean
  neighborhood?: string
  city?: string
  state?: string
  zip_code?: string
  description?: string
  photos?: Array<{ file: string; is_active?: boolean }>
}): string[] {
  const {
    status,
    property_type,
    purpose,
    sale_price,
    rent_price,
    price_on_request,
    neighborhood,
    city,
    state,
    zip_code,
    description,
    photos = [],
  } = params

  if (status !== 'disponivel') {
    return ['Só imóveis Disponíveis saem no portal']
  }

  const reasons: string[] = []

  // tipo Outro → "Tipo Outro não é aceito pelo portal"
  const acceptedTypes = ['casa', 'apartamento', 'terreno', 'chacara', 'comercial', 'galpao']
  if (!property_type || !acceptedTypes.includes(property_type)) {
    reasons.push('Tipo Outro não é aceito pelo portal')
  }

  // preço da finalidade em branco ou zero, ou "preço sob consulta" → "Informe o preço"
  const numSale =
    typeof sale_price === 'number'
      ? sale_price
      : Number(String(sale_price || '').replace(/\D/g, '')) / 100
  const numRent =
    typeof rent_price === 'number'
      ? rent_price
      : Number(String(rent_price || '').replace(/\D/g, '')) / 100

  const hasSale = !isNaN(numSale) && numSale > 0
  const hasRent = !isNaN(numRent) && numRent > 0

  if (
    price_on_request ||
    (purpose === 'venda' && !hasSale) ||
    (purpose === 'locacao' && !hasRent) ||
    (purpose === 'ambos' && (!hasSale || !hasRent)) ||
    (purpose !== 'venda' && purpose !== 'locacao' && purpose !== 'ambos')
  ) {
    reasons.push('Informe o preço')
  }

  // sem bairro → "Informe o bairro"
  if (!neighborhood || !neighborhood.trim()) {
    reasons.push('Informe o bairro')
  }

  // sem cidade → "Informe a cidade"
  if (!city || !city.trim()) {
    reasons.push('Informe a cidade')
  }

  // sem UF → "Informe a UF"
  if (!state || !state.trim()) {
    reasons.push('Informe a UF')
  }

  // CEP sem 8 dígitos → "Informe o CEP"
  const zipDigits = (zip_code || '').replace(/\D/g, '')
  if (zipDigits.length !== 8) {
    reasons.push('Informe o CEP')
  }

  // sem descrição → "Informe a descrição"
  if (!description || !description.trim()) {
    reasons.push('Informe a descrição')
  }

  // nenhuma foto JPEG ou WebP → "Envie ao menos uma foto JPEG ou WebP"
  const validPhotos = photos.filter((p) => {
    if (p.is_active === false) return false
    return isPortalEligiblePhoto(p.file)
  })
  if (validPhotos.length === 0) {
    reasons.push('Envie ao menos uma foto JPEG ou WebP')
  }

  return reasons
}

export interface ListPropertiesParams {
  page?: number
  perPage?: number
  search?: string
  propertyType?: PropertyType | ''
  purpose?: PropertyPurpose | ''
  status?: PropertyStatus | ''
  minBedrooms?: number | ''
  minParking?: number | ''
  capturedBy?: string | ''
  minPrice?: number | ''
  maxPrice?: number | ''
  pendingReviewOnly?: boolean
  importBatchId?: string
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
  if (msg.includes('Imóvel incompleto')) return msg
  if (
    msg.toLowerCase().includes('unique') ||
    msg.toLowerCase().includes('already exists') ||
    msg.includes('idx_properties_org_code')
  ) {
    return 'Já existe um imóvel com este código.'
  }

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
    case 'zip_code':
      return 'CEP inválido. Use 8 dígitos (00000-000).'
    case 'state':
      return 'UF inválida. Use a sigla de duas letras (ex.: BA).'
    case 'publish_to':
      return 'Opção de anúncio inválida.'
    case 'file':
      return msg || 'Arquivo inválido. Envie apenas JPEG ou WebP de até 3 MB.'
    default:
      return msg || 'Campo inválido.'
  }
}

function translateGenericMessage(msg: string): string {
  if (msg.includes('Imóvel incompleto')) return msg
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
  if (
    msg.toLowerCase().includes('unique') ||
    msg.toLowerCase().includes('already exists') ||
    msg.includes('idx_properties_org_code')
  ) {
    return 'Já existe um imóvel com este código.'
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
 * Ordena fotos por position crescente, depois created
 */
export function sortPropertyPhotos(photos: PropertyPhotoRecord[]): PropertyPhotoRecord[] {
  return [...photos].sort((a, b) => {
    const posA =
      typeof a.position === 'number' && a.position > 0 ? a.position : Number.MAX_SAFE_INTEGER
    const posB =
      typeof b.position === 'number' && b.position > 0 ? b.position : Number.MAX_SAFE_INTEGER
    if (posA !== posB) return posA - posB
    const dateA = a.created ? new Date(a.created).getTime() : 0
    const dateB = b.created ? new Date(b.created).getTime() : 0
    return dateA - dateB
  })
}

/**
 * Obtém a capa efetiva do imóvel:
 * Entre as fotos ativas, é a de cover_photo_id se ela existir e estiver ativa;
 * senão é a primeira por position, depois created.
 */
export function getEffectiveCoverPhoto(property: PropertyRecord): PropertyPhotoRecord | null {
  const rawPhotos = property.expand?.property_photos_via_property_id
  if (!Array.isArray(rawPhotos) || rawPhotos.length === 0) {
    return null
  }
  const activePhotos = rawPhotos.filter((p) => p.is_active !== false)
  if (activePhotos.length === 0) {
    return null
  }
  const sorted = sortPropertyPhotos(activePhotos)
  if (property.cover_photo_id) {
    const cover = sorted.find((p) => p.id === property.cover_photo_id)
    if (cover) return cover
  }
  return sorted[0] || null
}

/**
 * Mantido por compatibilidade: retorna a capa efetiva do imóvel
 */
export function getFirstActivePhoto(property: PropertyRecord): PropertyPhotoRecord | null {
  return getEffectiveCoverPhoto(property)
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
    minParking,
    capturedBy,
    minPrice,
    maxPrice,
    pendingReviewOnly,
    importBatchId,
    sort = '-created',
  } = params

  const filterParts: string[] = []

  // Filtro por lote de importação
  if (importBatchId) {
    filterParts.push(`import_batch_id = "${importBatchId.replace(/['"\\]/g, '')}"`)
  }

  // Busca textual por: código, título, rua, número, bairro, cidade e CEP
  if (search && search.trim()) {
    const term = search.trim().replace(/['"\\]/g, '')
    const digits = term.replace(/\D/g, '')
    const searchConditions: string[] = [
      `code ~ "${term}"`,
      `title ~ "${term}"`,
      `street ~ "${term}"`,
      `street_number ~ "${term}"`,
      `neighborhood ~ "${term}"`,
      `city ~ "${term}"`,
      `zip_code ~ "${term}"`,
    ]
    if (digits && digits !== term) {
      searchConditions.push(`zip_code ~ "${digits}"`)
    }
    filterParts.push(`(${searchConditions.join(' || ')})`)
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

  // Vagas (mínimo)
  if (typeof minParking === 'number' && minParking > 0) {
    filterParts.push(`parking >= ${minParking}`)
  }

  // Captador (captured_by)
  if (capturedBy && capturedBy.trim()) {
    filterParts.push(`captured_by = "${capturedBy.trim().replace(/['"\\]/g, '')}"`)
  }

  // Faixa de preço (mínimo e máximo):
  // Regra de filtro: se a finalidade for Venda, filtra pelo preço de venda;
  // se for Locação, pelo preço de locação;
  // se for Todas, o imóvel entra quando um dos dois preços estiver na faixa.
  // Valores zero no banco significam "não informado", então preços válidos devem ser > 0.
  const hasMin = typeof minPrice === 'number' && minPrice > 0
  const hasMax = typeof maxPrice === 'number' && maxPrice > 0

  if (hasMin || hasMax) {
    if (purpose === 'venda') {
      if (hasMin && hasMax) {
        filterParts.push(`(sale_price >= ${minPrice} && sale_price <= ${maxPrice})`)
      } else if (hasMin) {
        filterParts.push(`sale_price >= ${minPrice}`)
      } else if (hasMax) {
        filterParts.push(`(sale_price > 0 && sale_price <= ${maxPrice})`)
      }
    } else if (purpose === 'locacao') {
      if (hasMin && hasMax) {
        filterParts.push(`(rent_price >= ${minPrice} && rent_price <= ${maxPrice})`)
      } else if (hasMin) {
        filterParts.push(`rent_price >= ${minPrice}`)
      } else if (hasMax) {
        filterParts.push(`(rent_price > 0 && rent_price <= ${maxPrice})`)
      }
    } else {
      // Finalidade 'Todas' (ou não informada): um dos dois preços na faixa
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
    }
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
    filter: filterParts.join(' && '),
    sort,
    expand:
      'property_photos_via_property_id,captured_by,owner_id,condominium_id.condominium_photos_via_condominium_id',
  })
}

/**
 * Obtém os detalhes de um imóvel por ID
 */
export async function getPropertyById(id: string): Promise<PropertyRecord> {
  return await pb.collection('properties').getOne<PropertyRecord>(id, {
    expand:
      'property_photos_via_property_id,captured_by,owner_id,condominium_id.condominium_photos_via_condominium_id',
  })
}

/**
 * Cria um novo imóvel na coleção `properties`
 */
export async function createProperty(
  input: CreatePropertyInput,
  currentUser: { organization_id?: string },
): Promise<PropertyRecord> {
  const orgId = currentUser.organization_id
  if (!orgId) {
    throw new Error('Organização do usuário não identificada.')
  }

  const payload: Record<string, unknown> = {
    organization_id: orgId,
    code: input.code.trim(),
    title: input.title.trim(),
    purpose: input.purpose,
    property_type: input.property_type,
    captured_by: input.captured_by,
  }

  if (input.use_type) payload.use_type = input.use_type
  payload.in_condominium = Boolean(input.in_condominium)
  if (input.in_condominium && input.condominium_id) {
    payload.condominium_id = input.condominium_id
  }

  if (input.street?.trim()) payload.street = input.street.trim()
  if (input.street_number?.trim()) payload.street_number = input.street_number.trim()
  if (input.complement?.trim()) payload.complement = input.complement.trim()
  if (input.neighborhood?.trim()) payload.neighborhood = input.neighborhood.trim()
  if (input.city?.trim()) payload.city = input.city.trim()
  if (input.state !== undefined) payload.state = input.state.trim()
  if (input.zip_code !== undefined) payload.zip_code = input.zip_code.trim()
  if (Array.isArray(input.publish_to)) payload.publish_to = input.publish_to
  if (typeof input.bedrooms === 'number' && input.bedrooms > 0) payload.bedrooms = input.bedrooms
  if (typeof input.suites === 'number' && input.suites >= 0) payload.suites = input.suites
  if (typeof input.bathrooms === 'number' && input.bathrooms > 0)
    payload.bathrooms = input.bathrooms
  if (typeof input.parking === 'number' && input.parking > 0) payload.parking = input.parking
  if (typeof input.area === 'number' && input.area > 0) payload.area = input.area

  if (input.price_on_request) {
    payload.price_on_request = true
  } else {
    payload.price_on_request = false
  }

  if (typeof input.sale_price === 'number' && input.sale_price > 0)
    payload.sale_price = input.sale_price
  if (typeof input.rent_price === 'number' && input.rent_price > 0)
    payload.rent_price = input.rent_price
  if (typeof input.condo_fee === 'number' && input.condo_fee > 0)
    payload.condo_fee = input.condo_fee
  if (typeof input.iptu === 'number' && input.iptu > 0) payload.iptu = input.iptu

  if (input.description?.trim()) payload.description = input.description.trim()
  if (input.owner_id?.trim()) payload.owner_id = input.owner_id.trim()
  if (input.highlight_level && input.highlight_level !== 'comum') {
    payload.highlight_level = input.highlight_level
    if (input.highlight_level !== 'super_destaque' && input.highlight_until) {
      payload.highlight_until = input.highlight_until
    }
  }

  return await pb.collection('properties').create<PropertyRecord>(payload, {
    expand: 'captured_by,owner_id',
  })
}

/**
 * Atualiza um imóvel na coleção `properties`
 */
export async function updateProperty(
  id: string,
  input: UpdatePropertyInput,
): Promise<PropertyRecord> {
  const payload: Record<string, unknown> = {}

  if (input.code !== undefined) payload.code = input.code.trim()
  if (input.title !== undefined) payload.title = input.title.trim()
  if (input.purpose !== undefined) payload.purpose = input.purpose
  if (input.property_type !== undefined) payload.property_type = input.property_type
  if (input.use_type !== undefined) payload.use_type = input.use_type
  if (input.in_condominium !== undefined) payload.in_condominium = input.in_condominium
  if (input.condominium_id !== undefined) payload.condominium_id = input.condominium_id
  if (input.status !== undefined) payload.status = input.status

  if (input.street !== undefined) payload.street = input.street.trim()
  if (input.street_number !== undefined) payload.street_number = input.street_number.trim()
  if (input.complement !== undefined) payload.complement = input.complement.trim()
  if (input.neighborhood !== undefined) payload.neighborhood = input.neighborhood.trim()
  if (input.city !== undefined) payload.city = input.city.trim()
  if (input.state !== undefined) payload.state = input.state.trim()
  if (input.zip_code !== undefined) payload.zip_code = input.zip_code.trim()
  if (input.publish_to !== undefined) payload.publish_to = input.publish_to

  if (input.bedrooms !== undefined) payload.bedrooms = input.bedrooms > 0 ? input.bedrooms : 0
  if (input.suites !== undefined) payload.suites = input.suites > 0 ? input.suites : 0
  if (input.bathrooms !== undefined) payload.bathrooms = input.bathrooms > 0 ? input.bathrooms : 0
  if (input.parking !== undefined) payload.parking = input.parking > 0 ? input.parking : 0
  if (input.area !== undefined) payload.area = input.area > 0 ? input.area : 0

  if (input.price_on_request !== undefined) {
    payload.price_on_request = Boolean(input.price_on_request)
  }

  if (input.sale_price !== undefined) {
    payload.sale_price = input.sale_price !== null && input.sale_price > 0 ? input.sale_price : null
  }
  if (input.rent_price !== undefined) {
    payload.rent_price = input.rent_price !== null && input.rent_price > 0 ? input.rent_price : null
  }
  if (input.condo_fee !== undefined) {
    payload.condo_fee = input.condo_fee !== null && input.condo_fee > 0 ? input.condo_fee : null
  }
  if (input.iptu !== undefined) {
    payload.iptu = input.iptu !== null && input.iptu > 0 ? input.iptu : null
  }

  if (input.description !== undefined) payload.description = input.description.trim()
  if (input.owner_id !== undefined) payload.owner_id = input.owner_id.trim()
  if (input.captured_by !== undefined) payload.captured_by = input.captured_by
  if (input.highlight_level !== undefined) payload.highlight_level = input.highlight_level
  if (input.highlight_until !== undefined) payload.highlight_until = input.highlight_until

  return await pb.collection('properties').update<PropertyRecord>(id, payload, {
    expand: 'captured_by,owner_id',
  })
}

/**
 * Lista as fotos ativas de um imóvel ordenadas por criação
 */
export async function listPropertyPhotos(propertyId: string): Promise<PropertyPhotoRecord[]> {
  const records = await pb.collection('property_photos').getFullList<PropertyPhotoRecord>({
    filter: `property_id = "${propertyId}" && is_active = true`,
    sort: 'position,created',
  })
  return sortPropertyPhotos(records)
}

/**
 * Atualiza a ordem das fotos ativas do imóvel
 * PUT /backend/v1/properties/{id}/photos/order com { ordered_ids: string[] }
 */
export async function updatePropertyPhotosOrder(
  propertyId: string,
  orderedIds: string[],
): Promise<{ ok: boolean; ordered_ids: string[] }> {
  try {
    return await pb.send<{ ok: boolean; ordered_ids: string[] }>(
      `/backend/v1/properties/${propertyId}/photos/order`,
      {
        method: 'PUT',
        body: { ordered_ids: orderedIds },
      },
    )
  } catch (err: unknown) {
    const serverMsg = extractServerErrorMessage(err)
    throw new Error(serverMsg)
  }
}

/**
 * Define as fotos com estrela para manter ao sair do super-destaque
 * PUT /backend/v1/properties/{id}/photos/stars com { photo_ids: string[] }
 */
export async function setPropertyPhotoStars(
  propertyId: string,
  photoIds: string[],
): Promise<{ ok: boolean; photo_ids: string[] }> {
  try {
    return await pb.send<{ ok: boolean; photo_ids: string[] }>(
      `/backend/v1/properties/${propertyId}/photos/stars`,
      {
        method: 'PUT',
        body: { photo_ids: photoIds },
      },
    )
  } catch (err: unknown) {
    const serverMsg = extractServerErrorMessage(err)
    throw new Error(serverMsg)
  }
}

/**
 * Verifica se o imóvel está em super-destaque efetivo. Vale pelo nível, em qualquer situação
 * (Rascunho, Disponível, Reservado...); o site só mostra o imóvel quando ele está Disponível.
 */
export function isSuperActive(
  property?: { highlight_level?: string; status?: string } | null,
): boolean {
  if (!property) return false
  return property.highlight_level === 'super_destaque'
}

/**
 * Retorna o limite de fotos ativas do imóvel (100 se super-destaque efetivo, senão 20)
 */
export function photoLimit(
  property?: { highlight_level?: string; status?: string } | null,
): number {
  return isSuperActive(property) ? 100 : 20
}

/**
 * Conta as fotos arquivadas pelo sistema na saída do super-destaque (voltam sozinhas se o imóvel voltar)
 */
export async function countAutoArchivedPhotos(propertyId: string): Promise<number> {
  try {
    const res = await pb.collection('property_photos').getList<PropertyPhotoRecord>(1, 1, {
      filter: `property_id = "${propertyId}" && auto_archived = true && is_active = false`,
      requestKey: null,
    })
    return res.totalItems
  } catch {
    return 0
  }
}

/**
 * Define a capa do imóvel (photoId vazio volta ao padrão)
 * PUT /backend/v1/properties/{id}/cover com { photo_id: string }
 */
export async function setPropertyCoverPhoto(
  propertyId: string,
  photoId: string,
): Promise<{ ok: boolean; cover_photo_id: string }> {
  try {
    return await pb.send<{ ok: boolean; cover_photo_id: string }>(
      `/backend/v1/properties/${propertyId}/cover`,
      {
        method: 'PUT',
        body: { photo_id: photoId },
      },
    )
  } catch (err: unknown) {
    const serverMsg = extractServerErrorMessage(err)
    throw new Error(serverMsg)
  }
}

/**
 * Extrai a mensagem de erro do servidor de respostas pb.send
 */
export function extractServerErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const errObj = error as {
      response?: { message?: string; data?: Record<string, unknown> }
      data?: { message?: string }
      message?: string
    }
    if (errObj.response?.message && typeof errObj.response.message === 'string') {
      return errObj.response.message
    }
    if (errObj.data?.message && typeof errObj.data.message === 'string') {
      return errObj.data.message
    }
    if (errObj.message && typeof errObj.message === 'string') {
      return errObj.message
    }
  }
  return 'Ocorreu um erro ao processar a requisição.'
}

/**
 * Envia uma foto para o imóvel (uma por requisição, multipart)
 */
export async function uploadPropertyPhoto(
  propertyId: string,
  organizationId: string,
  file: File,
): Promise<PropertyPhotoRecord> {
  const formData = new FormData()
  formData.append('property_id', propertyId)
  formData.append('organization_id', organizationId)
  formData.append('file', file)
  formData.append('is_active', 'true')

  return await pb.collection('property_photos').create<PropertyPhotoRecord>(formData)
}

/**
 * Remove (desativa) uma foto do imóvel setando is_active = false
 */
export async function deactivatePropertyPhoto(photoId: string): Promise<PropertyPhotoRecord> {
  return await pb.collection('property_photos').update<PropertyPhotoRecord>(photoId, {
    is_active: false,
  })
}

/**
 * Obtém o histórico de alterações do imóvel
 */
export async function getPropertyHistory(propertyId: string): Promise<PropertyHistoryItem[]> {
  const res = await pb.send<{ items: PropertyHistoryItem[] }>(
    `/backend/v1/properties/${propertyId}/history`,
    {
      method: 'GET',
    },
  )
  return res.items || []
}

/**
 * Confirma os dados do imóvel (/backend/v1/properties/:id/confirm)
 */
export async function confirmPropertyData(
  propertyId: string,
): Promise<{ last_reviewed_at: string }> {
  return await pb.send<{ last_reviewed_at: string }>(
    `/backend/v1/properties/${propertyId}/confirm`,
    {
      method: 'POST',
    },
  )
}

/**
 * Obtém o texto da ficha para envio via WhatsApp (/backend/v1/properties/:id/ficha)
 */
export async function getPropertyFicha(
  propertyId: string,
): Promise<{ code: string; text: string }> {
  return await pb.send<{ code: string; text: string }>(
    `/backend/v1/properties/${propertyId}/ficha`,
    {
      method: 'GET',
    },
  )
}

/**
 * Busca clientes proprietários (kind ~ 'proprietario')
 */
export async function searchOwners(term: string): Promise<PropertyOwnerRecord[]> {
  const filterParts: string[] = ['kind ~ "proprietario"']
  if (term.trim()) {
    const cleanTerm = term.trim().replace(/['"\\]/g, '')
    const digits = term.replace(/\D/g, '').replace(/^0+/, '')
    const searchConditions: string[] = [`name ~ "${cleanTerm}"`]
    if (digits) {
      searchConditions.push(`phone ~ "${digits}"`)
    }
    filterParts.push(`(${searchConditions.join(' || ')})`)
  }

  const res = await pb.collection('clients').getList<RecordModel>(1, 20, {
    filter: filterParts.join(' && '),
    sort: 'name',
  })

  return res.items.map((item) => ({
    id: item.id,
    name: item.name as string,
    phone: (item.phone as string) || '',
    email: (item.email as string) || '',
    kind: (item.kind as string[]) || [],
  }))
}

/**
 * Sugere títulos com IA chamando POST /backend/v1/properties/{id}/suggest-title
 */
export async function suggestPropertyTitles(propertyId: string): Promise<string[]> {
  try {
    const res = await pb.send<{ suggestions: string[] }>(
      `/backend/v1/properties/${propertyId}/suggest-title`,
      {
        method: 'POST',
      },
    )
    return res.suggestions || []
  } catch (err) {
    if (err instanceof ClientResponseError && err.status === 503) {
      throw new Error('A sugestão está indisponível agora.')
    }
    throw err
  }
}

/**
 * Vincula proprietário existente ao imóvel
 */
/**
 * Busca rápida de imóveis por código ou título (até o limite indicado)
 */
export async function searchPropertiesForQuickFind(
  term: string,
  limit = 5,
): Promise<Array<{ id: string; code: string; title: string }>> {
  const cleanTerm = term.trim().replace(/['"\\]/g, '')
  if (!cleanTerm) return []
  const filter = `code ~ "${cleanTerm}" || title ~ "${cleanTerm}"`
  const res = await pb.collection('properties').getList<PropertyRecord>(1, limit, {
    filter,
    sort: '-created',
    fields: 'id,code,title',
    requestKey: null,
  })
  return res.items.map((p) => ({
    id: p.id,
    code: p.code,
    title: p.title,
  }))
}

export async function linkExistingPropertyOwner(
  propertyId: string,
  clientId: string,
): Promise<{ client_id: string }> {
  return await pb.send<{ client_id: string }>(`/backend/v1/properties/${propertyId}/owner`, {
    method: 'POST',
    body: { client_id: clientId },
  })
}

/**
 * Vincula novo proprietário ao imóvel com tratamento de 409
 */
export interface LinkNewOwnerResult {
  client_id?: string
  existing_client_id?: string
  message?: string
}

export async function linkNewPropertyOwner(
  propertyId: string,
  newOwner: { name: string; phone?: string; email?: string },
): Promise<LinkNewOwnerResult> {
  try {
    return await pb.send<{ client_id: string }>(`/backend/v1/properties/${propertyId}/owner`, {
      method: 'POST',
      body: { new: newOwner },
    })
  } catch (err) {
    if (err instanceof ClientResponseError && err.status === 409) {
      const data = err.response as { message?: string; existing_client_id?: string }
      return {
        existing_client_id: data.existing_client_id,
        message: data.message || 'Já existe um cliente com este contato.',
      }
    }
    throw err
  }
}

/**
 * Publica um imóvel (atualiza status para 'disponivel')
 */
export async function publishProperty(propertyId: string): Promise<PropertyRecord> {
  return await pb.collection('properties').update<PropertyRecord>(
    propertyId,
    { status: 'disponivel' },
    {
      expand: 'property_photos_via_property_id,captured_by,owner_id,condominium_id',
    },
  )
}

/**
 * Retorna os proprietários sem imóvel vinculado
 * GET /backend/v1/admin/owners-without-property
 */
export interface OwnerWithoutPropertyItem {
  id: string
  name: string
}

export async function listOwnersWithoutProperty(): Promise<OwnerWithoutPropertyItem[]> {
  const res = await pb.send<{ items: OwnerWithoutPropertyItem[] }>(
    '/backend/v1/admin/owners-without-property',
    {
      method: 'GET',
    },
  )
  return res.items || []
}
