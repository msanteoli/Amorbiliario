import pb from '@/lib/pocketbase/client'

export interface BackupCounts {
  leads?: number
  lead_events?: number
  clients?: number
  client_private?: number
  properties?: number
  property_photos?: number
  condominiums?: number
  condominium_photos?: number
  visits?: number
  tasks?: number
  property_visit_slots?: number
  users?: number
  organizations?: number
  [key: string]: number | undefined
}

export interface BackupExportData {
  generated_at: string
  scope: 'completo' | 'operacional' | string
  organization_id: string
  counts: BackupCounts
  collections: Record<string, unknown[]>
}

export interface BackupExportResult {
  filename: string
  data: BackupExportData
}

export interface BackupRemindResponse {
  created: boolean
  task_id: string
}

export function formatBackupErrorMessage(
  err: unknown,
  defaultMessage = 'Ocorreu um erro ao comunicar com o servidor.',
): string {
  if (!err) return defaultMessage
  if (typeof err === 'object' && err !== null) {
    const errorObj = err as Record<string, unknown>

    if (
      errorObj.status === 403 ||
      (errorObj.response as Record<string, unknown> | undefined)?.status === 403
    ) {
      return 'Acesso negado. Apenas administradores e SDRs podem exportar dados.'
    }

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
      if (
        errorObj.message.includes('NetworkError') ||
        errorObj.message.includes('Failed to fetch')
      ) {
        return 'Erro de conexão. Verifique sua internet e tente novamente.'
      }
      return errorObj.message
    }
  }
  return defaultMessage
}

/**
 * Extrai o nome do arquivo a partir do header Content-Disposition ou fallback
 */
export function extractFilenameFromContentDisposition(
  contentDisposition: string | null,
  fallbackDate = new Date(),
): string {
  if (contentDisposition) {
    // Tenta formato filename="backup-YYYY-MM-DD.json" ou filename=backup-YYYY-MM-DD.json
    const match = /filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?/i.exec(contentDisposition)
    if (match && match[1]) {
      const cleaned = match[1].trim()
      if (cleaned) return cleaned
    }
  }
  const day = fallbackDate.toISOString().slice(0, 10)
  return `backup-${day}.json`
}

/**
 * Chama GET /backend/v1/backup/export com o token de autorização atual,
 * lê a resposta, extrai o nome do arquivo do header Content-Disposition,
 * dispara o download como arquivo JSON e retorna os metadados (counts, scope, etc).
 */
export async function exportBackup(): Promise<BackupExportResult> {
  const token = pb.authStore.token
  const baseUrl = pb.baseUrl || ''
  const url = `${baseUrl}/backend/v1/backup/export`

  const headers: HeadersInit = {
    Accept: 'application/json',
  }
  if (token) {
    headers['Authorization'] = token
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
    })
  } catch (netErr) {
    throw new Error('Falha na conexão de rede. Verifique sua conexão e tente novamente.')
  }

  if (!response.ok) {
    let errorMessage = `Erro na exportação (código ${response.status}).`
    try {
      const errJson = await response.json()
      if (errJson && typeof errJson.message === 'string') {
        errorMessage = errJson.message
      }
    } catch {
      // resposta não é json
    }
    const errorObj = new Error(errorMessage)
    ;(errorObj as unknown as { status: number }).status = response.status
    throw errorObj
  }

  const contentDisposition = response.headers.get('content-disposition')
  const filename = extractFilenameFromContentDisposition(contentDisposition)

  // Lê a resposta como texto/blob para download e converte para JSON para extrair counts e scope
  const textData = await response.text()
  const data = JSON.parse(textData) as BackupExportData

  // Dispara o download no navegador usando Blob
  const blob = new Blob([textData], { type: 'application/json;charset=utf-8' })
  const downloadUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = downloadUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.URL.revokeObjectURL(downloadUrl)

  return {
    filename,
    data,
  }
}

/**
 * Chama POST /backend/v1/backup/remind (somente admin).
 */
export async function createBackupReminder(): Promise<BackupRemindResponse> {
  return await pb.send<BackupRemindResponse>('/backend/v1/backup/remind', {
    method: 'POST',
  })
}
