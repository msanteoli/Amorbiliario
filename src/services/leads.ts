import pb from '@/lib/pocketbase/client'
import { ClientResponseError, RecordModel } from 'pocketbase'

export type LeadStage =
  | 'novo'
  | 'em_atendimento'
  | 'visita_marcada'
  | 'proposta'
  | 'ganho'
  | 'perdido'

export type LeadOrigin =
  | 'whatsapp'
  | 'portal'
  | 'indicacao_balcao'
  | 'site_redes_outros'
  | 'ligacao'
  | 'site'
  | 'redes_sociais'

export type LostReason = 'sem_retorno' | 'desistencia' | 'duplicado'

export type DedupeStatus = 'pendente' | 'resolvido_separado' | 'resolvido_mesma_pessoa'

export type LeadEventType =
  | 'criado'
  | 'nota'
  | 'contato'
  | 'estagio'
  | 'atribuicao'
  | 'proximo_passo'
  | 'ficha_enviada'
  | 'convertido'
  | 'origem_corrigida'
  | 'pendencia_dedupe'
  | 'dedupe_resolvido'
  | 'contato_repetido'

export type LeadConsentStatus = 'opt_in' | 'opt_out' | 'unknown'

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  novo: 'Novo',
  em_atendimento: 'Em atendimento',
  visita_marcada: 'Visita marcada',
  proposta: 'Proposta',
  ganho: 'Ganho',
  perdido: 'Perdido',
}

export const LEAD_ORIGIN_LABELS: Record<LeadOrigin, string> = {
  whatsapp: 'WhatsApp',
  portal: 'Portais imobiliários',
  indicacao_balcao: 'Indicação ou balcão',
  site_redes_outros: 'Instagram, site e outros',
  ligacao: 'Ligação',
  site: 'Site',
  redes_sociais: 'Redes sociais',
}

export const LOST_REASON_LABELS: Record<LostReason, string> = {
  sem_retorno: 'Sem retorno',
  desistencia: 'Desistência',
  duplicado: 'Duplicado',
}

export const LEAD_EVENT_TYPE_LABELS: Record<LeadEventType, string> = {
  criado: 'Criado',
  nota: 'Nota',
  contato: 'Contato',
  estagio: 'Etapa',
  atribuicao: 'Atribuição',
  proximo_passo: 'Próximo passo',
  ficha_enviada: 'Ficha enviada',
  convertido: 'Convertido',
  origem_corrigida: 'Origem corrigida',
  pendencia_dedupe: 'Pendência de duplicidade',
  dedupe_resolvido: 'Duplicidade resolvida',
  contato_repetido: 'Novo contato',
}

export interface LeadUserRecord {
  id: string
  name?: string
  email?: string
  role?: string
}

export interface LeadPropertyRecord {
  id: string
  code: string
  title: string
  status?: string
}

export interface LeadClientRecord {
  id: string
  name: string
  phone?: string
}

export interface LeadRecord extends RecordModel {
  organization_id: string
  name: string
  phone?: string
  email?: string
  origin: LeadOrigin
  origin_detail?: string
  property_id?: string
  search_neighborhood?: string
  search_type?: string
  search_bedrooms?: number
  search_min_price?: number
  search_max_price?: number
  search_neighborhoods?: string
  notes?: string
  consent_status: LeadConsentStatus
  stage: LeadStage
  assigned_to?: string
  next_step?: string
  next_step_due?: string
  first_contact_at?: string
  last_contact_at?: string
  client_id?: string
  lost_reason?: LostReason
  dedupe_status?: DedupeStatus
  dedupe_of?: string
  expand?: {
    assigned_to?: LeadUserRecord
    property_id?: LeadPropertyRecord
    client_id?: LeadClientRecord
  }
}

export interface LeadEventRecord extends RecordModel {
  organization_id: string
  lead_id: string
  type: LeadEventType
  author_id?: string
  occurred_at: string
  text: string
  intent_key?: string
  expand?: {
    author_id?: LeadUserRecord
  }
}

