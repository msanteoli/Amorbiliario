import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  PropertyPurpose,
  PropertyType,
  PropertyStatus,
  PROPERTY_TYPE_LABELS,
  PROPERTY_PURPOSE_LABELS,
  PROPERTY_STATUS_LABELS,
  searchOwners,
  PropertyOwnerRecord,
} from '@/services/properties'
import { ResponsibleUser } from '@/services/clients'
import { formatPhoneNumber } from '@/lib/clientUtils'
import { maskCurrencyInput, parseCurrencyInput, formatCurrencyInput } from '@/lib/currencyUtils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ExternalLink, Loader2, Search, User, X } from 'lucide-react'
export interface PropertyFormData {
  // Identificação
  code: string
  title: string
  purpose: PropertyPurpose
  property_type: PropertyType
  status?: PropertyStatus

  // Endereço
  street: string
  street_number: string
  complement: string
  neighborhood: string
  city: string

  // Características
  bedrooms: string
  bathrooms: string
  parking: string
  area: string

  // Valores
  sale_price: string
  rent_price: string
  condo_fee: string
  iptu: string
  price_on_request: boolean

  // Descrição
  description: string

  // Proprietário e Captador
  owner_id: string
  captured_by: string
}

interface PropertyFormProps {
  isEditing?: boolean
  initialData?: Partial<PropertyFormData>
  initialOwner?: PropertyOwnerRecord | null
  eligibleUsers: ResponsibleUser[]
  currentUser: {
    id: string
    name?: string
    email?: string
    role?: string
  }
  onSubmit: (formData: PropertyFormData) => Promise<void>
  saving: boolean
  onCancel: () => void
}

