import pb from '@/lib/pocketbase/client'

export type GoogleConnectionStatus = 'conectado' | 'reconectar' | 'nao_conectado'

export interface GoogleStatusResponse {
  status: GoogleConnectionStatus
  google_email: string
}

export interface GoogleConnectResponse {
  url: string
}

export interface GoogleFinishPayload {
  code: string
  state: string
}

export interface GoogleFinishResponse {
  status: GoogleConnectionStatus
  google_email: string
}

export interface GoogleDisconnectResponse {
  status: 'nao_conectado'
}

export class GoogleIntegrationConfigError extends Error {
  constructor(message = 'Integração com o Google ainda não configurada.') {
    super(message)
    this.name = 'GoogleIntegrationConfigError'
  }
}

/**
 * Extrai mensagem em português a partir de erro do PocketBase / HTTP
 */
export function extractGoogleErrorMessage(
  err: unknown,
  defaultMessage = 'Não foi possível conectar a agenda do Google. Tente de novo.',
): string {
  if (!err) return defaultMessage
  if (typeof err === 'object' && err !== null) {
    const errorObj = err as Record<string, unknown>
    if (errorObj.status === 503) {
      return 'Integração com o Google ainda não configurada.'
    }
    if (errorObj.data && typeof errorObj.data === 'object') {
      const data = errorObj.data as Record<string, unknown>
      if (typeof data.message === 'string' && data.message.trim()) {
        return data.message
      }
    }
    const response = errorObj.response as Record<string, unknown> | undefined
    if (response) {
      if (typeof response.message === 'string' && response.message.trim()) {
        return response.message
      }
      if (response.data && typeof response.data === 'object') {
        const rData = response.data as Record<string, unknown>
        if (typeof rData.message === 'string' && rData.message.trim()) {
          return rData.message
        }
      }
    }
    if (typeof errorObj.message === 'string' && errorObj.message.trim()) {
      if (errorObj.message === 'Failed to authenticate.') return 'Falha na autenticação.'
      return errorObj.message
    }
  }
  return defaultMessage
}

/**
 * GET /backend/v1/google/status
 * Devolve a situação da conexão com a agenda. Falha deve ser tratada como silenciosa nos chamadores.
 */
export async function getGoogleStatus(): Promise<GoogleStatusResponse> {
  return await pb.send<GoogleStatusResponse>('/backend/v1/google/status', {
    method: 'GET',
    requestKey: null,
  })
}

/**
 * GET /backend/v1/google/connect
 * Retorna a URL de autorização da Google Agenda.
 */
export async function getGoogleConnectUrl(): Promise<string> {
  try {
    const res = await pb.send<GoogleConnectResponse>('/backend/v1/google/connect', {
      method: 'GET',
      requestKey: null,
    })
    return res.url
  } catch (err: unknown) {
    const errorObj = err as { status?: number; data?: { message?: string } } | undefined
    if (errorObj?.status === 503) {
      throw new GoogleIntegrationConfigError('Integração com o Google ainda não configurada.')
    }
    throw err
  }
}

/**
 * POST /backend/v1/google/finish
 * Conclui a autorização enviando {code, state}.
 */
export async function finishGoogleConnection(
  payload: GoogleFinishPayload,
): Promise<GoogleFinishResponse> {
  return await pb.send<GoogleFinishResponse>('/backend/v1/google/finish', {
    method: 'POST',
    body: payload,
    requestKey: null,
  })
}

/**
 * POST /backend/v1/google/disconnect
 * Desconecta a Google Agenda e remove eventos futuros criados pelo sistema.
 */
export async function disconnectGoogle(): Promise<GoogleDisconnectResponse> {
  return await pb.send<GoogleDisconnectResponse>('/backend/v1/google/disconnect', {
    method: 'POST',
    requestKey: null,
  })
}