export interface LeadIntakeInput {
  name: string
  phone?: string
  email?: string
  origin: LeadOrigin
  origin_detail?: string
  property_id?: string
  search_neighborhood?: string
  search_type?: string
  search_bedrooms?: number
  search_min_price?: number
  search_max_price?: number
  search_neighborhoods?: string
  notes?: string
  consent_status?: LeadConsentStatus
  next_step?: string
  next_step_due?: string
}

export interface LeadIntakeResponse {
  status: 'created' | 'existing' | 'pending_review'
  lead_id: string
  already_client: boolean
  existing_lead_id?: string
}

export interface DedupeResolveInput {
  resolution: 'separate' | 'same_person'
}

export interface DedupeResolveResponse {
  dedupe_status: DedupeStatus
}

export interface PropertyFichaResponse {
  code: string
  text: string
}

export interface LeadFichaSentResponse {
  duplicate: boolean
}

export interface ConvertMatchClient {
  id: string
  name: string
  phone?: string
}

export interface ConvertMatchItem {
  match_by: 'phone' | 'email'
  same_name: boolean
  visible: boolean
  client: ConvertMatchClient | null
}

export interface ConvertConflictResponse {
  status: 'same_person' | 'maybe_same' | 'already_linked'
  matches?: ConvertMatchItem[]
  message?: string
}

export interface ConvertLeadInput {
  mode?: 'create' | 'link'
  client_id?: string
  kind?: string[]
  responsible_id?: string
}

export interface ConvertLeadResponse {
  client_id: string
}

export interface LeadOriginResponse {
  origin: LeadOrigin
}

export interface ListLeadsParams {
  page?: number
  perPage?: number
  search?: string
  stage?: LeadStage | ''
  origin?: LeadOrigin | ''
  assigned_to?: string | 'unassigned' | ''
  expiredOnly?: boolean
  newUnassignedOnly?: boolean
  sort?: string
}

export interface UpdateLeadDataInput {
  name?: string
  phone?: string
  email?: string
  origin_detail?: string
  property_id?: string | null
  search_neighborhood?: string
  search_type?: string | null
  search_bedrooms?: number | null
  search_min_price?: number | null
  search_max_price?: number | null
  search_neighborhoods?: string
  notes?: string
  consent_status?: LeadConsentStatus
}

/**
 * Traduz mensagens de erro de backend para português amigável
 */
export function formatLeadErrorMessage(error: unknown): string {
  if (error instanceof ClientResponseError) {
    const data = error.response?.data
    if (data && typeof data === 'object') {
      const msgs: string[] = []
      for (const [field, detail] of Object.entries(data)) {
        if (
          detail &&
          typeof detail === 'object' &&
          'message' in detail &&
          typeof (detail as { message: unknown }).message === 'string'
        ) {
          const rawMsg = (detail as { message: string }).message
          msgs.push(translateFieldMessage(field, rawMsg))
        }
      }
      if (msgs.length > 0) {
        return msgs.join(' ')
      }
    }
    const respMsg = error.response?.message
    if (typeof respMsg === 'string' && respMsg.length > 0) {
      return translateGenericLeadMessage(respMsg)
    }
    if (error.message) {
      return translateGenericLeadMessage(error.message)
    }
  }
  if (error instanceof Error) {
    return translateGenericLeadMessage(error.message)
  }
  return 'Ocorreu um erro inesperado.'
}

