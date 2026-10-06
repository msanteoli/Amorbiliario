import { useState } from 'react'
import {
  LeadRecord,
  LeadConsentStatus,
  searchAvailableProperties,
  updateLeadData,
  formatLeadErrorMessage,
} from '@/services/leads'
import { maskPhoneInput } from '@/lib/clientUtils'
import { PROPERTY_TYPE_LABELS } from '@/services/properties'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { AlertCircle, Loader2, Search } from 'lucide-react'

interface EditLeadModalProps {
  lead: LeadRecord
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (updated: LeadRecord) => void
}

export function EditLeadModal({ lead, open, onOpenChange, onSaved }: EditLeadModalProps) {
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [name, setName] = useState(lead.name || '')
  const [phone, setPhone] = useState(maskPhoneInput(lead.phone || ''))
  const [email, setEmail] = useState(lead.email || '')
  const [originDetail, setOriginDetail] = useState(lead.origin_detail || '')

  // Imóvel de interesse
  const initialProp = lead.expand?.property_id
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(lead.property_id || '')
  const [selectedPropertyLabel, setSelectedPropertyLabel] = useState<string>(
    initialProp ? `${initialProp.code} - ${initialProp.title}` : '',
  )
  const [propertySearch, setPropertySearch] = useState('')
  const [propertySearchResults, setPropertySearchResults] = useState<
    Array<{ id: string; code: string; title: string }>
  >([])
  const [searchingProperty, setSearchingProperty] = useState(false)

  // Perfil de busca
  const [searchNeighborhood, setSearchNeighborhood] = useState(lead.search_neighborhood || '')
  const [searchType, setSearchType] = useState<string>(lead.search_type || '')
  const [searchBedrooms, setSearchBedrooms] = useState<string>(
    lead.search_bedrooms ? String(lead.search_bedrooms) : '',
  )
  const [searchMaxPrice, setSearchMaxPrice] = useState<string>(
    lead.search_max_price ? String(lead.search_max_price) : '',
  )

  // Consentimento
  const [consentStatus, setConsentStatus] = useState<LeadConsentStatus>(
    lead.consent_status || 'unknown',
  )

  const handleSearchProperty = async (query: string) => {
    setPropertySearch(query)
    if (!query.trim()) {
      setPropertySearchResults([])
      return
    }
    setSearchingProperty(true)
    try {
      const res = await searchAvailableProperties(query)
      setPropertySearchResults(
        res.items.map((p) => ({
          id: p.id,
          code: (p.code as string) || '',
          title: (p.title as string) || '',
        })),
      )
    } catch {
      setPropertySearchResults([])
    } finally {
      setSearchingProperty(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!name.trim()) {
      setErrorMessage('Informe o nome do lead.')
      return
    }

    if (!phone.trim() && !email.trim()) {
      setErrorMessage('Informe ao menos telefone ou e-mail.')
      return
    }

    setLoading(true)

    try {
      const updated = await updateLeadData(lead.id, lead, {
        name: name.trim(),
        phone: phone.trim() || '',
        email: email.trim().toLowerCase(),
        origin_detail: originDetail.trim(),
        property_id: selectedPropertyId || null,
        search_neighborhood: searchNeighborhood.trim(),
        search_type: searchType || null,
        search_bedrooms: searchBedrooms ? Number(searchBedrooms) : 0,
        search_max_price: searchMaxPrice ? Number(searchMaxPrice) : 0,
        consent_status: consentStatus,
      })

      onSaved(updated)
      onOpenChange(false)
    } catch (err) {
      setErrorMessage(formatLeadErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar dados do lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-name">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Telefone</Label>
              <Input
                id="edit-phone"
                value={phone}
                onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">E-mail</Label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com.br"
              />
            </div>
          </div>

          {/* Origem como texto puro sem edição */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-md bg-muted/40 border">
            <div>
              <span className="text-xs text-muted-foreground block">Origem</span>
              <span className="text-sm font-semibold capitalize">{lead.origin}</span>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-origin-detail" className="text-xs">
                Detalhe da origem
              </Label>
              <Input
                id="edit-origin-detail"
                value={originDetail}
                onChange={(e) => setOriginDetail(e.target.value)}
                maxLength={80}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Imóvel de interesse */}
          <div className="space-y-2">
            <Label>Imóvel de interesse (Disponíveis)</Label>
            {selectedPropertyId ? (
              <div className="flex items-center justify-between p-2.5 rounded-md border bg-muted/40 text-xs">
                <span className="font-medium">{selectedPropertyLabel}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedPropertyId('')
                    setSelectedPropertyLabel('')
                  }}
                  className="h-7 text-xs"
                >
                  Remover
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por código ou título..."
                    value={propertySearch}
                    onChange={(e) => handleSearchProperty(e.target.value)}
                    className="pl-8 text-xs"
                  />
                  {searchingProperty && (
                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>

                {propertySearchResults.length > 0 && (
                  <div className="max-h-36 overflow-y-auto border rounded-md divide-y bg-card text-xs">
                    {propertySearchResults.map((p) => (
                      <div
                        key={p.id}
                        className="p-2 hover:bg-muted cursor-pointer flex items-center justify-between gap-2"
                        onClick={() => {
                          setSelectedPropertyId(p.id)
                          setSelectedPropertyLabel(`${p.code} - ${p.title}`)
                          setPropertySearch('')
                          setPropertySearchResults([])
                        }}
                      >
                        <span className="font-semibold text-primary">{p.code}</span>
                        <span className="truncate flex-1 text-muted-foreground">{p.title}</span>
                        <span className="text-primary font-medium">Selecionar</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Perfil de busca */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-neighborhood">Bairro de interesse</Label>
              <Input
                id="edit-neighborhood"
                value={searchNeighborhood}
                onChange={(e) => setSearchNeighborhood(e.target.value)}
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-search-type">Tipo de imóvel</Label>
              <Select
                value={searchType || 'nenhum'}
                onValueChange={(val) => setSearchType(val === 'nenhum' ? '' : val)}
              >
                <SelectTrigger id="edit-search-type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Não informado</SelectItem>
                  {Object.entries(PROPERTY_TYPE_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-bedrooms">Quartos mínimos</Label>
              <Input
                id="edit-bedrooms"
                type="number"
                min="0"
                value={searchBedrooms}
                onChange={(e) => setSearchBedrooms(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-max-price">Valor máximo (R$)</Label>
              <Input
                id="edit-max-price"
                type="number"
                min="0"
                value={searchMaxPrice}
                onChange={(e) => setSearchMaxPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-consent">Consentimento de comunicação</Label>
            <Select
              value={consentStatus}
              onValueChange={(val) => setConsentStatus(val as LeadConsentStatus)}
            >
              <SelectTrigger id="edit-consent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">Sem informação</SelectItem>
                <SelectItem value="opt_in">Autorizou</SelectItem>
                <SelectItem value="opt_out">Não autorizou</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Salvar alterações</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
