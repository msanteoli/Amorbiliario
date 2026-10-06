import pb from '@/lib/pocketbase/client'
import { ClientResponseError, RecordModel } from 'pocketbase'

export type ClientKind = 'comprador' | 'locatario' | 'proprietario' | 'investidor'
export type ConsentStatus = 'opt_in' | 'opt_out' | 'unknown'

export interface ClientRecord extends RecordModel {
  organization_id: string
  name: string
  phone: string
  email: string
  kind: ClientKind[]
  responsible_id?: string
  consent_status: ConsentStatus
  consent_at?: string
  consent_channel?: string
  expand?: {
    responsible_id?: {
      id: string
      name?: string
      email?: string
      role?: string
    }
  }
}

export interface ClientPrivateRecord extends RecordModel {
  organization_id: string
  client_id: string
  cpf: string
  birth_date?: string
}

export interface MatchResultItem {
  match_by: 'cpf' | 'phone' | 'email'
  same_name: boolean
  visible: boolean
  client: {
    id: string
    name: string
    phone: string
    email: string
    kind: ClientKind[]
    responsible_id?: string
  } | null
}

export interface MatchResponse {
  status: 'none' | 'same_person' | 'maybe_same'
  matches: MatchResultItem[]
}

export interface CheckClientMatchParams {
  name?: string
  phone?: string
  email?: string
  cpf?: string
}

export interface ListClientsParams {
  page?: number
  perPage?: number
  search?: string
  kind?: ClientKind | ''
  responsible_id?: string
  sort?: string
}

export class ClientPrivateSaveError extends Error {
  clientId: string
  originalError: unknown

  constructor(clientId: string, originalError: unknown) {
    super(formatErrorMessage(originalError))
    this.name = 'ClientPrivateSaveError'
    this.clientId = clientId
    this.originalError = originalError
  }
}

export interface CreateClientInput {
  name: string
  phone?: string
  email?: string
  kind: ClientKind[]
  responsible_id?: string
  consent_status?: ConsentStatus
  consent_channel?: string
  cpf?: string
  birth_date?: string
}

export interface UpdateClientInput {
  name?: string
  phone?: string
  email?: string
  kind?: ClientKind[]
  responsible_id?: string
  consent_status?: ConsentStatus
  consent_channel?: string
  cpf?: string
  birth_date?: string
}

export interface ResponsibleUser {
  id: string
  name: string
  email: string
  role: string
}

/**
 * Traduz mensagens de erro do backend para português amigável
 */
export function formatErrorMessage(error: unknown): string {
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
    if (error.message) {
      return translateGenericMessage(error.message)
    }
  }
  if (error instanceof Error) {
    return translateGenericMessage(error.message)
  }
  return 'Ocorreu um erro inesperado.'
}

function translateFieldMessage(field: string, msg: string): string {
  if (msg.includes('Telefone inválido')) return msg
  if (msg.includes('CPF inválido')) return msg
  if (msg.includes('Responsável inválido')) return msg
  if (msg.includes('Data de nascimento')) return msg
  if (msg.includes('Informe ao menos telefone')) return msg

  switch (field) {
    case 'name':
      return 'Nome inválido ou incompleto.'
    case 'phone':
      return 'Telefone inválido. Informe DDD e número.'
    case 'email':
      return 'E-mail inválido.'
    case 'kind':
      return 'Selecione ao menos um tipo de relação.'
    case 'responsible_id':
      return 'Responsável inválido.'
    case 'cpf':
      return 'CPF inválido.'
    case 'birth_date':
      return 'Data de nascimento inválida.'
    default:
      return msg || 'Campo inválido.'
  }
}

