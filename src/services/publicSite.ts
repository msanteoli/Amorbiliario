/**
 * Serviço do site público (consumo anônimo de endpoints públicos).
 * Sem uso do cliente pb com autenticação.
 */

export interface PublicPropertyPrice {
  state: 'consulte' | 'informado' | 'nao_informado'
  value: number | null
}

export interface PublicPropertyCondominium {
  name: string
  amenities: string
  rules: string
}

export interface PublicPropertyDetail {
  code: string
  title: string
  purpose: string
  type: string
  neighborhood: string
  city: string
  bedrooms: number
  bathrooms: number
  parking: number
  area: number
  condo_fee: number
  iptu: number
  sale: PublicPropertyPrice | null
  rent: PublicPropertyPrice | null
  description: string
  condominium: PublicPropertyCondominium | null
  highlight: string
  photos: string[]
  cover: string | null
}

export interface PublicSlot {
  start: string // ISO string
  end: string // ISO string
}

export interface PublicSlotsResponse {
  slots: PublicSlot[]
  timezone: string
  min_notice_hours: number
  window_days: number
}

export interface PublicFiltersResponse {
  organization: {
    name: string
    whatsapp_enabled: boolean
    whatsapp_url: string | null
  }
  neighborhoods: Array<{ name: string; count: number }>
  types: Array<{ value: string; count: number }>
  purposes: { venda: number; locacao: number }
}

export interface SubmitLeadPayload {
  org?: string
  name: string
  phone: string
  email: string
  consent: boolean
  submission_id: string
  property_code?: string
  website?: string // honeypot
  visit_start?: string // ISO string exata
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  gclid?: string
  fbclid?: string
  search?: {
    filters?: {
      neighborhood?: string
      type?: string
      purpose?: string
      bedrooms?: number
      max_price?: number
    }
    viewed?: string[]
  }
}

export type SubmitLeadVisitResult = 'requested' | 'slot_taken' | 'invalid' | 'limit' | 'none'

export interface SubmitLeadResponse {
  ok: boolean
  whatsapp_url: string | null
  visit: SubmitLeadVisitResult
}

/**
 * Busca os dados públicos do imóvel pelo código
 */
export async function getPublicProperty(code: string, org?: string): Promise<PublicPropertyDetail> {
  const params = new URLSearchParams()
  if (org) params.set('org', org)
  const query = params.toString() ? `?${params.toString()}` : ''
  const res = await fetch(`/backend/v1/public/properties/${encodeURIComponent(code)}${query}`)
  if (!res.ok) {
    throw new Error('Imóvel não encontrado.')
  }
  return (await res.json()) as PublicPropertyDetail
}

/**
 * Busca horários livres de visita do imóvel
 */
export async function getPublicPropertySlots(
  code: string,
  org?: string,
): Promise<PublicSlotsResponse> {
  const params = new URLSearchParams()
  if (org) params.set('org', org)
  const query = params.toString() ? `?${params.toString()}` : ''
  const res = await fetch(`/backend/v1/public/properties/${encodeURIComponent(code)}/slots${query}`)
  if (!res.ok) {
    throw new Error('Não foi possível carregar os horários de visita.')
  }
  return (await res.json()) as PublicSlotsResponse
}

/**
 * Envia lead gerado no site público.
 * submitLead inclui visit_start no corpo somente quando a prop estiver preenchida,
 * com o valor EXATO recebido (a string ISO, sem reformatar).
 */
export async function submitLead(payload: SubmitLeadPayload): Promise<SubmitLeadResponse> {
  const body: Record<string, unknown> = {
    name: payload.name,
    phone: payload.phone,
    email: payload.email,
    consent: payload.consent,
    submission_id: payload.submission_id,
  }

  if (payload.org) body.org = payload.org
  if (payload.property_code) body.property_code = payload.property_code
  if (payload.website !== undefined) body.website = payload.website
  if (payload.visit_start) body.visit_start = payload.visit_start
  if (payload.utm_source) body.utm_source = payload.utm_source
  if (payload.utm_medium) body.utm_medium = payload.utm_medium
  if (payload.utm_campaign) body.utm_campaign = payload.utm_campaign
  if (payload.gclid) body.gclid = payload.gclid
  if (payload.fbclid) body.fbclid = payload.fbclid
  if (payload.search) body.search = payload.search

  const res = await fetch('/backend/v1/public/leads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>

  if (!res.ok) {
    const msg =
      (typeof data.message === 'string' && data.message) ||
      'Não foi possível enviar o seu contato. Tente novamente em instantes.'
    throw new Error(msg)
  }

  return {
    ok: Boolean(data.ok),
    whatsapp_url: typeof data.whatsapp_url === 'string' ? data.whatsapp_url : null,
    visit: (data.visit as SubmitLeadVisitResult) || 'none',
  }
}
