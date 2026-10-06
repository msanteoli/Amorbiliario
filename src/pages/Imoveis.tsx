import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import { useAuth } from '@/contexts/AuthContext'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

// Estilos de badge para cada status
const STATUS_BADGE_VARIANTS: Record<PropertyStatus, { label: string; className: string }> = {
  rascunho: {
    label: PROPERTY_STATUS_LABELS.rascunho,
    className: 'bg-muted text-muted-foreground border-border',
  },
  disponivel: {
    label: PROPERTY_STATUS_LABELS.disponivel,
    className:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  },
  reservado: {
    label: PROPERTY_STATUS_LABELS.reservado,
    className:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
  vendido: {
    label: PROPERTY_STATUS_LABELS.vendido,
    className:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  },
  alugado: {
    label: PROPERTY_STATUS_LABELS.alugado,
    className:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
  },
  inativo: {
    label: PROPERTY_STATUS_LABELS.inativo,
    className:
      'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
  },
}

export default function Imoveis() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Permissão do botão Novo Imóvel: somente admin ou corretor
  const canCreateProperty = user?.role === 'admin' || user?.role === 'corretor'

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
  const [minPriceInput, setMinPriceInput] = useState<string>('')
  const [maxPriceInput, setMaxPriceInput] = useState<string>('')

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
    const minP = minPriceInput ? Number(minPriceInput) : undefined
    const maxP = maxPriceInput ? Number(maxPriceInput) : undefined

    listProperties({
      page: currentPage,
      perPage: 10,
      search: debouncedSearch,
      propertyType: selectedType || undefined,
      purpose: selectedPurpose || undefined,
      status: selectedStatus || undefined,
      minBedrooms: Number.isNaN(minBed) ? undefined : minBed,
      minPrice: Number.isNaN(minP) ? undefined : minP,
      maxPrice: Number.isNaN(maxP) ? undefined : maxP,
      pendingReviewOnly: activeTab === 'pendentes',
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
    minPriceInput,
    maxPriceInput,
    activeTab,
  ])

  const handleClearFilters = () => {
    setSearchInput('')
    setSelectedType('')
    setSelectedPurpose('')
    setSelectedStatus('')
    setMinBedroomsInput('')
    setMinPriceInput('')
    setMaxPriceInput('')
    setCurrentPage(1)
  }

  const hasActiveFilters = Boolean(
    searchInput ||
    selectedType ||
    selectedPurpose ||
    selectedStatus ||
    minBedroomsInput ||
    minPriceInput ||
    maxPriceInput,
  )

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Imóveis</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie o catálogo de imóveis, valores e situação da sua imobiliária.
          </p>
        </div>
        {canCreateProperty && (
          <Button onClick={() => navigate('/imoveis/novo')} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            <span>Novo imóvel</span>
          </Button>
        )}
      </div>

      {/* Abas no topo: Todos e Pendentes de revisão */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val as 'todos' | 'pendentes')
          setCurrentPage(1)
        }}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-flex">
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="pendentes" className="gap-2">
            <span>Pendentes de revisão</span>
            {activeTab === 'pendentes' && (
              <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                {totalItems}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filtros e Busca */}
      <Card className="border-border">
        <CardContent className="p-4 space-y-3">
          {/* Linha 1: Busca por código, título ou bairro */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, título ou bairro..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Linha 2: Filtros de tipo, finalidade, situação, quartos e faixa de preço */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
            {/* Tipo */}
            <Select
              value={selectedType || 'todos'}
              onValueChange={(val) => {
                setSelectedType(val === 'todos' ? '' : (val as PropertyType))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-full">
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
              <SelectTrigger className="w-full">
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
              <SelectTrigger className="w-full">
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

            {/* Quartos (mínimo) */}
            <Select
              value={minBedroomsInput || 'todos'}
              onValueChange={(val) => {
                setMinBedroomsInput(val === 'todos' ? '' : val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Quartos (mín.)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Quartos (qualquer)</SelectItem>
                <SelectItem value="1">1+ quarto</SelectItem>
                <SelectItem value="2">2+ quartos</SelectItem>
                <SelectItem value="3">3+ quartos</SelectItem>
                <SelectItem value="4">4+ quartos</SelectItem>
              </SelectContent>
            </Select>

            {/* Preço Mínimo */}
            <Input
              type="number"
              min="0"
              placeholder="Preço mín. (R$)"
              value={minPriceInput}
              onChange={(e) => {
                setMinPriceInput(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full"
            />

            {/* Preço Máximo */}
            <Input
              type="number"
              min="0"
              placeholder="Preço máx. (R$)"
              value={maxPriceInput}
              onChange={(e) => {
                setMaxPriceInput(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full"
            />
          </div>

          {/* Botão Limpar Filtros quando há filtros aplicados */}
          {hasActiveFilters && (
            <div className="flex justify-end pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="gap-1.5 text-xs h-8"
              >
                <FilterX className="h-3.5 w-3.5" />
                <span>Limpar filtros</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Erro de carregamento */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Conteúdo: Desktop Tabela + Mobile Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Carregando imóveis...</p>
        </div>
      ) : properties.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Home className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <h3 className="text-base font-semibold">Nenhum imóvel encontrado</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
              {activeTab === 'pendentes'
                ? 'Nenhum imóvel pendente de revisão encontrado.'
                : hasActiveFilters
                  ? 'Nenhum resultado corresponde aos filtros aplicados. Tente ajustar os termos de busca.'
                  : 'Nenhum imóvel cadastrado no momento.'}
            </p>
            {hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                Limpar filtros
              </Button>
            ) : canCreateProperty ? (
              <Button onClick={() => navigate('/imoveis/novo')} size="sm">
                Cadastrar primeiro imóvel
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Versão Desktop: Tabela */}
          <div className="hidden lg:block rounded-md border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[84px]">Foto</TableHead>
                  <TableHead className="w-[120px]">Código</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead className="text-center">Quartos</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Captador</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.map((property) => {
                  const coverPhoto = getFirstActivePhoto(property)
                  const isOutdated = isPropertyPendingReview(property)
                  const statusInfo = STATUS_BADGE_VARIANTS[property.status] || {
                    label: property.status,
                    className: 'bg-muted text-muted-foreground',
                  }
                  const captadorName =
                    property.expand?.captured_by?.name ||
                    property.expand?.captured_by?.email ||
                    'Não informado'
                  const locationText =
                    [property.neighborhood, property.city].filter(Boolean).join(', ') || '-'

                  return (
                    <TableRow
                      key={property.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/imoveis/${property.id}`)}
                    >
                      {/* Foto */}
                      <TableCell className="p-2">
                        <div className="w-14 h-14 rounded-md overflow-hidden bg-muted flex items-center justify-center border shrink-0">
                          {coverPhoto ? (
                            <img
                              src={getPhotoFileUrl(coverPhoto, '100x100')}
                              alt={property.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                          )}
                        </div>
                      </TableCell>

                      {/* Código */}
                      <TableCell className="font-mono text-xs font-semibold text-muted-foreground">
                        {property.code}
                      </TableCell>

                      {/* Título e alertas */}
                      <TableCell>
                        <div className="space-y-1">
                          <Link
                            to={`/imoveis/${property.id}`}
                            className="font-medium text-foreground hover:text-primary hover:underline line-clamp-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {property.title}
                          </Link>
                          {isOutdated && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 h-4 bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700 gap-1 inline-flex items-center"
                            >
                              <Clock className="h-2.5 w-2.5" />
                              <span>Desatualizado</span>
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Tipo */}
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {PROPERTY_TYPE_LABELS[property.property_type] || property.property_type}
                      </TableCell>

                      {/* Localização (apenas Bairro e Cidade - nunca rua/número) */}
                      <TableCell className="text-sm text-muted-foreground">
                        {locationText}
                      </TableCell>

                      {/* Quartos */}
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {property.bedrooms !== undefined &&
                        property.bedrooms !== null &&
                        property.bedrooms > 0
                          ? property.bedrooms
                          : '-'}
                      </TableCell>

                      {/* Preço formatado */}
                      <TableCell className="text-sm font-medium text-foreground whitespace-nowrap">
                        {formatPropertyPrice(property)}
                      </TableCell>

                      {/* Situação */}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs font-medium border ${statusInfo.className}`}
                        >
                          {statusInfo.label}
                        </Badge>
                      </TableCell>

                      {/* Captador */}
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {captadorName}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Versão Mobile/Tablet: Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-3">
            {properties.map((property) => {
              const coverPhoto = getFirstActivePhoto(property)
              const isOutdated = isPropertyPendingReview(property)
              const statusInfo = STATUS_BADGE_VARIANTS[property.status] || {
                label: property.status,
                className: 'bg-muted text-muted-foreground',
              }
              const captadorName =
                property.expand?.captured_by?.name ||
                property.expand?.captured_by?.email ||
                'Não informado'
              const locationText =
                [property.neighborhood, property.city].filter(Boolean).join(', ') ||
                'Localização não informada'

              return (
                <Card
                  key={property.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
                  onClick={() => navigate(`/imoveis/${property.id}`)}
                >
                  <div className="flex flex-row p-3 gap-3">
                    {/* Imagem de Capa */}
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-md overflow-hidden bg-muted flex items-center justify-center border shrink-0">
                      {coverPhoto ? (
                        <img
                          src={getPhotoFileUrl(coverPhoto, '150x150')}
                          alt={property.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                      )}
                    </div>

                    {/* Informações */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                          <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                            {property.code}
                          </span>
                          <div className="flex items-center gap-1">
                            {isOutdated && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-4 bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
                              >
                                Desatualizado
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 h-4 border ${statusInfo.className}`}
                            >
                              {statusInfo.label}
                            </Badge>
                          </div>
                        </div>

                        <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                          {property.title}
                        </h3>

                        <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{locationText}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border/50 mt-2 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {PROPERTY_TYPE_LABELS[property.property_type] || property.property_type}
                          </span>
                          {property.bedrooms !== undefined &&
                            property.bedrooms !== null &&
                            property.bedrooms > 0 && (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Bed className="h-3 w-3" />
                                {property.bedrooms} {property.bedrooms === 1 ? 'quarto' : 'quartos'}
                              </span>
                            )}
                        </div>

                        <div className="text-xs font-semibold text-primary truncate">
                          {formatPropertyPrice(property)}
                        </div>

                        <div className="text-[11px] text-muted-foreground truncate">
                          Captador: {captadorName}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Paginação de 10 por página */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <span className="text-xs text-muted-foreground order-2 sm:order-1">
              Mostrando {properties.length} de {totalItems} imóvel{totalItems === 1 ? '' : 'is'}
            </span>
            <div className="flex items-center gap-2 order-1 sm:order-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || loading}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Anterior</span>
              </Button>
              <span className="text-xs font-medium px-2">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || loading}
                className="gap-1"
              >
                <span>Próxima</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
