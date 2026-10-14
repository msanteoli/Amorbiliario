import { useState, useEffect, useCallback } from 'react'
import {
  getBrokerSuggestion,
  assignLead,
  listActiveBrokers,
  BrokerSuggestionResponse,
  LeadUserRecord,
  LeadAssignConflictError,
  formatLeadErrorMessage,
} from '@/services/leads'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { AlertCircle, Loader2 } from 'lucide-react'

interface DirectLeadModalProps {
  leadId: string
  leadName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (assignedUserName: string) => void
}

export function DirectLeadModal({
  leadId,
  leadName,
  open,
  onOpenChange,
  onSuccess,
}: DirectLeadModalProps) {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [brokers, setBrokers] = useState<LeadUserRecord[]>([])
  const [suggestion, setSuggestion] = useState<BrokerSuggestionResponse | null>(null)
  const [selectedBrokerId, setSelectedBrokerId] = useState<string>('')
  const [serverConflictMessage, setServerConflictMessage] = useState<string | null>(null)
  const [genericErrorMessage, setGenericErrorMessage] = useState<string | null>(null)

  const fetchSuggestionAndBrokers = useCallback(async () => {
    if (!leadId) return
    setLoading(true)
    setGenericErrorMessage(null)
    try {
      const [sugg, activeBrokers] = await Promise.all([
        getBrokerSuggestion(leadId),
        listActiveBrokers(),
      ])
      setBrokers(activeBrokers)
      setSuggestion(sugg)
      if (sugg.user_id) {
        setSelectedBrokerId(sugg.user_id)
      } else if (activeBrokers.length > 0) {
        setSelectedBrokerId(activeBrokers[0].id)
      } else {
        setSelectedBrokerId('')
      }
    } catch (err: unknown) {
      setGenericErrorMessage(formatLeadErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    if (open) {
      setServerConflictMessage(null)
      setGenericErrorMessage(null)
      fetchSuggestionAndBrokers()
    } else {
      setSuggestion(null)
      setSelectedBrokerId('')
      setServerConflictMessage(null)
      setGenericErrorMessage(null)
    }
  }, [open, fetchSuggestionAndBrokers])

  const handleConfirm = async () => {
    if (!selectedBrokerId || submitting) return
    setSubmitting(true)
    setServerConflictMessage(null)
    setGenericErrorMessage(null)

    try {
      await assignLead(leadId, selectedBrokerId)
      const chosenBroker = brokers.find((b) => b.id === selectedBrokerId)
      const chosenName = chosenBroker?.name || chosenBroker?.email || suggestion?.name || 'Corretor'
      onOpenChange(false)
      onSuccess(chosenName)
    } catch (err: unknown) {
      if (err instanceof LeadAssignConflictError) {
        // em 409 mostra a message do servidor como TEXTO (nunca HTML) e busca a sugestão de novo.
        setServerConflictMessage(err.serverMessage)
        await fetchSuggestionAndBrokers()
      } else {
        setGenericErrorMessage(formatLeadErrorMessage(err))
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Textos exatos:
  // reason 'tipo' → "Sugestão: (atende este tipo de imóvel)."
  // 'fila' → "Sugestão: (próximo da fila)."
  // user_id null / 'fila_vazia' → "Sem corretor disponível agora. O lead continua com você." e SEM botão de confirmar.
  const isFilaVazia =
    !suggestion || suggestion.user_id === null || suggestion.reason === 'fila_vazia'

  let suggestionText = ''
  if (suggestion) {
    if (suggestion.reason === 'tipo') {
      suggestionText = 'Sugestão: (atende este tipo de imóvel).'
    } else if (suggestion.reason === 'fila') {
      suggestionText = 'Sugestão: (próximo da fila).'
    } else if (isFilaVazia) {
      suggestionText = 'Sem corretor disponível agora. O lead continua com você.'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-normal">
            Direcionar lead{leadName ? ` — ${leadName}` : ''}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Defina o corretor responsável pelo atendimento deste lead.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs">Consultando sugestão de corretor...</span>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Mensagem de conflito 409 renderizada estritamente como texto */}
            {serverConflictMessage && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="whitespace-pre-wrap">{serverConflictMessage}</span>
              </div>
            )}

            {/* Mensagem de erro genérico se houver */}
            {genericErrorMessage && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="whitespace-pre-wrap">{genericErrorMessage}</span>
              </div>
            )}

            {/* Texto de sugestão */}
            {suggestionText && (
              <div
                className={`p-3 rounded-lg text-xs border ${
                  isFilaVazia
                    ? 'bg-muted/40 text-muted-foreground border-border'
                    : 'bg-primary/5 text-foreground border-primary/20'
                }`}
              >
                <span>{suggestionText}</span>
              </div>
            )}

            {!isFilaVazia && (
              <div className="space-y-2">
                <Label htmlFor="broker-select" className="text-xs font-normal">
                  Corretor responsável
                </Label>
                <Select value={selectedBrokerId} onValueChange={setSelectedBrokerId}>
                  <SelectTrigger id="broker-select" className="h-10 text-xs">
                    <SelectValue placeholder="Selecione um corretor" />
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
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="h-9 rounded-full px-4 text-xs font-normal border-border"
          >
            {isFilaVazia ? 'Fechar' : 'Cancelar'}
          </Button>

          {/* user_id null / 'fila_vazia' → SEM botão de confirmar */}
          {!loading && !isFilaVazia && (
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              disabled={submitting || !selectedBrokerId}
              className="h-9 rounded-full px-4 text-xs font-normal bg-primary text-primary-foreground gap-1.5"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Confirmar direcionamento</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
