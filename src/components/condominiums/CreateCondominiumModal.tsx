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
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Building2 } from 'lucide-react'
import {
  createCondominium,
  CondominiumRecord,
  CreateCondominiumInput,
} from '@/services/condominiums'
import { formatErrorMessage } from '@/services/properties'

interface CreateCondominiumModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUser: { organization_id?: string }
  onCreated: (condo: CondominiumRecord) => void
}

export function CreateCondominiumModal({
  open,
  onOpenChange,
  currentUser,
  onCreated,
}: CreateCondominiumModalProps) {
  const [name, setName] = useState('')
  const [street, setStreet] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [amenities, setAmenities] = useState('')
  const [infrastructure, setInfrastructure] = useState('')
  const [rules, setRules] = useState('')
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)

  const resetForm = () => {
    setName('')
    setStreet('')
    setNeighborhood('')
    setCity('')
    setAmenities('')
    setInfrastructure('')
    setRules('')
    setNameError(null)
    setGeneralError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setNameError(null)
    setGeneralError(null)

    const trimmedName = name.trim()
    if (trimmedName.length < 2) {
      setNameError('Informe o nome do condomínio.')
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
        infrastructure: infrastructure.trim(),
        rules: rules.trim(),
      }

      const created = await createCondominium(input, currentUser)
      onCreated(created)
      resetForm()
      onOpenChange(false)
    } catch (err) {
      const msg = formatErrorMessage(err)
      if (
        msg.toLowerCase().includes('já existe um condomínio com este nome') ||
        msg.toLowerCase().includes('ja existe um condominio com este nome') ||
        msg.toLowerCase().includes('já existe um condomínio')
      ) {
        setNameError('Já existe um condomínio com este nome.')
      } else {
        setGeneralError(msg)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-lg p-5">
        <DialogHeader>
          <DialogTitle className="text-lg font-normal text-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span>Novo condomínio</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Cadastre os dados cadastrais, regras e comodidades do condomínio.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {generalError && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 font-normal">
              {generalError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="create-condo-name" className="text-xs eyebrow text-muted-foreground">
              Nome do condomínio <span className="text-destructive">*</span>
            </Label>
            <Input
              id="create-condo-name"
              placeholder="Ex.: Residencial Bella Vista"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (nameError) setNameError(null)
              }}
              required
              maxLength={120}
              className={`h-11 text-sm border-border ${
                nameError ? 'border-destructive focus-visible:ring-destructive' : ''
              }`}
            />
            {nameError && <p className="text-xs text-destructive font-normal mt-1">{nameError}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5 sm:col-span-1">
              <Label
                htmlFor="create-condo-street"
                className="text-xs eyebrow text-muted-foreground"
              >
                Endereço
              </Label>
              <Input
                id="create-condo-street"
                placeholder="Rua, Av., etc."
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                maxLength={160}
                className="h-11 text-sm border-border"
              />
              <p className="text-[11px] text-muted-foreground font-normal">
                Pode ficar em branco em lançamentos sem endereço divulgado.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="create-condo-neighborhood"
                className="text-xs eyebrow text-muted-foreground"
              >
                Bairro
              </Label>
              <Input
                id="create-condo-neighborhood"
                placeholder="Bairro"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                maxLength={80}
                className="h-11 text-sm border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-condo-city" className="text-xs eyebrow text-muted-foreground">
                Cidade
              </Label>
              <Input
                id="create-condo-city"
                placeholder="Cidade"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                maxLength={80}
                className="h-11 text-sm border-border"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="create-condo-amenities"
                className="text-xs eyebrow text-muted-foreground"
              >
                Itens de lazer
              </Label>
              <span className="text-[11px] text-muted-foreground">um por linha</span>
            </div>
            <Textarea
              id="create-condo-amenities"
              placeholder={'Piscina\nAcademia\nSalão de festas\nChurrasqueira'}
              value={amenities}
              onChange={(e) => setAmenities(e.target.value)}
              rows={3}
              maxLength={2000}
              className="text-sm border-border resize-y font-normal"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="create-condo-infrastructure"
                className="text-xs eyebrow text-muted-foreground"
              >
                Itens de infraestrutura
              </Label>
              <span className="text-[11px] text-muted-foreground">um por linha</span>
            </div>
            <Textarea
              id="create-condo-infrastructure"
              placeholder={'Portaria 24h\nGerador\nElevador'}
              value={infrastructure}
              onChange={(e) => setInfrastructure(e.target.value)}
              rows={4}
              maxLength={2000}
              className="text-sm border-border resize-y font-normal"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-condo-rules" className="text-xs eyebrow text-muted-foreground">
              Regras e observações
            </Label>
            <Textarea
              id="create-condo-rules"
              placeholder="Ex.: Pets até 10kg permitidos, portaria 24 horas, silêncio após às 22h..."
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              rows={3}
              maxLength={2000}
              className="text-sm border-border resize-y font-normal"
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
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Cadastrar condomínio</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
