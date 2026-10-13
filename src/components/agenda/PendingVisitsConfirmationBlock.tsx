import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  PendingConfirmationItem,
  getPendingConfirmationVisits,
  updateVisitStatus,
  declineVisit,
  formatDateBahia,
  formatTimeBahia,
  extractErrorMessage,
} from '@/services/visits'
import { Cota } from '@/components/Cota'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AlertCircle, Calendar, Check, X, Clock, Loader2 } from 'lucide-react'

export interface PendingVisitsConfirmationBlockProps {
  /**
   * Chamado quando o SDR/Admin clica no atalho "Remarcar".
   * Recebe o id da visita e o item completo.
   */
  onRescheduleClick?: (item: PendingConfirmationItem) => void
  /**
   * Classe CSS opcional para estilização adicional.
   */
  className?: string
  /**
   * Notificação quando o status de conexão do Google retornado pelo endpoint mudar.
   */
  onGoogleStatusChange?: (status: 'conectado' | 'reconectar' | 'nao_conectado') => void
}

export function PendingVisitsConfirmationBlock({
  onRescheduleClick,
  className,
  onGoogleStatusChange,
}: PendingVisitsConfirmationBlockProps) {
  const { user } = useAuth()
  const role = user?.role || ''
  const isBroker = role === 'corretor'
  const isSdrOrAdmin = role === 'sdr' || role === 'admin'

  const [items, setItems] = useState<PendingConfirmationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)

  // Submissões inline por item
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  // Modal "Não posso" (decline)
  const [declineModalOpen, setDeclineModalOpen] = useState(false)
  const [declineTargetItem, setDeclineTargetItem] = useState<PendingConfirmationItem | null>(null)
  const [declineReason, setDeclineReason] = useState('')
  const [declineSubmitting, setDeclineSubmitting] = useState(false)
  const [declineError, setDeclineError] = useState<string | null>(null)

  const loadPending = useCallback(async () => {
    try {
      const resp = await getPendingConfirmationVisits()
      setItems(resp.items || [])
      if (resp.google && onGoogleStatusChange) {
        onGoogleStatusChange(resp.google.status)
      }
    } catch {
      // Se falhar (ex: sem permissão ou rede), limpa os itens
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [onGoogleStatusChange])

  useEffect(() => {
    loadPending()
  }, [loadPending])

  // Tempo real na coleção 'visits': qualquer mudança atualiza sozinho
  useRealtime(
    'visits',
    useCallback(() => {
      loadPending()
    }, [loadPending]),
    true,
  )

  // Ação de confirmar: POST /visits/{id}/status com {"status":"confirmada"}
  const handleConfirm = async (item: PendingConfirmationItem) => {
    setConfirmingId(item.id)
    setFeedbackError(null)
    try {
      await updateVisitStatus(item.id, 'confirmada')
      // Ao responder 200, sai do bloco imediatamente
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } catch (err: unknown) {
      // Em 400 ou 409, mostre a mensagem do servidor tal qual
      const msg = extractErrorMessage(err, 'Erro ao confirmar visita.')
      setFeedbackError(msg)
    } finally {
      setConfirmingId(null)
    }
  }

  // Abrir modal de recusa ("Não posso")
  const handleOpenDeclineModal = (item: PendingConfirmationItem) => {
    setDeclineTargetItem(item)
    setDeclineReason('')
    setDeclineError(null)
    setDeclineModalOpen(true)
  }

  // Ação de recusar: POST /visits/{id}/decline com {"reason":"..."}
  const handleDeclineSubmit = async () => {
    if (!declineTargetItem) return
    const trimmed = declineReason.trim()
    if (trimmed.length < 3 || trimmed.length > 300) {
      setDeclineError('Informe o motivo (de 3 a 300 caracteres).')
      return
    }

    setDeclineSubmitting(true)
    setDeclineError(null)
    try {
      await declineVisit(declineTargetItem.id, trimmed)
      setDeclineModalOpen(false)
      // Atualiza lista
      await loadPending()
    } catch (err: unknown) {
      // Em 400 (por exemplo, "já foi recusada"), mostre a mensagem do servidor
      const msg = extractErrorMessage(err, 'Erro ao recusar visita.')
      setDeclineError(msg)
    } finally {
      setDeclineSubmitting(false)
    }
  }

  // Sem itens, o bloco NÃO aparece
  if (!loading && items.length === 0) {
    return null
  }

  // Bloco 1: Corretor -> "Visitas para confirmar"
  // Cada item mostra imóvel (código e link para a ficha), data e hora, nome do lead e,
  // se overdue, o selo "Sem confirmação há mais de 24 h". Sem telefone nem e-mail.
  // Dois botões: Confirmar e Não posso.
  if (isBroker) {
    return (
      <section
        role="region"
        aria-label="Visitas para confirmar"
        className={`rounded-[8px] border border-border bg-card p-4 sm:p-5 shadow-none space-y-4 ${className || ''}`}
      >
        <div className="border-b border-border pb-2">
          <Cota
            title="Visitas para confirmar"
            count={items.length}
            isAttention={items.some((it) => it.overdue)}
          />
        </div>

        {feedbackError && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{feedbackError}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFeedbackError(null)}
              className="h-6 px-2 text-xs text-destructive hover:bg-destructive/20"
            >
              Fechar
            </Button>
          </div>
        )}

        <div className="divide-y divide-border">
          {items.map((item) => {
            const isSubmittingThis = confirmingId === item.id
            return (
              <div
                key={item.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Imóvel: código e link para a ficha */}
                    {item.property_id ? (
                      <Link
                        to={`/imoveis/${item.property_id}`}
                        className="font-medium text-foreground hover:underline"
                        title="Ver ficha do imóvel"
                      >
                        Imóvel [{item.property_code || 'Sem código'}]
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">
                        Imóvel [{item.property_code || 'Sem código'}]
                      </span>
                    )}

                    {/* Selo overdue: "Sem confirmação há mais de 24 h" */}
                    {item.overdue && (
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-normal text-[11px]"
                      >
                        Sem confirmação há mais de 24 h
                      </Badge>
                    )}

                    {/* Se já foi recusada pelo corretor */}
                    {item.declined && (
                      <Badge variant="destructive" className="font-normal text-[11px]">
                        Recusada
                      </Badge>
                    )}
                  </div>

                  {/* Data e hora */}
                  <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                    <span className="tabular">
                      {item.start_at
                        ? `${formatDateBahia(item.start_at)} às ${formatTimeBahia(item.start_at)}`
                        : 'Horário a definir'}
                    </span>
                    <span>•</span>
                    {/* Nome do lead (sem telefone nem e-mail) */}
                    <span className="text-foreground">{item.lead_name || 'Lead sem nome'}</span>
                  </div>
                </div>

                {/* Dois botões: Confirmar e Não posso */}
                <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => handleConfirm(item)}
                    disabled={isSubmittingThis}
                    className="rounded-full font-normal min-h-[36px] h-9 px-4 text-xs gap-1.5"
                  >
                    {isSubmittingThis ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    <span>Confirmar</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenDeclineModal(item)}
                    disabled={isSubmittingThis}
                    className="rounded-full font-normal min-h-[36px] h-9 px-4 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Não posso</span>
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Modal de Motivo Obrigatório para "Não posso" */}
        <Dialog open={declineModalOpen} onOpenChange={setDeclineModalOpen}>
          <DialogContent className="w-full max-w-md p-5 rounded-lg border border-border bg-popover text-popover-foreground shadow-none">
            <DialogHeader className="pb-2 border-b border-border">
              <DialogTitle className="text-base font-normal text-foreground">
                Recusar horário da visita
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Informe o motivo pelo qual você não poderá comparecer. O SDR será notificado para
                remarcar com o cliente.
              </DialogDescription>
            </DialogHeader>

            {declineError && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2 my-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{declineError}</span>
              </div>
            )}

            <div className="space-y-2 py-2">
              <Label htmlFor="decline-reason" className="text-xs eyebrow text-foreground">
                Motivo da recusa <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="decline-reason"
                placeholder="Ex.: Já tenho compromisso inadiável nesse horário..."
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={3}
                maxLength={300}
                className="text-sm resize-none"
              />
              <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                <span>Mínimo 3 caracteres</span>
                <span className="tabular">{declineReason.length}/300</span>
              </div>
            </div>

            <DialogFooter className="flex flex-row justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeclineModalOpen(false)}
                disabled={declineSubmitting}
                className="rounded-full font-normal"
              >
                Voltar
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDeclineSubmit}
                disabled={declineSubmitting || declineReason.trim().length < 3}
                className="rounded-full font-normal gap-1.5"
              >
                {declineSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Enviar recusa</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    )
  }

  // Bloco 2: SDR e Admin -> "Aguardando confirmação"
  // Destaque em amarelo para overdue ("Sem confirmação há mais de 24 h")
  // e em vermelho para declined: "Corretor não pode: <motivo>" com a data.
  // Cada item tem o atalho Remarcar.
  if (isSdrOrAdmin) {
    return (
      <section
        role="region"
        aria-label="Aguardando confirmação"
        className={`rounded-[8px] border border-border bg-card p-4 sm:p-5 shadow-none space-y-4 ${className || ''}`}
      >
        <div className="border-b border-border pb-2">
          <Cota
            title="Aguardando confirmação"
            count={items.length}
            isAttention={items.some((it) => it.overdue || it.declined)}
          />
        </div>

        <div className="divide-y divide-border">
          {items.map((item) => {
            return (
              <div
                key={item.id}
                className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Imóvel */}
                    {item.property_id ? (
                      <Link
                        to={`/imoveis/${item.property_id}`}
                        className="font-medium text-foreground hover:underline"
                        title="Ver ficha do imóvel"
                      >
                        Imóvel [{item.property_code || 'Sem código'}]
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">
                        Imóvel [{item.property_code || 'Sem código'}]
                      </span>
                    )}

                    {/* Destaque em amarelo para overdue */}
                    {item.overdue && !item.declined && (
                      <Badge
                        variant="outline"
                        className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-normal text-[11px]"
                      >
                        Sem confirmação há mais de 24 h
                      </Badge>
                    )}

                    {/* Destaque em vermelho para declined */}
                    {item.declined && (
                      <Badge variant="destructive" className="font-normal text-[11px]">
                        Recusada pelo corretor
                      </Badge>
                    )}
                  </div>

                  {/* Informações detalhadas */}
                  <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                    <span className="tabular">
                      {item.start_at
                        ? `${formatDateBahia(item.start_at)} às ${formatTimeBahia(item.start_at)}`
                        : 'Horário a definir'}
                    </span>
                    <span>•</span>
                    <span>
                      Lead:{' '}
                      <strong className="font-normal text-foreground">
                        {item.lead_name || 'Sem nome'}
                      </strong>
                    </span>
                    {item.broker_name && (
                      <>
                        <span>•</span>
                        <span>
                          Corretor: <span className="text-foreground">{item.broker_name}</span>
                        </span>
                      </>
                    )}
                  </div>

                  {/* Destaque detalhado do declined com motivo e data */}
                  {item.declined && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive space-y-0.5">
                      <p className="font-medium">
                        Corretor não pode:{' '}
                        <span className="font-normal text-foreground">
                          {item.declined_reason || 'Sem motivo informado'}
                        </span>
                      </p>
                      {item.declined_at && (
                        <p className="text-[11px] text-muted-foreground tabular">
                          Recusado em: {formatDateBahia(item.declined_at)} às{' '}
                          {formatTimeBahia(item.declined_at)}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Atalho Remarcar */}
                <div className="flex items-center gap-2 shrink-0 pt-1 md:pt-0">
                  {onRescheduleClick && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onRescheduleClick(item)}
                      className="rounded-full font-normal min-h-[36px] h-9 px-4 text-xs gap-1.5"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Remarcar</span>
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  return null
}

export default PendingVisitsConfirmationBlock
