import pb from '@/lib/pocketbase/client'

export interface TodayLeadItem {
  id: string
  name: string
  origin: string
  stage: string
  assigned_to: string
  next_step: string
  next_step_due: string
  created: string
  overdue?: boolean
}

export interface TodayVisitItem {
  id: string
  status: string
  start_at: string
  end_at: string
  broker_id: string
  broker_name: string
  property_id: string
  property_code: string
  lead_id: string
  client_id: string
  person_name: string
}

export interface TodayTaskItem {
  id: string
  title: string
  due_at: string
  assigned_to: string
  assigned_name: string
  lead_id: string
  client_id: string
  property_id: string
}

export interface TodayPropertyItem {
  id: string
  code: string
  title: string
  status: string
  last_reviewed_at: string
}

export interface TodayStageCountItem {
  stage: string
  count: number
}

export interface TodaySection<T> {
  count: number
  more: boolean
  items: T[]
}

export interface TodaySections {
  // SDR
  new_unassigned_leads?: TodaySection<TodayLeadItem>
  dedupe_pending?: TodaySection<TodayLeadItem>
  overdue_next_steps?: TodaySection<TodayLeadItem>
  pending_visits?: TodaySection<TodayVisitItem>
  my_tasks_due?: TodaySection<TodayTaskItem>
  visits_today?: TodaySection<TodayVisitItem>

  // Corretor
  visits_to_confirm?: TodaySection<TodayVisitItem>

  // Admin
  leads_by_stage?: TodaySection<TodayStageCountItem>
  visits_week?: TodaySection<TodayVisitItem>
  stalled_leads?: TodaySection<TodayLeadItem>
  properties_pending_review?: TodaySection<TodayPropertyItem>
  overdue_tasks?: TodaySection<TodayTaskItem>
}

export interface TodayResponse {
  role: 'admin' | 'sdr' | 'corretor' | string
  generated_at: string
  sections: TodaySections
}

export function formatTodayErrorMessage(
  err: unknown,
  defaultMessage = 'Falha ao carregar o painel Hoje.',
): string {
  if (!err) return defaultMessage
  if (typeof err === 'object' && err !== null) {
    const errorObj = err as Record<string, unknown>
    if (errorObj.data && typeof errorObj.data === 'object') {
      const data = errorObj.data as Record<string, unknown>
      if (typeof data.message === 'string' && data.message) {
        return data.message
      }
    }
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
      if (errorObj.message === 'Failed to authenticate.') return 'Falha na autenticação.'
      if (errorObj.message.includes('Papel sem acesso')) return 'Papel sem acesso a estes dados.'
      return errorObj.message
    }
  }
  return defaultMessage
}

/**
 * GET /backend/v1/today
 */
export async function getTodayData(): Promise<TodayResponse> {
  return await pb.send<TodayResponse>('/backend/v1/today', {
    method: 'GET',
    requestKey: null,
  })
}
