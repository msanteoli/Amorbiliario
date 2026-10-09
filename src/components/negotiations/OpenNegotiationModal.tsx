import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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
import { Loader2, Search, Building2, AlertCircle } from 'lucide-react'
import {
  NegotiationPurpose,
  openNegotiation,
  formatNegotiationErrorMessage,
} from '@/services/negotiations'
import { maskCurrencyInput, parseCurrencyInput } from '@/lib/currencyUtils'
import pb from '@/lib/pocketbase/client'
import { RecordModel } from 'pocketbase'

interface PropertyOption {
  id: string
  code: string
  title: string
  purpose: string
  sale_price?: number
  rent_price?: number
}

interface OpenNegotiationModalProps {
  leadId: string
  defaultPropertyId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (negotiationId: string) => void
  onConflict?: () => void
}

export function OpenNegotiationModal({
  leadId,
  defaultPropertyId,
  open,
  onOpenChange,
  onSuccess,
  onConflict,
}: OpenNegotiationModalProps) {
  const [purpose, setPurpose] = useState<NegotiationPurpose>('venda')
  const [agreedValueStr, setAgreedValueStr] = useState('')
  const [propertySearch, setPropertySearch] = useState('')
  const [searchingProperties, setSearchingProperties] = useState(false)
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [selectedProperty, setSelectedProperty] = useState<PropertyOption | null>(null)

  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Reseta estado ao abrir
  useEffect(() => {
    if (open) {
      setPurpose('venda')
      setAgreedValueStr('')
      setPropertySearch('')
      setErrorMessage(null)
      setSelectedProperty(null)

      // Se há um defaultPropertyId vinculado ao lead, busca dados dele
      if (defaultPropertyId) {
        pb.collection('properties')
          .getOne<RecordModel>(defaultPropertyId)
          .then((p) => {
            const opt: PropertyOption = {
              id: p.id,
              code: (p.code as string) || '',
              title: (p.title as string) || '',
              purpose: (p.purpose as string) || '',
              sale_price: (p.sale_price as number) || undefined,
              rent_price: (p.rent_price as number) || undefined,
            }
            setSelectedProperty(opt)
            if (opt.purpose === 'locacao') {
              setPurpose('locacao')
            } else {
              setPurpose('venda')
            }
          })
          .catch(() => {})
      }

      // Pré-carrega alguns imóveis disponíveis
      searchProperties('')
    }
  }, [open, defaultPropertyId])

  // Busca imóveis disponíveis
  const searchProperties = async (term: string) => {
    setSearchingProperties(true)
    try {
      const filterParts = ['(status != "inativo" && status != "vendido" && status != "alugado")']
      if (term.trim()) {
        const clean = term.trim().replace(/['"\\]/g, '')
        filterParts.push(`(code ~ "${clean}" || title ~ "${clean}")`)
      }

      const res = await pb.collection('properties').getList<RecordModel>(1, 10, {
        filter: filterParts.join(' && '),
        sort: '-created',
      })

      const list: PropertyOption[] = res.items.map((p) => ({
        id: p.id,
        code: (p.code as string) || '',
        title: (p.title as string) || '',
        purpose: (p.purpose as string) || '',
        sale_price: (p.sale_price as number) || undefined,
        rent_price: (p.rent_price as number) || undefined,
      }))
      setProperties(list)
    } catch {
      // ignore
    } finally {
      setSearchingProperties(false)
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setPropertySearch(val)
    searchProperties(val)
  }

  const handleSelectProperty = (prop: PropertyOption) => {
    setSelectedProperty(prop)
    if (prop.purpose === 'locacao' && purpose !== 'locacao') {
      setPurpose('locacao')
    } else if (prop.purpose === 'venda' && purpose !== 'venda') {
      setPurpose('venda')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProperty) {
      setErrorMessage('Selecione um imóvel disponível para a negociação.')
      return
    }

    setSaving(true)
    setErrorMessage(null)

    const agreedValue = agreedValueStr ? parseCurrencyInput(agreedValueStr) : undefined

    try {
      const res = await openNegotiation(leadId, {
        property_id: selectedProperty.id,
        purpose,
        agreed_value: agreedValue || null,
      })
      onOpenChange(false)
      onSuccess(res.id)
    } catch (err: unknown) {
      const msg = formatNegotiationErrorMessage(err)
      setErrorMessage(msg)
      // Se responder 409 ("já tem uma negociação aberta"), aciona recarregamento se solicitado
      if (
        msg.toLowerCase().includes('já tem uma negociação aberta') ||
        (typeof err === 'object' && err !== null && (err as { status?: number }).status === 409)
      ) {
        if (onConflict) {
          onConflict()
        }
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Abrir negociação</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Inicie a negociação escolhendo o imóvel disponível, a finalidade e o valor combinado.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive" className="py-2.5">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Busca de imóvel */}
          <div className="space-y-2">
            <Label className="text-xs font-normal">
              Imóvel <span className="text-destructive">*</span>
            </Label>
            {selectedProperty ? (
              <div className="p-3 rounded-lg border border-border bg-muted/30 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="text-xs truncate">
                    <span className="font-semibold text-foreground">[{selectedProperty.code}]</span>{' '}
                    <span className="text-foreground">{selectedProperty.title}</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedProperty(null)}
                  className="h-7 text-xs px-2 shrink-0"
                >
                  Trocar
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar pelo código ou título..."
                    value={propertySearch}
                    onChange={handleSearchChange}
                    className="pl-9 h-10 text-xs rounded-lg"
                  />
                  {searchingProperties && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>

                <div className="max-h-44 overflow-y-auto divide-y divide-border border border-border rounded-lg">
                  {properties.length === 0 ? (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      {searchingProperties
                        ? 'Buscando imóveis...'
                        : 'Nenhum imóvel disponível encontrado.'}
                    </div>
                  ) : (
                    properties.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => handleSelectProperty(p)}
                        className="w-full text-left p-2.5 hover:bg-muted/50 transition-colors flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="truncate">
                          <span className="font-semibold text-foreground">[{p.code}]</span>{' '}
                          <span className="text-foreground">{p.title}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground capitalize shrink-0">
                          {p.purpose === 'ambos' ? 'Venda/Locação' : p.purpose}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Finalidade */}
          <div className="space-y-1.5">
            <Label className="text-xs font-normal">
              Finalidade <span className="text-destructive">*</span>
            </Label>
            <Select
              value={purpose}
              onValueChange={(val) => setPurpose(val as NegotiationPurpose)}
              disabled={
                selectedProperty &&
                (selectedProperty.purpose === 'venda' || selectedProperty.purpose === 'locacao')
              }
            >
              <SelectTrigger className="h-10 text-xs rounded-lg border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="venda">Venda</SelectItem>
                <SelectItem value="locacao">Locação</SelectItem>
              </SelectContent>
            </Select>
            {selectedProperty && selectedProperty.purpose !== 'ambos' && (
              <p className="text-[11px] text-muted-foreground">
                Finalidade determinada pelo anúncio do imóvel ({selectedProperty.purpose}).
              </p>
            )}
          </div>

          {/* Valor combinado (opcional, em reais) */}
          <div className="space-y-1.5">
            <Label htmlFor="agreed-value-input" className="text-xs font-normal">
              Valor combinado (opcional)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                R$
              </span>
              <Input
                id="agreed-value-input"
                placeholder="0,00"
                value={agreedValueStr}
                onChange={(e) => setAgreedValueStr(maskCurrencyInput(e.target.value))}
                className="pl-9 h-10 text-xs rounded-lg tabular"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Se informado, ficará registrado como base da proposta ou contrato.
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="text-xs h-9 rounded-full px-4"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || !selectedProperty}
              className="text-xs h-9 rounded-full px-4 gap-1.5"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Abrir negociação</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
