import pb from '@/lib/pocketbase/client'
import { RecordModel } from 'pocketbase'

export type VisitStatus =
  | 'pendente_agenda'
  | 'agendada'
  | 'confirmada'
  | 'realizada'
  | 'cancelada'
  | 'nao_compareceu'

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  pendente_agenda: 'Pendente de agenda',
  agendada: 'Agendada',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  nao_compareceu: 'Não compareceu',
}

export interface VisitRecord extends RecordModel {
  organization_id: string
  lead_id?: string
  client_id?: string
  property_id: string
  broker_id?: string
  start_at?: string
  end_at?: string
  status: VisitStatus
  result_text?: string
  cancel_reason?: string
  cancelled_by?: string
  cancelled_at?: string
  created_by?: string
  created: string
  updated: string
  expand?: {
    lead_id?: {
      id: string
      name: string
      phone?: string
      email?: string
      stage?: string
    }
    client_id?: {
      id: string
      name: string
      phone?: string
      email?: string
    }
    property_id?: {
      id: string
      code: string
      title: string
      neighborhood?: string
      status?: string
    }
    broker_id?: {
      id: string
      name?: string
      email?: string
      role?: string
    }
    cancelled_by?: {
      id: string
      name?: string
      email?: string
    }
    created_by?: {
      id: string
      name?: string
      email?: string
    }
  }
}

export interface VisitConflictError {
  message: string
  conflict_start?: string
  conflict_end?: string
}

/**
 * Converte data ISO UTC para partes no fuso America/Bahia (UTC-3 fixo sem horário de verão)
 */
function getBahiaParts(dateStr: string): {
  year: number
  month: number
  day: number
  hours: number
  minutes: number
  dateObj: Date
} | null {
  if (!dateStr) return null
  const d = new Date(
    dateStr.includes('T')
      ? dateStr
      : dateStr.replace(' ', 'T') + (dateStr.endsWith('Z') ? '' : 'Z'),
  )
  if (isNaN(d.getTime())) return null

  // America/Bahia é sempre UTC-3
  const bahiaMillis = d.getTime() - 3 * 3600 * 1000
  const bahiaDate = new Date(bahiaMillis)

  return {
    year: bahiaDate.getUTCFullYear(),
    month: bahiaDate.getUTCMonth() + 1,
    day: bahiaDate.getUTCDate(),
    hours: bahiaDate.getUTCHours(),
    minutes: bahiaDate.getUTCMinutes(),
    dateObj: bahiaDate,
  }
}

/**
 * Formata data e hora no fuso America/Bahia: dd/mm/aaaa hh:mm
 */
