import pb from '@/lib/pocketbase/client'
import { RecordModel } from 'pocketbase'

export interface AdminUserItem {
  id: string
  name: string
  email: string
  role: 'admin' | 'sdr' | 'corretor' | string
  active: boolean
}

export interface AdminUsersResponse {
  items: AdminUserItem[]
}

export interface InviteUserPayload {
  name: string
  email: string
  role: 'admin' | 'sdr' | 'corretor' | string
  send_invite?: boolean
}

export interface InviteUserResponse {
  id: string
  email_sent: boolean
  invited?: boolean
}

export interface ReinviteUserResponse {
  email_sent: boolean
}

export interface OpenItemsResponse {
  leads: number
  visits: number
  tasks: number
}

export interface OrganizationRecord extends RecordModel {
  name: string
  slug: string
  timezone: string
  contact_phone?: string
  contact_email?: string
  address?: string
  whatsapp_number?: string
}

export interface UpdateOrganizationPayload {
  name?: string
  contact_phone?: string
  contact_email?: string
  address?: string
}

export interface AuditLogRecord extends RecordModel {
  organization_id: string
  actor_id: string
  actor_role: string
  action: string
  collection_name: string
  record_id: string
  field_name?: string
  reason?: string
  occurred_at: string
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  acesso_negado: 'Acesso negado',
  imovel_criado: 'Imóvel cadastrado',
  imovel_alterado: 'Imóvel alterado',
  dados_confirmados: 'Dados confirmados',
  lead_origem_corrigida: 'Origem do lead corrigida',
  visita_remarcada: 'Visita remarcada',
  visita_cancelada: 'Visita cancelada',
  organizacao_alterada: 'Organização alterada',
  usuario_convidado: 'Usuário convidado',
  usuario_convite_reenviado: 'Convite reenviado',
}

export const AUDIT_REASON_LABELS: Record<string, string> = {
  papel_sem_permissao: 'Papel sem permissão',
  conta_inativa: 'Conta inativa',
}

export function formatAdminErrorMessage(err: unknown, defaultMessage = 'Ocorreu um erro.'): string {
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
      if (errorObj.message === 'The request requires admin privileges.')
        return 'Permissão de administrador necessária.'
      return errorObj.message
    }
  }
  return defaultMessage
}

/**
 * GET /backend/v1/admin/users
 */
export async function listAdminUsers(): Promise<AdminUserItem[]> {
  const res = await pb.send<AdminUsersResponse>('/backend/v1/admin/users', {
    method: 'GET',
    requestKey: null,
  })
  return res.items || []
}

/**
 * POST /backend/v1/admin/users
 */
export async function inviteAdminUser(payload: InviteUserPayload): Promise<InviteUserResponse> {
  return await pb.send<InviteUserResponse>('/backend/v1/admin/users', {
    method: 'POST',
    body: payload,
  })
}

/**
 * POST /backend/v1/admin/users/{id}/invite
 */
export async function reinviteAdminUser(userId: string): Promise<ReinviteUserResponse> {
  return await pb.send<ReinviteUserResponse>(`/backend/v1/admin/users/${userId}/invite`, {
    method: 'POST',
  })
}

/**
 * GET /backend/v1/admin/users/{id}/open-items
 */
export async function getUserOpenItems(userId: string): Promise<OpenItemsResponse> {
  return await pb.send<OpenItemsResponse>(`/backend/v1/admin/users/${userId}/open-items`, {
    method: 'GET',
    requestKey: null,
  })
}

/**
 * Atualiza usuário existente via coleção 'users' enviando apenas o que mudou.
 * NUNCA envia email, password, organization_id nem passwordConfirm.
 */
export async function updateAdminUser(
  userId: string,
  changes: { name?: string; role?: string; active?: boolean; intake_types?: string },
): Promise<RecordModel> {
  return await pb.collection('users').update(userId, changes)
}

