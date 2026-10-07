import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  VisitRecord,
  VisitStatus,
  VISIT_STATUS_LABELS,
  formatDateTimeBahia,
  isoUtcToBahiaInput,
  bahiaLocalToIsoUtc,
  updateVisitStatus,
  cancelVisit,
  rescheduleVisit,
  extractErrorMessage,
  listActiveBrokers,
  ActiveBroker,
} from '@/services/visits'
import { useAuth } from '@/contexts/AuthContext'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Building2,
  Calendar,
  User,
  Clock,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  XCircle,
  UserX,
  CalendarDays,
  Loader2,
} from 'lucide-react'

export function getVisitStatusBadge(status: VisitStatus) {
  switch (status) {
    case 'pendente_agenda':
      return <Badge variant="attention">Pendente de agenda</Badge>
    case 'agendada':
      return <Badge variant="default">Agendada</Badge>
    case 'confirmada':
      return <Badge variant="success">Confirmada</Badge>
    case 'realizada':
      return <Badge variant="default">Realizada</Badge>
    case 'cancelada':
      return <Badge variant="destructive">Cancelada</Badge>
    case 'nao_compareceu':
      return <Badge variant="destructive">Não compareceu</Badge>
    default:
      return <Badge variant="default">{status}</Badge>
  }
}

interface VisitDetailModalProps {
  visit: VisitRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
}

