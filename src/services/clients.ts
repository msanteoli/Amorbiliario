import pb from '@/lib/pocketbase/client'
import { ClientResponseError, RecordModel } from 'pocketbase'

export type ClientKind = 'comprador' | 'locatario' | 'proprietario' | 'investidor'
export type PersonType = 'fisica' | 'juridica'
export type ConsentStatus = 'opt_in' | 'opt_out' | 'unknown'

export interface ClientRecord extends RecordModel {
  organization_id: string
  name: string
  phone: string
  email: string
  kind: ClientKind[]
  person_type?: PersonType
  company_name?: string
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
  rg?: string
  address?: string
  bank_details?: string
  cnpj?: string
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
  person_type?: PersonType
  company_name?: string
  responsible_id?: string
  consent_status?: ConsentStatus
  consent_channel?: string
  cpf?: string
  birth_date?: string
  rg?: string
  address?: string
  bank_details?: string
  cnpj?: string
}

export interface UpdateClientInput {
  name?: string
  phone?: string
  email?: string
  kind?: ClientKind[]
  person_type?: PersonType
  company_name?: string
  responsible_id?: string
  consent_status?: ConsentStatus
  consent_channel?: string
  cpf?: string
  birth_date?: string
  rg?: string
  address?: string
  bank_details?: string
  cnpj?: string
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
  if (msg.includes('Proprietário só nasce ligado')) return msg
  if (msg.includes('CNPJ inválido')) return msg

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
    case 'cnpj':
      return 'CNPJ inválido.'
    case 'birth_date':
      return 'Data de nascimento inválida.'
    default:
      return msg || 'Campo inválido.'
  }
}

