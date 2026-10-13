import pb from '@/lib/pocketbase/client'
import { FichaImovelParsed, FichaProprietarioParsed } from '@/lib/fichaPdf'

export interface FichaFieldDiff {
  field: string
  label?: string
  current_value: any
  ficha_value: any
  is_empty_in_system?: boolean
}

export interface FichaMatchResult {
  proprietario: {
    id: string | null
    diffs?: FichaFieldDiff[]
    existing?: Record<string, any>
  }
  imovel: {
    id: string | null
    diffs?: FichaFieldDiff[]
    existing?: Record<string, any>
  }
  pergunta_telefone: boolean
}

export interface FichaMatchPayload {
  imovel: FichaImovelParsed
  proprietario: FichaProprietarioParsed
  property_id?: string | null
}

export interface FichaCommitPayload {
  imovel: FichaImovelParsed
  proprietario: FichaProprietarioParsed
  // IDs vinculados ou selecionados
  property_id?: string | null
  owner_id?: string | null
  // Se pergunta_telefone ocorreu e o usuário confirmou que é a mesma pessoa
  vincular_proprietario_existente?: boolean
  // Campos marcados para receber os valores da ficha
  selected_imovel_fields?: string[]
  selected_proprietario_fields?: string[]
}

export interface FichaCommitResult {
  property_id: string
  owner_id?: string | null
  code: string
  criado: boolean
  pendencias: string[]
}

/**
 * Consulta cadastros existentes sem gravar nada.
 * POST /backend/v1/properties/ficha/match
 */
export async function matchFicha(payload: FichaMatchPayload): Promise<FichaMatchResult> {
  return await pb.send<FichaMatchResult>('/backend/v1/properties/ficha/match', {
    method: 'POST',
    body: payload,
  })
}

/**
 * Grava o imóvel e proprietário conforme a conferência.
 * POST /backend/v1/properties/ficha/commit
 */
export async function commitFicha(payload: FichaCommitPayload): Promise<FichaCommitResult> {
  return await pb.send<FichaCommitResult>('/backend/v1/properties/ficha/commit', {
    method: 'POST',
    body: payload,
  })
}
