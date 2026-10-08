import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Plus } from 'lucide-react'
import {
  createCondominium,
  CondominiumRecord,
  CreateCondominiumInput,
} from '@/services/condominiums'
import { formatErrorMessage } from '@/services/properties'

interface QuickCondominiumModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUser: { organization_id?: string }
  onCreated: (condo: CondominiumRecord) => void
}

export function QuickCondominiumModal({
  open,
  onOpenChange,
  currentUser,
  onCreated,
}: QuickCondominiumModalProps) {
  const [name, setName] = useState('')
  const [street, setStreet] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [amenities, setAmenities] = useState('')
  const [rules, setRules] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const trimmedName = name.trim()
    if (trimmedName.length < 2) {
      setErrorMessage('Informe o nome do condomínio.')
      return
    }

    setSaving(true)
    try {
      const input: CreateCondominiumInput = {
        name: trimmedName,
        street: street.trim(),
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        amenities: amenities.trim(),
        rules: rules.trim(),
      }
      const created = await createCondominium(input, currentUser)
      onCreated(created)
      onOpenChange(false)
      // Limpa os campos
      setName('')
      setStreet('')
      setNeighborhood('')
      setCity('')
      setAmenities('')
      setRules('')
    } catch (err) {
      setErrorMessage(formatErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-5">
        <DialogHeader>
          <DialogTitle className="text-lg font-normal text-foreground flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span>Novo condomínio</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Cadastro rápido de condomínio sem sair do formulário do imóvel.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 font-normal">
              {errorMessage}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="condo-name" className="text-[13px] font-normal text-foreground block">
              Nome do condomínio <span className="text-destructive">*</span>
            </label>
            <Input
              id="condo-name"
              placeholder="Ex.: Residencial Bella Vista"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              className="h-11 text-sm border-border"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5 sm:col-span-1">
              <label
                htmlFor="condo-street"
                className="text-[13px] font-normal text-foreground block"
              >
                Rua / Logradouro
              </label>
              <Input
                id="condo-street"
                placeholder="Ex.: Av. Centenário"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                maxLength={160}
                className="h-11 text-sm border-border"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="condo-neigh"
                className="text-[13px] font-normal text-foreground block"
              >
                Bairro
              </label>
              <Input
                id="condo-neigh"
                placeholder="Ex.: Barra"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                maxLength={80}
                className="h-11 text-sm border-border"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="condo-city" className="text-[13px] font-normal text-foreground block">
                Cidade
              </label>
              <Input
                id="condo-city"
                placeholder="Ex.: Salvador"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                maxLength={80}
                className="h-11 text-sm border-border"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="condo-amenities"
              className="text-[13px] font-normal text-foreground block"
            >
              Itens de lazer e comodidades
            </label>
            <Textarea
              id="condo-amenities"
              placeholder="Ex.: Piscina adulto e infantil, academia climatizada, quadra poliesportiva, salão de festas..."
              value={amenities}
              onChange={(e) => setAmenities(e.target.value)}
              rows={2}
              maxLength={2000}
              className="text-sm border-border resize-y"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="condo-rules" className="text-[13px] font-normal text-foreground block">
              Regras e observações
            </label>
            <Textarea
              id="condo-rules"
              placeholder="Ex.: Aceita pets de pequeno porte, portaria 24h presencial..."
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              rows={2}
              maxLength={2000}
              className="text-sm border-border resize-y"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="h-9 rounded-full px-4 text-xs font-normal border-border"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="h-9 rounded-full px-5 text-xs font-normal bg-primary text-primary-foreground gap-1.5"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Salvar condomínio</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
