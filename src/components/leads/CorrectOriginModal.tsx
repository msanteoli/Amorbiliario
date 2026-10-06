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

const ORIGINS: LeadOrigin[] = ['whatsapp', 'portal', 'indicacao_balcao', 'site_redes_outros']

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5 text-primary" />
            <span>Corrigir origem do lead</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="p-3 rounded-md bg-muted/40 border text-xs text-muted-foreground space-y-1">
            <div>
              Origem atual:{' '}
              <strong className="text-foreground">
                {LEAD_ORIGIN_LABELS[lead.origin] || lead.origin}
              </strong>
            </div>
            {lead.origin_detail && <div>Detalhe: {lead.origin_detail}</div>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="correct-origin">Nova origem</Label>
            <Select
              value={selectedOrigin}
              onValueChange={(val) => setSelectedOrigin(val as LeadOrigin)}
            >
              <SelectTrigger id="correct-origin">
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

          <div className="space-y-2">
            <Label htmlFor="correct-reason">
              Motivo da correção <span className="text-destructive">*</span>
            </Label>
            <Input
              id="correct-reason"
              placeholder="Ex.: Cliente informou que conheceu pelo Instagram"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={3}
              maxLength={300}
              required
            />
            <span className="text-[11px] text-muted-foreground block">
              Obrigatório (mínimo de 3 caracteres). Fica gravado no log de auditoria.
            </span>
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Confirmar correção</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