export function formatDateTimeBahia(dateStr?: string | null): string {
  if (!dateStr) return '-'
  const parts = getBahiaParts(dateStr)
  if (!parts) return '-'
  const dd = String(parts.day).padStart(2, '0')
  const mm = String(parts.month).padStart(2, '0')
  const yyyy = parts.year
  const hh = String(parts.hours).padStart(2, '0')
  const min = String(parts.minutes).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

/**
 * Formata apenas data no fuso America/Bahia: dd/mm/aaaa
 */
export function formatDateBahia(dateStr?: string | null): string {
  if (!dateStr) return '-'
  const parts = getBahiaParts(dateStr)
  if (!parts) return '-'
  const dd = String(parts.day).padStart(2, '0')
  const mm = String(parts.month).padStart(2, '0')
  const yyyy = parts.year
  return `${dd}/${mm}/${yyyy}`
}

/**
 * Formata apenas hora no fuso America/Bahia: hh:mm
 */
export function formatTimeBahia(dateStr?: string | null): string {
  if (!dateStr) return '-'
  const parts = getBahiaParts(dateStr)
  if (!parts) return '-'
  const hh = String(parts.hours).padStart(2, '0')
  const min = String(parts.minutes).padStart(2, '0')
  return `${hh}:${min}`
}

/**
 * Retorna string "yyyy-mm-dd" da data no fuso America/Bahia para agrupamento em calendário
 */
export function getDateKeyBahia(dateStr?: string | null): string | null {
  if (!dateStr) return null
  const parts = getBahiaParts(dateStr)
  if (!parts) return null
  const mm = String(parts.month).padStart(2, '0')
  const dd = String(parts.day).padStart(2, '0')
  return `${parts.year}-${mm}-${dd}`
}

/**
 * Converte data e hora locais (digitadas no fuso America/Bahia, ex: "2025-05-10T14:30") para ISO UTC
 */
export function bahiaLocalToIsoUtc(localDateTimeStr: string): string {
  if (!localDateTimeStr) return ''
  // localDateTimeStr: "YYYY-MM-DDTHH:mm"
  const [datePart, timePart] = localDateTimeStr.split('T')
  if (!datePart) return ''
  const [yyyy, mm, dd] = datePart.split('-').map(Number)
  const [hh, min] = (timePart || '00:00').split(':').map(Number)

  // Criamos UTC base e somamos 3 horas (já que Bahia é UTC-3)
  const utcMillis = Date.UTC(yyyy, mm - 1, dd, hh + 3, min, 0, 0)
  return new Date(utcMillis).toISOString()
}

/**
 * Converte data ISO UTC para formato "YYYY-MM-DDTHH:mm" no fuso America/Bahia (para preenchimento de inputs datetime-local)
 */
export function isoUtcToBahiaInput(dateStr?: string | null): string {
  if (!dateStr) return ''
  const parts = getBahiaParts(dateStr)
  if (!parts) return ''
  const mm = String(parts.month).padStart(2, '0')
  const dd = String(parts.day).padStart(2, '0')
  const hh = String(parts.hours).padStart(2, '0')
  const min = String(parts.minutes).padStart(2, '0')
  return `${parts.year}-${mm}-${dd}T${hh}:${min}`
}

/**
 * Extrai mensagem amigável de erros do servidor
 */
export function extractErrorMessage(err: unknown, defaultMessage = 'Ocorreu um erro.'): string {
  if (!err) return defaultMessage
  if (typeof err === 'object' && err !== null) {
    const errorObj = err as Record<string, unknown>
    // Resposta do endpoint com data.message
    if (errorObj.data && typeof errorObj.data === 'object') {
      const data = errorObj.data as Record<string, unknown>
      if (typeof data.message === 'string' && data.message) {
        return data.message
      }
    }
    // Resposta com response.data.message ou response.message
    const response = errorObj.response as Record<string, unknown> | undefined
    if (response) {
      if (typeof response.message === 'string' && response.message) {
        return response.message
      }
      if (response.data && typeof response.data === 'object') {
        const rData = response.data as Record<string, unknown>
        if (typeof rData.message === 'string' && rData.message) {
          return rData.message
        }
      }
    }
    if (typeof errorObj.message === 'string' && errorObj.message) {
      // Mensagens padrões do pocketbase
      if (errorObj.message === 'Failed to authenticate.') return 'Falha na autenticação.'
      if (errorObj.message === 'The request requires admin privileges.')
        return 'Permissão insuficiente.'
      return errorObj.message
    }
  }
  return defaultMessage
}

export interface ListVisitsParams {
  brokerId?: string
  status?: VisitStatus | 'all'
  page?: number
  perPage?: number
  includePending?: boolean
}

/**
 * Lista visitas com expand completo
 */
export async function listVisits(
  params: {
    brokerId?: string
    status?: string
    includePending?: boolean
    startDateIso?: string
    endDateIso?: string
    page?: number
    perPage?: number
    sort?: string
  } = {},
) {
  const filters: string[] = []

  if (params.brokerId && params.brokerId !== 'all') {
    filters.push(`broker_id = "${params.brokerId}"`)
  }

  if (params.status && params.status !== 'all') {
    filters.push(`status = "${params.status}"`)
  }

  if (params.includePending === false) {
    filters.push(`status != "pendente_agenda"`)
  }

  if (params.startDateIso) {
    filters.push(`start_at >= "${params.startDateIso}"`)
  }

  if (params.endDateIso) {
    filters.push(`start_at <= "${params.endDateIso}"`)
  }

  const page = params.page || 1
  const perPage = params.perPage || 50
  const sort = params.sort || 'start_at'

  return await pb.collection('visits').getList<VisitRecord>(page, perPage, {
    filter: filters.length > 0 ? filters.join(' && ') : undefined,
    sort,
    expand: 'broker_id,lead_id,client_id,property_id,cancelled_by,created_by',
    requestKey: null,
  })
}

/**
 * Lista visitas pendentes de agenda
 */
export async function listPendingVisits(brokerId?: string) {
  const filters: string[] = ['status = "pendente_agenda"']
  if (brokerId && brokerId !== 'all') {
    filters.push(`broker_id = "${brokerId}"`)
  }

  return await pb.collection('visits').getFullList<VisitRecord>({
    filter: filters.join(' && '),
    sort: '-created',
    expand: 'broker_id,lead_id,client_id,property_id,created_by',
    requestKey: null,
  })
}

/**
 * Lista visitas de um lead específico
 */
export async function listVisitsByLead(leadId: string) {
  return await pb.collection('visits').getFullList<VisitRecord>({
    filter: `lead_id = "${leadId}"`,
    sort: '-created',
    expand: 'broker_id,property_id,cancelled_by,created_by',
    requestKey: null,
  })
}

/**
 * Lista visitas de um cliente específico
 */
export async function listVisitsByClient(clientId: string) {
  return await pb.collection('visits').getFullList<VisitRecord>({
    filter: `client_id = "${clientId}"`,
    sort: '-created',
    expand: 'broker_id,property_id,cancelled_by,created_by',
    requestKey: null,
  })
}

/**
 * Busca uma visita individual pelo id com expand
 */
export async function getVisitById(id: string) {
  return await pb.collection('visits').getOne<VisitRecord>(id, {
    expand: 'broker_id,lead_id,client_id,property_id,cancelled_by,created_by',
    requestKey: null,
  })
}

/**
 * POST /backend/v1/visits/{id}/status
 * status = confirmada | realizada | nao_compareceu
 */
export async function updateVisitStatus(
  visitId: string,
  status: 'confirmada' | 'realizada' | 'nao_compareceu',
  result?: string,
): Promise<{ status: string }> {
  return await pb.send<{ status: string }>(`/backend/v1/visits/${visitId}/status`, {
    method: 'POST',
    body: { status, result },
  })
}

/**
 * POST /backend/v1/visits/{id}/cancel
 * body = { reason }
 */
export async function cancelVisit(visitId: string, reason: string): Promise<{ status: string }> {
  return await pb.send<{ status: string }>(`/backend/v1/visits/${visitId}/cancel`, {
    method: 'POST',
    body: { reason },
  })
}

export interface RescheduleVisitInput {
  broker_id?: string
  start_at?: string // ISO UTC
  end_at?: string // ISO UTC
}

/**
 * POST /backend/v1/visits/{id}/reschedule
 */
export async function rescheduleVisit(
  visitId: string,
  input: RescheduleVisitInput,
): Promise<{ status: string }> {
  return await pb.send<{ status: string }>(`/backend/v1/visits/${visitId}/reschedule`, {
    method: 'POST',
    body: input,
  })
}

export interface CreateVisitInput {
  lead_id?: string
  client_id?: string
  property_id: string
  broker_id?: string
  start_at?: string // ISO UTC
  end_at?: string // ISO UTC
}

/**
 * POST /backend/v1/visits
 */
export async function createVisit(
  input: CreateVisitInput,
): Promise<{ id: string; status: VisitStatus }> {
  return await pb.send<{ id: string; status: VisitStatus }>('/backend/v1/visits', {
    method: 'POST',
    body: input,
  })
}

export interface ActiveBroker {
  id: string
  name: string
  email: string
  role: string
}

/**
 * Lista usuários ativos que são corretores ou admins para filtro e seleção
 */
export async function listActiveBrokers(): Promise<ActiveBroker[]> {
  try {
    const records = await pb.collection('users').getFullList<RecordModel>({
      filter: 'active = true && (role = "corretor" || role = "admin")',
      sort: 'name',
    })
    return records.map((r) => ({
      id: r.id,
      name: (r.name as string) || (r.email as string) || 'Sem nome',
      email: (r.email as string) || '',
      role: (r.role as string) || '',
    }))
  } catch {
    return []
  }
}