export function PropertyForm({
  isEditing = false,
  initialData,
  initialOwner = null,
  eligibleUsers,
  currentUser,
  onSubmit,
  saving,
  onCancel,
}: PropertyFormProps) {
  const isAdmin = currentUser.role === 'admin'
  const isCorretor = currentUser.role === 'corretor'

  // Identificação
  const [code, setCode] = useState(initialData?.code || '')
  const [title, setTitle] = useState(initialData?.title || '')
  const [purpose, setPurpose] = useState<PropertyPurpose>(initialData?.purpose || 'venda')
  const [propertyType, setPropertyType] = useState<PropertyType>(
    initialData?.property_type || 'apartamento',
  )
  const [status, setStatus] = useState<PropertyStatus>(initialData?.status || 'rascunho')

  // Endereço
  const [street, setStreet] = useState(initialData?.street || '')
  const [streetNumber, setStreetNumber] = useState(initialData?.street_number || '')
  const [complement, setComplement] = useState(initialData?.complement || '')
  const [neighborhood, setNeighborhood] = useState(initialData?.neighborhood || '')
  const [city, setCity] = useState(initialData?.city || '')

  // Características
  const [bedrooms, setBedrooms] = useState(initialData?.bedrooms || '')
  const [bathrooms, setBathrooms] = useState(initialData?.bathrooms || '')
  const [parking, setParking] = useState(initialData?.parking || '')
  const [area, setArea] = useState(initialData?.area || '')

  // Valores
  const [salePrice, setSalePrice] = useState(initialData?.sale_price || '')
  const [rentPrice, setRentPrice] = useState(initialData?.rent_price || '')
  const [condoFee, setCondoFee] = useState(initialData?.condo_fee || '')
  const [iptu, setIptu] = useState(initialData?.iptu || '')
  const [priceOnRequest, setPriceOnRequest] = useState(Boolean(initialData?.price_on_request))

  // Descrição
  const [description, setDescription] = useState(initialData?.description || '')

  // Captador
  const defaultCapturedBy = isEditing
    ? initialData?.captured_by || currentUser.id
    : isCorretor
      ? currentUser.id
      : initialData?.captured_by || currentUser.id
  const [capturedBy, setCapturedBy] = useState(defaultCapturedBy)

  // Proprietário
  const [selectedOwner, setSelectedOwner] = useState<PropertyOwnerRecord | null>(initialOwner)
  const [ownerSearchTerm, setOwnerSearchTerm] = useState('')
  const [ownerSearchResults, setOwnerSearchResults] = useState<PropertyOwnerRecord[]>([])
  const [isSearchingOwners, setIsSearchingOwners] = useState(false)
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Erros locais de validação de valor zero
  const [zeroValueError, setZeroValueError] = useState<string | null>(null)

  // Busca de proprietários
  useEffect(() => {
    if (!ownerSearchTerm.trim()) {
      setOwnerSearchResults([])
      return
    }

    let active = true
    setIsSearchingOwners(true)

    const timer = setTimeout(() => {
      searchOwners(ownerSearchTerm)
        .then((results) => {
          if (active) {
            setOwnerSearchResults(results)
          }
        })
        .catch(() => {
          if (active) setOwnerSearchResults([])
        })
        .finally(() => {
          if (active) setIsSearchingOwners(false)
        })
    }, 250)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [ownerSearchTerm])

  // Fecha dropdown de busca ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowOwnerDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Manipulação de inputs de valor com máscara e bloqueio de zero
  const handleCurrencyChange = (
    rawValue: string,
    setter: (val: string) => void,
    fieldName: string,
  ) => {
    setZeroValueError(null)
    const trimmed = rawValue.trim()
    if (!trimmed) {
      setter('')
      return
    }
    const digits = trimmed.replace(/\D/g, '')
    if (digits === '0' || parseInt(digits, 10) === 0) {
      setZeroValueError(`Deixe em branco quando não informado. (${fieldName})`)
      setter('')
      return
    }
    setter(maskCurrencyInput(rawValue))
  }

  // Preenche dados ao alterar initialData (quando carregado de forma assíncrona)
  useEffect(() => {
    if (initialData) {
      if (initialData.code !== undefined) setCode(initialData.code)
      if (initialData.title !== undefined) setTitle(initialData.title)
      if (initialData.purpose !== undefined) setPurpose(initialData.purpose)
      if (initialData.property_type !== undefined) setPropertyType(initialData.property_type)
      if (initialData.status !== undefined) setStatus(initialData.status)

      if (initialData.street !== undefined) setStreet(initialData.street)
      if (initialData.street_number !== undefined) setStreetNumber(initialData.street_number)
      if (initialData.complement !== undefined) setComplement(initialData.complement)
      if (initialData.neighborhood !== undefined) setNeighborhood(initialData.neighborhood)
      if (initialData.city !== undefined) setCity(initialData.city)

      if (initialData.bedrooms !== undefined) setBedrooms(initialData.bedrooms)
      if (initialData.bathrooms !== undefined) setBathrooms(initialData.bathrooms)
      if (initialData.parking !== undefined) setParking(initialData.parking)
      if (initialData.area !== undefined) setArea(initialData.area)

      if (initialData.sale_price !== undefined) setSalePrice(initialData.sale_price)
      if (initialData.rent_price !== undefined) setRentPrice(initialData.rent_price)
      if (initialData.condo_fee !== undefined) setCondoFee(initialData.condo_fee)
      if (initialData.iptu !== undefined) setIptu(initialData.iptu)
      if (initialData.price_on_request !== undefined) {
        setPriceOnRequest(Boolean(initialData.price_on_request))
      }

      if (initialData.description !== undefined) setDescription(initialData.description)
      if (initialData.captured_by !== undefined) setCapturedBy(initialData.captured_by)
    }
  }, [initialData])

  useEffect(() => {
    if (initialOwner) {
      setSelectedOwner(initialOwner)
    }
  }, [initialOwner])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setZeroValueError(null)

    // Validação de zeros explícitos em campos monetários
    const checkZero = (val: string, label: string) => {
      const parsed = parseCurrencyInput(val)
      if (parsed !== undefined && parsed === 0) {
        setZeroValueError(`Deixe em branco quando não informado. (${label})`)
        return true
      }
      return false
    }

    if (purpose === 'venda' || purpose === 'ambos') {
      if (checkZero(salePrice, 'Preço de venda')) return
    }
    if (purpose === 'locacao' || purpose === 'ambos') {
      if (checkZero(rentPrice, 'Preço de locação')) return
    }
    if (checkZero(condoFee, 'Condomínio')) return
    if (checkZero(iptu, 'IPTU')) return

    await onSubmit({
      code: code.trim(),
      title: title.trim(),
      purpose,
      property_type: propertyType,
      status: isEditing ? status : undefined,
      street: street.trim(),
      street_number: streetNumber.trim(),
      complement: complement.trim(),
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      bedrooms: bedrooms.trim(),
      bathrooms: bathrooms.trim(),
      parking: parking.trim(),
      area: area.trim(),
      sale_price: salePrice.trim(),
      rent_price: rentPrice.trim(),
      condo_fee: condoFee.trim(),
      iptu: iptu.trim(),
      price_on_request: priceOnRequest,
      description: description.trim(),
      owner_id: selectedOwner?.id || '',
      captured_by: isCorretor ? currentUser.id : capturedBy,
    })
  }

  // Define se campos de preço devem ser exibidos
  const showSalePrice = purpose === 'venda' || purpose === 'ambos'
  const showRentPrice = purpose === 'locacao' || purpose === 'ambos'

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Aviso de validação de valor zero */}
      {zeroValueError && (
        <p className="text-xs text-destructive font-normal" role="alert">
          {zeroValueError}
        </p>
      )}

      {/* 1. SEÇÃO: IDENTIFICAÇÃO */}
      <section className="space-y-4">
        <div>
          <h2 className="text-[20px] font-normal text-foreground">Identificação</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Código do imóvel, título descritivo, finalidade e tipo de construção.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Código do imóvel */}
          <div className="space-y-1.5">
            <label htmlFor="prop-code" className="text-[13px] font-normal text-foreground block">
              Código do imóvel <span className="text-destructive">*</span>
            </label>
            <Input
              id="prop-code"
              placeholder="Ex.: AP-001, CA-12"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={40}
              required
              className="h-12 text-sm border-border"
            />
            <p className="text-xs text-muted-foreground">
              Código de referência único dentro da sua imobiliária.
            </p>
          </div>

          {/* Finalidade */}
          <div className="space-y-1.5">
            <label htmlFor="prop-purpose" className="text-[13px] font-normal text-foreground block">
              Finalidade <span className="text-destructive">*</span>
            </label>
            <Select value={purpose} onValueChange={(val) => setPurpose(val as PropertyPurpose)}>
              <SelectTrigger id="prop-purpose" className="h-12 text-sm border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROPERTY_PURPOSE_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Tipo de Imóvel */}
          <div className="space-y-1.5">
            <label htmlFor="prop-type" className="text-[13px] font-normal text-foreground block">
              Tipo de imóvel <span className="text-destructive">*</span>
            </label>
            <Select
              value={propertyType}
              onValueChange={(val) => setPropertyType(val as PropertyType)}
            >
              <SelectTrigger id="prop-type" className="h-12 text-sm border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROPERTY_TYPE_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Situação (somente na EDIÇÃO) */}
          {isEditing && (
            <div className="space-y-1.5">
              <label
                htmlFor="prop-status"
                className="text-[13px] font-normal text-foreground block"
              >
                Situação do imóvel <span className="text-destructive">*</span>
              </label>
              <Select value={status} onValueChange={(val) => setStatus(val as PropertyStatus)}>
                <SelectTrigger id="prop-status" className="h-12 text-sm border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROPERTY_STATUS_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Para ficar Disponível, o imóvel deve ter endereço, valores, características,
                proprietário e 5 fotos.
              </p>
            </div>
          )}
        </div>

        {/* Título */}
        <div className="space-y-1.5">
          <label htmlFor="prop-title" className="text-[13px] font-normal text-foreground block">
            Título do anúncio <span className="text-destructive">*</span>
          </label>
          <Input
            id="prop-title"
            placeholder="Ex.: Apartamento com 3 quartos e vista mar no bairro Santa Mônica"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            required
            className="h-12 text-sm border-border"
          />
          <p className="text-xs text-muted-foreground">
            Título chamativo para o catálogo (máximo 160 caracteres).
          </p>
        </div>
      </section>

      <hr className="border-t border-border" />

      {/* 2. SEÇÃO: ENDEREÇO */}
      <section className="space-y-4">
        <div>
          <h2 className="text-[20px] font-normal text-foreground">Endereço</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Localização física do imóvel. O número aceita &quot;S/N&quot; se não houver numeração.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <label htmlFor="prop-street" className="text-[13px] font-normal text-foreground block">
              Logradouro / Rua
            </label>
            <Input
              id="prop-street"
              placeholder="Ex.: Rua das Flores"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              maxLength={120}
              className="h-12 text-sm border-border"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="prop-street-number"
              className="text-[13px] font-normal text-foreground block"
            >
              Número (&quot;S/N&quot; válido)
            </label>
            <Input
              id="prop-street-number"
              placeholder="Ex.: 123 ou S/N"
              value={streetNumber}
              onChange={(e) => setStreetNumber(e.target.value)}
              maxLength={20}
              className="h-12 text-sm border-border"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="prop-complement"
              className="text-[13px] font-normal text-foreground block"
            >
              Complemento
            </label>
            <Input
              id="prop-complement"
              placeholder="Ex.: Bloco B, Apt 302"
              value={complement}
              onChange={(e) => setComplement(e.target.value)}
              maxLength={80}
              className="h-12 text-sm border-border"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="prop-neighborhood"
              className="text-[13px] font-normal text-foreground block"
            >
              Bairro
            </label>
            <Input
              id="prop-neighborhood"
              placeholder="Ex.: Santa Mônica"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              maxLength={80}
              className="h-12 text-sm border-border"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="prop-city" className="text-[13px] font-normal text-foreground block">
              Cidade
            </label>
            <Input
              id="prop-city"
              placeholder="Ex.: Feira de Santana"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={80}
              className="h-12 text-sm border-border"
            />
          </div>
        </div>
      </section>

      <hr className="border-t border-border" />

      {/* 3. SEÇÃO: CARACTERÍSTICAS */}
      <section className="space-y-4">
        <div>
          <h2 className="text-[20px] font-normal text-foreground">Características</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cômodos, vagas de garagem e área útil ou total do imóvel.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="prop-bedrooms"
              className="text-[13px] font-normal text-foreground block"
            >
              Quartos
            </label>
            <Input
              id="prop-bedrooms"
              type="number"
              min="0"
              max="99"
              placeholder="0"
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
              className="h-12 text-sm border-border tabular"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="prop-bathrooms"
              className="text-[13px] font-normal text-foreground block"
            >
              Banheiros
            </label>
            <Input
              id="prop-bathrooms"
              type="number"
              min="0"
              max="99"
              placeholder="0"
              value={bathrooms}
              onChange={(e) => setBathrooms(e.target.value)}
              className="h-12 text-sm border-border tabular"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="prop-parking" className="text-[13px] font-normal text-foreground block">
              Vagas de garagem
            </label>
            <Input
              id="prop-parking"
              type="number"
              min="0"
              max="99"
              placeholder="0"
              value={parking}
              onChange={(e) => setParking(e.target.value)}
              className="h-12 text-sm border-border tabular"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="prop-area" className="text-[13px] font-normal text-foreground block">
              Área (m²)
            </label>
            <Input
              id="prop-area"
              type="number"
              min="0"
              step="0.01"
              placeholder="Ex.: 85.5"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="h-12 text-sm border-border tabular"
            />
          </div>
        </div>
      </section>

      <hr className="border-t border-border" />

      {/* 4. SEÇÃO: VALORES */}
      <section className="space-y-4">
        <div>
          <h2 className="text-[20px] font-normal text-foreground">Valores</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Deixe em branco quando não informado. Não digite zero.
          </p>
        </div>

        <div className="flex items-center space-x-2 py-1">
          <Checkbox
            id="prop-price-request"
            checked={priceOnRequest}
            onCheckedChange={(c) => setPriceOnRequest(Boolean(c))}
          />
          <label
            htmlFor="prop-price-request"
            className="text-xs font-normal text-foreground cursor-pointer"
          >
            Sob consulta (oculta valores numéricos no catálogo público)
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Preço de Venda (se aplicável à finalidade) */}
          {showSalePrice && (
            <div className="space-y-1.5">
              <label
                htmlFor="prop-sale-price"
                className="text-[13px] font-normal text-foreground block"
              >
                Preço de venda (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-normal text-muted-foreground eyebrow">
                  R$
                </span>
                <Input
                  id="prop-sale-price"
                  placeholder="0,00"
                  value={salePrice}
                  onChange={(e) =>
                    handleCurrencyChange(e.target.value, setSalePrice, 'Preço de venda')
                  }
                  className="pl-9 h-12 text-sm border-border tabular"
                />
              </div>
            </div>
          )}

          {/* Preço de Locação (se aplicável à finalidade) */}
          {showRentPrice && (
            <div className="space-y-1.5">
              <label
                htmlFor="prop-rent-price"
                className="text-[13px] font-normal text-foreground block"
              >
                Preço de locação (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-normal text-muted-foreground eyebrow">
                  R$
                </span>
                <Input
                  id="prop-rent-price"
                  placeholder="0,00"
                  value={rentPrice}
                  onChange={(e) =>
                    handleCurrencyChange(e.target.value, setRentPrice, 'Preço de locação')
                  }
                  className="pl-9 h-12 text-sm border-border tabular"
                />
              </div>
            </div>
          )}

          {/* Condomínio */}
          <div className="space-y-1.5">
            <label
              htmlFor="prop-condo-fee"
              className="text-[13px] font-normal text-foreground block"
            >
              Condomínio (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-normal text-muted-foreground eyebrow">
                R$
              </span>
              <Input
                id="prop-condo-fee"
                placeholder="0,00"
                value={condoFee}
                onChange={(e) => handleCurrencyChange(e.target.value, setCondoFee, 'Condomínio')}
                className="pl-9 h-12 text-sm border-border tabular"
              />
            </div>
          </div>

          {/* IPTU */}
          <div className="space-y-1.5">
            <label htmlFor="prop-iptu" className="text-[13px] font-normal text-foreground block">
              IPTU anual (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-normal text-muted-foreground eyebrow">
                R$
              </span>
              <Input
                id="prop-iptu"
                placeholder="0,00"
                value={iptu}
                onChange={(e) => handleCurrencyChange(e.target.value, setIptu, 'IPTU')}
                className="pl-9 h-12 text-sm border-border tabular"
              />
            </div>
          </div>
        </div>
      </section>

      <hr className="border-t border-border" />

      {/* 5. SEÇÃO: DESCRIÇÃO */}
      <section className="space-y-4">
        <div>
          <h2 className="text-[20px] font-normal text-foreground">Descrição</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Texto completo de apresentação do imóvel (até 3000 caracteres).
          </p>
        </div>

        <div className="space-y-1.5">
          <Textarea
            placeholder="Descreva detalhes como acabamento, posição solar, comodidades do condomínio, mobília inclusa..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            maxLength={3000}
            className="resize-y border-border text-sm"
          />
          <div className="flex justify-end">
            <span className="text-xs text-muted-foreground tabular">
              {description.length} / 3000 caracteres
            </span>
          </div>
        </div>
      </section>

      <hr className="border-t border-border" />

      {/* 6. SEÇÃO: PROPRIETÁRIO E CAPTADOR */}
      <section className="space-y-6">
        <div>
          <h2 className="text-[20px] font-normal text-foreground">Proprietário e Captador</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Vincule o cliente proprietário do imóvel e o corretor responsável pela captação.
          </p>
        </div>

        {/* Proprietário */}
        <div className="space-y-1.5" ref={searchContainerRef}>
          <label className="text-[13px] font-normal text-foreground block">
            Proprietário do imóvel
          </label>

          {selectedOwner ? (
            <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-normal text-foreground">{selectedOwner.name}</p>
                  <p className="text-xs text-muted-foreground tabular">
                    Telefone: {formatPhoneNumber(selectedOwner.phone)}
                    {selectedOwner.email && ` · ${selectedOwner.email}`}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedOwner(null)
                  setOwnerSearchTerm('')
                }}
                className="h-9 sm:h-8 min-h-[44px] sm:min-h-[32px] rounded-full px-3.5 sm:px-3 text-xs font-normal border-border gap-1"
              >
                <X className="h-3.5 w-3.5" />
                <span>Trocar</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5 relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar proprietário por nome ou telefone..."
                  value={ownerSearchTerm}
                  onChange={(e) => {
                    setOwnerSearchTerm(e.target.value)
                    setShowOwnerDropdown(true)
                  }}
                  onFocus={() => setShowOwnerDropdown(true)}
                  className="pl-9 h-12 text-sm border-border"
                />
                {isSearchingOwners && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Dropdown de resultados */}
              {showOwnerDropdown && ownerSearchTerm.trim().length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-popover p-1">
                  {ownerSearchResults.length > 0 ? (
                    ownerSearchResults.map((owner) => (
                      <div
                        key={owner.id}
                        className="flex items-center justify-between p-2.5 rounded hover:bg-muted cursor-pointer text-xs"
                        onClick={() => {
                          setSelectedOwner(owner)
                          setShowOwnerDropdown(false)
                          setOwnerSearchTerm('')
                        }}
                      >
                        <div>
                          <p className="text-foreground">{owner.name}</p>
                          <p className="text-xs text-muted-foreground tabular">
                            {formatPhoneNumber(owner.phone)}
                            {owner.email && ` · ${owner.email}`}
                          </p>
                        </div>
                        <span className="text-xs text-primary">Selecionar</span>
                      </div>
                    ))
                  ) : !isSearchingOwners ? (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      Nenhum cliente do tipo proprietário encontrado.
                    </div>
                  ) : null}
                </div>
              )}

              {/* Mensagem e link para cadastrar proprietário */}
              <p className="text-xs text-muted-foreground pt-1">
                Cadastre o proprietário em Clientes e volte aqui.{' '}
                <Link
                  to="/clientes/novo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  <span>Abrir cadastro de clientes</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* Captador */}
        <div className="space-y-1.5 pt-2">
          <label
            htmlFor="prop-captured-by"
            className="text-[13px] font-normal text-foreground block"
          >
            Captador do imóvel <span className="text-destructive">*</span>
          </label>
          {isCorretor ? (
            <div className="p-3 rounded-lg border border-border bg-card text-xs text-foreground flex items-center justify-between">
              <div>
                <p>{currentUser.name || currentUser.email}</p>
                <p className="text-xs text-muted-foreground">Você é o corretor captador</p>
              </div>
              <span className="eyebrow text-muted-foreground">Fixo</span>
            </div>
          ) : isAdmin ? (
            <Select value={capturedBy} onValueChange={(val) => setCapturedBy(val)}>
              <SelectTrigger id="prop-captured-by" className="h-12 text-sm border-border">
                <SelectValue placeholder="Selecione o captador" />
              </SelectTrigger>
              <SelectContent>
                {eligibleUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={currentUser.name || currentUser.email}
              disabled
              className="h-12 text-sm border-border"
            />
          )}
        </div>
      </section>

      {/* Botões de Ação - Desktop */}
      <div className="hidden md:flex items-center justify-end gap-3 pt-6 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
          className="h-10 rounded-full px-5 text-xs font-normal border-border"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={saving}
          className="h-10 rounded-full px-6 text-xs font-normal bg-primary text-primary-foreground gap-2"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          <span>Salvar</span>
        </Button>
      </div>

      {/* Barra de ações fixa no rodapé para celular (acima da navegação móvel) */}
      <div className="md:hidden fixed bottom-14 left-0 right-0 p-3 bg-background/95 backdrop-blur border-t border-border z-30 flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 h-11 rounded-full text-xs font-normal border-border"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={saving}
          className="flex-1 h-11 rounded-full text-xs font-normal bg-primary text-primary-foreground gap-2"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          <span>Salvar</span>
        </Button>
      </div>
    </form>
  )
}