function translateGenericMessage(msg: string): string {
  if (msg.includes('Papel sem acesso a estes dados.')) return 'Papel sem acesso a estes dados.'
  if (msg.includes('Informe telefone, e-mail ou CPF.')) return 'Informe telefone, e-mail ou CPF.'
  if (msg.includes('Telefone inválido. Informe DDD e número.'))
    return 'Telefone inválido. Informe DDD e número.'
  if (msg.includes('CPF inválido.')) return 'CPF inválido.'
  if (msg.includes('Responsável inválido.')) return 'Responsável inválido.'
  if (msg.includes('Informe ao menos telefone ou e-mail.'))
    return 'Informe ao menos telefone ou e-mail.'
  if (msg.includes('Data de nascimento inválida.')) return 'Data de nascimento inválida.'
  if (msg.includes('Cliente inválido.')) return 'Cliente inválido.'
  if (msg.includes('Somente o responsável ou o admin informa os dados pessoais.')) {
    return 'Somente o responsável ou o admin informa os dados pessoais.'
  }
  if (msg.includes('Failed to create record') || msg.includes('Failed to update record')) {
    return 'Não foi possível salvar os dados. Verifique as informações fornecidas.'
  }
  return msg
}

/**
 * Remove qualquer caractere não numérico e garante formato com código do país 55
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
 * Remove formatação do CPF mantendo só dígitos
 */
export function normalizeCpfDigits(cpf?: string): string {
  if (!cpf) return ''
  return cpf.replace(/\D/g, '')
}

/**
 * Verifica se o cliente já existe através do endpoint /backend/v1/clients/match
 */
export async function checkClientMatch(params: CheckClientMatchParams): Promise<MatchResponse> {
  const payload: Record<string, string> = {}
  if (params.name) payload.name = params.name.trim()
  if (params.phone) payload.phone = params.phone.trim()
  if (params.email) payload.email = params.email.trim().toLowerCase()
  if (params.cpf) payload.cpf = normalizeCpfDigits(params.cpf)

  const res = await pb.send<MatchResponse>('/backend/v1/clients/match', {
    method: 'POST',
    body: payload,
  })
  return res
}

/**
 * Lista clientes com paginação, busca e filtros
 */
export async function listClients(params: ListClientsParams = {}) {
  const { page = 1, perPage = 10, search, kind, responsible_id, sort = '-created' } = params
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

  if (kind) {
    filterParts.push(`kind ~ "${kind}"`)
  }

  if (responsible_id) {
    filterParts.push(`responsible_id = "${responsible_id}"`)
  }

  const filter = filterParts.join(' && ')

  return await pb.collection('clients').getList<ClientRecord>(page, perPage, {
    filter: filter || undefined,
    sort,
    expand: 'responsible_id',
  })
}

/**
 * Obtém os detalhes de um cliente por ID
 */
export async function getClientById(id: string): Promise<ClientRecord> {
  return await pb.collection('clients').getOne<ClientRecord>(id, {
    expand: 'responsible_id',
  })
}

/**
 * Obtém dados privados do cliente (CPF e data de nascimento).
 * Retorna null se não houver dados ou se o usuário não tiver permissão.
 */
export async function getClientPrivate(clientId: string): Promise<ClientPrivateRecord | null> {
  try {
    const list = await pb.collection('client_private').getList<ClientPrivateRecord>(1, 1, {
      filter: `client_id = "${clientId}"`,
    })
    return list.items[0] || null
  } catch {
    // Caso de 403 / 404 / não encontrado: não lançar erro, devolver null conforme requisito
    return null
  }
}

/**
 * Lista usuários ativos que podem ser responsáveis por clientes (corretor ou admin)
 */
export async function listEligibleResponsibleUsers(): Promise<ResponsibleUser[]> {
  try {
    const users = await pb.collection('users').getFullList<RecordModel>({
      filter: 'active = true && (role = "admin" || role = "corretor")',
      sort: 'name',
    })
    return users.map((u) => ({
      id: u.id,
      name: (u.name as string) || (u.email as string) || 'Sem nome',
      email: (u.email as string) || '',
      role: (u.role as string) || '',
    }))
  } catch {
    return []
  }
}

