import pb from '@/lib/pocketbase/client'
import { RecordModel } from 'pocketbase'

export type TaskStatus = 'aberta' | 'concluida' | 'cancelada'

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  aberta: 'Aberta',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

export interface TaskRecord extends RecordModel {
  organization_id: string
  title: string
  description?: string
  due_at?: string
  assigned_to?: string
  status: TaskStatus
  closed_by?: string
  closed_at?: string
  lead_id?: string
  client_id?: string
  property_id?: string
  created_by?: string
  created: string
  updated: string
  expand?: {
    assigned_to?: {
      id: string
      name?: string
      email?: string
      role?: string
    }
    created_by?: {
      id: string
      name?: string
      email?: string
    }
    closed_by?: {
      id: string
      name?: string
      email?: string
    }
    lead_id?: {
      id: string
      name: string
    }
    client_id?: {
      id: string
      name: string
    }
    property_id?: {
      id: string
      code: string
      title: string
    }
  }
}

/**
 * Converte data ISO UTC para partes no fuso America/Bahia (UTC-3)
 */
function getBahiaParts(dateStr: string): {
  year: number
  month: number
  day: number
  hours: number
  minutes: number
} | null {
  if (!dateStr) return null
  const d = new Date(
    dateStr.includes('T')
      ? dateStr
      : dateStr.replace(' ', 'T') + (dateStr.endsWith('Z') ? '' : 'Z'),
  )
  if (isNaN(d.getTime())) return null

  const bahiaMillis = d.getTime() - 3 * 3600 * 1000
  const bahiaDate = new Date(bahiaMillis)

  return {
    year: bahiaDate.getUTCFullYear(),
    month: bahiaDate.getUTCMonth() + 1,
    day: bahiaDate.getUTCDate(),
    hours: bahiaDate.getUTCHours(),
    minutes: bahiaDate.getUTCMinutes(),
  }
}

/**
 * Formata data e hora no fuso America/Bahia: dd/mm/aaaa hh:mm
 */
