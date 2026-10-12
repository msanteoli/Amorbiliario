import pb from '@/lib/pocketbase/client'
import { ClientResponseError } from 'pocketbase'

export interface PortalSummaryResponse {
  feed_url: string
  active: boolean
  published_count: number
  marked_count: number
  pending_count: number
  last_fetched_at: string | null
  last_count: number
  leads_url?: string
  last_lead_at?: string | null
  leads_count?: number
}

export type PortalPendingReasonCode =
  | 'tipo_outro'
  | 'sem_preco'
  | 'sem_bairro'
  | 'sem_cidade'
  | 'sem_uf'
  | 'sem_cep'
  | 'sem_descricao'
  | 'sem_foto'
  | string

export interface PortalPendingItem {
  id: string
  code: string
  title: string
  reasons: PortalPendingReasonCode[]
}

export interface PortalPendingResponse {
  items: PortalPendingItem[]
}

export interface PortalBatchPropertiesPayload {
  property_ids: string[]
  enabled: boolean
}

export interface PortalBatchPropertiesResponse {
  changed: number
  ignored: number
}

export interface PortalRotateResponse {
  feed_url: string
}

export interface PortalRotateLeadsResponse {
  leads_url: string
}

export const PORTAL_REASON_LABELS: Record<string, string> = {
  tipo_outro: 'Tipo Outro não é aceito pelo portal',
  sem_preco: 'Informe o preço',
  sem_bairro: 'Informe o bairro',
  sem_cidade: 'Informe a cidade',
  sem_uf: 'Informe a UF',
  sem_cep: 'Informe o CEP',
  sem_descricao: 'Informe a descrição',
  sem_foto: 'Envie ao menos uma foto JPEG ou WebP',
}

export function translatePortalReason(code: string): string {
  return PORTAL_REASON_LABELS[code] || code
}

/**
 * Extrai mensagem de erro sem NUNCA vazar feed_url ou tokens no texto retornado
 */
export function formatPortalErrorMessage(
  err: unknown,
  defaultMessage = 'Ocorreu um erro ao comunicar com o portal.',
): string {
  if (!err) return defaultMessage
  if (err instanceof ClientResponseError) {
    if (err.data && typeof err.data === 'object') {
      const data = err.data as Record<string, unknown>
      if (typeof data.message === 'string' && data.message) {
        return sanitizePortalErrorText(data.message)
      }
    }
    const resp = err.response as Record<string, unknown> | undefined
    if (resp && typeof resp.message === 'string' && resp.message) {
      return sanitizePortalErrorText(resp.message)
    }
    if (err.message) {
      return sanitizePortalErrorText(err.message)
    }
  }

  if (typeof err === 'object' && err !== null) {
    const errorObj = err as Record<string, unknown>
    if (errorObj.data && typeof errorObj.data === 'object') {
      const data = errorObj.data as Record<string, unknown>
      if (typeof data.message === 'string' && data.message) {
        return sanitizePortalErrorText(data.message)
      }
    }
    if (typeof errorObj.message === 'string' && errorObj.message) {
      return sanitizePortalErrorText(errorObj.message)
    }
  }

  if (err instanceof Error) {
    return sanitizePortalErrorText(err.message)
  }

  return defaultMessage
}

function sanitizePortalErrorText(text: string): string {
  // Mascara qualquer URL de feed, leads ou tokens por segurança
  return text
    .replace(/https?:\/\/[^\s]+feeds\/[^\s]+/gi, '[endereço protegido]')
    .replace(/feeds\/[a-zA-Z0-9_-]+\/chavesnamao\.xml/gi, '[endereço protegido]')
    .replace(/https?:\/\/[^\s]+leads\/[^\s]+/gi, '[endereço protegido]')
    .replace(/leads\/[a-zA-Z0-9_-]+/gi, '[endereço protegido]')
}

/**
 * GET /backend/v1/admin/portals/chaves-na-mao
 */
export async function getChavesNaMaoSummary(): Promise<PortalSummaryResponse> {
  return await pb.send<PortalSummaryResponse>('/backend/v1/admin/portals/chaves-na-mao', {
    method: 'GET',
    requestKey: null,
  })
}

/**
 * GET /backend/v1/admin/portals/chaves-na-mao/pending
 */
export async function getChavesNaMaoPending(): Promise<PortalPendingItem[]> {
  const res = await pb.send<PortalPendingResponse>(
    '/backend/v1/admin/portals/chaves-na-mao/pending',
    {
      method: 'GET',
      requestKey: null,
    },
  )
  return res.items || []
}

/**
 * POST /backend/v1/admin/portals/chaves-na-mao/properties
 */
export async function updateChavesNaMaoProperties(
  payload: PortalBatchPropertiesPayload,
): Promise<PortalBatchPropertiesResponse> {
  return await pb.send<PortalBatchPropertiesResponse>(
    '/backend/v1/admin/portals/chaves-na-mao/properties',
    {
      method: 'POST',
      body: payload,
    },
  )
}

/**
 * POST /backend/v1/admin/portals/chaves-na-mao/rotate
 */
export async function rotateChavesNaMaoFeed(): Promise<PortalRotateResponse> {
  return await pb.send<PortalRotateResponse>('/backend/v1/admin/portals/chaves-na-mao/rotate', {
    method: 'POST',
  })
}

/**
 * POST /backend/v1/admin/portals/chaves-na-mao/rotate-leads
 */
export async function rotateChavesNaMaoLeads(): Promise<PortalRotateLeadsResponse> {
  return await pb.send<PortalRotateLeadsResponse>(
    '/backend/v1/admin/portals/chaves-na-mao/rotate-leads',
    {
      method: 'POST',
    },
  )
}

export interface AvailablePropertyForPortal {
  id: string
  code: string
  title: string
  neighborhood: string
  city: string
  isPublishedToPortal: boolean
}

/**
 * Busca imóveis com situação "disponivel" para seleção no lote (máx 200)
 */
export async function searchAvailableProperties(
  searchTerm = '',
  limit = 200,
): Promise<AvailablePropertyForPortal[]> {
  const filterParts: string[] = ['status = "disponivel"']
  if (searchTerm.trim()) {
    const term = searchTerm.trim().replace(/['"\\]/g, '')
    filterParts.push(`(code ~ "${term}" || title ~ "${term}")`)
  }

  const res = await pb.collection('properties').getList(1, Math.min(limit, 200), {
    filter: filterParts.join(' && '),
    sort: 'code',
    requestKey: null,
    fields: 'id,code,title,neighborhood,city,publish_to',
  })

  return res.items.map((r) => {
    const pubTo = Array.isArray(r.publish_to)
      ? (r.publish_to as string[])
      : typeof r.publish_to === 'string'
        ? [r.publish_to]
        : []
    return {
      id: r.id,
      code: (r.code as string) || '',
      title: (r.title as string) || '',
      neighborhood: (r.neighborhood as string) || '',
      city: (r.city as string) || '',
      isPublishedToPortal: pubTo.includes('chaves_na_mao'),
    }
  })
}
