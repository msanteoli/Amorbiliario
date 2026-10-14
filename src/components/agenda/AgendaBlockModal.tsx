import React, { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Clock, Loader2 } from 'lucide-react'
import {
  AgendaBlockRecord,
  createAgendaBlock,
  endAgendaBlock,
  listActiveAndFutureAgendaBlocks,
  formatAgendaBlockErrorMessage,
} from '@/services/agendaBlocks'
import { bahiaLocalToIsoUtc, isoUtcToBahiaInput, formatDateTimeBahia } from '@/services/visits'
import { listActiveBrokers, LeadUserRecord } from '@/services/leads'
import { useAuth } from '@/contexts/AuthContext'

interface AgendaBlockModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated?: () => void
}

export function AgendaBlockModal({ open, onOpenChange, onUpdated }: AgendaBlockModalProps) {
  const { user } = useAuth()
  const role = user?.role || ''
  const isAdmin = role === 'admin'

  // Estados do formulário
  const [startLocal, setStartLocal] = useState('')
  const [endLocal, setEndLocal] = useState('')
  const [reason, setReason] = useState('')
  const [selectedBrokerId, setSelectedBrokerId] = useState('')
  const [brokers, setBrokers] = useState<LeadUserRecord[]>([])

  // Estados de bloqueios existentes (ativos e futuros)
  const [blocks, setBlocks] = useState<AgendaBlockRecord[]>([])
  const [loadingBlocks, setLoadingBlocks] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [endingId, setEndingId] = useState<string | null>(null)

  // Mensagens
  const [formError, setFormError] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)

  // Inicializa datas com valores padrão no fuso da Bahia: início agora (arredondado), fim +4h
  const resetForm = useCallback(() => {
    const now = new Date()
    const nowIso = now.toISOString()
    const currentInput = isoUtcToBahiaInput(nowIso)
    setStartLocal(currentInput)

    // Fim sugerido: +4 horas
    const futureDate = new Date(now.getTime() + 4 * 3600 * 1000)
    setEndLocal(isoUtcToBahiaInput(futureDate.toISOString()))

    setReason('')
    setFormError(null)
    setListError(null)
  }, [])

  const loadData = useCallback(async () => {
    setLoadingBlocks(true)
    setListError(null)
    try {
      // Para admin, listActiveAndFutureAgendaBlocks traz todos os da org
      // Para corretor, o backend filtra por user_id = @request.auth.id
      const [blockList, brokerList] = await Promise.all([
        listActiveAndFutureAgendaBlocks(),
        isAdmin ? listActiveBrokers().catch(() => []) : Promise.resolve([]),
      ])
      setBlocks(blockList)
      if (isAdmin) {
        setBrokers(brokerList)
        if (brokerList.length > 0 && !selectedBrokerId) {
          setSelectedBrokerId(brokerList[0].id)
        }
      }
    } catch (err) {
      setListError(formatAgendaBlockErrorMessage(err, 'Falha ao carregar bloqueios.'))
    } finally {
      setLoadingBlocks(false)
    }
  }, [isAdmin, selectedBrokerId])

  useEffect(() => {
    if (open) {
      resetForm()
      loadData()
    }
  }, [open, resetForm, loadData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!startLocal || !endLocal) {
      setFormError('Informe início e fim do bloqueio.')
      return
    }

    const startIso = bahiaLocalToIsoUtc(startLocal)
    const endIso = bahiaLocalToIsoUtc(endLocal)

    const startTime = new Date(startIso).getTime()
    const endTime = new Date(endIso).getTime()

    if (isNaN(startTime) || isNaN(endTime)) {
      setFormError('Datas inválidas.')
      return
    }

    if (endTime <= startTime) {
      setFormError('O fim precisa ser depois do início.')
      return
    }

    if (isAdmin && !selectedBrokerId) {
      setFormError('Selecione o corretor para o bloqueio.')
      return
    }

    setSubmitting(true)
    try {
      await createAgendaBlock({
        start_at: startIso,
        end_at: endIso,
        reason: reason.trim() ? reason.trim().slice(0, 200) : undefined,
        user_id: isAdmin ? selectedBrokerId : undefined,
      })
      resetForm()
      await loadData()
      onUpdated?.()
    } catch (err) {
      setFormError(formatAgendaBlockErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleEndBlock = async (blockId: string) => {
    setEndingId(blockId)
    setListError(null)
    try {
      await endAgendaBlock(blockId)
      await loadData()
      onUpdated?.()
    } catch (err) {
      setListError(formatAgendaBlockErrorMessage(err, 'Falha ao encerrar bloqueio.'))
    } finally {
      setEndingId(null)
    }
  }

  // Identifica se o bloqueio está ocorrendo agora
  const isBlockActiveNow = (b: AgendaBlockRecord) => {
    if (b.ended_at) return false
    const nowMs = Date.now()
    const startMs = new Date(b.start_at.replace(' ', 'T')).getTime()
    const endMs = new Date(b.end_at.replace(' ', 'T')).getTime()
    return startMs <= nowMs && endMs > nowMs
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <span>{isAdmin ? 'Bloqueios de agenda da equipe' : 'Bloquear minha agenda'}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isAdmin
              ? 'Defina períodos em que o corretor não recebe novos leads nem pedidos de visita.'
              : 'Enquanto a agenda estiver bloqueada, você não recebe leads novos nem pedidos de visita.'}
          </DialogDescription>
        </DialogHeader>

        {/* Formulário de criação de bloqueio */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-b border-border pb-6">
          <p className="text-xs font-medium text-foreground eyebrow">Novo bloqueio</p>

          {formError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Seletor de corretor para admin */}
          {isAdmin && (
            <div className="space-y-1.5">
              <Label htmlFor="agenda-block-broker" className="text-xs font-normal">
                Corretor
              </Label>
              <Select value={selectedBrokerId} onValueChange={setSelectedBrokerId}>
                <SelectTrigger id="agenda-block-broker" className="h-10 text-xs">
                  <SelectValue placeholder="Selecione um corretor ativo" />
                </SelectTrigger>
                <SelectContent>
                  {brokers.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs">
                      {b.name || b.email || 'Corretor'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Início e fim em horário de Bahia UTC-3 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="block-start" className="text-xs eyebrow text-muted-foreground">
                Início (horário de Bahia)
              </Label>
              <Input
                id="block-start"
                type="datetime-local"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
                required
                className="h-11 rounded-lg text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="block-end" className="text-xs eyebrow text-muted-foreground">
                Fim (horário de Bahia)
              </Label>
              <Input
                id="block-end"
                type="datetime-local"
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
                required
                className="h-11 rounded-lg text-xs"
              />
            </div>
          </div>

          {/* Motivo opcional até 200 caracteres */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="block-reason" className="text-xs font-normal text-muted-foreground">
                Motivo (opcional)
              </Label>
              <span className="text-[11px] tabular text-muted-foreground">{reason.length}/200</span>
            </div>
            <Textarea
              id="block-reason"
              placeholder="Ex.: Férias, ausência médica, compromisso externo..."
              value={reason}
              maxLength={200}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[70px] text-xs resize-none"
            />
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="rounded-full px-5 text-xs font-normal gap-1.5"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Confirmar bloqueio</span>
            </Button>
          </div>
        </form>

        {/* Lista de bloqueios ativos e futuros */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground eyebrow">
              Bloqueios em andamento e futuros
            </p>
            {blocks.length > 0 && (
              <span className="text-[11px] tabular text-muted-foreground">
                ({blocks.length} {blocks.length === 1 ? 'bloqueio' : 'bloqueios'})
              </span>
            )}
          </div>

          {listError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{listError}</span>
            </div>
          )}

          {loadingBlocks ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs">Carregando bloqueios...</span>
            </div>
          ) : blocks.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Nenhum bloqueio ativo ou futuro no momento.
            </p>
          ) : (
            <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
              {blocks.map((block) => {
                const activeNow = isBlockActiveNow(block)
                const brokerName =
                  block.expand?.user_id?.name ||
                  block.expand?.user_id?.email ||
                  (isAdmin ? 'Corretor' : 'Você')
                const isEnding = endingId === block.id

                return (
                  <div
                    key={block.id}
                    className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      activeNow ? 'bg-attention/10' : 'bg-background hover:bg-muted/30'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isAdmin && (
                          <span className="text-xs font-medium text-foreground truncate">
                            {brokerName}
                          </span>
                        )}
                        {activeNow ? (
                          <Badge variant="attention" className="text-[10px] h-5">
                            Bloqueado agora
                          </Badge>
                        ) : (
                          <Badge variant="default" className="text-[10px] h-5">
                            Agendado
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs text-foreground font-normal">
                        <span>{formatDateTimeBahia(block.start_at)}</span>
                        <span className="text-muted-foreground mx-1.5">até</span>
                        <span className="font-medium">{formatDateTimeBahia(block.end_at)}</span>
                      </div>

                      {block.reason && (
                        <p className="text-xs text-muted-foreground italic truncate">
                          Motivo: {block.reason}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isEnding}
                        onClick={() => handleEndBlock(block.id)}
                        className="rounded-full text-xs font-normal border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 h-8 px-3.5"
                      >
                        {isEnding ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                            Encerrando...
                          </>
                        ) : (
                          'Encerrar bloqueio'
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
