import pb from '@/lib/pocketbase/client'
import { RecordModel } from 'pocketbase'

export interface CondominiumPhotoRecord extends RecordModel {
  organization_id: string
  condominium_id: string
  file: string
  is_active: boolean
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
  expand?: {
    condominium_photos_via_condominium_id?: CondominiumPhotoRecord[]
  }
}

export interface CreateCondominiumInput {
  name: string
  street?: string
  neighborhood?: string
  city?: string
  amenities?: string
  rules?: string
}

/**
 * Lista condomínios ativos da organização com busca por nome
 */
export async function listActiveCondominiums(search?: string): Promise<CondominiumRecord[]> {
  const filterParts: string[] = ['is_active = true']
  if (search && search.trim()) {
    const term = search.trim().replace(/['"\\]/g, '')
    filterParts.push(`name ~ "${term}"`)
  }

  const res = await pb.collection('condominiums').getList<CondominiumRecord>(1, 50, {
    filter: filterParts.join(' && '),
    sort: 'name',
    expand: 'condominium_photos_via_condominium_id',
  })

  return res.items
}

/**
 * Cria um condomínio rápido
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
  }

  return await pb.collection('condominiums').create<CondominiumRecord>(payload)
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
 * Gera URL de foto de condomínio
 */
export function getCondoPhotoUrl(photo: CondominiumPhotoRecord, thumb?: string): string {
  return pb.files.getURL(photo, photo.file, { thumb })
}
