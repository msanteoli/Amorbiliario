import pb from '@/lib/pocketbase/client'

export interface BloqueioItem {
  tipo: 'negociacao' | 'visita' | 'tarefa' | 'imovel' | 'lead' | 'cliente' | 'anuncio' | string
  quantidade: number
}

export interface DeleteConflictResponse {
  bloqueios: BloqueioItem[]
}

export interface AnonymizeClientResponse {
  ok: boolean
  leads_anonimizados: number
}

export class DeleteConflictError extends Error {
  bloqueios: BloqueioItem[]
  constructor(bloqueios: BloqueioItem[]) {
    super('Não dá para excluir ainda')
    this.name = 'DeleteConflictError'
    this.bloqueios = bloqueios
  }
}

export class ForbiddenDeleteError extends Error {
  constructor(message = 'Só o administrador pode excluir.') {
    super(message)
    this.name = 'ForbiddenDeleteError'
  }
}

export class NotFoundDeleteError extends Error {
  constructor(message = 'Este registro não existe mais.') {
    super(message)
    this.name = 'NotFoundDeleteError'
  }
}

export function formatBloqueioItem(item: BloqueioItem): string {
  const q = item.quantidade
  switch (item.tipo) {
    case 'negociacao':
      return q === 1 ? '1 negociação' : `${q} negociações`
    case 'visita':
      return q === 1 ? '1 visita' : `${q} visitas`
    case 'tarefa':
      return q === 1 ? '1 tarefa aberta' : `${q} tarefas abertas`
    case 'imovel':
      return q === 1 ? '1 imóvel ligado' : `${q} imóveis ligados`
    case 'lead':
      return q === 1 ? '1 lead ligado' : `${q} leads ligados`
    case 'cliente':
      return 'Este lead já virou cliente'
    case 'anuncio':
      return 'O imóvel está anunciado no site ou nos portais. Desmarque em Onde anunciar antes de excluir.'
    default:
      return `${q} vínculo(s) do tipo ${item.tipo}`
  }
}

async function sendDelete(path: string): Promise<void> {
  try {
    await pb.send<{ ok: boolean }>(path, { method: 'DELETE' })
  } catch (err: any) {
    const status = err?.status || err?.response?.status || err?.data?.status
    const data = err?.data || err?.response?.data || {}

    if (status === 409 && Array.isArray(data?.bloqueios)) {
      throw new DeleteConflictError(data.bloqueios)
    }
    if (status === 403) {
      throw new ForbiddenDeleteError('Só o administrador pode excluir.')
    }
    if (status === 404) {
      throw new NotFoundDeleteError('Este registro não existe mais.')
    }

    const message = data?.message || err?.message || 'Erro ao excluir registro.'
    throw new Error(message)
  }
}

export async function deleteClient(id: string): Promise<void> {
  return sendDelete(`/backend/v1/clients/${encodeURIComponent(id)}`)
}

export async function deleteProperty(id: string): Promise<void> {
  return sendDelete(`/backend/v1/properties/${encodeURIComponent(id)}`)
}

export async function deleteCondominium(id: string): Promise<void> {
  return sendDelete(`/backend/v1/condominiums/${encodeURIComponent(id)}`)
}

export async function deleteLead(id: string): Promise<void> {
  return sendDelete(`/backend/v1/leads/${encodeURIComponent(id)}`)
}

export async function anonymizeClient(id: string): Promise<AnonymizeClientResponse> {
  try {
    return await pb.send<AnonymizeClientResponse>(
      `/backend/v1/clients/${encodeURIComponent(id)}/anonymize`,
      { method: 'POST' },
    )
  } catch (err: any) {
    const status = err?.status || err?.response?.status || err?.data?.status
    const data = err?.data || err?.response?.data || {}

    if (status === 403) {
      throw new ForbiddenDeleteError('Só o administrador pode anonimizar.')
    }
    if (status === 404) {
      throw new NotFoundDeleteError('Este registro não existe mais.')
    }

    const message = data?.message || err?.message || 'Erro ao anonimizar cliente.'
    throw new Error(message)
  }
}