function translateFieldMessage(field: string, msg: string): string {
  if (msg.includes('Telefone inválido')) return 'Telefone inválido. Informe DDD e número.'
  if (msg.includes('Informe ao menos telefone')) return 'Informe ao menos telefone ou e-mail.'
  if (msg.includes('Informe o nome')) return 'Informe o nome do lead.'
  if (msg.includes('Origem inválida')) return 'Origem inválida.'
  if (msg.includes('Consentimento inválido')) return 'Consentimento inválido.'
  if (msg.includes('Imóvel inválido')) return 'Imóvel inválido.'
  if (msg.includes('Tipo de imóvel inválido')) return 'Tipo de imóvel inválido.'
  if (msg.includes('Perfil de busca inválido')) return 'Perfil de busca inválido.'
  if (msg.includes('Prazo inválido')) return 'Prazo inválido.'
  if (msg.includes('Responsável inválido')) return 'Responsável inválido.'
  if (msg.includes('Escolha o responsável')) return 'Escolha o responsável.'
  if (msg.includes('Informe o motivo da perda')) return 'Informe o motivo da perda.'
  if (msg.includes('Informe o motivo da correção')) return 'Informe o motivo da correção.'

  switch (field) {
    case 'name':
      return 'Informe o nome do lead.'
    case 'phone':
      return 'Telefone inválido. Informe DDD e número.'
    case 'email':
      return 'E-mail inválido.'
    case 'origin':
      return 'Origem inválida.'
    case 'stage':
      return 'Etapa inválida.'
    case 'lost_reason':
      return 'Informe o motivo da perda.'
    case 'assigned_to':
      return 'Responsável inválido.'
    default:
      return msg || 'Campo inválido.'
  }
}

function translateGenericLeadMessage(msg: string): string {
  if (msg.includes('Telefone inválido. Informe DDD e número.'))
    return 'Telefone inválido. Informe DDD e número.'
  if (msg.includes('Informe ao menos telefone ou e-mail.'))
    return 'Informe ao menos telefone ou e-mail.'
  if (msg.includes('Informe o nome do lead.')) return 'Informe o nome do lead.'
  if (msg.includes('Origem inválida.')) return 'Origem inválida.'
  if (msg.includes('Consentimento inválido.')) return 'Consentimento inválido.'
  if (msg.includes('Imóvel inválido.')) return 'Imóvel inválido.'
  if (msg.includes('Tipo de imóvel inválido.')) return 'Tipo de imóvel inválido.'
  if (msg.includes('Perfil de busca inválido.')) return 'Perfil de busca inválido.'
  if (msg.includes('Prazo inválido.')) return 'Prazo inválido.'
  if (msg.includes('Informe o motivo da perda.')) return 'Informe o motivo da perda.'
  if (msg.includes('Motivo inválido.')) return 'Motivo de perda inválido.'
  if (msg.includes('Responsável inválido.')) return 'Responsável inválido.'
  if (msg.includes('Escolha o responsável.')) return 'Escolha o responsável.'
  if (msg.includes('A faixa de valor está invertida.'))
    return 'A faixa de valor está invertida (o valor mínimo é maior que o máximo).'
  if (msg.includes('Informe o motivo da correção.')) return 'Informe o motivo da correção.'
  if (msg.includes('Só o SDR e o admin cadastram leads.'))
    return 'Só o SDR e o admin cadastram leads.'
  if (msg.includes('Só o SDR e o admin resolvem pendências.'))
    return 'Só o SDR e o admin resolvem pendências.'
  if (msg.includes('Só o admin corrige a origem do lead.'))
    return 'Só o admin corrige a origem do lead.'
  if (msg.includes('Lead não encontrado.')) return 'Lead não encontrado.'
  if (msg.includes('Você não tem acesso a este lead.')) return 'Você não tem acesso a este lead.'
  if (msg.includes('Só imóveis disponíveis geram ficha.'))
    return 'Só imóveis disponíveis geram ficha.'
  if (msg.includes('Papel sem acesso a estes dados.')) return 'Papel sem acesso a estes dados.'
  if (msg.includes('O corretor só altera etapa, próximo passo e prazo.'))
    return 'O corretor só altera etapa, próximo passo e prazo.'
  if (msg.includes('Este lead já está ligado a um cliente.'))
    return 'Este lead já está ligado a um cliente.'
  if (msg.includes('Escreva o texto do registro.')) return 'Escreva o texto do registro.'
  return msg
}

