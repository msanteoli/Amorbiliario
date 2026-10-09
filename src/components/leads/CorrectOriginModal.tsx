import { useState } from 'react'
import {
  LeadRecord,
  LeadOrigin,
  LEAD_ORIGIN_LABELS,
  correctLeadOrigin,
  formatLeadErrorMessage,
} from '@/services/leads'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, Edit, Loader2 } from 'lucide-react'

interface CorrectOriginModalProps {
  lead: LeadRecord
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (newOrigin: LeadOrigin) => void
}

const ORIGINS: LeadOrigin[] = [
  'whatsapp',
  'portal',
  'indicacao_balcao',
  'ligacao',
  'site',
  'redes_sociais',
  'site_redes_outros',
]

export function CorrectOriginModal({
  lead,
  open,
  onOpenChange,
  onSuccess,
}: CorrectOriginModalProps) {
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [selectedOrigin, setSelectedOrigin] = useState<LeadOrigin>(lead.origin)
  const [reason, setReason] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (reason.trim().length < 3) {
      setErrorMessage('Informe o motivo da correção (mínimo de 3 caracteres).')
      return
    }

    setLoading(true)

    try {
      const res = await correctLeadOrigin(lead.id, selectedOrigin, reason.trim())
      onSuccess(res.origin)
      onOpenChange(false)
    } catch (err) {
      setErrorMessage(formatLeadErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setErrorMessage(null)
      setReason('')
      setSelectedOrigin(lead.origin)
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md w-full max-sm:h-[90vh] max-sm:max-h-[90vh] max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:fixed max-sm:bottom-0 max-sm:top-auto max-sm:translate-y-0 rounded-lg border border-border bg-card p-6 shadow-none overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-normal text-foreground">
            Corrigir origem do lead
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20">
              {errorMessage}
            </div>
          )}

          <div className="p-3.5 rounded-lg bg-muted/20 border border-border text-xs text-muted-foreground space-y-1">
            <div>
              Origem atual:{' '}
              <strong className="text-foreground font-normal">
                {LEAD_ORIGIN_LABELS[lead.origin] || lead.origin}
              </strong>
            </div>
            {lead.origin_detail && <div>Detalhe: {lead.origin_detail}</div>}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="correct-origin"
              className="text-[13px] font-normal text-foreground block"
            >
              Nova origem
            </label>
            <Select
              value={selectedOrigin}
              onValueChange={(val) => setSelectedOrigin(val as LeadOrigin)}
            >
              <SelectTrigger
                id="correct-origin"
                className="h-12 rounded-lg border-border bg-background"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORIGINS.map((orig) => (
                  <SelectItem key={orig} value={orig}>
                    {LEAD_ORIGIN_LABELS[orig]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="correct-reason"
              className="text-[13px] font-normal text-foreground block"
            >
              Motivo da correção <span className="text-destructive">*</span>
            </label>
            <input
              id="correct-reason"
              placeholder="Ex.: Cliente informou que conheceu pelo Instagram"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={3}
              maxLength={300}
              required
              className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-[11px] text-muted-foreground block">
              Obrigatório (mínimo de 3 caracteres). Fica gravado no log de auditoria.
            </span>
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={loading}
              className="h-10 rounded-full px-5 text-xs font-normal border-border"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="h-10 rounded-full px-5 text-xs font-normal bg-primary text-primary-foreground gap-2"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Confirmar correção</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