export function formatTaskDateTimeBahia(dateStr?: string | null): string {
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
 * Converte data e hora locais no fuso America/Bahia para ISO UTC
 */
export function taskBahiaLocalToIsoUtc(localDateTimeStr: string): string {
  if (!localDateTimeStr) return ''
  const [datePart, timePart] = localDateTimeStr.split('T')
  if (!datePart) return ''
  const [yyyy, mm, dd] = datePart.split('-').map(Number)
  const [hh, min] = (timePart || '00:00').split(':').map(Number)

  const utcMillis = Date.UTC(yyyy, mm - 1, dd, hh + 3, min, 0, 0)
  return new Date(utcMillis).toISOString()
}

/**
 * Converte data ISO UTC para input datetime-local no fuso Bahia
 */
export function taskIsoUtcToBahiaInput(dateStr?: string | null): string {
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
 * Checa se uma tarefa aberta está atrasada (due_at anterior a agora)
 */
export function isTaskOverdue(task: TaskRecord): boolean {
  if (task.status !== 'aberta' || !task.due_at) return false
  const due = new Date(
    task.due_at.includes('T')
      ? task.due_at
      : task.due_at.replace(' ', 'T') + (task.due_at.endsWith('Z') ? '' : 'Z'),
  )
  return due.getTime() < Date.now()
}

/**
 * Extrai mensagem amigável de erro
 */
export function extractTaskErrorMessage(err: unknown, defaultMessage = 'Ocorreu um erro.'): string {
  if (!err) return defaultMessage
  if (typeof err === 'object' && err !== null) {
    const errorObj = err as Record<string, unknown>
    if (errorObj.data && typeof errorObj.data === 'object') {
      const data = errorObj.data as Record<string, unknown>
      if (typeof data.message === 'string' && data.message) return data.message
    }
    const response = errorObj.response as Record<string, unknown> | undefined
    if (response) {
      if (typeof response.message === 'string' && response.message) return response.message
      if (response.data && typeof response.data === 'object') {
        const rData = response.data as Record<string, unknown>
        if (typeof rData.message === 'string' && rData.message) return rData.message
      }
    }
    if (typeof errorObj.message === 'string' && errorObj.message) {
      if (errorObj.message === 'Failed to authenticate.') return 'Falha na autenticação.'
      return errorObj.message
    }
  }
  return defaultMessage
}

export interface ListTasksParams {
  status?: TaskStatus | 'all'
  assignedTo?: string
  overdueOnly?: boolean
  search?: string
  page?: number
  perPage?: number
}

/**
 * Lista tarefas com paginação e filtros
 * Ordenação padrão: prazo mais próximo primeiro, sem prazo por último (sort: 'due_at')
 */
export async function listTasks(params: ListTasksParams = {}) {
  const filters: string[] = []

  // Filtro por situação
  if (params.status && params.status !== 'all') {
    filters.push(`status = "${params.status}"`)
  }

  // Filtro por responsável
  if (params.assignedTo && params.assignedTo !== 'all') {
    filters.push(`assigned_to = "${params.assignedTo}"`)
  }

  // Filtro por busca de título
  if (params.search && params.search.trim()) {
    const clean = params.search.trim().replace(/['"\\]/g, '')
    filters.push(`title ~ "${clean}"`)
  }

  // Filtro de atrasadas (abertas com prazo < agora)
  if (params.overdueOnly) {
    const nowIso = new Date().toISOString()
    filters.push(`status = "aberta" && due_at != "" && due_at < "${nowIso}"`)
  }

  const page = params.page || 1
  const perPage = params.perPage || 10

  // Em PocketBase, strings vazias em due_at podem vir primeiro ou último dependendo do sort.
  // Ordenando por 'due_at', tarefas com data válida virão ordenadas.
  // Também podemos puxar e garantir a ordenação correta no cliente ou com sort adequado.
  return await pb.collection('tasks').getList<TaskRecord>(page, perPage, {
    filter: filters.length > 0 ? filters.join(' && ') : undefined,
    sort: 'due_at,created',
    expand: 'assigned_to,created_by,closed_by,lead_id,client_id,property_id',
    requestKey: null,
  })
}

/**
 * Lista tarefas vinculadas a um Lead (abertas primeiro)
 */
export async function listTasksByLead(leadId: string): Promise<TaskRecord[]> {
  return await pb.collection('tasks').getFullList<TaskRecord>({
    filter: `lead_id = "${leadId}"`,
    sort: 'status,due_at',
    expand: 'assigned_to,created_by,closed_by',
    requestKey: null,
  })
}

/**
 * Lista tarefas vinculadas a um Cliente (abertas primeiro)
 */
export async function listTasksByClient(clientId: string): Promise<TaskRecord[]> {
  return await pb.collection('tasks').getFullList<TaskRecord>({
    filter: `client_id = "${clientId}"`,
    sort: 'status,due_at',
    expand: 'assigned_to,created_by,closed_by',
    requestKey: null,
  })
}

/**
 * Lista tarefas vinculadas a um Imóvel (abertas primeiro)
 */
export async function listTasksByProperty(propertyId: string): Promise<TaskRecord[]> {
  return await pb.collection('tasks').getFullList<TaskRecord>({
    filter: `property_id = "${propertyId}"`,
    sort: 'status,due_at',
    expand: 'assigned_to,created_by,closed_by',
    requestKey: null,
  })
}

export interface CreateTaskInput {
  organization_id: string
  title: string
  description?: string
  due_at?: string // ISO UTC
  assigned_to?: string
  lead_id?: string
  client_id?: string
  property_id?: string
}

/**
 * Cria uma nova tarefa na coleção tasks.
 * Restrição: nunca enviar status, created_by, closed_by nem closed_at.
 */
export async function createTask(input: CreateTaskInput): Promise<TaskRecord> {
  const payload: Record<string, unknown> = {
    organization_id: input.organization_id,
    title: input.title.trim(),
    description: (input.description || '').trim(),
    assigned_to: input.assigned_to || undefined,
  }

  if (input.due_at) {
    payload.due_at = input.due_at
  }
  if (input.lead_id) {
    payload.lead_id = input.lead_id
  }
  if (input.client_id) {
    payload.client_id = input.client_id
  }
  if (input.property_id) {
    payload.property_id = input.property_id
  }

  return await pb.collection('tasks').create<TaskRecord>(payload)
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  due_at?: string
  assigned_to?: string
  status?: TaskStatus
}

/**
 * Atualiza campos modificados de uma tarefa.
 * Restrição: enviar SOMENTE os campos que mudaram; nunca enviar organization_id,
 * created_by, closed_by, closed_at, lead_id, client_id nem property_id.
 */
export async function updateTask(taskId: string, changes: UpdateTaskInput): Promise<TaskRecord> {
  const payload: Record<string, unknown> = {}

  if (changes.title !== undefined) payload.title = changes.title.trim()
  if (changes.description !== undefined) payload.description = changes.description.trim()
  if (changes.due_at !== undefined) payload.due_at = changes.due_at
  if (changes.assigned_to !== undefined) payload.assigned_to = changes.assigned_to
  if (changes.status !== undefined) payload.status = changes.status

  return await pb.collection('tasks').update<TaskRecord>(taskId, payload)
}

/**
 * Conclui uma tarefa enviando somente { status: "concluida" }
 */
export async function completeTask(taskId: string): Promise<TaskRecord> {
  return await updateTask(taskId, { status: 'concluida' })
}

/**
 * Cancela uma tarefa enviando somente { status: "cancelada" }
 */
export async function cancelTask(taskId: string): Promise<TaskRecord> {
  return await updateTask(taskId, { status: 'cancelada' })
}

/**
 * Reabre uma tarefa enviando somente { status: "aberta" }
 */
export async function reopenTask(taskId: string): Promise<TaskRecord> {
  return await updateTask(taskId, { status: 'aberta' })
}
