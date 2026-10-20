import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Check } from 'lucide-react'
import {
  listProperties,
  PropertyRecord,
  PropertyType,
  PropertyPurpose,
  PropertyStatus,
  PROPERTY_TYPE_LABELS,
  PROPERTY_PURPOSE_LABELS,
  PROPERTY_STATUS_LABELS,
  isPropertyPendingReview,
  formatPropertyPrice,
  getFirstActivePhoto,
  getPhotoFileUrl,
  formatErrorMessage,
} from '@/services/properties'
import { getEffectiveCondoCoverPhoto, getCondoPhotoUrl } from '@/services/condominiums'
import { listEligibleResponsibleUsers, ResponsibleUser } from '@/services/clients'
import { formatRoomsText, formatParkingText } from '@/lib/propertyCardUtils'
import { maskCurrencyInput, parseCurrencyInput } from '@/lib/currencyUtils'
import { useAuth } from '@/contexts/AuthContext'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getPropertyStatusBadgeVariant } from '@/lib/badgeVariants'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Search,
  Plus,
  Home,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  FilterX,
  Bed,
  MapPin,
  Clock,
  ImageIcon,
} from 'lucide-react'

// Estilos de badge para cada status centralizados em getPropertyStatusBadgeVariant

export default function Imoveis() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()

  const [successBanner, setSuccessBanner] = useState<string | null>(null)

  useEffect(() => {
    if (location.state?.successMessage) {
      setSuccessBanner(location.state.successMessage)
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  // Permissão do botão Novo Imóvel: somente admin ou corretor
  const canCreateProperty = user?.role === 'admin' || user?.role === 'corretor'

  // Filtro de lote de importação vindo da URL
  const importBatchIdParam = searchParams.get('import_batch_id') || ''

  // Aba selecionada: 'todos' ou 'pendentes'
  const [activeTab, setActiveTab] = useState<'todos' | 'pendentes'>('todos')

  // Lista e paginação
  const [properties, setProperties] = useState<PropertyRecord[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Filtros
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedType, setSelectedType] = useState<PropertyType | ''>('')
  const [selectedPurpose, setSelectedPurpose] = useState<PropertyPurpose | ''>('')
  const [selectedStatus, setSelectedStatus] = useState<PropertyStatus | ''>('')
  const [minBedroomsInput, setMinBedroomsInput] = useState<string>('')
  const [minParkingInput, setMinParkingInput] = useState<string>('')
  const [selectedCaptador, setSelectedCaptador] = useState<string>('')
  const [minPriceInput, setMinPriceInput] = useState<string>('')
  const [maxPriceInput, setMaxPriceInput] = useState<string>('')

  // Usuários corretores e admins para o filtro de captador
  const [captadores, setCaptadores] = useState<ResponsibleUser[]>([])

  useEffect(() => {
    let active = true
    listEligibleResponsibleUsers()
      .then((items) => {
        if (active) setCaptadores(items)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // Debounce de 300 ms para o campo de busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Carrega imóveis da API PocketBase
  useEffect(() => {
    let active = true
    setLoading(true)
    setErrorMessage(null)

    const minBed = minBedroomsInput ? Number(minBedroomsInput) : undefined
    const minPark = minParkingInput ? Number(minParkingInput) : undefined
    const minP = parseCurrencyInput(minPriceInput)
    const maxP = parseCurrencyInput(maxPriceInput)

    listProperties({
      page: currentPage,
      perPage: 10,
      search: debouncedSearch,
      propertyType: selectedType || undefined,
      purpose: selectedPurpose || undefined,
      status: selectedStatus || undefined,
      minBedrooms: Number.isNaN(minBed) ? undefined : minBed,
      minParking: Number.isNaN(minPark) ? undefined : minPark,
      capturedBy: selectedCaptador || undefined,
      minPrice: minP !== undefined && !Number.isNaN(minP) ? minP : undefined,
      maxPrice: maxP !== undefined && !Number.isNaN(maxP) ? maxP : undefined,
      pendingReviewOnly: activeTab === 'pendentes',
      importBatchId: importBatchIdParam || undefined,
      sort: '-created',
    })
      .then((res) => {
        if (!active) return
        setProperties(res.items)
        setTotalItems(res.totalItems)
        setTotalPages(res.totalPages || 1)
      })
      .catch((err) => {
        if (!active) return
        setErrorMessage(formatErrorMessage(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [
    currentPage,
    debouncedSearch,
    selectedType,
    selectedPurpose,
    selectedStatus,
    minBedroomsInput,
    minParkingInput,
    selectedCaptador,
    minPriceInput,
    maxPriceInput,
    activeTab,
    importBatchIdParam,
  ])

  const handleClearFilters = () => {
    setSearchInput('')
    setSelectedType('')
    setSelectedPurpose('')
    setSelectedStatus('')
    setMinBedroomsInput('')
    setMinParkingInput('')
    setSelectedCaptador('')
    setMinPriceInput('')
    setMaxPriceInput('')
    if (importBatchIdParam) {
      searchParams.delete('import_batch_id')
      setSearchParams(searchParams)
    }
    setCurrentPage(1)
  }

  const hasActiveFilters = Boolean(
    searchInput ||
    selectedType ||
    selectedPurpose ||
    selectedStatus ||
    minBedroomsInput ||
    minParkingInput ||
    selectedCaptador ||
    minPriceInput ||
    maxPriceInput ||
    importBatchIdParam,
  )

  const getPropertyBadgeVariant = (status: PropertyStatus) => {
    return getPropertyStatusBadgeVariant(status)
  }

  return (
    <div className="space-y-6">
      {/* Banner de sucesso */}
      {successBanner && (
        <Alert className="border-success/30 bg-success/10 text-success">
          <Check className="h-4 w-4 text-success" />
          <AlertDescription className="text-sm font-medium flex items-center justify-between text-foreground">
            <span>{successBanner}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSuccessBanner(null)}
              className="h-6 text-xs"
            >
              Fechar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="display-sm text-foreground">Imóveis</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gerencie o catálogo de imóveis, valores e situação da sua imobiliária.
          </p>
        </div>
        {canCreateProperty && (
          <Button
            onClick={() => navigate('/imoveis/novo')}
            className="hidden sm:inline-flex rounded-full px-5 h-10 gap-2 font-medium"
          >
            <Plus className="h-4 w-4" />
            <span>Novo imóvel</span>
          </Button>
        )}
      </div>

      {/* Botão flutuante no celular (FAB 56px) */}
      {canCreateProperty && (
        <button
          type="button"
          onClick={() => navigate('/imoveis/novo')}
          aria-label="Novo imóvel"
          className="sm:hidden fixed right-4 bottom-20 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-none border border-border flex items-center justify-center active:scale-95 transition-transform"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Abas no topo em pílulas: Todos e Pendentes de revisão */}
      <div className="flex items-center gap-1.5 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => {
            setActiveTab('todos')
            setCurrentPage(1)
          }}
          className={`h-9 px-4 rounded-full text-xs font-normal border transition-colors ${
            activeTab === 'todos'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-transparent text-foreground border-border hover:bg-muted'
          }`}
        >
          Todos
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('pendentes')
            setCurrentPage(1)
          }}
          className={`h-9 px-4 rounded-full text-xs font-normal border transition-colors inline-flex items-center gap-1.5 ${
            activeTab === 'pendentes'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-transparent text-foreground border-border hover:bg-muted'
          }`}
        >
          <span>Pendentes de revisão</span>
          {activeTab === 'pendentes' && (
            <Badge variant="attention" className="px-1.5 py-0 text-[10px] tabular">
              {totalItems}
            </Badge>
          )}
        </button>
      </div>

      {/* Filtros e Busca */}
      <div className="space-y-2.5">
        {/* Campo de busca em pílula de 48px */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por código, endereço, bairro ou título..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full h-12 pl-11 pr-4 rounded-full border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Pílulas de seleção com quebra de linha permitida */}
        <div className="flex items-center gap-2 flex-wrap py-1">
          {/* Tipo */}
          <Select
            value={selectedType || 'todos'}
            onValueChange={(val) => {
              setSelectedType(val === 'todos' ? '' : (val as PropertyType))
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="h-9 rounded-full px-3.5 text-xs border-border bg-background shrink-0 w-auto min-w-[130px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {Object.entries(PROPERTY_TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Finalidade */}
          <Select
            value={selectedPurpose || 'todos'}
            onValueChange={(val) => {
              setSelectedPurpose(val === 'todos' ? '' : (val as PropertyPurpose))
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="h-9 rounded-full px-3.5 text-xs border-border bg-background shrink-0 w-auto min-w-[130px]">
              <SelectValue placeholder="Finalidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas finalidades</SelectItem>
              {Object.entries(PROPERTY_PURPOSE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Situação */}
          <Select
            value={selectedStatus || 'todos'}
            onValueChange={(val) => {
              setSelectedStatus(val === 'todos' ? '' : (val as PropertyStatus))
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="h-9 rounded-full px-3.5 text-xs border-border bg-background shrink-0 w-auto min-w-[130px]">
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas situações</SelectItem>
              {Object.entries(PROPERTY_STATUS_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Captador */}
          <Select
            value={selectedCaptador || 'todos'}
            onValueChange={(val) => {
              setSelectedCaptador(val === 'todos' ? '' : val)
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="h-9 rounded-full px-3.5 text-xs border-border bg-background shrink-0 w-auto min-w-[140px]">
              <SelectValue placeholder="Captador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os captadores</SelectItem>
              {captadores.map((cap) => (
                <SelectItem key={cap.id} value={cap.id}>
                  {cap.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Quartos */}
          <Select
            value={minBedroomsInput || 'todos'}
            onValueChange={(val) => {
              setMinBedroomsInput(val === 'todos' ? '' : val)
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="h-9 rounded-full px-3.5 text-xs border-border bg-background shrink-0 w-auto min-w-[120px]">
              <SelectValue placeholder="Quartos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Quartos (qualquer)</SelectItem>
              <SelectItem value="1">1+ quarto</SelectItem>
              <SelectItem value="2">2+ quartos</SelectItem>
              <SelectItem value="3">3+ quartos</SelectItem>
              <SelectItem value="4">4+ quartos</SelectItem>
            </SelectContent>
          </Select>

          {/* Vagas */}
          <Select
            value={minParkingInput || 'todos'}
            onValueChange={(val) => {
              setMinParkingInput(val === 'todos' ? '' : val)
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="h-9 rounded-full px-3.5 text-xs border-border bg-background shrink-0 w-auto min-w-[110px]">
              <SelectValue placeholder="Vagas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Vagas: qualquer</SelectItem>
              <SelectItem value="1">1+</SelectItem>
              <SelectItem value="2">2+</SelectItem>
              <SelectItem value="3">3+</SelectItem>
            </SelectContent>
          </Select>

          {/* Preço mín. */}
          <div className="relative shrink-0 w-28 sm:w-32">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-normal text-muted-foreground pointer-events-none">
              R$
            </span>
            <Input
              type="text"
              placeholder="Preço mín."
              value={minPriceInput}
              onChange={(e) => {
                const val = e.target.value
                const formatted = val ? maskCurrencyInput(val) : ''
                setMinPriceInput(formatted)
                setCurrentPage(1)
              }}
              className="h-9 rounded-full pl-8 pr-2.5 text-xs border-border bg-background tabular"
            />
          </div>

          {/* Preço máx. */}
          <div className="relative shrink-0 w-28 sm:w-32">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-normal text-muted-foreground pointer-events-none">
              R$
            </span>
            <Input
              type="text"
              placeholder="Preço máx."
              value={maxPriceInput}
              onChange={(e) => {
                const val = e.target.value
                const formatted = val ? maskCurrencyInput(val) : ''
                setMaxPriceInput(formatted)
                setCurrentPage(1)
              }}
              className="h-9 rounded-full pl-8 pr-2.5 text-xs border-border bg-background tabular"
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs text-muted-foreground hover:text-foreground shrink-0 px-2 py-1 underline"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Aviso de filtro de lote ativo */}
        {importBatchIdParam && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 text-xs text-foreground">
            <span>
              Exibindo imóveis importados no lote{' '}
              <strong className="font-mono">{importBatchIdParam}</strong>.
            </span>
            <button
              type="button"
              onClick={() => {
                searchParams.delete('import_batch_id')
                setSearchParams(searchParams)
              }}
              className="text-primary underline hover:opacity-80 ml-auto"
            >
              Remover filtro
            </button>
          </div>
        )}
      </div>

      {/* Erro de carregamento */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Conteúdo: Desktop Lista de Linhas + Mobile Linhas com miniatura de 56px */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-16 rounded-lg border border-border animate-pulse bg-muted/40"
            />
          ))}
        </div>
      ) : properties.length === 0 ? (
        <div className="p-12 text-center rounded-[8px] border border-border bg-card grade-planta">
          <div className="max-w-sm mx-auto bg-card/90 backdrop-blur-sm p-6 rounded-[8px] border border-border shadow-none">
            <p className="text-sm text-muted-foreground mb-4">
              {activeTab === 'pendentes'
                ? 'Nenhum imóvel pendente de revisão encontrado.'
                : hasActiveFilters
                  ? 'Nenhum resultado corresponde aos filtros aplicados.'
                  : 'Nenhum imóvel por aqui. Cadastre o primeiro.'}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs text-primary underline"
              >
                Limpar filtros
              </button>
            ) : canCreateProperty ? (
              <Button
                onClick={() => navigate('/imoveis/novo')}
                className="rounded-[4px] px-5 h-10 gap-2 font-medium"
              >
                <Plus className="h-4 w-4" />
                <span>Novo imóvel</span>
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          {/* Versão Desktop: Lista de linhas com divisores e cabeçalho em .eyebrow */}
          <div className="hidden lg:block rounded-lg border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-border text-left eyebrow text-muted-foreground">
              <div className="col-span-1">Foto</div>
              <div className="col-span-1">Código</div>
              <div className="col-span-4">Título</div>
              <div className="col-span-2">Localização</div>
              <div className="col-span-2">Preço</div>
              <div className="col-span-2 text-right">Situação</div>
            </div>
            <div className="divide-y divide-border">
              {properties.map((property) => {
                const coverPhoto = getFirstActivePhoto(property)
                const condoCoverPhoto =
                  !coverPhoto && property.in_condominium && property.expand?.condominium_id
                    ? getEffectiveCondoCoverPhoto(property.expand.condominium_id as any)
                    : null
                const isOutdated = isPropertyPendingReview(property)
                const statusLabel = PROPERTY_STATUS_LABELS[property.status] || property.status
                const locationText =
                  [property.neighborhood, property.city].filter(Boolean).join(', ') || '—'

                return (
                  <div
                    key={property.id}
                    onClick={() => navigate(`/imoveis/${property.id}`)}
                    className="grid grid-cols-12 gap-3 px-4 py-3 items-center hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    {/* Miniatura 56px (8px raio) */}
                    <div className="col-span-1">
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-muted flex items-center justify-center border border-border shrink-0">
                        {coverPhoto ? (
                          <img
                            src={getPhotoFileUrl(coverPhoto, '100x100')}
                            alt={property.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : condoCoverPhoto ? (
                          <>
                            <img
                              src={getCondoPhotoUrl(condoCoverPhoto, '100x100')}
                              alt={property.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            <div className="absolute bottom-0 inset-x-0 bg-background/90 text-[8px] text-center text-muted-foreground py-0.2 border-t border-border/50 truncate leading-tight">
                              do condomínio
                            </div>
                          </>
                        ) : (
                          <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                        )}
                      </div>
                    </div>

                    <div className="col-span-1 dado text-muted-foreground truncate">
                      {property.code}
                    </div>

                    <div className="col-span-4 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-normal text-sm text-foreground line-clamp-1">
                          {property.title ||
                            `${PROPERTY_TYPE_LABELS[property.property_type] || property.property_type} · ${property.neighborhood || 'Sem bairro'} · ${property.code}`}
                        </span>
                        {(() => {
                          const hl = (property as any).highlight_level || 'comum'
                          const untilStr = (property as any).highlight_until
                          if (hl === 'destaque' || hl === 'super_destaque') {
                            const isExpired =
                              untilStr &&
                              !isNaN(new Date(untilStr.replace(' ', 'T')).getTime()) &&
                              new Date(untilStr.replace(' ', 'T')).getTime() < Date.now()
                            if (isExpired) {
                              const d = new Date(untilStr.replace(' ', 'T'))
                              const dd = String(d.getUTCDate()).padStart(2, '0')
                              const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
                              return (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] text-muted-foreground border-border shrink-0"
                                >
                                  Comum (destaque vencido em {dd}/{mm})
                                </Badge>
                              )
                            }
                            return (
                              <Badge
                                variant={hl === 'super_destaque' ? 'default' : 'secondary'}
                                className={`text-[10px] shrink-0 ${
                                  hl === 'super_destaque'
                                    ? 'bg-primary text-primary-foreground border-primary font-medium'
                                    : 'border-border text-foreground'
                                }`}
                              >
                                {hl === 'super_destaque' ? 'Super-destaque' : 'Destaque'}
                              </Badge>
                            )
                          }
                          return null
                        })()}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {PROPERTY_TYPE_LABELS[property.property_type] || property.property_type}
                        {formatRoomsText(property.bedrooms, property.suites) &&
                          ` · ${formatRoomsText(property.bedrooms, property.suites)}`}
                        {formatParkingText(property.parking) &&
                          ` · ${formatParkingText(property.parking)}`}
                      </span>
                    </div>

                    <div className="col-span-2 text-xs text-muted-foreground truncate">
                      {locationText}
                    </div>

                    <div className="col-span-2 dado text-foreground whitespace-nowrap">
                      {formatPropertyPrice(property)}
                    </div>

                    <div className="col-span-2 text-right flex items-center justify-end gap-1.5 flex-wrap">
                      {property.source === 'importacao' && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-muted/60 text-foreground border-border"
                        >
                          Importado
                        </Badge>
                      )}
                      {(() => {
                        const hl = (property as any).highlight_level || 'comum'
                        const untilStr = (property as any).highlight_until
                        if (hl === 'destaque' || hl === 'super_destaque') {
                          const isExpired =
                            untilStr &&
                            !isNaN(new Date(untilStr.replace(' ', 'T')).getTime()) &&
                            new Date(untilStr.replace(' ', 'T')).getTime() < Date.now()
                          if (isExpired) {
                            const d = new Date(untilStr.replace(' ', 'T'))
                            const dd = String(d.getUTCDate()).padStart(2, '0')
                            const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
                            return (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-muted-foreground border-border"
                              >
                                Comum (destaque vencido em {dd}/{mm})
                              </Badge>
                            )
                          }
                          return (
                            <Badge
                              variant={hl === 'super_destaque' ? 'default' : 'secondary'}
                              className={`text-[10px] ${
                                hl === 'super_destaque'
                                  ? 'bg-primary text-primary-foreground border-primary font-medium'
                                  : 'border-border text-foreground'
                              }`}
                            >
                              {hl === 'super_destaque' ? 'Super-destaque' : 'Destaque'}
                            </Badge>
                          )
                        }
                        return null
                      })()}
                      {isOutdated && (
                        <Badge variant="attention" className="text-[10px]">
                          Desatualizado
                        </Badge>
                      )}
                      <Badge
                        variant={getPropertyBadgeVariant(property.status)}
                        className="text-[10px]"
                      >
                        {statusLabel}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Versão Mobile/Tablet: Linha de 72px com miniatura de 56px à esquerda, preço em .tabular e badges */}
          <div className="lg:hidden rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
            {properties.map((property) => {
              const coverPhoto = getFirstActivePhoto(property)
              const condoCoverPhoto =
                !coverPhoto && property.in_condominium && property.expand?.condominium_id
                  ? getEffectiveCondoCoverPhoto(property.expand.condominium_id as any)
                  : null
              const isOutdated = isPropertyPendingReview(property)
              const statusLabel = PROPERTY_STATUS_LABELS[property.status] || property.status
              const locationText =
                [property.neighborhood, property.city].filter(Boolean).join(', ') ||
                'Localização não informada'

              return (
                <div
                  key={property.id}
                  onClick={() => navigate(`/imoveis/${property.id}`)}
                  className="p-3 flex items-center gap-3 min-h-[72px] hover:bg-muted/40 cursor-pointer active:bg-muted/60 transition-colors"
                >
                  {/* Miniatura 56px (8px raio) */}
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-muted flex items-center justify-center border border-border shrink-0">
                    {coverPhoto ? (
                      <img
                        src={getPhotoFileUrl(coverPhoto, '100x100')}
                        alt={property.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : condoCoverPhoto ? (
                      <>
                        <img
                          src={getCondoPhotoUrl(condoCoverPhoto, '100x100')}
                          alt={property.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute bottom-0 inset-x-0 bg-background/90 text-[8px] text-center text-muted-foreground py-0.2 border-t border-border/50 truncate leading-tight">
                          do condomínio
                        </div>
                      </>
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                    )}
                  </div>

                  {/* Informações centrais e preço em tabular */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="dado text-muted-foreground text-[11px] shrink-0 pt-0.5">
                        {property.code}
                      </span>
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        {property.source === 'importacao' && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 bg-muted/60 text-foreground border-border shrink-0"
                          >
                            Importado
                          </Badge>
                        )}
                        {(() => {
                          const hl = (property as any).highlight_level || 'comum'
                          const untilStr = (property as any).highlight_until
                          if (hl === 'destaque' || hl === 'super_destaque') {
                            const isExpired =
                              untilStr &&
                              !isNaN(new Date(untilStr.replace(' ', 'T')).getTime()) &&
                              new Date(untilStr.replace(' ', 'T')).getTime() < Date.now()
                            if (isExpired) {
                              const d = new Date(untilStr.replace(' ', 'T'))
                              const dd = String(d.getUTCDate()).padStart(2, '0')
                              const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
                              return (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1 py-0 text-muted-foreground border-border"
                                >
                                  Comum (destaque vencido em {dd}/{mm})
                                </Badge>
                              )
                            }
                            return (
                              <Badge
                                variant={hl === 'super_destaque' ? 'default' : 'secondary'}
                                className={`text-[9px] px-1 py-0 ${
                                  hl === 'super_destaque'
                                    ? 'bg-primary text-primary-foreground border-primary font-medium'
                                    : 'border-border text-foreground'
                                }`}
                              >
                                {hl === 'super_destaque' ? 'Super-destaque' : 'Destaque'}
                              </Badge>
                            )
                          }
                          return null
                        })()}
                        {isOutdated && (
                          <Badge variant="attention" className="text-[9px] px-1 py-0">
                            Desatualizado
                          </Badge>
                        )}
                        <Badge
                          variant={getPropertyBadgeVariant(property.status)}
                          className="text-[9px] px-1 py-0"
                        >
                          {statusLabel}
                        </Badge>
                      </div>
                    </div>

                    <span className="font-normal text-xs text-foreground line-clamp-1 mt-0.5">
                      {property.title ||
                        `${PROPERTY_TYPE_LABELS[property.property_type] || property.property_type} · ${property.neighborhood || 'Sem bairro'} · ${property.code}`}
                    </span>

                    <span className="text-[11px] text-muted-foreground truncate block">
                      {PROPERTY_TYPE_LABELS[property.property_type] || property.property_type}
                      {formatRoomsText(property.bedrooms, property.suites) &&
                        ` · ${formatRoomsText(property.bedrooms, property.suites)}`}
                      {formatParkingText(property.parking) &&
                        ` · ${formatParkingText(property.parking)}`}
                    </span>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                      <span className="truncate max-w-[150px]">{locationText}</span>
                      <span className="dado text-foreground font-normal shrink-0">
                        {formatPropertyPrice(property)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Paginação em pílulas com a página atual em texto de apoio */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground tabular">
              Página {currentPage} de {totalPages} ({totalItems} imóveis)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || loading}
                className="h-9 rounded-full px-4 text-xs font-normal border-border gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Anterior</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || loading}
                className="h-9 rounded-full px-4 text-xs font-normal border-border gap-1"
              >
                <span>Próxima</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
