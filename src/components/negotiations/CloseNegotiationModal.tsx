import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import {
  closeNegotiation,
  formatNegotiationErrorMessage,
  NegotiationPurpose,
} from '@/services/negotiations'

interface CloseNegotiationModalProps {
  negotiationId: string
  purpose: NegotiationPurpose
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CloseNegotiationModal({
  negotiationId,
  purpose,
  open,
  onOpenChange,
  onSuccess,
}: CloseNegotiationModalProps) {
  const [closing, setClosing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isVenda = purpose === 'venda'
  const novoStatusImovel = isVenda ? 'Vendido' : 'Alugado'

  const handleConfirmClose = async () => {
    setClosing(true)
    setErrorMessage(null)

    try {
      await closeNegotiation(negotiationId)
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      setErrorMessage(formatNegotiationErrorMessage(err))
    } finally {
      setClosing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-foreground">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <DialogTitle>Fechar negócio</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1.5">
            Confirme a conclusão bem-sucedida desta negociação.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive" className="py-2.5">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
          </Alert>
        )}

        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
          <p className="text-xs text-foreground leading-relaxed">
            O imóvel vira <strong>{novoStatusImovel}</strong>, sai do site e o lead vira{' '}
            <strong>Ganho</strong>.
          </p>
          <p className="text-xs font-semibold text-destructive">Não dá para desfazer.</p>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={closing}
            className="text-xs h-9 rounded-full px-4"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirmClose}
            disabled={closing}
            className="text-xs h-9 rounded-full px-4 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {closing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Confirmar fechamento</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