function translateGenericMessage(msg: string): string {
  if (msg.includes('Proprietário só nasce ligado a um imóvel')) {
    return 'Proprietário só nasce ligado a um imóvel. Cadastre o imóvel e vincule o proprietário nele.'
  }
  if (msg.includes('Papel sem acesso a estes dados.')) return 'Papel sem acesso a estes dados.'
  if (msg.includes('Informe telefone, e-mail ou CPF.')) return 'Informe telefone, e-mail ou CPF.'
  if (msg.includes('Telefone inválido. Informe DDD e número.'))
    return 'Telefone inválido. Informe DDD e número.'
  if (msg.includes('CPF inválido.')) return 'CPF inválido.'
  if (msg.includes('CNPJ inválido.')) return 'CNPJ inválido.'
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
 * Remove formatação do CNPJ mantendo só dígitos
 */
export function normalizeCnpjDigits(cnpj?: string): string {
  if (!cnpj) return ''
  return cnpj.replace(/\D/g, '')
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
/**
 * Busca rápida de clientes por nome ou telefone (até o limite indicado)
 */
export async function searchClientsForQuickFind(
  term: string,
  limit = 5,
): Promise<Array<{ id: string; name: string; phone: string }>> {
  const cleanTerm = term.trim().replace(/['"\\]/g, '')
  if (!cleanTerm) return []
  const digits = term.replace(/\D/g, '').replace(/^0+/, '')
  const conditions = [`name ~ "${cleanTerm}"`]
  if (digits) {
    conditions.push(`phone ~ "${digits}"`)
  }
  const res = await pb.collection('clients').getList<ClientRecord>(1, limit, {
    filter: `(${conditions.join(' || ')})`,
    sort: '-created',
    fields: 'id,name,phone',
    requestKey: null,
  })
  return res.items.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone || '',
  }))
}

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

  const personType: PersonType = input.person_type || 'fisica'

  const clientPayload: Record<string, unknown> = {
    organization_id: orgId,
    name: input.name.trim(),
    phone: input.phone ? normalizePhoneForBackend(input.phone) : '',
    email: input.email ? input.email.trim().toLowerCase() : '',
    kind: input.kind,
    person_type: personType,
    company_name: personType === 'juridica' ? input.company_name?.trim() || '' : '',
    responsible_id: responsibleId || undefined,
    consent_status: input.consent_status || 'unknown',
    consent_channel: input.consent_channel?.trim() || '',
  }

  const createdClient = await pb.collection('clients').create<ClientRecord>(clientPayload)

  // Grava dados pessoais/fiscais em client_private se admin ou corretor tiver informado
  const cpfDigits = normalizeCpfDigits(input.cpf)
  const cnpjDigits = personType === 'juridica' ? normalizeCnpjDigits(input.cnpj) : ''
  const birthDate = input.birth_date ? input.birth_date.trim() : ''
  const rg = input.rg ? input.rg.trim().slice(0, 30) : ''
  const address = input.address ? input.address.trim().slice(0, 300) : ''
  const bankDetails = input.bank_details ? input.bank_details.trim().slice(0, 500) : ''

  const hasPrivateData = cpfDigits || cnpjDigits || birthDate || rg || address || bankDetails

  if (hasPrivateData) {
    try {
      await pb.collection('client_private').create({
        organization_id: orgId,
        client_id: createdClient.id,
        cpf: cpfDigits,
        cnpj: cnpjDigits || undefined,
        birth_date: birthDate || undefined,
        rg: rg || undefined,
        address: address || undefined,
        bank_details: bankDetails || undefined,
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
  if (input.person_type !== undefined) clientPayload.person_type = input.person_type
  if (input.company_name !== undefined) {
    clientPayload.company_name =
      input.person_type === 'juridica' ||
      (!input.person_type && clientPayload.person_type === 'juridica')
        ? input.company_name.trim().slice(0, 160)
        : ''
  }
  if (!isCorretor && input.responsible_id !== undefined) {
    clientPayload.responsible_id = input.responsible_id || ''
  }
  if (input.consent_status !== undefined) clientPayload.consent_status = input.consent_status
  if (input.consent_channel !== undefined)
    clientPayload.consent_channel = input.consent_channel.trim()

  const updatedClient = await pb.collection('clients').update<ClientRecord>(clientId, clientPayload)

  // Atualiza ou cria client_private se dados pessoais/fiscais forem fornecidos
  const effectivePersonType = input.person_type || updatedClient.person_type || 'fisica'
  const cpfDigits = input.cpf !== undefined ? normalizeCpfDigits(input.cpf) : undefined
  const cnpjDigits =
    input.cnpj !== undefined
      ? effectivePersonType === 'juridica'
        ? normalizeCnpjDigits(input.cnpj)
        : ''
      : undefined
  const birthDate = input.birth_date !== undefined ? input.birth_date.trim() : undefined
  const rg = input.rg !== undefined ? input.rg.trim().slice(0, 30) : undefined
  const address = input.address !== undefined ? input.address.trim().slice(0, 300) : undefined
  const bankDetails =
    input.bank_details !== undefined ? input.bank_details.trim().slice(0, 500) : undefined

  const touchedPrivate =
    cpfDigits !== undefined ||
    cnpjDigits !== undefined ||
    birthDate !== undefined ||
    rg !== undefined ||
    address !== undefined ||
    bankDetails !== undefined

  if (touchedPrivate) {
    const existingPrivate = await getClientPrivate(clientId)
    const orgId = currentUser.organization_id || updatedClient.organization_id

    if (existingPrivate) {
      const privatePayload: Record<string, unknown> = {}
      if (cpfDigits !== undefined) privatePayload.cpf = cpfDigits
      if (cnpjDigits !== undefined) privatePayload.cnpj = cnpjDigits
      if (birthDate !== undefined) privatePayload.birth_date = birthDate || undefined
      if (rg !== undefined) privatePayload.rg = rg
      if (address !== undefined) privatePayload.address = address
      if (bankDetails !== undefined) privatePayload.bank_details = bankDetails
      await pb.collection('client_private').update(existingPrivate.id, privatePayload)
    } else {
      const hasAnyValue =
        (cpfDigits && cpfDigits.length > 0) ||
        (cnpjDigits && cnpjDigits.length > 0) ||
        (birthDate && birthDate.length > 0) ||
        (rg && rg.length > 0) ||
        (address && address.length > 0) ||
        (bankDetails && bankDetails.length > 0)

      if (hasAnyValue) {
        await pb.collection('client_private').create({
          organization_id: orgId,
          client_id: clientId,
          cpf: cpfDigits || '',
          cnpj: cnpjDigits || undefined,
          birth_date: birthDate || undefined,
          rg: rg || undefined,
          address: address || undefined,
          bank_details: bankDetails || undefined,
        })
      }
    }
  }

  return updatedClient
}
