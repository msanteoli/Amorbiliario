import pb from '@/lib/pocketbase/client'

export interface SiteLink {
  label: string
  url: string
}

export interface SiteSettings {
  about_title: string
  about_text: string
  address: string
  hours: string
  phone: string
  email: string
  instagram: string
  whatsapp: string
  links: SiteLink[]
  primary_color: string
  logo_asset_id?: string
  favicon_asset_id?: string
  logo_url?: string
  favicon_url?: string
}

export interface AdminSiteResponse {
  settings: SiteSettings
  publicacoes: number
  versao_ativa: number
}

export interface UpdateSiteSettingsPayload {
  about_title?: string
  about_text?: string
  address?: string
  hours?: string
  phone?: string
  email?: string
  instagram?: string
  whatsapp?: string
  links?: SiteLink[]
  primary_color?: string
  logo_asset_id?: string
  favicon_asset_id?: string
}

export interface SiteAssetUploadResponse {
  id: string
  url: string
}

export interface SitePreviewResponse {
  token: string
  expires_at: string
}

export interface SitePublishResponse {
  publication_id: string
  version: number
}

export interface SiteUndoResponse {
  publication_id: string
  version: number
}

/**
 * Converte URLs relativas (/api/files/...) em URLs completas com o base URL do PocketBase.
 * URLs que já começam com http/https ou data: passam direto.
 */
export function resolveAssetUrl(url?: string | null): string {
  if (!url) return ''
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed
  }
  const base = pb.baseURL ? pb.baseURL.replace(/\/+$/, '') : ''
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return `${base}${path}`
}

export function formatSiteErrorMessage(err: unknown, defaultMessage = 'Ocorreu um erro.'): string {
  if (!err) return defaultMessage
  if (typeof err === 'object' && err !== null) {
    const errorObj = err as Record<string, unknown>
    // 409 status check
    const status =
      errorObj.status || (errorObj.response as Record<string, unknown> | undefined)?.status
    if (status === 409) {
      return 'Não há versão anterior para voltar.'
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
      if (errorObj.message === 'The request requires admin privileges.') {
        return 'Permissão de administrador necessária.'
      }
      return errorObj.message
    }
  }
  return defaultMessage
}

/**
 * GET /backend/v1/admin/site
 */
export async function getAdminSite(): Promise<AdminSiteResponse> {
  return await pb.send<AdminSiteResponse>('/backend/v1/admin/site', {
    method: 'GET',
    requestKey: null,
  })
}

/**
 * PUT /backend/v1/admin/site/settings
 * Envia corpo JSON apenas com os campos modificados
 */
export async function updateAdminSiteSettings(
  changes: UpdateSiteSettingsPayload,
): Promise<{ settings: SiteSettings }> {
  return await pb.send<{ settings: SiteSettings }>('/backend/v1/admin/site/settings', {
    method: 'PUT',
    body: changes,
  })
}

/**
 * POST /backend/v1/admin/site/assets
 * Envia multipart com file e kind ('logo' | 'favicon')
 */
export async function uploadSiteAsset(
  file: File | Blob,
  kind: 'logo' | 'favicon',
  fileName = 'asset.webp',
): Promise<SiteAssetUploadResponse> {
  const formData = new FormData()
  formData.append('file', file, fileName)
  formData.append('kind', kind)

  return await pb.send<SiteAssetUploadResponse>('/backend/v1/admin/site/assets', {
    method: 'POST',
    body: formData,
  })
}

/**
 * POST /backend/v1/admin/site/preview
 */
export async function createSitePreview(): Promise<SitePreviewResponse> {
  return await pb.send<SitePreviewResponse>('/backend/v1/admin/site/preview', {
    method: 'POST',
  })
}

/**
 * POST /backend/v1/admin/site/publish
 */
export async function publishSite(): Promise<SitePublishResponse> {
  return await pb.send<SitePublishResponse>('/backend/v1/admin/site/publish', {
    method: 'POST',
  })
}

/**
 * POST /backend/v1/admin/site/undo
 */
export async function undoSitePublication(): Promise<SiteUndoResponse> {
  return await pb.send<SiteUndoResponse>('/backend/v1/admin/site/undo', {
    method: 'POST',
  })
}