// Especialidades do corretor (users.intake_types, texto separado por vírgula): usadas na sugestão de corretor do lead.
// Valores: finalidades (venda, locacao, captacao) e tipos de imóvel (casa, apartamento, ...).
export const BROKER_SPECIALTY_OPTIONS: Array<{
  group: string
  items: Array<{ value: string; label: string }>
}> = [
  {
    group: 'Atendimento',
    items: [
      { value: 'venda', label: 'Venda' },
      { value: 'locacao', label: 'Locação' },
      { value: 'captacao', label: 'Captação (proprietários que querem anunciar)' },
    ],
  },
  {
    group: 'Tipo de imóvel',
    items: [
      { value: 'casa', label: 'Casa' },
      { value: 'apartamento', label: 'Apartamento' },
      { value: 'terreno', label: 'Terreno' },
      { value: 'comercial', label: 'Sala ou loja comercial' },
      { value: 'galpao', label: 'Galpão' },
      { value: 'chacara', label: 'Chácara ou sítio' },
      { value: 'outro', label: 'Outro' },
    ],
  },
]

export async function getUserIntakeTypes(userId: string): Promise<string> {
  const rec = await pb.collection('users').getOne(userId, { requestKey: null })
  return String(rec.intake_types || '')
}

/**
 * Busca o registro da organização do usuário logado
 */
export async function getOrganization(): Promise<OrganizationRecord> {
  const orgId = pb.authStore.record?.organization_id
  if (orgId) {
    return await pb
      .collection('organizations')
      .getOne<OrganizationRecord>(orgId, { requestKey: null })
  }
  return await pb
    .collection('organizations')
    .getFirstListItem<OrganizationRecord>('', { requestKey: null })
}

/**
 * Atualiza campos da organização enviando só o que mudou (nunca slug nem timezone)
 */
export async function updateOrganization(
  orgId: string,
  changes: UpdateOrganizationPayload,
): Promise<OrganizationRecord> {
  return await pb.collection('organizations').update<OrganizationRecord>(orgId, changes)
}

export interface ListAuditLogParams {
  page?: number
  perPage?: number
  startDateIso?: string
  endDateIso?: string
  action?: string
  actorId?: string
  collectionName?: string
}

export interface AuditLogListResult {
  items: AuditLogRecord[]
  totalItems: number
  totalPages: number
  page: number
}

/**
 * Lista audit_log com paginação de 50 por página, mais novos primeiro
 */
export async function listAuditLogs(params: ListAuditLogParams = {}): Promise<AuditLogListResult> {
  const filters: string[] = []

  if (params.startDateIso) {
    filters.push(`occurred_at >= "${params.startDateIso}"`)
  }
  if (params.endDateIso) {
    filters.push(`occurred_at <= "${params.endDateIso}"`)
  }
  if (params.action && params.action !== 'all') {
    filters.push(`action = "${params.action}"`)
  }
  if (params.actorId && params.actorId !== 'all') {
    filters.push(`actor_id = "${params.actorId}"`)
  }
  if (params.collectionName && params.collectionName !== 'all') {
    filters.push(`collection_name = "${params.collectionName}"`)
  }

  const page = params.page || 1
  const perPage = params.perPage || 50

  const res = await pb.collection('audit_log').getList<AuditLogRecord>(page, perPage, {
    filter: filters.length > 0 ? filters.join(' && ') : undefined,
    sort: '-occurred_at',
    requestKey: null,
  })

  return {
    items: res.items,
    totalItems: res.totalItems,
    totalPages: res.totalPages,
    page: res.page,
  }
}

// ═══════════════════════════════════════════════════════════════════════
// IMPORTAÇÃO DE IMÓVEIS (M2b)
// ═══════════════════════════════════════════════════════════════════════

export interface PropertyComparisonSnapshot {
  code?: string
  status?: string
  street?: string
  street_number?: string
  complement?: string
  neighborhood?: string
  sale_price?: number
  rent_price?: number
}

export interface PropertyImportItemResult {
  row: number
  code: string
  outcome: 'aceito' | 'pendente' | 'recusado'
  reasons: string[]
  notas: string[]
  comparison?: {
    existing: PropertyComparisonSnapshot
    incoming: PropertyComparisonSnapshot
  }
}

export interface PropertyImportSimulationResponse {
  dry_run: boolean
  batch_id: string | null
  counts: {
    aceito: number
    pendente: number
    recusado: number
  }
  items: PropertyImportItemResult[]
  condominios?: {
    criados: number
    reaproveitados: number
    parecidos: Array<{ novo: string; existente: string }>
  }
}

