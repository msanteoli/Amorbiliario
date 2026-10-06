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
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
          Pendente de agenda
        </Badge>
      )
    case 'agendada':
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
          Agendada
        </Badge>
      )
    case 'confirmada':
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
          Confirmada
        </Badge>
      )
    case 'realizada':
      return (
        <Badge variant="outline" className="bg-teal-50 text-teal-800 border-teal-300">
          Realizada
        </Badge>
      )
    case 'cancelada':
      return (
        <Badge variant="outline" className="bg-zinc-100 text-zinc-600 border-zinc-200">
          Cancelada
        </Badge>
      )
    case 'nao_compareceu':
      return (
        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
          Não compareceu
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-4">
            <DialogTitle className="text-lg font-bold">Detalhe da Visita</DialogTitle>
            {getVisitStatusBadge(visit.status)}
          </div>
          <DialogDescription className="sr-only">
            Informações detalhadas sobre a visita agendada ou pendente.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive" className="my-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Informações da visita */}
        <div className="space-y-4 py-2 text-sm">
          {/* Imóvel */}
          <div className="flex items-start gap-3 p-3 rounded-md bg-muted/40 border">
            <Building2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-muted-foreground">Imóvel</span>
              {property ? (
                <div className="font-semibold text-foreground">
                  <Link
                    to={`/imoveis/${property.id}`}
                    className="hover:underline text-primary inline-flex items-center gap-1"
                    onClick={() => onOpenChange(false)}
                  >
                    <span>
                      [{property.code}] {property.title}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 inline" />
                  </Link>
                  {property.neighborhood && (
                    <p className="text-xs text-muted-foreground font-normal">
                      Bairro: {property.neighborhood}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Imóvel não identificado</p>
              )}
            </div>
          </div>

          {/* Lead ou Cliente */}
          <div className="flex items-start gap-3 p-3 rounded-md bg-muted/40 border">
            <User className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-muted-foreground">
                {lead ? 'Lead' : 'Cliente'}
              </span>
              {lead ? (
                <div>
                  <Link
                    to={`/leads/${lead.id}`}
                    className="font-semibold hover:underline text-primary inline-flex items-center gap-1"
                    onClick={() => onOpenChange(false)}
                  >
                    <span>{lead.name}</span>
                    <ExternalLink className="h-3.5 w-3.5 inline" />
                  </Link>
                  {lead.phone && <p className="text-xs text-muted-foreground">{lead.phone}</p>}
                </div>
              ) : client ? (
                <div>
                  <Link
                    to={`/clientes/${client.id}`}
                    className="font-semibold hover:underline text-primary inline-flex items-center gap-1"
                    onClick={() => onOpenChange(false)}
                  >
                    <span>{client.name}</span>
                    <ExternalLink className="h-3.5 w-3.5 inline" />
                  </Link>
                  {client.phone && <p className="text-xs text-muted-foreground">{client.phone}</p>}
                </div>
              ) : (
                <p className="text-muted-foreground">Não vinculado</p>
              )}
            </div>
          </div>

          {/* Corretor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-md bg-muted/40 border">
              <span className="text-xs font-medium text-muted-foreground block mb-1">
                Corretor responsável
              </span>
              <p className="font-medium text-foreground">
                {broker?.name || broker?.email || 'Ainda sem corretor'}
              </p>
            </div>

            {/* Início e Fim */}
            <div className="p-3 rounded-md bg-muted/40 border">
              <span className="text-xs font-medium text-muted-foreground block mb-1">
                Horário da visita
              </span>
              {visit.start_at ? (
                <div>
                  <p className="font-semibold text-foreground">
                    {formatDateTimeBahia(visit.start_at)}
                  </p>
                  {visit.end_at && (
                    <p className="text-xs text-muted-foreground">
                      Até {formatDateTimeBahia(visit.end_at)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-amber-600 font-medium">Horário pendente</p>
              )}
            </div>
          </div>

          {/* Resultado (se houver) */}
          {visit.result_text && (
            <div className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 block mb-1">
                Resultado da visita:
              </span>
              <p className="text-sm text-emerald-900 dark:text-emerald-100 whitespace-pre-wrap">
                {visit.result_text}
              </p>
            </div>
          )}

          {/* Cancelamento (se houver) */}
          {visit.status === 'cancelada' && (
            <div className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 space-y-1">
              <span className="text-xs font-semibold text-rose-800 dark:text-rose-300 block">
                Visita cancelada
              </span>
              {visit.cancel_reason && (
                <p className="text-sm text-rose-900 dark:text-rose-100">
                  <span className="font-medium">Motivo:</span> {visit.cancel_reason}
                </p>
              )}
              {cancelledBy && (
                <p className="text-xs text-rose-700 dark:text-rose-300">
                  Cancelada por: {cancelledBy.name || cancelledBy.email} em{' '}
                  {formatDateTimeBahia(visit.cancelled_at)}
                </p>
              )}
            </div>
          )}

          {/* Formulário inline para Ação: Realizada */}
          {activeAction === 'realizada' && (
            <div className="p-4 border rounded-md bg-background space-y-3 shadow-sm">
              <Label className="text-sm font-semibold">
                Resultado da visita <span className="text-destructive">*</span>
              </Label>
              <Textarea
                placeholder="Descreva como foi a visita (mínimo 3 caracteres)..."
                value={resultText}
                onChange={(e) => setResultText(e.target.value)}
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveAction(null)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleRealizadaSubmit}
                  disabled={submitting || resultText.trim().length < 3}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Confirmar realização
                </Button>
              </div>
            </div>
          )}

          {/* Formulário inline para Ação: Cancelar */}
          {activeAction === 'cancelar' && (
            <div className="p-4 border rounded-md bg-destructive/5 space-y-3">
              <Label className="text-sm font-semibold text-destructive">
                Motivo do cancelamento <span className="text-destructive">*</span>
              </Label>
              <Textarea
                placeholder="Informe o motivo do cancelamento (mínimo 3 caracteres)..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveAction(null)}
                  disabled={submitting}
                >
                  Voltar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleCancelSubmit}
                  disabled={submitting || cancelReason.trim().length < 3}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Confirmar cancelamento
                </Button>
              </div>
            </div>
          )}

          {/* Formulário inline para Ação: Remarcar / Agendar */}
          {activeAction === 'remarcar' && (
            <div className="p-4 border rounded-md bg-muted/30 space-y-3">
              <div className="font-semibold text-sm">
                {isPending ? 'Agendar visita' : 'Remarcar visita'}
              </div>

              {conflictMessage && (
                <Alert variant="destructive" className="py-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs font-medium">
                    {conflictMessage}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Corretor</Label>
                <Select
                  value={rescheduleBrokerId || 'unassigned'}
                  onValueChange={(val) => setRescheduleBrokerId(val === 'unassigned' ? '' : val)}
                >
                  <SelectTrigger className="w-full">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Início</Label>
                  <Input
                    type="datetime-local"
                    value={rescheduleStart}
                    onChange={(e) => handleStartChange(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fim (sugestão +1h)</Label>
                  <Input
                    type="datetime-local"
                    value={rescheduleEnd}
                    onChange={(e) => setRescheduleEnd(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveAction(null)}
                  disabled={submitting}
                >
                  Voltar
                </Button>
                <Button size="sm" onClick={handleRescheduleSubmit} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Botões de Ação na barra inferior se nenhuma ação inline estiver aberta */}
        {!activeAction && (
          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between items-stretch sm:items-center pt-2 border-t">
            <div className="flex flex-wrap gap-1.5">
              {/* Cancelar */}
              {canCancel && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setActiveAction('cancelar')}
                >
                  Cancelar visita
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              {/* Remarcar / Agendar */}
              {canReschedule && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveAction('remarcar')}
                  className="gap-1.5"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>{isPending ? 'Agendar' : 'Remarcar'}</span>
                </Button>
              )}

              {/* Não compareceu */}
              {canMarkNaoCompareceu && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNaoCompareceu}
                  disabled={submitting}
                  className="gap-1.5"
                >
                  <UserX className="h-3.5 w-3.5" />
                  <span>Cliente não compareceu</span>
                </Button>
              )}

              {/* Confirmar */}
              {canConfirm && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Confirmar</span>
                </Button>
              )}

              {/* Marcar como realizada */}
              {canMarkRealizada && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setActiveAction('realizada')}
                  className="gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Marcar como realizada</span>
                </Button>
              )}
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