/**
 * Cadastra um novo cliente na coleção `clients` e, se informados CPF/nascimento, em `client_private`.
 */
export async function createClient(
  input: CreateClientInput,
  currentUser: { id: string; organization_id?: string; role?: string },
): Promise<ClientRecord> {
  const orgId = currentUser.organization_id
  if (!orgId) {
    throw new Error('Organização do usuário não identificada.')
  }

  const isCorretor = currentUser.role === 'corretor'
  const responsibleId = isCorretor ? currentUser.id : input.responsible_id || ''

  const clientPayload: Record<string, unknown> = {
    organization_id: orgId,
    name: input.name.trim(),
    phone: input.phone ? normalizePhoneForBackend(input.phone) : '',
    email: input.email ? input.email.trim().toLowerCase() : '',
    kind: input.kind,
    responsible_id: responsibleId || undefined,
    consent_status: input.consent_status || 'unknown',
    consent_channel: input.consent_channel?.trim() || '',
  }

  const createdClient = await pb.collection('clients').create<ClientRecord>(clientPayload)

  // Grava dados pessoais em client_private se admin ou corretor tiver informado CPF ou nascimento
  const cpfDigits = normalizeCpfDigits(input.cpf)
  const birthDate = input.birth_date ? input.birth_date.trim() : ''

  if (cpfDigits || birthDate) {
    try {
      await pb.collection('client_private').create({
        organization_id: orgId,
        client_id: createdClient.id,
        cpf: cpfDigits,
        birth_date: birthDate || undefined,
      })
    } catch (privateErr) {
      throw new ClientPrivateSaveError(createdClient.id, privateErr)
    }
  }

  return createdClient
}

/**
 * Atualiza um cliente e seus dados pessoais em client_private
 */
export async function updateClient(
  clientId: string,
  input: UpdateClientInput,
  currentUser: { id: string; organization_id?: string; role?: string },
): Promise<ClientRecord> {
  const isCorretor = currentUser.role === 'corretor'

  const clientPayload: Record<string, unknown> = {}
  if (input.name !== undefined) clientPayload.name = input.name.trim()
  if (input.phone !== undefined)
    clientPayload.phone = input.phone ? normalizePhoneForBackend(input.phone) : ''
  if (input.email !== undefined)
    clientPayload.email = input.email ? input.email.trim().toLowerCase() : ''
  if (input.kind !== undefined) clientPayload.kind = input.kind
  if (!isCorretor && input.responsible_id !== undefined) {
    clientPayload.responsible_id = input.responsible_id || ''
  }
  if (input.consent_status !== undefined) clientPayload.consent_status = input.consent_status
  if (input.consent_channel !== undefined)
    clientPayload.consent_channel = input.consent_channel.trim()

  const updatedClient = await pb.collection('clients').update<ClientRecord>(clientId, clientPayload)

  // Atualiza ou cria client_private se CPF ou nascimento forem fornecidos
  const cpfDigits = input.cpf !== undefined ? normalizeCpfDigits(input.cpf) : undefined
  const birthDate = input.birth_date !== undefined ? input.birth_date.trim() : undefined

  if (cpfDigits !== undefined || birthDate !== undefined) {
    const existingPrivate = await getClientPrivate(clientId)
    const orgId = currentUser.organization_id || updatedClient.organization_id

    if (existingPrivate) {
      const privatePayload: Record<string, unknown> = {}
      if (cpfDigits !== undefined) privatePayload.cpf = cpfDigits
      if (birthDate !== undefined) privatePayload.birth_date = birthDate || undefined
      await pb.collection('client_private').update(existingPrivate.id, privatePayload)
    } else if ((cpfDigits && cpfDigits.length > 0) || (birthDate && birthDate.length > 0)) {
      await pb.collection('client_private').create({
        organization_id: orgId,
        client_id: clientId,
        cpf: cpfDigits || '',
        birth_date: birthDate || undefined,
      })
    }
  }

  return updatedClient
}
