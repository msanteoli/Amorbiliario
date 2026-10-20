import pb from '@/lib/pocketbase/client'
import { RecordModel } from 'pocketbase'
import { PropertyRecord } from '@/services/properties'

export interface CondominiumPhotoRecord extends RecordModel {
  organization_id: string
  condominium_id: string
  file: string
  is_active: boolean
  position?: number
  created?: string
  updated?: string
}

export interface CondominiumRecord extends RecordModel {
  organization_id: string
  name: string
  name_key?: string
  street?: string
  neighborhood?: string
  city?: string
  amenities?: string
  rules?: string
  is_active?: boolean
  created_batch_id?: string
  cover_photo_id?: string
  created?: string
  updated?: string
  expand?: {
    condominium_photos_via_condominium_id?: CondominiumPhotoRecord[]
  }
}

export interface CondominiumWithCount extends CondominiumRecord {
  propertiesCount: number
}

export interface CreateCondominiumInput {
  name: string
  street?: string
  neighborhood?: string
  city?: string
  amenities?: string
  rules?: string
}

export interface UpdateCondominiumInput {
  name?: string
  street?: string
  neighborhood?: string
  city?: string
  amenities?: string
  rules?: string
  is_active?: boolean
}

export interface ImportCondominiumRow {
  Nome?: string
  name?: string
  Endereço?: string
  Endereco?: string
  street?: string
  Bairro?: string
  neighborhood?: string
  Cidade?: string
  city?: string
  Lazer?: string
  amenities?: string
  Regras?: string
  rules?: string
  [key: string]: unknown
}

export interface ImportCondominiumItemResult {
  row: number
  name: string
  outcome: 'aceito' | 'pendente' | 'recusado'
  reasons: string[]
}

export interface ImportCondominiumsResponse {
  dry_run: boolean
  batch_id: string | null
  counts: {
    aceito: number
    pendente: number
    recusado: number
  }
  items: ImportCondominiumItemResult[]
}

/**
 * Lista condomínios ativos da organização com busca por nome (usado em selects)
 */
