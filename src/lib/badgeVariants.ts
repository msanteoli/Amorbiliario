import type { LeadStage } from '@/services/leads'
import type { VisitStatus } from '@/services/visits'
import type { PropertyStatus } from '@/services/properties'
import type { TaskRecord } from '@/services/tasks'

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'attention'
  | 'info'

/**
 * Item 5 - Cores das situações (badges):
 * Lead:
 * - "novo" e "proposta": neutras ('default')
 * - "em_atendimento" e "visita_marcada": 'info'
 * - "ganho": 'success'
 * - "perdido": 'destructive'
 */
export function getLeadStageBadgeVariant(
  stage: LeadStage | string | undefined | null,
): BadgeVariant {
  switch (stage) {
    case 'novo':
    case 'proposta':
      return 'default'
    case 'em_atendimento':
    case 'visita_marcada':
      return 'info'
    case 'ganho':
      return 'success'
    case 'perdido':
      return 'destructive'
    default:
      return 'default'
  }
}

/**
 * Visita:
 * - "pendente_agenda": 'attention'
 * - "agendada": 'info'
 * - "confirmada" e "realizada": 'success'
 * - "cancelada" e "nao_compareceu": 'destructive'
 */
export function getVisitStatusBadgeVariant(
  status: VisitStatus | string | undefined | null,
): BadgeVariant {
  switch (status) {
    case 'pendente_agenda':
      return 'attention'
    case 'agendada':
      return 'info'
    case 'confirmada':
    case 'realizada':
      return 'success'
    case 'cancelada':
    case 'nao_compareceu':
      return 'destructive'
    default:
      return 'default'
  }
}

/**
 * Imóvel:
 * - "rascunho" e "inativo": neutras ('default')
 * - "disponivel": 'success'
 * - "reservado": 'attention'
 * - "vendido" e "alugado": 'info'
 */
export function getPropertyStatusBadgeVariant(
  status: PropertyStatus | string | undefined | null,
): BadgeVariant {
  switch (status) {
    case 'rascunho':
    case 'inativo':
      return 'default'
    case 'disponivel':
      return 'success'
    case 'reservado':
      return 'attention'
    case 'vendido':
    case 'alugado':
      return 'info'
    default:
      return 'default'
  }
}

/**
 * Tarefa:
 * - "aberta": neutra ('default'), se vencida 'attention'
 * - "concluida": 'success'
 * - "cancelada": 'destructive'
 */
export function getTaskStatusBadgeVariant(
  status: string | undefined | null,
  isOverdue = false,
): BadgeVariant {
  if (status === 'aberta' && isOverdue) return 'attention'
  switch (status) {
    case 'concluida':
      return 'success'
    case 'cancelada':
      return 'destructive'
    case 'aberta':
    default:
      return 'default'
  }
}
