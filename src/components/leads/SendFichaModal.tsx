import { useState } from 'react'
import {
  searchAvailableProperties,
  getPropertyFicha,
  markLeadFichaSent,
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Check, Copy, Loader2, Search } from 'lucide-react'

interface SendFichaModalProps {
  leadId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSent: () => void
}

export function SendFichaModal({ leadId, open, onOpenChange, onSent }: SendFichaModalProps) {
  const [propertySearch, setPropertySearch] = useState('')
  const [searchResults, setSearchResults] = useState<
    Array<{ id: string; code: string; title: string }>
  >([])
  const [searching, setSearching] = useState(false)

  // Imóvel escolhido e processo de envio
  const [selectedProperty, setSelectedProperty] = useState<{
    id: string
    code: string
    title: string
  } | null>(null)
  const [intentKey, setIntentKey] = useState<string>('')
  const [fichaText, setFichaText] = useState<string>('')
  const [processing, setProcessing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleSearchProperty = async (query: string) => {
    setPropertySearch(query)
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const res = await searchAvailableProperties(query)
      setSearchResults(
        res.items.map((p) => ({
          id: p.id,
          code: (p.code as string) || '',
          title: (p.title as string) || '',
        })),
      )
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleSelectAndProcessProperty = async (prop: {
    id: string
    code: string
    title: string
  }) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setSelectedProperty(prop)

    // Gera uma chave de intenção uma vez por clique no imóvel e guarda-a até o fim da operação
    const key = crypto.randomUUID()
    setIntentKey(key)

    await executeFichaFlow(prop.id, key)
  }

  const executeFichaFlow = async (propertyId: string, currentKey: string) => {
    setProcessing(true)
    try {
      // 1. Chame GET /backend/v1/properties/{id}/ficha
      const ficha = await getPropertyFicha(propertyId)
      setFichaText(ficha.text)

      // 2. Copie o campo text para a área de transferência
      try {
        await navigator.clipboard.writeText(ficha.text)
        setCopied(true)
      } catch {
        // clipboard pode falhar em alguns navegadores/permissões
      }

      setSuccessMessage('Ficha copiada. Cole no WhatsApp.')

      // 3. Em seguida chame POST /backend/v1/leads/{id}/ficha-sent com { property_id, intent_key }
      await markLeadFichaSent(leadId, propertyId, currentKey)
      onSent()
    } catch (err) {
      setErrorMessage(formatLeadErrorMessage(err))
    } finally {
      setProcessing(false)
    }
  }

  const handleRetry = async () => {
    if (!selectedProperty || !intentKey) return
    setErrorMessage(null)
    await executeFichaFlow(selectedProperty.id, intentKey)
  }

  const handleManualCopy = async () => {
    if (!fichaText) return
    try {
      await navigator.clipboard.writeText(fichaText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setPropertySearch('')
      setSearchResults([])
      setSelectedProperty(null)
      setIntentKey('')
      setFichaText('')
      setErrorMessage(null)
      setSuccessMessage(null)
      setCopied(false)
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl w-full max-sm:h-[90vh] max-sm:max-h-[90vh] max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:fixed max-sm:bottom-0 max-sm:top-auto max-sm:translate-y-0 rounded-lg border border-border bg-card p-6 shadow-none overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-normal text-foreground">
            Enviar ficha de imóvel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 flex items-center justify-between gap-2">
              <span>{errorMessage}</span>
              {selectedProperty && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="text-xs text-primary underline shrink-0"
                >
                  Tentar novamente
                </button>
              )}
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-lg border border-border bg-muted/40 text-foreground text-xs flex items-center gap-2">
              <Check className="h-4 w-4 text-success shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {!selectedProperty ? (
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground block">
                Busque um imóvel disponível por código ou título para gerar a ficha:
              </span>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Ex.: AP001 ou Residencial Flores..."
                  value={propertySearch}
                  onChange={(e) => handleSearchProperty(e.target.value)}
                  className="w-full h-12 pl-11 pr-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {searching && (
                  <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {searchResults.length > 0 && (
                <div className="max-h-56 overflow-y-auto border border-border rounded-lg divide-y divide-border bg-card text-xs">
                  {searchResults.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 hover:bg-muted/40 cursor-pointer flex items-center justify-between gap-3"
                      onClick={() => handleSelectAndProcessProperty(p)}
                    >
                      <div>
                        <span className="eyebrow text-foreground block">{p.code}</span>
                        <span className="text-muted-foreground">{p.title}</span>
                      </div>
                      <span className="text-xs text-primary underline shrink-0">Gerar ficha</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20 text-xs">
                <div>
                  <span className="eyebrow text-foreground">{selectedProperty.code}</span>
                  <span className="text-muted-foreground ml-2">{selectedProperty.title}</span>
                </div>
                {!processing && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProperty(null)
                      setFichaText('')
                      setSuccessMessage(null)
                      setErrorMessage(null)
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Trocar imóvel
                  </button>
                )}
              </div>

              {processing ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs">Gerando ficha e registrando envio...</span>
                </div>
              ) : fichaText ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="eyebrow text-muted-foreground">
                      Texto da ficha gerado pelo servidor:
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleManualCopy}
                      className="h-8 rounded-full px-3 text-xs font-normal border-border gap-1"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3 w-3 text-success" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copiar novamente</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <Textarea
                    readOnly
                    value={fichaText}
                    rows={10}
                    className="font-mono text-xs bg-muted/20 border-border"
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter className="pt-3">
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            className="h-10 rounded-full px-5 text-xs font-normal border-border"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