export async function listActiveCondominiums(search?: string): Promise<CondominiumRecord[]> {
  const filterParts: string[] = ['is_active = true']
  if (search && search.trim()) {
    const term = search.trim().replace(/['"\\]/g, '')
    filterParts.push(`name ~ "${term}"`)
  }

  const res = await pb.collection('condominiums').getList<CondominiumRecord>(1, 100, {
    filter: filterParts.join(' && '),
    sort: 'name',
    expand: 'condominium_photos_via_condominium_id',
  })

  return res.items
}

export interface ListCondominiumsParams {
  search?: string
  showInactive?: boolean
}

/**
 * Lista condomínios com contagem de imóveis vinculados
 */
export async function listCondominiumsWithPropertyCount(
  params: ListCondominiumsParams = {},
): Promise<CondominiumWithCount[]> {
  const filterParts: string[] = []

  if (!params.showInactive) {
    filterParts.push('is_active = true')
  }

  if (params.search && params.search.trim()) {
    const term = params.search.trim().replace(/['"\\]/g, '')
    filterParts.push(`(name ~ "${term}" || neighborhood ~ "${term}")`)
  }

  // Busca todos os condomínios ordenados por nome
  const condos = await pb.collection('condominiums').getFullList<CondominiumRecord>({
    filter: filterParts.length > 0 ? filterParts.join(' && ') : undefined,
    sort: 'name',
    expand: 'condominium_photos_via_condominium_id',
  })

  if (condos.length === 0) {
    return []
  }

  // Busca todos os imóveis que possuem condominium_id para calcular a contagem por condomínio
  // O PocketBase permite getFullList com campos específicos
  let propertiesWithCondo: Array<Pick<PropertyRecord, 'id' | 'condominium_id'>> = []
  try {
    propertiesWithCondo = await pb
      .collection('properties')
      .getFullList<Pick<PropertyRecord, 'id' | 'condominium_id'>>({
        filter: "condominium_id != ''",
        fields: 'id,condominium_id',
      })
  } catch (err) {
    console.error('Erro ao buscar imóveis para contagem:', err)
  }

  const countsMap = new Map<string, number>()
  for (const p of propertiesWithCondo) {
    if (p.condominium_id) {
      countsMap.set(p.condominium_id, (countsMap.get(p.condominium_id) || 0) + 1)
    }
  }

  return condos.map((c) => ({
    ...c,
    propertiesCount: countsMap.get(c.id) || 0,
  }))
}

/**
 * Cria um condomínio
 */
export async function createCondominium(
  input: CreateCondominiumInput,
  currentUser: { organization_id?: string },
): Promise<CondominiumRecord> {
  const orgId = currentUser.organization_id
  if (!orgId) {
    throw new Error('Organização do usuário não identificada.')
  }

  const payload: Record<string, unknown> = {
    organization_id: orgId,
    name: input.name.trim(),
    street: input.street?.trim() || '',
    neighborhood: input.neighborhood?.trim() || '',
    city: input.city?.trim() || '',
    amenities: input.amenities?.trim() || '',
    rules: input.rules?.trim() || '',
    is_active: true,
  }

  return await pb.collection('condominiums').create<CondominiumRecord>(payload)
}

/**
 * Atualiza um condomínio existente
 */
export async function updateCondominium(
  id: string,
  input: UpdateCondominiumInput,
): Promise<CondominiumRecord> {
  const payload: Record<string, unknown> = {}
  if (input.name !== undefined) payload.name = input.name.trim()
  if (input.street !== undefined) payload.street = input.street.trim()
  if (input.neighborhood !== undefined) payload.neighborhood = input.neighborhood.trim()
  if (input.city !== undefined) payload.city = input.city.trim()
  if (input.amenities !== undefined) payload.amenities = input.amenities.trim()
  if (input.rules !== undefined) payload.rules = input.rules.trim()
  if (input.is_active !== undefined) payload.is_active = input.is_active

  return await pb.collection('condominiums').update<CondominiumRecord>(id, payload)
}

/**
 * Busca condomínio por id
 */
export async function getCondominiumById(id: string): Promise<CondominiumRecord> {
  return await pb.collection('condominiums').getOne<CondominiumRecord>(id, {
    expand: 'condominium_photos_via_condominium_id',
  })
}

/**
 * Lista fotos de um condomínio (todas ou apenas ativas)
 */
/**
 * Ordena fotos de condomínio por position crescente, depois created
 */
export function sortCondoPhotos(photos: CondominiumPhotoRecord[]): CondominiumPhotoRecord[] {
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
 * Obtém a capa efetiva do condomínio:
 * Entre as fotos ativas, é a de cover_photo_id se ela existir e estiver ativa;
 * senão é a primeira por position, depois created.
 */
export function getEffectiveCondoCoverPhoto(
  condo: CondominiumRecord,
  photosList?: CondominiumPhotoRecord[],
): CondominiumPhotoRecord | null {
  const rawPhotos = photosList || condo.expand?.condominium_photos_via_condominium_id
  if (!Array.isArray(rawPhotos) || rawPhotos.length === 0) {
    return null
  }
  const activePhotos = rawPhotos.filter((p) => p.is_active !== false)
  if (activePhotos.length === 0) {
    return null
  }
  const sorted = sortCondoPhotos(activePhotos)
  if (condo.cover_photo_id) {
    const cover = sorted.find((p) => p.id === condo.cover_photo_id)
    if (cover) return cover
  }
  return sorted[0] || null
}

/**
 * Lista fotos de um condomínio (todas ou apenas ativas), ordenadas por position,created
 */
export async function listCondominiumPhotos(
  condominiumId: string,
  onlyActive = false,
): Promise<CondominiumPhotoRecord[]> {
  const filter = onlyActive
    ? `condominium_id = "${condominiumId}" && is_active = true`
    : `condominium_id = "${condominiumId}"`

  const records = await pb.collection('condominium_photos').getFullList<CondominiumPhotoRecord>({
    filter,
    sort: 'position,created',
  })
  return sortCondoPhotos(records)
}

/**
 * Atualiza a ordem das fotos ativas do condomínio
 * PUT /backend/v1/condominiums/{id}/photos/order com { ordered_ids: string[] }
 */
export async function updateCondominiumPhotosOrder(
  condominiumId: string,
  orderedIds: string[],
): Promise<{ ok: boolean; ordered_ids: string[] }> {
  try {
    return await pb.send<{ ok: boolean; ordered_ids: string[] }>(
      `/backend/v1/condominiums/${condominiumId}/photos/order`,
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
 * Define a capa do condomínio (photoId vazio volta ao padrão)
 * PUT /backend/v1/condominiums/{id}/cover com { photo_id: string }
 */
export async function setCondominiumCoverPhoto(
  condominiumId: string,
  photoId: string,
): Promise<{ ok: boolean; cover_photo_id: string }> {
  try {
    return await pb.send<{ ok: boolean; cover_photo_id: string }>(
      `/backend/v1/condominiums/${condominiumId}/cover`,
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

function extractServerErrorMessage(error: unknown): string {
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
 * Faz upload de uma nova foto de condomínio
 */
export async function uploadCondominiumPhoto(
  condominiumId: string,
  file: File,
  currentUser: { organization_id?: string },
): Promise<CondominiumPhotoRecord> {
  const orgId = currentUser.organization_id
  if (!orgId) {
    throw new Error('Organização do usuário não identificada.')
  }

  const formData = new FormData()
  formData.append('organization_id', orgId)
  formData.append('condominium_id', condominiumId)
  formData.append('file', file)
  formData.append('is_active', 'true')

  return await pb.collection('condominium_photos').create<CondominiumPhotoRecord>(formData)
}

/**
 * Desativa ou reativa uma foto de condomínio ("desativar" no lugar de apagar)
 */
export async function setCondominiumPhotoActive(
  photoId: string,
  isActive: boolean,
): Promise<CondominiumPhotoRecord> {
  return await pb.collection('condominium_photos').update<CondominiumPhotoRecord>(photoId, {
    is_active: isActive,
  })
}

/**
 * Lista os imóveis vinculados a um condomínio
 */
export async function listPropertiesByCondominium(
  condominiumId: string,
): Promise<PropertyRecord[]> {
  return await pb.collection('properties').getFullList<PropertyRecord>({
    filter: `condominium_id = "${condominiumId}"`,
    sort: '-created',
    expand: 'property_photos_via_property_id',
  })
}

/**
 * Gera URL de foto de condomínio
 */
export function getCondoPhotoUrl(photo: CondominiumPhotoRecord, thumb?: string): string {
  return pb.files.getURL(photo, photo.file, { thumb })
}

/**
 * Envia dados para o endpoint de importação de condomínios
 */
export async function importCondominiumsEndpoint(params: {
  filename: string
  dry_run: boolean
  rows: ImportCondominiumRow[]
}): Promise<ImportCondominiumsResponse> {
  const res = await pb.send<ImportCondominiumsResponse>('/backend/v1/admin/imports/condominiums', {
    method: 'POST',
    body: {
      filename: params.filename,
      dry_run: params.dry_run,
      rows: params.rows,
    },
  })
  return res
}