/**
 * Remove qualquer caractere não numérico e garante formato com prefixo 55
 */
export function normalizePhoneForBackend(phone?: string): string {
  if (!phone) return ''
  let digits = phone.replace(/\D/g, '').replace(/^0+/, '')
  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits
  }
  return digits
}

/**
 * Lista leads com paginação, filtros e expand de assigned_to e property_id
 */
export async function listLeads(params: ListLeadsParams = {}) {
  const {
    page = 1,
    perPage = 10,
    search,
    stage,
    origin,
    assigned_to,
    expiredOnly,
    newUnassignedOnly,
    sort = '-created',
  } = params

  const filterParts: string[] = []

  if (search && search.trim()) {
    const term = search.trim().replace(/['"\\]/g, '')
    const digits = search.replace(/\D/g, '').replace(/^0+/, '')
    const searchConditions: string[] = [`name ~ "${term}"`, `email ~ "${term}"`]
    if (digits) {
      searchConditions.push(`phone ~ "${digits}"`)
    }
    filterParts.push(`(${searchConditions.join(' || ')})`)
  }

  if (newUnassignedOnly) {
    filterParts.push(`stage = "novo" && (assigned_to = "" || assigned_to = null)`)
  } else {
    if (stage) {
      filterParts.push(`stage = "${stage}"`)
    }
    if (assigned_to === 'unassigned') {
      filterParts.push(`(assigned_to = "" || assigned_to = null)`)
    } else if (assigned_to) {
      filterParts.push(`assigned_to = "${assigned_to}"`)
    }
  }

  if (origin) {
    filterParts.push(`origin = "${origin}"`)
  }

  if (expiredOnly) {
    const nowIso = new Date().toISOString()
    filterParts.push(
      `next_step_due != "" && next_step_due != null && next_step_due < "${nowIso}" && stage != "ganho" && stage != "perdido"`,
    )
  }

  const filter = filterParts.join(' && ')

  return await pb.collection('leads').getList<LeadRecord>(page, perPage, {
    filter: filter || undefined,
    sort,
    expand: 'assigned_to,property_id',
  })
}

/**
 * Lista TODOS os leads para visão em funil de acordo com os filtros aplicados
 */
export async function listAllLeadsForFunnel(
  params: Omit<ListLeadsParams, 'page' | 'perPage'> = {},
) {
  const {
    search,
    stage,
    origin,
    assigned_to,
    expiredOnly,
    newUnassignedOnly,
    sort = '-created',
  } = params

  const filterParts: string[] = []

  if (search && search.trim()) {
    const term = search.trim().replace(/['"\\]/g, '')
    const digits = search.replace(/\D/g, '').replace(/^0+/, '')
    const searchConditions: string[] = [`name ~ "${term}"`, `email ~ "${term}"`]
    if (digits) {
      searchConditions.push(`phone ~ "${digits}"`)
    }
    filterParts.push(`(${searchConditions.join(' || ')})`)
  }

  if (newUnassignedOnly) {
    filterParts.push(`stage = "novo" && (assigned_to = "" || assigned_to = null)`)
  } else {
    if (stage) {
      filterParts.push(`stage = "${stage}"`)
    }
    if (assigned_to === 'unassigned') {
      filterParts.push(`(assigned_to = "" || assigned_to = null)`)
    } else if (assigned_to) {
      filterParts.push(`assigned_to = "${assigned_to}"`)
    }
  }

  if (origin) {
    filterParts.push(`origin = "${origin}"`)
  }

  if (expiredOnly) {
    const nowIso = new Date().toISOString()
    filterParts.push(
      `next_step_due != "" && next_step_due != null && next_step_due < "${nowIso}" && stage != "ganho" && stage != "perdido"`,
    )
  }

  const filter = filterParts.join(' && ')

  return await pb.collection('leads').getFullList<LeadRecord>({
    filter: filter || undefined,
    sort,
    expand: 'assigned_to,property_id',
  })
}

/**
 * Lista pendências de duplicidade (dedupe_status = "pendente")
 */
export async function listDedupePendingLeads() {
  return await pb.collection('leads').getFullList<LeadRecord>({
    filter: 'dedupe_status = "pendente"',
    sort: '-created',
    expand: 'assigned_to,property_id',
  })
}

/**
 * Busca lead por ID com expansões
 */
export async function getLeadById(id: string): Promise<LeadRecord> {
  return await pb.collection('leads').getOne<LeadRecord>(id, {
    expand: 'assigned_to,property_id,client_id',
    requestKey: null,
  })
}

/**
 * Cadastra lead através do endpoint intake (POST /backend/v1/leads/intake)
 */
export async function intakeLead(input: LeadIntakeInput): Promise<LeadIntakeResponse> {
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    origin: input.origin,
  }

  if (input.phone) {
    payload.phone = normalizePhoneForBackend(input.phone)
  }
  if (input.email) {
    payload.email = input.email.trim().toLowerCase()
  }
  if (input.origin_detail?.trim()) {
    payload.origin_detail = input.origin_detail.trim()
  }
  if (input.property_id) {
    payload.property_id = input.property_id
  }
  if (input.search_neighborhood?.trim()) {
    payload.search_neighborhood = input.search_neighborhood.trim()
  }
  if (input.search_type) {
    payload.search_type = input.search_type
  }
  if (typeof input.search_bedrooms === 'number' && input.search_bedrooms > 0) {
    payload.search_bedrooms = input.search_bedrooms
  }
  if (typeof input.search_min_price === 'number' && input.search_min_price > 0) {
    payload.search_min_price = input.search_min_price
  }
  if (typeof input.search_max_price === 'number' && input.search_max_price > 0) {
    payload.search_max_price = input.search_max_price
  }
  if (input.search_neighborhoods !== undefined) {
    payload.search_neighborhoods = input.search_neighborhoods.trim().slice(0, 300)
  }
  if (input.notes !== undefined) {
    payload.notes = input.notes.trim().slice(0, 2000)
  }
  if (input.consent_status) {
    payload.consent_status = input.consent_status
  }
  if (input.next_step?.trim()) {
    payload.next_step = input.next_step.trim()
  }
  if (input.next_step_due) {
    payload.next_step_due = input.next_step_due
  }

  return await pb.send<LeadIntakeResponse>('/backend/v1/leads/intake', {
    method: 'POST',
    body: payload,
  })
}

/**
 * Resolve pendência de duplicidade (POST /backend/v1/leads/{id}/dedupe-resolve)
 */
export async function resolveDedupe(
  leadId: string,
  resolution: 'separate' | 'same_person',
): Promise<DedupeResolveResponse> {
  return await pb.send<DedupeResolveResponse>(
    `/backend/v1/leads/${encodeURIComponent(leadId)}/dedupe-resolve`,
    {
      method: 'POST',
      body: { resolution },
    },
  )
}

/**
 * Atualiza campos de dados gerais do lead (admin e SDR)
 * Nunca envia origin, client_id, dedupe_status, dedupe_of, first_contact_at, last_contact_at nem organization_id
 */
export async function updateLeadData(
  leadId: string,
  existing: LeadRecord,
  patch: UpdateLeadDataInput,
): Promise<LeadRecord> {
  const payload: Record<string, unknown> = {}

  if (patch.name !== undefined && patch.name.trim() !== (existing.name || '').trim()) {
    payload.name = patch.name.trim()
  }
  if (patch.phone !== undefined) {
    const norm = normalizePhoneForBackend(patch.phone)
    if (norm !== (existing.phone || '')) {
      payload.phone = norm
    }
  }
  if (patch.email !== undefined) {
    const clean = patch.email.trim().toLowerCase()
    if (clean !== (existing.email || '').trim().toLowerCase()) {
      payload.email = clean
    }
  }
  if (patch.origin_detail !== undefined) {
    const clean = patch.origin_detail.trim()
    if (clean !== (existing.origin_detail || '').trim()) {
      payload.origin_detail = clean
    }
  }
  if (patch.property_id !== undefined && patch.property_id !== (existing.property_id || null)) {
    payload.property_id = patch.property_id || ''
  }
  if (patch.search_neighborhood !== undefined) {
    const clean = patch.search_neighborhood.trim()
    if (clean !== (existing.search_neighborhood || '').trim()) {
      payload.search_neighborhood = clean
    }
  }
  if (patch.search_type !== undefined && patch.search_type !== (existing.search_type || null)) {
    payload.search_type = patch.search_type || ''
  }
  if (
    patch.search_bedrooms !== undefined &&
    patch.search_bedrooms !== (existing.search_bedrooms ?? null)
  ) {
    payload.search_bedrooms = patch.search_bedrooms ?? 0
  }
  if (
    patch.search_min_price !== undefined &&
    patch.search_min_price !== (existing.search_min_price ?? null)
  ) {
    payload.search_min_price = patch.search_min_price ?? 0
  }
  if (
    patch.search_max_price !== undefined &&
    patch.search_max_price !== (existing.search_max_price ?? null)
  ) {
    payload.search_max_price = patch.search_max_price ?? 0
  }
  if (patch.search_neighborhoods !== undefined) {
    const clean = patch.search_neighborhoods.trim().slice(0, 300)
    if (clean !== (existing.search_neighborhoods || '').trim()) {
      payload.search_neighborhoods = clean
    }
  }
  if (patch.notes !== undefined) {
    const clean = patch.notes.trim().slice(0, 2000)
    if (clean !== (existing.notes || '').trim()) {
      payload.notes = clean
    }
  }
  if (patch.consent_status !== undefined && patch.consent_status !== existing.consent_status) {
    payload.consent_status = patch.consent_status
  }

  if (Object.keys(payload).length === 0) {
    return existing
  }

  return await pb.collection('leads').update<LeadRecord>(leadId, payload, {
    expand: 'assigned_to,property_id,client_id',
  })
}

/**
 * Atualiza atribuição de lead (admin e SDR)
 */
export async function updateLeadAssignment(
  leadId: string,
  assignedTo: string | null,
): Promise<LeadRecord> {
  return await pb.collection('leads').update<LeadRecord>(
    leadId,
    { assigned_to: assignedTo || '' },
    {
      expand: 'assigned_to,property_id,client_id',
    },
  )
}

/**
 * Atualiza etapa do lead. Se perdido, exige lost_reason. Ao reabrir/mudar para outra etapa, lost_reason é limpo.
 */
export async function updateLeadStage(
  leadId: string,
  stage: LeadStage,
  lostReason?: LostReason,
): Promise<LeadRecord> {
  const payload: Record<string, unknown> = { stage }
  if (stage === 'perdido') {
    payload.lost_reason = lostReason || ''
  } else {
    payload.lost_reason = ''
  }

  return await pb.collection('leads').update<LeadRecord>(leadId, payload, {
    expand: 'assigned_to,property_id,client_id',
  })
}

/**
 * Atualiza próximo passo e prazo
 */
export async function updateLeadNextStep(
  leadId: string,
  nextStep: string,
  nextStepDue?: string,
): Promise<LeadRecord> {
  return await pb.collection('leads').update<LeadRecord>(
    leadId,
    {
      next_step: nextStep.trim(),
      next_step_due: nextStepDue || '',
    },
    {
      expand: 'assigned_to,property_id,client_id',
    },
  )
}

/**
 * Lista eventos da linha do tempo do lead do mais novo ao mais antigo
 */
export async function listLeadEvents(leadId: string): Promise<LeadEventRecord[]> {
  return await pb.collection('lead_events').getFullList<LeadEventRecord>({
    filter: `lead_id = "${leadId}"`,
    sort: '-occurred_at,-created',
    expand: 'author_id',
  })
}

/**
 * Registra nota ou contato na linha do tempo
 * Nunca envia author_id nem occurred_at
 */
export async function createLeadEvent(
  leadId: string,
  type: 'nota' | 'contato',
  text: string,
  organizationId: string,
): Promise<LeadEventRecord> {
  return await pb.collection('lead_events').create<LeadEventRecord>({
    organization_id: organizationId,
    lead_id: leadId,
    type,
    text: text.trim(),
  })
}

/**
 * Obtém texto da ficha de um imóvel Disponível (GET /backend/v1/properties/{id}/ficha)
 */
export async function getPropertyFicha(propertyId: string): Promise<PropertyFichaResponse> {
  return await pb.send<PropertyFichaResponse>(
    `/backend/v1/properties/${encodeURIComponent(propertyId)}/ficha`,
    {
      method: 'GET',
    },
  )
}

/**
 * Registra o envio da ficha de imóvel ao lead (POST /backend/v1/leads/{id}/ficha-sent)
 */
export async function markLeadFichaSent(
  leadId: string,
  propertyId: string,
  intentKey: string,
): Promise<LeadFichaSentResponse> {
  return await pb.send<LeadFichaSentResponse>(
    `/backend/v1/leads/${encodeURIComponent(leadId)}/ficha-sent`,
    {
      method: 'POST',
      body: {
        property_id: propertyId,
        intent_key: intentKey,
      },
    },
  )
}

/**
 * Converte lead em cliente ou liga a cliente existente (POST /backend/v1/leads/{id}/convert)
 * Trata resposta de sucesso (200) e 409 (conflito/já ligado/possível mesmo)
 */
export type ConvertResult =
  | { ok: true; data: ConvertLeadResponse }
  | { ok: false; conflict: ConvertConflictResponse }

export async function convertLead(leadId: string, input: ConvertLeadInput): Promise<ConvertResult> {
  try {
    const res = await pb.send<ConvertLeadResponse>(
      `/backend/v1/leads/${encodeURIComponent(leadId)}/convert`,
      {
        method: 'POST',
        body: input,
      },
    )
    return { ok: true, data: res }
  } catch (err: unknown) {
    if (err instanceof ClientResponseError && err.status === 409) {
      const respData = err.response as ConvertConflictResponse
      return {
        ok: false,
        conflict: {
          status: respData?.status || 'maybe_same',
          matches: respData?.matches || [],
          message: respData?.message,
        },
      }
    }
    throw err
  }
}

/**
 * Corrige origem do lead (POST /backend/v1/leads/{id}/origin)
 * Só admin, com motivo (mínimo 3 caracteres)
 */
export async function correctLeadOrigin(
  leadId: string,
  origin: LeadOrigin,
  reason: string,
): Promise<LeadOriginResponse> {
  return await pb.send<LeadOriginResponse>(
    `/backend/v1/leads/${encodeURIComponent(leadId)}/origin`,
    {
      method: 'POST',
      body: {
        origin,
        reason: reason.trim(),
      },
    },
  )
}

/**
 * Busca imóveis disponíveis para associação ao lead
 */
export async function searchAvailableProperties(query: string) {
  const clean = query.trim().replace(/['"\\]/g, '')
  let filter = 'status = "disponivel"'
  if (clean) {
    filter += ` && (code ~ "${clean}" || title ~ "${clean}")`
  }

  return await pb.collection('properties').getList<RecordModel>(1, 20, {
    filter,
    sort: '-created',
  })
}

/**
 * Lista corretores e admins ativos da organização para seleção de responsável/atribuído
 */
export async function listEligibleLeadAssignees() {
  return await pb.collection('users').getFullList<LeadUserRecord>({
    filter: 'active = true && (role = "corretor" || role = "admin")',
    sort: 'name',
  })
}
