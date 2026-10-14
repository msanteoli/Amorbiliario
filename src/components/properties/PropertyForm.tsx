import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  PropertyPurpose,
  PropertyType,
  PropertyStatus,
  PropertyUseType,
  PROPERTY_TYPE_LABELS,
  PROPERTY_USE_TYPE_LABELS,
  PROPERTY_STATUS_LABELS,
  BRAZIL_STATES,
  getPortalPendingReasons,
  searchOwners,
  PropertyOwnerRecord,
  suggestPropertyTitles,
  listPropertyPhotos,
} from '@/services/properties'
import { listActiveCondominiums, CondominiumRecord } from '@/services/condominiums'
import { QuickCondominiumModal } from '@/components/properties/QuickCondominiumModal'
import { ResponsibleUser } from '@/services/clients'
import { formatPhoneNumber, maskCepInput } from '@/lib/clientUtils'
import { maskCurrencyInput, parseCurrencyInput } from '@/lib/currencyUtils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, User, X, Plus, Building2, UserPlus } from 'lucide-react'
import { AiBadge } from '@/components/AiBadge'
import { Badge } from '@/components/ui/badge'
import { LinkOwnerModal } from '@/components/properties/LinkOwnerModal'
import { getPropertyById } from '@/services/properties'

export interface PropertyFormData {
  // Identificação
  code: string
  title: string
  purpose: PropertyPurpose
  property_type: PropertyType
  use_type?: PropertyUseType
  in_condominium: boolean
  condominium_id?: string
  status?: PropertyStatus

  // Endereço
  street: string
  street_number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  zip_code: string

  // Onde anunciar
  publish_to: string[]

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

  // Destaque no site
  highlight_level?: 'comum' | 'destaque' | 'super_destaque'
  highlight_until?: string
}

interface PropertyFormProps {
  propertyId?: string
  isEditing?: boolean
  initialData?: Partial<PropertyFormData>
  initialOwner?: PropertyOwnerRecord | null
  eligibleUsers: ResponsibleUser[]
  currentUser: {
    id: string
    organization_id?: string
    name?: string
    email?: string
    role?: string
  }
  onSubmit: (formData: PropertyFormData) => Promise<void>
  saving: boolean
  onCancel: () => void
}

