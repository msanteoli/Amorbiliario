import pb from '@/lib/pocketbase/client'
import { RecordModel } from 'pocketbase'

export interface AgendaBlockRecord extends RecordModel {
  organization_id: string
  user_id: string
  start_at: string
  end_at: string
  reason?: string
  ended_at?: string
  created_by?: string
  created: string
  updated: string
  expand?: {
    user_id?: {
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

export interface CreateAgendaBlockInput {
  start_at: string // ISO UTC
  end_at: string // ISO UTC
  reason?: string // até 200 caracteres
  user_id?: string // se admin criando para corretor
}

export interface CreateAgendaBlockResponse {
  id: string
  user_id: string
  start_at: string
  end_at: string
}

export interface EndAgendaBlockResponse {
  id: string
  ended_at: string
}

export function formatAgendaBlockErrorMessage(
  err: unknown,
  defaultMessage = 'Ocorreu um erro ao processar o bloqueio de agenda.',
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
      return errorObj.message
    }
  }
  return defaultMessage
}

/**
 * Cria um bloqueio de agenda via POST /backend/v1/agenda-blocks
 */
export async function createAgendaBlock(
  input: CreateAgendaBlockInput,
): Promise<CreateAgendaBlockResponse> {
  const body: Record<string, unknown> = {
    start_at: input.start_at,
    end_at: input.end_at,
  }
  if (input.reason) {
    body.reason = input.reason.trim().slice(0, 200)
  }
  if (input.user_id) {
    body.user_id = input.user_id
  }

  return await pb.send<CreateAgendaBlockResponse>('/backend/v1/agenda-blocks', {
    method: 'POST',
    body,
  })
}

/**
 * Encerra um bloqueio de agenda via POST /backend/v1/agenda-blocks/{id}/end
 */
export async function endAgendaBlock(id: string): Promise<EndAgendaBlockResponse> {
  return await pb.send<EndAgendaBlockResponse>(
    `/backend/v1/agenda-blocks/${encodeURIComponent(id)}/end`,
    {
      method: 'POST',
    },
  )
}

/**
 * Lista bloqueios ativos (sem ended_at) e futuros de GET /api/collections/agenda_blocks/records.
 * O servidor PocketBase já filtra os do corretor por apiRules (role corretor vê apenas os seus).
 * Opcionalmente aceita userId para filtrar no caso de admin.
 */
export async function listActiveAndFutureAgendaBlocks(
  userId?: string,
): Promise<AgendaBlockRecord[]> {
  const filters: string[] = ['ended_at = ""']
  if (userId) {
    filters.push(`user_id = "${userId}"`)
  }

  return await pb.collection('agenda_blocks').getFullList<AgendaBlockRecord>({
    filter: filters.join(' && '),
    sort: 'start_at',
    expand: 'user_id,created_by',
    requestKey: null,
  })
}

/**
 * Retorna se o corretor possui um bloqueio ativo agora (sem ended_at, start_at <= now < end_at).
 * Se houver, retorna o registro do bloqueio; caso contrário null.
 */
export async function getCurrentActiveAgendaBlock(
  userId?: string,
): Promise<AgendaBlockRecord | null> {
  const blocks = await listActiveAndFutureAgendaBlocks(userId)
  const nowMs = Date.now()
  for (const b of blocks) {
    if (b.ended_at) continue
    const startMs = new Date(b.start_at.replace(' ', 'T')).getTime()
    const endMs = new Date(b.end_at.replace(' ', 'T')).getTime()
    if (startMs <= nowMs && endMs > nowMs) {
      return b
    }
  }
  return null
}
