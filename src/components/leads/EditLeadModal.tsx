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
      <DialogContent className="sm:max-w-2xl w-full max-sm:h-[90vh] max-sm:max-h-[90vh] max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:fixed max-sm:bottom-0 max-sm:top-auto max-sm:translate-y-0 rounded-lg border border-border bg-card p-6 shadow-none overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-normal text-foreground">
            Editar dados do lead
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20">
              {errorMessage}
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="edit-name" className="text-[13px] font-normal text-foreground block">
              Nome <span className="text-destructive">*</span>
            </label>
            <input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="edit-phone" className="text-[13px] font-normal text-foreground block">
                Telefone
              </label>
              <input
                id="edit-phone"
                value={phone}
                onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
                placeholder="(00) 00000-0000"
                className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring tabular"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="edit-email" className="text-[13px] font-normal text-foreground block">
                E-mail
              </label>
              <input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com.br"
                className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Origem como texto puro sem edição */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg bg-muted/20 border border-border">
            <div>
              <span className="eyebrow text-muted-foreground block">Origem</span>
              <span className="text-sm font-normal text-foreground capitalize">{lead.origin}</span>
            </div>
            <div className="space-y-1">
              <label
                htmlFor="edit-origin-detail"
                className="text-[13px] font-normal text-foreground block"
              >
                Detalhe da origem
              </label>
              <input
                id="edit-origin-detail"
                value={originDetail}
                onChange={(e) => setOriginDetail(e.target.value)}
                maxLength={80}
                className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Imóvel de interesse */}
          <div className="space-y-1">
            <label className="text-[13px] font-normal text-foreground block">
              Imóvel de interesse (Disponíveis)
            </label>
            {selectedPropertyId ? (
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20 text-xs">
                <span className="font-normal text-foreground">{selectedPropertyLabel}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPropertyId('')
                    setSelectedPropertyLabel('')
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Remover
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    placeholder="Buscar por código ou título..."
                    value={propertySearch}
                    onChange={(e) => handleSearchProperty(e.target.value)}
                    className="w-full h-12 pl-11 pr-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  {searchingProperty && (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>

                {propertySearchResults.length > 0 && (
                  <div className="max-h-36 overflow-y-auto border border-border rounded-lg divide-y divide-border bg-card text-xs">
                    {propertySearchResults.map((p) => (
                      <div
                        key={p.id}
                        className="p-2.5 hover:bg-muted/40 cursor-pointer flex items-center justify-between gap-2"
                        onClick={() => {
                          setSelectedPropertyId(p.id)
                          setSelectedPropertyLabel(`${p.code} - ${p.title}`)
                          setPropertySearch('')
                          setPropertySearchResults([])
                        }}
                      >
                        <span className="eyebrow text-foreground">{p.code}</span>
                        <span className="truncate flex-1 text-muted-foreground">{p.title}</span>
                        <span className="text-xs text-primary underline">Selecionar</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Perfil de busca */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="edit-neighborhood"
                className="text-[13px] font-normal text-foreground block"
              >
                Bairro de interesse
              </label>
              <input
                id="edit-neighborhood"
                value={searchNeighborhood}
                onChange={(e) => setSearchNeighborhood(e.target.value)}
                maxLength={80}
                className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="edit-search-type"
                className="text-[13px] font-normal text-foreground block"
              >
                Tipo de imóvel
              </label>
              <Select
                value={searchType || 'nenhum'}
                onValueChange={(val) => setSearchType(val === 'nenhum' ? '' : val)}
              >
                <SelectTrigger
                  id="edit-search-type"
                  className="h-12 rounded-lg border-border bg-background"
                >
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
            <div className="space-y-1">
              <label
                htmlFor="edit-bedrooms"
                className="text-[13px] font-normal text-foreground block"
              >
                Quartos mínimos
              </label>
              <input
                id="edit-bedrooms"
                type="number"
                min="0"
                value={searchBedrooms}
                onChange={(e) => setSearchBedrooms(e.target.value)}
                className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring tabular"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="edit-max-price"
                className="text-[13px] font-normal text-foreground block"
              >
                Valor máximo (R$)
              </label>
              <input
                id="edit-max-price"
                type="number"
                min="0"
                value={searchMaxPrice}
                onChange={(e) => setSearchMaxPrice(e.target.value)}
                className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring tabular"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="edit-consent" className="text-[13px] font-normal text-foreground block">
              Consentimento de comunicação
            </label>
            <Select
              value={consentStatus}
              onValueChange={(val) => setConsentStatus(val as LeadConsentStatus)}
            >
              <SelectTrigger
                id="edit-consent"
                className="h-12 rounded-lg border-border bg-background"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">Sem informação</SelectItem>
                <SelectItem value="opt_in">Autorizou</SelectItem>
                <SelectItem value="opt_out">Não autorizou</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
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
              <span>Salvar alterações</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