export function VisitDetailModal({ visit, open, onOpenChange, onUpdated }: VisitDetailModalProps) {
  const { user } = useAuth()

  // Estados de ação
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)

  // Sub-diálogos de ação inline
  const [activeAction, setActiveAction] = useState<'realizada' | 'cancelar' | 'remarcar' | null>(
    null,
  )

  // Form para realizada
  const [resultText, setResultText] = useState('')

  // Form para cancelamento
  const [cancelReason, setCancelReason] = useState('')

  // Form para remarcar / agendar
  const [rescheduleBrokerId, setRescheduleBrokerId] = useState('')
  const [rescheduleStart, setRescheduleStart] = useState('')
  const [rescheduleEnd, setRescheduleEnd] = useState('')
  const [brokersList, setBrokersList] = useState<ActiveBroker[]>([])

  useEffect(() => {
    if (open && visit) {
      setErrorMessage(null)
      setConflictMessage(null)
      setActiveAction(null)
      setResultText(visit.result_text || '')
      setCancelReason('')

      setRescheduleBrokerId(visit.broker_id || '')
      const startBahia = visit.start_at ? isoUtcToBahiaInput(visit.start_at) : ''
      const endBahia = visit.end_at ? isoUtcToBahiaInput(visit.end_at) : ''
      setRescheduleStart(startBahia)
      setRescheduleEnd(endBahia)

      // Carregar corretores caso precise remarcar
      listActiveBrokers()
        .then(setBrokersList)
        .catch(() => {})
    }
  }, [open, visit])

  if (!visit) return null

  const role = user?.role || ''
  const isAdmin = role === 'admin'
  const isSdr = role === 'sdr'
  const isBroker = role === 'corretor'
  const isMyVisit = visit.broker_id === user?.id

  // Permissões de ação:
  // - "Confirmar" (admin, SDR e o corretor da visita; só quando Agendada)
  const canConfirm = (isAdmin || isSdr || isMyVisit) && visit.status === 'agendada'

  // - "Marcar como realizada" (mesmos papéis; quando Agendada ou Confirmada)
  const canMarkRealizada =
    (isAdmin || isSdr || isMyVisit) &&
    (visit.status === 'agendada' || visit.status === 'confirmada')

  // - "Cliente não compareceu" (mesmos papéis; quando Agendada ou Confirmada)
  const canMarkNaoCompareceu =
    (isAdmin || isSdr || isMyVisit) &&
    (visit.status === 'agendada' || visit.status === 'confirmada')

  // - "Cancelar" (mesmos papéis; quando Pendente, Agendada ou Confirmada)
  const canCancel =
    (isAdmin || isSdr || isMyVisit) &&
    ['pendente_agenda', 'agendada', 'confirmada'].includes(visit.status)

  // - "Remarcar" / "Agendar" (só admin e SDR; quando Pendente, Agendada ou Confirmada)
  const canReschedule =
    (isAdmin || isSdr) && ['pendente_agenda', 'agendada', 'confirmada'].includes(visit.status)

  const isPending = visit.status === 'pendente_agenda'
  const property = visit.expand?.property_id
  const lead = visit.expand?.lead_id
  const client = visit.expand?.client_id
  const broker = visit.expand?.broker_id
  const cancelledBy = visit.expand?.cancelled_by

  // Handler: Confirmar visita
  const handleConfirm = async () => {
    setSubmitting(true)
    setErrorMessage(null)
    setConflictMessage(null)
    try {
      await updateVisitStatus(visit.id, 'confirmada')
      onUpdated()
    } catch (err) {
      setErrorMessage(extractErrorMessage(err, 'Erro ao confirmar visita.'))
    } finally {
      setSubmitting(false)
    }
  }

  // Handler: Não compareceu
  const handleNaoCompareceu = async () => {
    setSubmitting(true)
    setErrorMessage(null)
    setConflictMessage(null)
    try {
      await updateVisitStatus(visit.id, 'nao_compareceu')
      onUpdated()
    } catch (err) {
      setErrorMessage(extractErrorMessage(err, 'Erro ao atualizar visita.'))
    } finally {
      setSubmitting(false)
    }
  }

  // Handler: Realizada
  const handleRealizadaSubmit = async () => {
    if (resultText.trim().length < 3) {
      setErrorMessage('Informe o resultado da visita (mínimo 3 caracteres).')
      return
    }
    setSubmitting(true)
    setErrorMessage(null)
    setConflictMessage(null)
    try {
      await updateVisitStatus(visit.id, 'realizada', resultText.trim())
      setActiveAction(null)
      onUpdated()
    } catch (err) {
      setErrorMessage(extractErrorMessage(err, 'Erro ao salvar resultado da visita.'))
    } finally {
      setSubmitting(false)
    }
  }

  // Handler: Cancelar
  const handleCancelSubmit = async () => {
    if (cancelReason.trim().length < 3) {
      setErrorMessage('Informe o motivo do cancelamento (mínimo 3 caracteres).')
      return
    }
    setSubmitting(true)
    setErrorMessage(null)
    setConflictMessage(null)
    try {
      await cancelVisit(visit.id, cancelReason.trim())
      setActiveAction(null)
      onUpdated()
    } catch (err) {
      setErrorMessage(extractErrorMessage(err, 'Erro ao cancelar visita.'))
    } finally {
      setSubmitting(false)
    }
  }

  // Handler: Mudança de horário de início no Remarcar -> sugerir fim = início + 1 hora
  const handleStartChange = (val: string) => {
    setRescheduleStart(val)
    if (val) {
      try {
        const d = new Date(val)
        if (!isNaN(d.getTime())) {
          const endD = new Date(d.getTime() + 60 * 60 * 1000)
          const yyyy = endD.getFullYear()
          const mm = String(endD.getMonth() + 1).padStart(2, '0')
          const dd = String(endD.getDate()).padStart(2, '0')
          const hh = String(endD.getHours()).padStart(2, '0')
          const min = String(endD.getMinutes()).padStart(2, '0')
          setRescheduleEnd(`${yyyy}-${mm}-${dd}T${hh}:${min}`)
        }
      } catch {
        // ignore
      }
    }
  }

  // Handler: Remarcar / Agendar submit
  const handleRescheduleSubmit = async () => {
    setSubmitting(true)
    setErrorMessage(null)
    setConflictMessage(null)
    try {
      const startIso = rescheduleStart ? bahiaLocalToIsoUtc(rescheduleStart) : undefined
      const endIso = rescheduleEnd ? bahiaLocalToIsoUtc(rescheduleEnd) : undefined

      await rescheduleVisit(visit.id, {
        broker_id: rescheduleBrokerId || undefined,
        start_at: startIso,
        end_at: endIso,
      })
      setActiveAction(null)
      onUpdated()
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Erro ao agendar/remarcar visita.')
      // 409 conflict
      setConflictMessage(msg)
      setErrorMessage(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Determina qual é a ação principal sugerida conforme a situação da visita
  // - Agendada: ação mais provável é Confirmar (preenchida)
  // - Confirmada: ação mais provável é Realizada (preenchida)
  // - Pendente: ação mais provável é Agendar (preenchida)
  const isAgendada = visit.status === 'agendada'
  const isConfirmada = visit.status === 'confirmada'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6 sm:rounded-lg rounded-t-2xl rounded-b-none border border-border bg-popover text-popover-foreground shadow-none fixed bottom-0 top-auto sm:top-[50%] sm:bottom-auto translate-y-0 sm:translate-y-[-50%]">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle className="text-lg font-normal text-foreground">
              Detalhe da Visita
            </DialogTitle>
            {getVisitStatusBadge(visit.status)}
          </div>
          <DialogDescription className="sr-only">
            Informações detalhadas sobre a visita agendada ou pendente.
          </DialogDescription>
        </DialogHeader>

        {/* Aviso de conflito de agenda no topo da janela: borda destructive, texto simples dizendo o que fazer */}
        {conflictMessage && (
          <div className="rounded-lg border border-destructive p-3 text-xs text-destructive flex items-start gap-2 mt-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-normal text-destructive">{conflictMessage}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Escolha outro horário ou selecione outro corretor para esta visita.
              </p>
            </div>
          </div>
        )}

        {errorMessage && !conflictMessage && (
          <div className="rounded-lg border border-destructive p-3 text-xs text-destructive flex items-center gap-2 mt-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Informações da visita */}
        <div className="space-y-4 py-3 text-sm">
          {/* Imóvel */}
          <div className="space-y-1">
            <span className="text-xs eyebrow text-muted-foreground">Imóvel</span>
            {property ? (
              <div>
                <Link
                  to={`/imoveis/${property.id}`}
                  className="text-foreground hover:underline inline-flex items-center gap-1 font-normal"
                  onClick={() => onOpenChange(false)}
                >
                  <span>
                    [{property.code}] {property.title}
                  </span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </Link>
                {property.neighborhood && (
                  <p className="text-xs text-muted-foreground">Bairro: {property.neighborhood}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Imóvel não identificado</p>
            )}
          </div>

          {/* Lead ou Cliente */}
          <div className="space-y-1">
            <span className="text-xs eyebrow text-muted-foreground">
              {lead ? 'Lead' : 'Cliente'}
            </span>
            {lead ? (
              <div>
                <Link
                  to={`/leads/${lead.id}`}
                  className="text-foreground hover:underline inline-flex items-center gap-1 font-normal"
                  onClick={() => onOpenChange(false)}
                >
                  <span>{lead.name}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </Link>
                {lead.phone && (
                  <p className="text-xs text-muted-foreground tabular">{lead.phone}</p>
                )}
              </div>
            ) : client ? (
              <div>
                <Link
                  to={`/clientes/${client.id}`}
                  className="text-foreground hover:underline inline-flex items-center gap-1 font-normal"
                  onClick={() => onOpenChange(false)}
                >
                  <span>{client.name}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </Link>
                {client.phone && (
                  <p className="text-xs text-muted-foreground tabular">{client.phone}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Não vinculado</p>
            )}
          </div>

          {/* Corretor e Horário */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1">
              <span className="text-xs eyebrow text-muted-foreground">Corretor</span>
              <p className="text-sm font-normal text-foreground">
                {broker?.name || broker?.email || 'Ainda sem corretor'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs eyebrow text-muted-foreground">Horário</span>
              {visit.start_at ? (
                <div>
                  <p className="text-sm font-normal tabular text-foreground">
                    {formatDateTimeBahia(visit.start_at)}
                  </p>
                  {visit.end_at && (
                    <p className="text-xs text-muted-foreground tabular">
                      Até {formatDateTimeBahia(visit.end_at)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-attention">Horário pendente</p>
              )}
            </div>
          </div>

          {/* Resultado (se houver) */}
          {visit.result_text && (
            <div className="space-y-1 pt-2 border-t border-border">
              <span className="text-xs eyebrow text-muted-foreground">Resultado da visita</span>
              <p className="text-sm text-foreground whitespace-pre-wrap">{visit.result_text}</p>
            </div>
          )}

          {/* Cancelamento (se houver) */}
          {visit.status === 'cancelada' && (
            <div className="space-y-1 pt-2 border-t border-border">
              <span className="text-xs eyebrow text-destructive">Visita cancelada</span>
              {visit.cancel_reason && (
                <p className="text-sm text-foreground">
                  <span className="text-muted-foreground">Motivo:</span> {visit.cancel_reason}
                </p>
              )}
              {cancelledBy && (
                <p className="text-xs text-muted-foreground tabular">
                  Cancelada por: {cancelledBy.name || cancelledBy.email} em{' '}
                  {formatDateTimeBahia(visit.cancelled_at)}
                </p>
              )}
            </div>
          )}

          {/* Formulário inline para Ação: Realizada */}
          {activeAction === 'realizada' && (
            <div className="p-4 border border-border rounded-lg space-y-3 bg-secondary/30">
              <Label className="text-xs eyebrow text-foreground">
                Resultado da visita <span className="text-destructive">*</span>
              </Label>
              <Textarea
                placeholder="Descreva como foi a visita (mínimo 3 caracteres)..."
                value={resultText}
                onChange={(e) => setResultText(e.target.value)}
                rows={3}
                className="text-sm"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveAction(null)}
                  disabled={submitting}
                  className="rounded-full font-normal"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleRealizadaSubmit}
                  disabled={submitting || resultText.trim().length < 3}
                  className="rounded-full font-normal"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Confirmar realização
                </Button>
              </div>
            </div>
          )}

          {/* Formulário inline para Ação: Cancelar */}
          {activeAction === 'cancelar' && (
            <div className="p-4 border border-destructive/40 rounded-lg space-y-3 bg-destructive/5">
              <Label className="text-xs eyebrow text-destructive">
                Motivo do cancelamento <span className="text-destructive">*</span>
              </Label>
              <Textarea
                placeholder="Informe o motivo do cancelamento (mínimo 3 caracteres)..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="text-sm"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveAction(null)}
                  disabled={submitting}
                  className="rounded-full font-normal"
                >
                  Voltar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleCancelSubmit}
                  disabled={submitting || cancelReason.trim().length < 3}
                  className="rounded-full font-normal"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Confirmar cancelamento
                </Button>
              </div>
            </div>
          )}

          {/* Formulário inline para Ação: Remarcar / Agendar */}
          {activeAction === 'remarcar' && (
            <div className="p-4 border border-border rounded-lg space-y-3 bg-secondary/30">
              <div className="text-sm font-normal text-foreground">
                {isPending ? 'Agendar visita' : 'Remarcar visita'}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs eyebrow text-muted-foreground">Corretor</Label>
                <Select
                  value={rescheduleBrokerId || 'unassigned'}
                  onValueChange={(val) => setRescheduleBrokerId(val === 'unassigned' ? '' : val)}
                >
                  <SelectTrigger className="w-full h-12 min-h-[48px] rounded-lg">
                    <SelectValue placeholder="Selecione o corretor..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Ainda sem corretor</SelectItem>
                    {brokersList.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} ({b.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs eyebrow text-muted-foreground">Início</Label>
                  <Input
                    type="datetime-local"
                    value={rescheduleStart}
                    onChange={(e) => handleStartChange(e.target.value)}
                    className="h-12 min-h-[48px] rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs eyebrow text-muted-foreground">
                    Fim (sugestão +1h)
                  </Label>
                  <Input
                    type="datetime-local"
                    value={rescheduleEnd}
                    onChange={(e) => setRescheduleEnd(e.target.value)}
                    className="h-12 min-h-[48px] rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveAction(null)}
                  disabled={submitting}
                  className="rounded-full font-normal"
                >
                  Voltar
                </Button>
                <Button
                  size="sm"
                  onClick={handleRescheduleSubmit}
                  disabled={submitting}
                  className="rounded-full font-normal"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Botões de Ação na barra inferior se nenhuma ação inline estiver aberta */}
        {/* Pílulas com uma só ação principal preenchida por tela; o resto de contorno */}
        {!activeAction && (
          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between items-stretch sm:items-center pt-3 border-t border-border">
            <div className="flex flex-wrap gap-2">
              {canCancel && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs font-normal border-destructive text-destructive hover:bg-destructive/10"
                  onClick={() => setActiveAction('cancelar')}
                >
                  Cancelar visita
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              {canReschedule && (
                <Button
                  variant={isPending ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveAction('remarcar')}
                  className="rounded-full text-xs font-normal"
                >
                  <span>{isPending ? 'Agendar' : 'Remarcar'}</span>
                </Button>
              )}

              {canMarkNaoCompareceu && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNaoCompareceu}
                  disabled={submitting}
                  className="rounded-full text-xs font-normal"
                >
                  <span>Não compareceu</span>
                </Button>
              )}

              {canConfirm && (
                <Button
                  variant={isAgendada ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="rounded-full text-xs font-normal"
                >
                  <span>Confirmar</span>
                </Button>
              )}

              {canMarkRealizada && (
                <Button
                  variant={isConfirmada ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveAction('realizada')}
                  className="rounded-full text-xs font-normal"
                >
                  <span>Realizada</span>
                </Button>
              )}
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
