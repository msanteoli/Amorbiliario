import pb from '@/lib/pocketbase/client'

export type NegotiationStatus = 'em_analise' | 'aprovada' | 'fechada' | 'desistiu'
export type NegotiationPurpose = 'venda' | 'locacao'
export type NegotiationPersonRole =
  | 'cliente'
  | 'fiador'
  | 'conjuge_cliente'
  | 'conjuge_fiador'
  | 'morador'
export type NegotiationDocType =
  | 'documento_foto'
  | 'cpf'
  | 'comprovante_renda'
  | 'comprovante_renda_3m'
  | 'comprovante_residencia'
  | 'certidao_estado_civil'
  | 'matricula_garantia'
  | 'contrato_social'
  | 'cnpj'
export type NegotiationDocState = 'pendente' | 'recebido' | 'conferido'

export const NEGOTIATION_STATUS_LABELS: Record<NegotiationStatus, string> = {
  em_analise: 'Em análise',
  aprovada: 'Aprovada',
  fechada: 'Fechada',
  desistiu: 'Desistiu',
}

export const NEGOTIATION_PURPOSE_LABELS: Record<NegotiationPurpose, string> = {
  venda: 'Venda',
  locacao: 'Locação',
}

export const NEGOTIATION_PERSON_ROLE_LABELS: Record<NegotiationPersonRole, string> = {
  cliente: 'Cliente',
  fiador: 'Fiador',
  conjuge_cliente: 'Cônjuge do cliente',
  conjuge_fiador: 'Cônjuge do fiador',
  morador: 'Morador',
}

export const NEGOTIATION_DOC_TYPE_LABELS: Record<NegotiationDocType, string> = {
  documento_foto: 'Documento com foto (RG ou CNH)',
  cpf: 'CPF',
  comprovante_renda: 'Comprovante de renda',
  comprovante_renda_3m: 'Comprovante de renda dos últimos 3 meses',
  comprovante_residencia: 'Comprovante de residência',
  certidao_estado_civil: 'Certidão de estado civil',
  matricula_garantia: 'Matrícula do imóvel de garantia',
  contrato_social: 'Contrato social',
  cnpj: 'CNPJ',
}

export const NEGOTIATION_DOC_STATE_LABELS: Record<NegotiationDocState, string> = {
  pendente: 'Pendente',
  recebido: 'Recebido',
  conferido: 'Conferido',
}

export interface NegotiationItem {
  id: string
  status: NegotiationStatus
  purpose: NegotiationPurpose
  agreed_value: number
  property_id: string
  property_code?: string
  responsible_id?: string
  closed_at?: string
  notes?: string
  created?: string
}

export interface NegotiationListResponse {
  items: NegotiationItem[]
}

export interface OpenNegotiationPayload {
  property_id: string
  purpose: NegotiationPurpose
  agreed_value?: number | null
}

export interface UpdateNegotiationPayload {
  status?: NegotiationStatus
  agreed_value?: number | null
  notes?: string
}

export interface ChecklistPerson {
  id: string
  client_id: string
  name: string
  role: NegotiationPersonRole
}

export interface ChecklistDocument {
  id: string
  person_id: string
  doc_type: NegotiationDocType
  state: NegotiationDocState
  files: string[]
  checked_at?: string
}

export interface NegotiationChecklistResponse {
  negotiation: {
    id: string
    status: NegotiationStatus
    purpose: NegotiationPurpose
  }
  people: ChecklistPerson[]
  documents: ChecklistDocument[]
  total: number
  received: number
  checked: number
  missing: number
}

export interface AddPersonExistingPayload {
  role: NegotiationPersonRole
  client_id: string
}

export interface AddPersonNewPayload {
  role: NegotiationPersonRole
  new: {
    name: string
    phone?: string
    email?: string
  }
}

export type AddPersonPayload = AddPersonExistingPayload | AddPersonNewPayload

export interface AddPersonResponse {
  person_id: string
  client_id: string
  documents: number
}

export interface DocumentUploadResponse {
  id: string
  state: NegotiationDocState
  files: string[]
}

export interface DocumentCheckResponse {
  id: string
  state: NegotiationDocState
}

export function formatNegotiationErrorMessage(
  err: unknown,
  defaultMessage = 'Ocorreu um erro ao processar a negociação.',
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
      if (errorObj.message.includes('requires admin privileges')) {
        return 'Permissão de administrador necessária.'
      }
      return errorObj.message
    }
  }
  return defaultMessage
}

/**
 * 1. Lista negociações do lead
 * GET /backend/v1/leads/{id}/negotiations
 */
export async function listLeadNegotiations(leadId: string): Promise<NegotiationItem[]> {
  const res = await pb.send<NegotiationListResponse>(
    `/backend/v1/leads/${encodeURIComponent(leadId)}/negotiations`,
    {
      method: 'GET',
      requestKey: null,
    },
  )
  return res.items || []
}

/**
 * 2. Abrir negociação
 * POST /backend/v1/leads/{id}/negotiation
 */