export function PropertyForm({
  propertyId,
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

  // Finalidade: duas caixas de seleção, Venda e Locação
  const initialPurpose = initialData?.purpose || 'venda'
  const [purposeVenda, setPurposeVenda] = useState(
    initialPurpose === 'venda' || initialPurpose === 'ambos',
  )
  const [purposeLocacao, setPurposeLocacao] = useState(
    initialPurpose === 'locacao' || initialPurpose === 'ambos',
  )
  const [purposeError, setPurposeError] = useState<string | null>(null)

  // Uso do imóvel (use_type)
  const [useType, setUseType] = useState<PropertyUseType>(initialData?.use_type || 'residencial')

  const [propertyType, setPropertyType] = useState<PropertyType>(
    initialData?.property_type || 'apartamento',
  )
  const [status, setStatus] = useState<PropertyStatus>(initialData?.status || 'rascunho')

  // Alternador Condomínio
  const [inCondominium, setInCondominium] = useState<boolean>(Boolean(initialData?.in_condominium))
  const [condominiumId, setCondominiumId] = useState<string>(initialData?.condominium_id || '')
  const [condoList, setCondoList] = useState<CondominiumRecord[]>([])
  const [loadingCondos, setLoadingCondos] = useState(false)
  const [quickCondoModalOpen, setQuickCondoModalOpen] = useState(false)
  const [condoSearchTerm, setCondoSearchTerm] = useState('')

  // Endereço padronizado (rua, número e S/N)
  const initialStreetNumber = initialData?.street_number || ''
  const isInitialSN = initialStreetNumber.trim().toUpperCase() === 'S/N'
  const [street, setStreet] = useState(initialData?.street || '')
  const [streetNumber, setStreetNumber] = useState(isInitialSN ? '' : initialStreetNumber)
  const [isSN, setIsSN] = useState(isInitialSN)
  const [complement, setComplement] = useState(initialData?.complement || '')
  const [neighborhood, setNeighborhood] = useState(initialData?.neighborhood || '')
  const [city, setCity] = useState(initialData?.city || '')
  const [state, setState] = useState(initialData?.state || 'BA')
  const [zipCode, setZipCode] = useState(
    initialData?.zip_code ? maskCepInput(initialData.zip_code) : '',
  )

  // Onde anunciar: "site" marcado por padrão em imóvel novo, "chaves_na_mao" desmarcado
  const initialPublishList = Array.isArray(initialData?.publish_to)
    ? initialData.publish_to
    : isEditing
      ? []
      : ['site']
  const [publishSite, setPublishSite] = useState(
    initialData?.publish_to !== undefined ? initialPublishList.includes('site') : true, // padrão novo: true
  )
  const [publishChavesNaMao, setPublishChavesNaMao] = useState(
    initialData?.publish_to !== undefined ? initialPublishList.includes('chaves_na_mao') : false, // padrão novo: false
  )
  // Guarda valores não exibidos na tela (zap, vivareal, olx) para preservar ao salvar
  const [hiddenPublishTargets, setHiddenPublishTargets] = useState<string[]>(
    initialPublishList.filter((p) => p !== 'site' && p !== 'chaves_na_mao'),
  )

  // Fotos para cálculo do indicador no formulário (quando em edição)
  const [formPhotos, setFormPhotos] = useState<Array<{ file: string; is_active?: boolean }>>([])

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

  // Permissão de editar Onde anunciar: admin e corretor captador
  // SDR: somente leitura (desabilitado)
  const canEditPublishTo = (() => {
    if (isAdmin) return true
    if (isCorretor) {
      if (!isEditing) return true
      const captadorId = initialData?.captured_by || capturedBy
      return captadorId === currentUser.id
    }
    return false
  })()

  // Proprietário
  const [selectedOwner, setSelectedOwner] = useState<PropertyOwnerRecord | null>(initialOwner)
  const [linkOwnerModalOpen, setLinkOwnerModalOpen] = useState(false)

  // Destaque no site
  const initialHl = initialData?.highlight_level || 'comum'
  const [isHighlighted, setIsHighlighted] = useState(initialHl !== 'comum')
  const [highlightLevel, setHighlightLevel] = useState<'destaque' | 'super_destaque'>(
    initialHl === 'super_destaque' ? 'super_destaque' : 'destaque',
  )
  const [highlightUntil, setHighlightUntil] = useState(
    initialData?.highlight_until ? initialData.highlight_until.slice(0, 10) : '',
  )

  // Erros locais de validação de valor zero
  const [zeroValueError, setZeroValueError] = useState<string | null>(null)

  // Sugestões de Título por IA
  const [suggestModalOpen, setSuggestModalOpen] = useState(false)
  const [suggestingTitle, setSuggestingTitle] = useState(false)
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([])
  const [suggestError, setSuggestError] = useState<string | null>(null)

  // Carrega lista de condomínios e fotos do imóvel (se editing)
  useEffect(() => {
    let active = true
    setLoadingCondos(true)
    listActiveCondominiums()
      .then((items) => {
        if (active) setCondoList(items)
      })
      .catch(() => {
        if (active) setCondoList([])
      })
      .finally(() => {
        if (active) setLoadingCondos(false)
      })

    if (propertyId) {
      listPropertyPhotos(propertyId)
        .then((items) => {
          if (active) setFormPhotos(items)
        })
        .catch(() => {
          if (active) setFormPhotos([])
        })
    }

    return () => {
      active = false
    }
  }, [propertyId])

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

      if (initialData.purpose !== undefined) {
        setPurposeVenda(initialData.purpose === 'venda' || initialData.purpose === 'ambos')
        setPurposeLocacao(initialData.purpose === 'locacao' || initialData.purpose === 'ambos')
      }

      if (initialData.use_type !== undefined) setUseType(initialData.use_type)
      if (initialData.in_condominium !== undefined) {
        setInCondominium(Boolean(initialData.in_condominium))
      }
      if (initialData.condominium_id !== undefined) {
        setCondominiumId(initialData.condominium_id)
      }

      if (initialData.property_type !== undefined) setPropertyType(initialData.property_type)
      if (initialData.status !== undefined) setStatus(initialData.status)

      if (initialData.street !== undefined) setStreet(initialData.street)
      if (initialData.street_number !== undefined) {
        const sn = initialData.street_number.trim().toUpperCase() === 'S/N'
        setIsSN(sn)
        setStreetNumber(sn ? '' : initialData.street_number)
      }
      if (initialData.complement !== undefined) setComplement(initialData.complement)
      if (initialData.neighborhood !== undefined) setNeighborhood(initialData.neighborhood)
      if (initialData.city !== undefined) setCity(initialData.city)
      if (initialData.state !== undefined && initialData.state.trim()) {
        setState(initialData.state.trim().toUpperCase())
      }
      if (initialData.zip_code !== undefined) {
        setZipCode(maskCepInput(initialData.zip_code))
      }
      if (initialData.publish_to !== undefined) {
        setPublishSite(initialData.publish_to.includes('site'))
        setPublishChavesNaMao(initialData.publish_to.includes('chaves_na_mao'))
        setHiddenPublishTargets(
          initialData.publish_to.filter((p) => p !== 'site' && p !== 'chaves_na_mao'),
        )
      }

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

      if (initialData.highlight_level !== undefined) {
        const isHl = initialData.highlight_level !== 'comum'
        setIsHighlighted(isHl)
        if (isHl) {
          setHighlightLevel(
            initialData.highlight_level === 'super_destaque' ? 'super_destaque' : 'destaque',
          )
        }
      }
      if (initialData.highlight_until !== undefined) {
        setHighlightUntil(
          initialData.highlight_until ? initialData.highlight_until.slice(0, 10) : '',
        )
      }
    }
  }, [initialData])

  useEffect(() => {
    if (initialOwner) {
      setSelectedOwner(initialOwner)
    }
  }, [initialOwner])

  // Ação: Sugerir título por IA
  const handleSuggestTitle = async () => {
    setSuggestError(null)
    setTitleSuggestions([])

    // O endpoint requer id do imóvel existente
    if (!propertyId) {
      setSuggestError(
        'Salve o imóvel como rascunho primeiro para sugerir títulos com base nos seus dados.',
      )
      setSuggestModalOpen(true)
      return
    }

    setSuggestModalOpen(true)
    setSuggestingTitle(true)
    try {
      const suggestions = await suggestPropertyTitles(propertyId)
      setTitleSuggestions(suggestions)
    } catch (err) {
      if (err instanceof Error) {
        setSuggestError(err.message)
      } else {
        setSuggestError('A sugestão está indisponível agora.')
      }
    } finally {
      setSuggestingTitle(false)
    }
  }

  const handleSelectTitleSuggestion = (selected: string) => {
    setTitle(selected)
    setSuggestModalOpen(false)
  }

  // Submissão do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setZeroValueError(null)
    setPurposeError(null)

    // Validação da Finalidade (duas caixas de seleção)
    if (!purposeVenda && !purposeLocacao) {
      setPurposeError('Marque venda, locação ou as duas')
      return
    }

    const calculatedPurpose: PropertyPurpose =
      purposeVenda && purposeLocacao ? 'ambos' : purposeVenda ? 'venda' : 'locacao'

    // Validação de condomínio
    if (inCondominium && !condominiumId) {
      setZeroValueError('Escolha o condomínio ou marque fora de condomínio.')
      return
    }

    // Validação de zeros explícitos em campos monetários
    const checkZero = (val: string, label: string) => {
      const parsed = parseCurrencyInput(val)
      if (parsed !== undefined && parsed === 0) {
        setZeroValueError(`Deixe em branco quando não informado. (${label})`)
        return true
      }
      return false
    }

    if (calculatedPurpose === 'venda' || calculatedPurpose === 'ambos') {
      if (checkZero(salePrice, 'Preço de venda')) return
    }
    if (calculatedPurpose === 'locacao' || calculatedPurpose === 'ambos') {
      if (checkZero(rentPrice, 'Preço de locação')) return
    }
    if (checkZero(condoFee, 'Condomínio')) return
    if (checkZero(iptu, 'IPTU')) return

    const finalStreetNumber = isSN ? 'S/N' : streetNumber.trim()

    // Monta lista publish_to mantendo valores ocultos existentes
    const nextPublishTo: string[] = []
    if (publishSite) nextPublishTo.push('site')
    if (publishChavesNaMao) nextPublishTo.push('chaves_na_mao')
    for (const h of hiddenPublishTargets) {
      if (!nextPublishTo.includes(h)) nextPublishTo.push(h)
    }

    await onSubmit({
      code: code.trim(),
      title: title.trim(),
      purpose: calculatedPurpose,
      property_type: propertyType,
      use_type: useType,
      in_condominium: inCondominium,
      condominium_id: inCondominium ? condominiumId : '',
      status: isEditing ? status : undefined,
      street: street.trim(),
      street_number: finalStreetNumber,
      complement: complement.trim(),
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase() || 'BA',
      zip_code: zipCode.trim(),
      publish_to: nextPublishTo,
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
      highlight_level: isHighlighted ? highlightLevel : 'comum',
      highlight_until: isHighlighted && highlightUntil ? highlightUntil : '',
    })
  }

  // Define se campos de preço devem ser exibidos
  const showSalePrice = purposeVenda
  const showRentPrice = purposeLocacao

  // Filtra condomínios pelo search
  const filteredCondos = condoList.filter((c) =>
    condoSearchTerm.trim()
      ? c.name.toLowerCase().includes(condoSearchTerm.trim().toLowerCase())
      : true,
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Aviso de validação de valor zero ou erro geral */}
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
            Código do imóvel, finalidade do negócio, uso, tipo de construção e título.
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

          {/* Finalidade do negócio: Venda e Locação em Checkboxes */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-normal text-foreground block">
              Finalidade do negócio <span className="text-destructive">*</span>
            </label>
            <div className="h-12 px-3.5 rounded-lg border border-border bg-card flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground">
                <Checkbox
                  checked={purposeVenda}
                  onCheckedChange={(c) => {
                    setPurposeVenda(Boolean(c))
                    setPurposeError(null)
                  }}
                />
                <span>Venda</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground">
                <Checkbox
                  checked={purposeLocacao}
                  onCheckedChange={(c) => {
                    setPurposeLocacao(Boolean(c))
                    setPurposeError(null)
                  }}
                />
                <span>Locação</span>
              </label>
            </div>
            {purposeError && (
              <p className="text-xs text-destructive font-normal" role="alert">
                {purposeError}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Uso do Imóvel: Finalidade (use_type) */}
          <div className="space-y-1.5">
            <label
              htmlFor="prop-use-type"
              className="text-[13px] font-normal text-foreground block"
            >
              Uso do imóvel <span className="text-destructive">*</span>
            </label>
            <Select value={useType} onValueChange={(val) => setUseType(val as PropertyUseType)}>
              <SelectTrigger id="prop-use-type" className="h-12 text-sm border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROPERTY_USE_TYPE_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de Imóvel */}
          <div className="space-y-1.5">
            <label htmlFor="prop-type" className="text-[13px] font-normal text-foreground block">
              Tipo de construção <span className="text-destructive">*</span>
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
        </div>

        {/* Situação (somente na EDIÇÃO) */}
        {isEditing && (
          <div className="space-y-1.5">
            <label htmlFor="prop-status" className="text-[13px] font-normal text-foreground block">
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
              Para ficar Disponível, o imóvel deve ter título e descrição, endereço, valores,
              características, proprietário e 5 fotos.
            </p>
          </div>
        )}

        {/* Título com botão Sugerir título por IA */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="prop-title" className="text-[13px] font-normal text-foreground block">
              Título do anúncio <span className="text-destructive">*</span>
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSuggestTitle}
              className="h-8 rounded-full px-3 text-xs font-normal border-border text-foreground hover:bg-muted/40"
            >
              <span>Sugerir título</span>
            </Button>
          </div>
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

      {/* 2. SEÇÃO: CONDOMÍNIO (Alternador Dentro / Fora) */}
      <section className="space-y-4">
        <div>
          <h2 className="text-[20px] font-normal text-foreground">Condomínio</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Informe se o imóvel está situado dentro de um condomínio residencial ou comercial.
          </p>
        </div>

        {/* Alternador / Pílulas: Dentro / Fora */}
        <div className="inline-flex p-1 rounded-full border border-border bg-muted/40 gap-1">
          <button
            type="button"
            onClick={() => setInCondominium(false)}
            className={`h-9 px-4 rounded-full text-xs font-normal transition-colors ${
              !inCondominium
                ? 'bg-primary text-primary-foreground font-medium'
                : 'bg-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Fora de condomínio
          </button>
          <button
            type="button"
            onClick={() => setInCondominium(true)}
            className={`h-9 px-4 rounded-full text-xs font-normal transition-colors ${
              inCondominium
                ? 'bg-primary text-primary-foreground font-medium'
                : 'bg-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Dentro de condomínio
          </button>
        </div>

        {/* Se Dentro de condomínio: seletor de condomínio e atalho Novo condomínio */}
        {inCondominium && (
          <div className="p-4 rounded-lg border border-border bg-card space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <label
                htmlFor="prop-condo-select"
                className="text-[13px] font-normal text-foreground block"
              >
                Escolher condomínio <span className="text-destructive">*</span>
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuickCondoModalOpen(true)}
                className="h-8 rounded-full px-3 text-xs font-normal border-border gap-1 self-start sm:self-auto"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Novo condomínio</span>
              </Button>
            </div>

            <Select value={condominiumId || ''} onValueChange={(val) => setCondominiumId(val)}>
              <SelectTrigger id="prop-condo-select" className="h-12 text-sm border-border">
                <SelectValue placeholder="Selecione um condomínio ativo..." />
              </SelectTrigger>
              <SelectContent>
                {loadingCondos ? (
                  <div className="p-3 text-xs text-muted-foreground text-center">
                    Carregando condomínios...
                  </div>
                ) : condoList.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground text-center">
                    Nenhum condomínio ativo cadastrado. Clique em Novo condomínio.
                  </div>
                ) : (
                  condoList.map((condo) => (
                    <SelectItem key={condo.id} value={condo.id} className="text-xs">
                      {condo.name}
                      {condo.neighborhood ? ` · ${condo.neighborhood}` : ''}
                      {condo.city ? ` (${condo.city})` : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              A ficha do imóvel exibirá dados como área de lazer, regras e fotos do condomínio.
            </p>
          </div>
        )}
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
            <div className="flex items-center justify-between">
              <label
                htmlFor="prop-street-number"
                className="text-[13px] font-normal text-foreground block"
              >
                Número
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={isSN}
                  onCheckedChange={(checked) => {
                    const sn = Boolean(checked)
                    setIsSN(sn)
                    if (sn) setStreetNumber('')
                  }}
                />
                <span>S/N</span>
              </label>
            </div>
            <Input
              id="prop-street-number"
              placeholder={isSN ? 'S/N' : 'Ex.: 123'}
              value={isSN ? 'S/N' : streetNumber}
              disabled={isSN}
              onChange={(e) => setStreetNumber(e.target.value)}
              maxLength={20}
              className="h-12 text-sm border-border"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label htmlFor="prop-cep" className="text-[13px] font-normal text-foreground block">
                CEP
              </label>
              <Input
                id="prop-cep"
                placeholder="00000-000"
                value={zipCode}
                onChange={(e) => setZipCode(maskCepInput(e.target.value))}
                maxLength={9}
                className="h-12 text-sm border-border tabular"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="prop-state" className="text-[13px] font-normal text-foreground block">
                UF
              </label>
              <Select value={state} onValueChange={(val) => setState(val)}>
                <SelectTrigger id="prop-state" className="h-12 text-sm border-border tabular">
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {BRAZIL_STATES.map((st) => (
                    <SelectItem key={st.uf} value={st.uf} className="text-xs">
                      {st.uf} - {st.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-t border-border" />

      {/* SEÇÃO: ONDE ANUNCIAR */}
      <section className="space-y-4">
        <div>
          <h2 className="text-[20px] font-normal text-foreground">Onde anunciar</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Defina em quais canais e portais imobiliários o imóvel será publicado.
          </p>
        </div>

        <div className="p-4 rounded-lg border border-border bg-card space-y-4">
          {/* Checkbox: Site da imobiliária */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="prop-publish-site"
              checked={publishSite}
              disabled={!canEditPublishTo}
              onCheckedChange={(c) => setPublishSite(Boolean(c))}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <label
                htmlFor="prop-publish-site"
                className={`text-sm font-normal ${
                  canEditPublishTo ? 'text-foreground cursor-pointer' : 'text-muted-foreground'
                }`}
              >
                Site da imobiliária
              </label>
              <p className="text-xs text-muted-foreground">
                Publica na busca e vitrines públicas do site oficial da imobiliária.
              </p>
            </div>
          </div>

          <hr className="border-t border-border/60" />

          {/* Checkbox: Chaves na Mão */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="prop-publish-chaves"
              checked={publishChavesNaMao}
              disabled={!canEditPublishTo}
              onCheckedChange={(c) => setPublishChavesNaMao(Boolean(c))}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <label
                htmlFor="prop-publish-chaves"
                className={`text-sm font-normal ${
                  canEditPublishTo ? 'text-foreground cursor-pointer' : 'text-muted-foreground'
                }`}
              >
                Chaves na Mão
              </label>
              <p className="text-xs text-muted-foreground">
                Só ligue num imóvel que a Kenlo já parou de publicar nesse portal, para não duplicar
                o anúncio.
              </p>
            </div>
          </div>

          {!canEditPublishTo && (
            <p className="text-[11px] text-muted-foreground italic pt-1 border-t border-border/40">
              Apenas administradores e o corretor captador podem alterar os destinos de publicação.
            </p>
          )}

          {/* Indicador Pronto para o portal (quando Chaves na Mão estiver marcado) */}
          {publishChavesNaMao &&
            (() => {
              const calculatedPurpose: PropertyPurpose =
                purposeVenda && purposeLocacao ? 'ambos' : purposeVenda ? 'venda' : 'locacao'
              const reasons = getPortalPendingReasons({
                status: isEditing ? status : 'disponivel',
                property_type: propertyType,
                purpose: calculatedPurpose,
                sale_price: salePrice,
                rent_price: rentPrice,
                price_on_request: priceOnRequest,
                neighborhood: neighborhood,
                city: city,
                state: state,
                zip_code: zipCode,
                description: description,
                photos: formPhotos,
              })
              const isReady = reasons.length === 0

              return (
                <div
                  className={`p-3.5 rounded-lg border text-xs space-y-2 mt-3 ${
                    isReady
                      ? 'border-success/30 bg-success/10 text-success'
                      : 'border-attention/30 bg-attention/10 text-attention'
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium">
                    {isReady ? (
                      <Badge variant="success">Pronto para o portal</Badge>
                    ) : (
                      <Badge variant="attention">Pendências para o portal Chaves na Mão</Badge>
                    )}
                  </div>

                  {!isReady && (
                    <ul className="space-y-1 list-disc list-inside text-xs text-foreground">
                      {reasons.map((r, idx) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })()}
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

      {/* 6. SEÇÃO: DESTAQUE NO SITE */}
      {(isAdmin || isCorretor) && (
        <>
          <section className="space-y-4">
            <div>
              <h2 className="text-[20px] font-normal text-foreground">Destaque no site</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Escolha se e como este imóvel será promovido nas vitrines e páginas de busca do
                site.
              </p>
            </div>

            <div className="p-4 rounded-lg border border-border bg-card space-y-4">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox
                  id="prop-highlight-checkbox"
                  checked={isHighlighted}
                  onCheckedChange={(c) => {
                    const checked = Boolean(c)
                    setIsHighlighted(checked)
                    if (!checked) {
                      setHighlightUntil('')
                    }
                  }}
                />
                <span className="text-sm font-normal text-foreground">Destacar no site</span>
              </label>

              {isHighlighted && (
                <div className="pt-2 border-t border-border space-y-5">
                  <div className="space-y-2">
                    <label className="text-[13px] font-normal text-foreground block">
                      Nível de destaque <span className="text-destructive">*</span>
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Opção Destaque */}
                      <div
                        onClick={() => setHighlightLevel('destaque')}
                        className={`p-3.5 rounded-lg border cursor-pointer transition-colors space-y-2.5 ${
                          highlightLevel === 'destaque'
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-card hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
                            <input
                              type="radio"
                              name="highlight-level-choice"
                              value="destaque"
                              checked={highlightLevel === 'destaque'}
                              onChange={() => setHighlightLevel('destaque')}
                              className="text-primary focus:ring-primary h-4 w-4 border-border"
                            />
                            <span>Destaque</span>
                          </label>
                          <span className="eyebrow text-[10px] text-muted-foreground">
                            Retângulo médio
                          </span>
                        </div>

                        {/* Miniatura de espaço reservado (placeholder fácil de trocar) */}
                        <div className="w-full h-24 rounded-lg border border-dashed border-border bg-muted/40 flex flex-col items-center justify-center p-2 text-center">
                          <span className="text-xs font-medium text-foreground">
                            Quadro Destaque
                          </span>
                          <span className="text-[11px] text-muted-foreground mt-0.5">
                            tamanho final a definir
                          </span>
                        </div>
                      </div>

                      {/* Opção Super-destaque */}
                      <div
                        onClick={() => setHighlightLevel('super_destaque')}
                        className={`p-3.5 rounded-lg border cursor-pointer transition-colors space-y-2.5 ${
                          highlightLevel === 'super_destaque'
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-card hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
                            <input
                              type="radio"
                              name="highlight-level-choice"
                              value="super_destaque"
                              checked={highlightLevel === 'super_destaque'}
                              onChange={() => setHighlightLevel('super_destaque')}
                              className="text-primary focus:ring-primary h-4 w-4 border-border"
                            />
                            <span>Super-destaque</span>
                          </label>
                          <span className="eyebrow text-[10px] text-muted-foreground">
                            Retângulo grande
                          </span>
                        </div>

                        {/* Miniatura de espaço reservado (placeholder fácil de trocar) */}
                        <div className="w-full h-36 rounded-lg border border-dashed border-border bg-muted/40 flex flex-col items-center justify-center p-2 text-center">
                          <span className="text-xs font-medium text-foreground">
                            Quadro Super-destaque
                          </span>
                          <span className="text-[11px] text-muted-foreground mt-0.5">
                            tamanho final a definir
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Campo opcional: Destacar até */}
                  <div className="space-y-1.5 max-w-sm">
                    <label
                      htmlFor="prop-highlight-until"
                      className="text-[13px] font-normal text-foreground block"
                    >
                      Destacar até (opcional)
                    </label>
                    <Input
                      id="prop-highlight-until"
                      type="date"
                      value={highlightUntil}
                      onChange={(e) => setHighlightUntil(e.target.value)}
                      className="h-12 text-sm border-border tabular"
                    />
                    <p className="text-xs text-muted-foreground">
                      Deixe em branco para destaque por tempo indeterminado. Se informado, precisa
                      ser uma data futura.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <hr className="border-t border-border" />
        </>
      )}

      {/* 7. SEÇÃO: PROPRIETÁRIO E CAPTADOR */}
      <section className="space-y-6">
        <div>
          <h2 className="text-[20px] font-normal text-foreground">Proprietário e Captador</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Vincule o cliente proprietário do imóvel e o corretor responsável pela captação.
          </p>
        </div>

        {/* Proprietário */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-normal text-foreground block">
            Proprietário do imóvel
          </label>

          {!propertyId ? (
            <div className="p-3.5 rounded-lg border border-border bg-muted/20 text-xs text-muted-foreground">
              Salve o imóvel para vincular o proprietário.
            </div>
          ) : selectedOwner ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border border-border bg-card gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-normal text-foreground">{selectedOwner.name}</p>
                  {(selectedOwner.phone || selectedOwner.email) && (
                    <p className="text-xs text-muted-foreground tabular">
                      {selectedOwner.phone
                        ? `Telefone: ${formatPhoneNumber(selectedOwner.phone)}`
                        : ''}
                      {selectedOwner.phone && selectedOwner.email ? ' · ' : ''}
                      {selectedOwner.email || ''}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLinkOwnerModalOpen(true)}
                  className="h-8 rounded-full px-3 text-xs font-normal border-border gap-1"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Vincular proprietário</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedOwner(null)}
                  className="h-8 rounded-full px-2.5 text-xs font-normal text-muted-foreground hover:text-foreground"
                  title="Desvincular no formulário"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-lg border border-border bg-muted/20 text-muted-foreground flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
              <span>Nenhum proprietário vinculado</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLinkOwnerModalOpen(true)}
                className="h-8 rounded-full px-3 text-xs font-normal border-border gap-1 self-start sm:self-auto text-foreground"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Vincular proprietário</span>
              </Button>
            </div>
          )}
        </div>

        {/* Captador */}
        <div className="space-y-1.5 pt-2">
          <label
            htmlFor="prop-captured-by"
            className="text-[13px] font-normal text-foreground block"
          >
            Corretor captador <span className="text-destructive">*</span>
          </label>
          {isCorretor ? (
            <div className="space-y-1">
              <Input
                id="prop-captured-by"
                value={currentUser.name || currentUser.email || 'Você'}
                disabled
                className="h-12 text-sm border-border bg-muted cursor-not-allowed opacity-90"
              />
              <p className="text-xs text-muted-foreground">Você cadastra em seu nome.</p>
            </div>
          ) : isAdmin ? (
            <div className="space-y-1">
              <Select value={capturedBy} onValueChange={(val) => setCapturedBy(val)}>
                <SelectTrigger id="prop-captured-by" className="h-12 text-sm border-border">
                  <SelectValue placeholder="Selecione o corretor captador" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.role === 'admin' ? 'Administrador' : 'Corretor'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Selecione o responsável pela captação deste imóvel.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <Input
                id="prop-captured-by"
                value={currentUser.name || currentUser.email}
                disabled
                className="h-12 text-sm border-border bg-muted cursor-not-allowed"
              />
            </div>
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

      {/* Modal de Vincular Proprietário */}
      {propertyId && (
        <LinkOwnerModal
          open={linkOwnerModalOpen}
          onOpenChange={setLinkOwnerModalOpen}
          propertyId={propertyId}
          propertyCode={code || initialData?.code || ''}
          onLinked={async () => {
            try {
              const fresh = await getPropertyById(propertyId)
              if (fresh.expand?.owner_id) {
                setSelectedOwner(fresh.expand.owner_id)
              } else if (fresh.owner_id) {
                setSelectedOwner({ id: fresh.owner_id, name: 'Proprietário vinculado' })
              }
            } catch {
              // fallback
            }
          }}
        />
      )}

      {/* Modal de Cadastro Rápido de Condomínio */}
      <QuickCondominiumModal
        open={quickCondoModalOpen}
        onOpenChange={setQuickCondoModalOpen}
        currentUser={currentUser}
        onCreated={(newCondo) => {
          setCondoList((prev) => [newCondo, ...prev])
          setCondominiumId(newCondo.id)
        }}
      />

      {/* Modal de Sugestões de Título por IA (Item 9 - Identidade Planta) */}
      <Dialog open={suggestModalOpen} onOpenChange={setSuggestModalOpen}>
        <DialogContent className="max-w-xl p-6">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <AiBadge />
              <DialogTitle className="text-base font-semibold text-foreground">
                Sugestões de título
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Opções formuladas com base nos dados do imóvel para compor o anúncio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Enquanto a IA trabalha: frase + barra fina em primary */}
            {suggestingTitle && (
              <div className="space-y-2 py-6">
                <p className="text-xs text-foreground font-normal">Gerando título…</p>
                <div className="h-0.5 w-full bg-border overflow-hidden">
                  <div className="h-full w-full bg-primary" />
                </div>
              </div>
            )}

            {suggestError && (
              <div className="p-3.5 rounded-[4px] bg-destructive/10 text-destructive text-xs border border-destructive/20 font-normal">
                {suggestError}
              </div>
            )}

            {!suggestingTitle && titleSuggestions.length > 0 && (
              <div className="space-y-3">
                {titleSuggestions.map((sug, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-[4px] bg-accent border border-border/60 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-normal text-foreground leading-relaxed flex-1">
                        {sug}
                      </p>
                      <AiBadge className="shrink-0" />
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                      {/* Ações especificadas: "Usar este título" (preenchida), "Editar" (contorno), "Gerar outro" (texto) */}
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleSelectTitleSuggestion(sug)}
                        className="h-8 rounded-[4px] px-3.5 text-xs font-normal bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        Usar este título
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTitle(sug)
                          setSuggestModalOpen(false)
                        }}
                        className="h-8 rounded-[4px] px-3 text-xs font-normal border-border hover:bg-card"
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleSuggestTitle}
                        className="h-8 rounded-[4px] px-2.5 text-xs font-normal text-muted-foreground hover:text-foreground hover:bg-transparent"
                      >
                        Gerar outro
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSuggestModalOpen(false)}
              className="h-9 rounded-[4px] px-4 text-xs font-normal border-border"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}