export interface ImportBatchItem {
  id: string
  kind: string
  filename: string
  state: string
  counts: {
    aceito: number
    pendente: number
    recusado: number
  }
  created: string
}

export interface ListImportBatchesResponse {
  items: ImportBatchItem[]
}

export interface UndoImportBatchResponse {
  undone: number
  skipped: number
  condominiums_deactivated?: number
}

/**
 * Envia linhas para simulação ou confirmação de importação de imóveis (POST /backend/v1/admin/imports/properties)
 * No máximo 500 linhas por chamada.
 */
export async function importPropertiesEndpoint(params: {
  rows: Record<string, unknown>[]
  dry_run: boolean
  filename?: string
  default_captor_id?: string
}): Promise<PropertyImportSimulationResponse> {
  const body: Record<string, unknown> = {
    rows: params.rows,
    dry_run: params.dry_run,
    filename: params.filename,
  }
  if (params.default_captor_id) {
    body.default_captor_id = params.default_captor_id
  }
  return await pb.send<PropertyImportSimulationResponse>('/backend/v1/admin/imports/properties', {
    method: 'POST',
    body,
  })
}

/**
 * Lista o histórico de importações anteriores (GET /backend/v1/admin/imports)
 */
export async function listImportBatches(): Promise<ImportBatchItem[]> {
  const res = await pb.send<ListImportBatchesResponse>('/backend/v1/admin/imports', {
    method: 'GET',
  })
  return res.items || []
}

/**
 * Desfaz uma importação (POST /backend/v1/admin/imports/{id}/undo)
 */
export async function undoImportBatch(batchId: string): Promise<UndoImportBatchResponse> {
  return await pb.send<UndoImportBatchResponse>(
    `/backend/v1/admin/imports/${encodeURIComponent(batchId)}/undo`,
    {
      method: 'POST',
    },
  )
}

// ═══════════════════════════════════════════════════════════════════════
// ACESSO MCP (ADMINISTRAÇÃO)
// ═════════════════════════════════════════════════════════════════

export interface McpKeyItem {
  id: string
  name: string
  user_id: string
  token_prefix: string
  scope: 'leitura' | 'leitura_escrita' | string
  active: boolean
  revoked_at: string
  last_used_at: string
  created: string
}

export interface McpAdminStatusResponse {
  enabled: boolean
  keys: McpKeyItem[]
}

export interface CreateMcpKeyPayload {
  name: string
  user_id: string
  scope: 'leitura' | 'leitura_escrita'
}

export interface CreateMcpKeyResponse {
  id: string
  token_prefix: string
  token: string
  scope: string
}

export interface RevokeMcpKeyResponse {
  id: string
  active: boolean
}

/**
 * GET /backend/v1/admin/mcp
 */
export async function getMcpAdminStatus(): Promise<McpAdminStatusResponse> {
  return await pb.send<McpAdminStatusResponse>('/backend/v1/admin/mcp', {
    method: 'GET',
    requestKey: null,
  })
}

/**
 * POST /backend/v1/admin/mcp/enable
 */
export async function enableMcp(): Promise<{ enabled: boolean }> {
  return await pb.send<{ enabled: boolean }>('/backend/v1/admin/mcp/enable', {
    method: 'POST',
  })
}

/**
 * POST /backend/v1/admin/mcp/disable
 */
export async function disableMcp(): Promise<{ enabled: boolean }> {
  return await pb.send<{ enabled: boolean }>('/backend/v1/admin/mcp/disable', {
    method: 'POST',
  })
}

/**
 * POST /backend/v1/admin/mcp/keys
 */
export async function createMcpKey(payload: CreateMcpKeyPayload): Promise<CreateMcpKeyResponse> {
  return await pb.send<CreateMcpKeyResponse>('/backend/v1/admin/mcp/keys', {
    method: 'POST',
    body: payload,
  })
}

/**
 * POST /backend/v1/admin/mcp/keys/{id}/revoke
 */
export async function revokeMcpKey(id: string): Promise<RevokeMcpKeyResponse> {
  return await pb.send<RevokeMcpKeyResponse>(
    `/backend/v1/admin/mcp/keys/${encodeURIComponent(id)}/revoke`,
    {
      method: 'POST',
    },
  )
}