export async function openNegotiation(
  leadId: string,
  payload: OpenNegotiationPayload,
): Promise<{ id: string; status: string; purpose: string; property_id: string }> {
  return await pb.send<{ id: string; status: string; purpose: string; property_id: string }>(
    `/backend/v1/leads/${encodeURIComponent(leadId)}/negotiation`,
    {
      method: 'POST',
      body: payload,
    },
  )
}

/**
 * 3. Editar negociação aberta (situação em_analise, aprovada, desistiu; valor; observações)
 * PATCH /backend/v1/negotiations/{id}
 */
export async function updateNegotiation(
  negotiationId: string,
  payload: UpdateNegotiationPayload,
): Promise<{ id: string; status: NegotiationStatus }> {
  return await pb.send<{ id: string; status: NegotiationStatus }>(
    `/backend/v1/negotiations/${encodeURIComponent(negotiationId)}`,
    {
      method: 'PATCH',
      body: payload,
    },
  )
}

/**
 * 3. Fechar negócio
 * POST /backend/v1/negotiations/{id}/close
 */
export async function closeNegotiation(
  negotiationId: string,
): Promise<{ id: string; status: 'fechada' }> {
  return await pb.send<{ id: string; status: 'fechada' }>(
    `/backend/v1/negotiations/${encodeURIComponent(negotiationId)}/close`,
    {
      method: 'POST',
    },
  )
}

/**
 * 4. Obter checklist (pessoas e documentos)
 * GET /backend/v1/negotiations/{id}/checklist
 */
export async function getNegotiationChecklist(
  negotiationId: string,
): Promise<NegotiationChecklistResponse> {
  return await pb.send<NegotiationChecklistResponse>(
    `/backend/v1/negotiations/${encodeURIComponent(negotiationId)}/checklist`,
    {
      method: 'GET',
      requestKey: null,
    },
  )
}

/**
 * 4. Adicionar pessoa à negociação
 * POST /backend/v1/negotiations/{id}/people
 */
export async function addNegotiationPerson(
  negotiationId: string,
  payload: AddPersonPayload,
): Promise<AddPersonResponse> {
  return await pb.send<AddPersonResponse>(
    `/backend/v1/negotiations/${encodeURIComponent(negotiationId)}/people`,
    {
      method: 'POST',
      body: payload,
    },
  )
}

/**
 * 4. Remover pessoa da negociação
 * POST /backend/v1/negotiations/{id}/people/{pid}/remove
 */
export async function removeNegotiationPerson(
  negotiationId: string,
  personId: string,
): Promise<{ person_id: string; active: boolean }> {
  return await pb.send<{ person_id: string; active: boolean }>(
    `/backend/v1/negotiations/${encodeURIComponent(negotiationId)}/people/${encodeURIComponent(personId)}/remove`,
    {
      method: 'POST',
    },
  )
}

/**
 * 5. Enviar arquivo para documento do checklist
 * POST /backend/v1/negotiations/{id}/documents/{did}/upload
 */
export async function uploadNegotiationDocument(
  negotiationId: string,
  documentId: string,
  file: File,
): Promise<DocumentUploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  return await pb.send<DocumentUploadResponse>(
    `/backend/v1/negotiations/${encodeURIComponent(negotiationId)}/documents/${encodeURIComponent(documentId)}/upload`,
    {
      method: 'POST',
      body: formData,
    },
  )
}

/**
 * 5. Abrir arquivo autenticado com fetch e token e exibir em nova aba (blob URL)
 * GET /backend/v1/negotiations/{id}/documents/{did}/file?name=<nome>
 */
export async function openNegotiationDocumentFile(
  negotiationId: string,
  documentId: string,
  fileName: string,
): Promise<void> {
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || ''
  const token = pb.authStore.token || ''
  const qs = fileName ? `?name=${encodeURIComponent(fileName)}` : ''
  const url = `${baseUrl}/backend/v1/negotiations/${encodeURIComponent(negotiationId)}/documents/${encodeURIComponent(documentId)}/file${qs}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  })

  if (!response.ok) {
    let errMessage = 'Não foi possível baixar o arquivo.'
    try {
      const data = await response.json()
      if (data && data.message) errMessage = data.message
    } catch {
      // ignore
    }
    throw new Error(errMessage)
  }

  const blob = await response.blob()
  const blobUrl = URL.createObjectURL(blob)
  window.open(blobUrl, '_blank', 'noopener,noreferrer')
}

/**
 * 5. Conferir documento
 * POST /backend/v1/negotiations/{id}/documents/{did}/check
 */
export async function checkNegotiationDocument(
  negotiationId: string,
  documentId: string,
): Promise<DocumentCheckResponse> {
  return await pb.send<DocumentCheckResponse>(
    `/backend/v1/negotiations/${encodeURIComponent(negotiationId)}/documents/${encodeURIComponent(documentId)}/check`,
    {
      method: 'POST',
    },
  )
}
