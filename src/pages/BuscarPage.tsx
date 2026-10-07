import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  getFilters,
  searchProperties,
  PublicFiltersResponse,
  PublicPropertyListItem,
} from '@/services/publicSite'
import { PUBLIC_PROPERTY_TYPE_LABELS, formatCurrencyBR } from '@/lib/publicSiteUtils'
import { setFilters as saveFiltersToMemory } from '@/lib/searchMemory'
import { initCampaignFromUrl } from '@/lib/campaign'
import { initMarketingScripts } from '@/lib/marketing'
import { PublicLayout } from '@/components/public/PublicLayout'
import { PropertyCard } from '@/components/public/PropertyCard'
import { SearchFilterBar, FilterValues } from '@/components/public/SearchFilterBar'
import { CategoryBar } from '@/components/public/CategoryBar'
import { PublicContactModal } from '@/components/public/PublicContactModal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, RotateCcw, X, MessageSquare } from 'lucide-react'

export const BuscarPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  // Filtros dinâmicos obtidos de /public/filters
  const [filterMeta, setFilterMeta] = useState<PublicFiltersResponse | null>(null)
  const [metaError, setMetaError] = useState<string | null>(null)

  // Lista de imóveis e paginação
  const [items, setItems] = useState<PublicPropertyListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Modal de contato para estado vazio
  const [emptyContactOpen, setEmptyContactOpen] = useState(false)

  // Lê parâmetros da URL
  const getFilterValuesFromUrl = useCallback((): FilterValues => {
    const p = searchParams.get('purpose')
    const purpose: 'venda' | 'locacao' = p === 'locacao' ? 'locacao' : 'venda'
    const type = searchParams.get('type') || ''
    const neighborhood = searchParams.get('neighborhood') || ''
    const bedrooms = searchParams.get('bedrooms') || ''
    const parking = searchParams.get('parking') || ''
    const min_price = searchParams.get('min_price') || ''
    const max_price = searchParams.get('max_price') || ''
    const s = searchParams.get('sort')
    const sort: 'recent' | 'price_asc' | 'price_desc' =
      s === 'price_asc' || s === 'price_desc' ? s : 'recent'

    return {
      purpose,
      type,
      neighborhood,
      bedrooms,
      parking,
      min_price,
      max_price,
      sort,
    }
  }, [searchParams])

  const [currentFilters, setCurrentFilters] = useState<FilterValues>(getFilterValuesFromUrl)

  // Guarda campanha e inicializa scripts na primeira carga
  useEffect(() => {
    initCampaignFromUrl()
    initMarketingScripts()
  }, [])

  // Carrega opções de filtros
  useEffect(() => {
    let mounted = true
    getFilters()
      .then((data) => {
        if (mounted) {
          setFilterMeta(data)
        }
      })
      .catch((err) => {
        if (mounted) {
          setMetaError(err.message || 'Erro ao carregar opções.')
        }
      })
    return () => {
      mounted = false
    }
  }, [])

  // Quando o searchParams mudar (ex: back/forward do navegador), sincroniza currentFilters
  useEffect(() => {
    setCurrentFilters(getFilterValuesFromUrl())
  }, [getFilterValuesFromUrl])

  // Executa busca sempre que currentFilters mudar (reinicia página 1)
  useEffect(() => {
    let active = true
    setLoading(true)
    setSearchError(null)

    // Atualiza memória de busca
    saveFiltersToMemory({
      neighborhood: currentFilters.neighborhood || undefined,
      type: currentFilters.type || undefined,
      purpose: currentFilters.purpose,
      bedrooms: currentFilters.bedrooms ? Number(currentFilters.bedrooms) : undefined,
      max_price: currentFilters.max_price ? Number(currentFilters.max_price) : undefined,
    })

    searchProperties({
      purpose: currentFilters.purpose,
      type: currentFilters.type || undefined,
      neighborhood: currentFilters.neighborhood || undefined,
      bedrooms: currentFilters.bedrooms || undefined,
      parking: currentFilters.parking || undefined,
      min_price: currentFilters.min_price || undefined,
      max_price: currentFilters.max_price || undefined,
      sort: currentFilters.sort,
      page: 1,
      per_page: 12,
    })
      .then((res) => {
        if (!active) return
        setItems(res.items)
        setTotal(res.total)
        setPage(res.page)
        setTotalPages(res.total_pages)
      })
      .catch((err) => {
        if (!active) return
        setSearchError(err.message || 'Erro ao buscar imóveis.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [currentFilters])

  // Handler para atualizar filtros e sincronizar com URL
  const handleFiltersChange = (newValues: FilterValues) => {
    const params = new URLSearchParams()
    params.set('purpose', newValues.purpose)
    if (newValues.type) params.set('type', newValues.type)
    if (newValues.neighborhood) params.set('neighborhood', newValues.neighborhood)
    if (newValues.bedrooms) params.set('bedrooms', newValues.bedrooms)
    if (newValues.parking) params.set('parking', newValues.parking)
    if (newValues.min_price) params.set('min_price', newValues.min_price)
    if (newValues.max_price) params.set('max_price', newValues.max_price)
    if (newValues.sort && newValues.sort !== 'recent') params.set('sort', newValues.sort)

    setSearchParams(params, { replace: true })
    setCurrentFilters(newValues)
  }

  // Limpa todos os filtros mantendo apenas a finalidade Comprar (padrão)
  const handleClearFilters = () => {
    const cleared: FilterValues = {
      purpose: 'venda',
      type: '',
      neighborhood: '',
      bedrooms: '',
      parking: '',
      min_price: '',
      max_price: '',
      sort: 'recent',
    }
    const params = new URLSearchParams()
    params.set('purpose', 'venda')
    setSearchParams(params, { replace: true })
    setCurrentFilters(cleared)
  }

  // Remove um filtro específico a partir de sua chip
  const handleRemoveSingleFilter = (key: keyof FilterValues) => {
    const updated = { ...currentFilters }
    if (key === 'purpose') {
      updated.purpose = 'venda'
    } else if (key === 'sort') {
      updated.sort = 'recent'
    } else {
      updated[key] = ''
    }
    handleFiltersChange(updated)
  }

  // Carrega mais imóveis (paginação)
  const handleLoadMore = async () => {
    if (loadingMore || page >= totalPages) return
    setLoadingMore(true)

    const nextPage = page + 1
    try {
      const res = await searchProperties({
        purpose: currentFilters.purpose,
        type: currentFilters.type || undefined,
        neighborhood: currentFilters.neighborhood || undefined,
        bedrooms: currentFilters.bedrooms || undefined,
        parking: currentFilters.parking || undefined,
        min_price: currentFilters.min_price || undefined,
        max_price: currentFilters.max_price || undefined,
        sort: currentFilters.sort,
        page: nextPage,
        per_page: 12,
      })

      setItems((prev) => [...prev, ...res.items])
      setPage(res.page)
      setTotalPages(res.total_pages)
      setTotal(res.total)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar mais imóveis.'
      setSearchError(msg)
    } finally {
      setLoadingMore(false)
    }
  }

  // Gera a lista de chips de filtros ativos
  interface ActiveChip {
    id: keyof FilterValues
    label: string
  }
  const activeChips: ActiveChip[] = []
  if (currentFilters.type) {
    activeChips.push({
      id: 'type',
      label: PUBLIC_PROPERTY_TYPE_LABELS[currentFilters.type] || currentFilters.type,
    })
  }
  if (currentFilters.neighborhood) {
    activeChips.push({
      id: 'neighborhood',
      label: currentFilters.neighborhood,
    })
  }
  if (currentFilters.bedrooms) {
    activeChips.push({
      id: 'bedrooms',
      label: `${currentFilters.bedrooms}+ quartos`,
    })
  }
  if (currentFilters.parking) {
    activeChips.push({
      id: 'parking',
      label: `${currentFilters.parking}+ vagas`,
    })
  }
  if (currentFilters.min_price) {
    activeChips.push({
      id: 'min_price',
      label: `Mín: R$ ${Number(currentFilters.min_price).toLocaleString('pt-BR')}`,
    })
  }
  if (currentFilters.max_price) {
    activeChips.push({
      id: 'max_price',
      label: `Máx: R$ ${Number(currentFilters.max_price).toLocaleString('pt-BR')}`,
    })
  }
  if (currentFilters.sort !== 'recent') {
    activeChips.push({
      id: 'sort',
      label: currentFilters.sort === 'price_asc' ? 'Menor preço' : 'Maior preço',
    })
  }

  const orgName = filterMeta?.organization?.name || 'Imobdigital'

  const searchFilterBarComponent = (
    <SearchFilterBar
      values={currentFilters}
      neighborhoods={filterMeta?.neighborhoods || []}
      types={filterMeta?.types || []}
      onChange={handleFiltersChange}
      onClear={handleClearFilters}
    />
  )

  return (
    <PublicLayout
      orgName={orgName}
      showContactButton={true}
      headerCenterSlot={searchFilterBarComponent}
      mobileSubHeaderSlot={searchFilterBarComponent}
    >
      {/* Faixa de Categorias (logo abaixo do cabeçalho) */}
      <CategoryBar
        types={filterMeta?.types || []}
        selectedType={currentFilters.type}
        onSelectType={(newType) => {
          handleFiltersChange({ ...currentFilters, type: newType })
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Abaixo do cabeçalho: os filtros ativos aparecem como pílulas de contorno removíveis ('x' com 44 px de toque) */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-medium text-muted-foreground mr-1">Filtros ativos:</span>
            {activeChips.map((chip) => (
              <span
                key={chip.id}
                className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full text-xs font-medium border border-border bg-card text-foreground shadow-sm"
              >
                <span>{chip.label}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSingleFilter(chip.id)}
                  aria-label={`Remover filtro ${chip.label}`}
                  className="inline-flex items-center justify-center w-7 h-7 sm:w-6 sm:h-6 min-w-[44px] min-h-[44px] sm:min-w-[28px] sm:min-h-[28px] rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-4 ml-2 min-h-[44px] inline-flex items-center px-1"
            >
              Limpar todos
            </button>
          </div>
        )}

        {/* Contagem ("12 imóveis") em texto de apoio */}
        {!loading && !searchError && items.length > 0 && (
          <div className="pt-2">
            <p className="text-sm text-muted-foreground">
              {total === 1 ? '1 imóvel' : `${total} imóveis`}
            </p>
          </div>
        )}

        {/* Mensagem de Erro: mensagem do servidor e "Tentar novamente" */}
        {searchError && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-[8px] text-destructive text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{searchError}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFiltersChange(currentFilters)}
              className="rounded-[8px] shrink-0 min-h-[44px]"
            >
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Grade de Resultados ou Esqueleto de Carregamento imitador */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3 p-2">
                <Skeleton className="aspect-[4/3] w-full rounded-[12px]" />
                <div className="space-y-2 pt-1">
                  <Skeleton className="h-5 w-3/4 rounded-[8px]" />
                  <Skeleton className="h-4 w-1/2 rounded-[8px]" />
                  <Skeleton className="h-4 w-2/3 rounded-[8px]" />
                  <Skeleton className="h-5 w-1/3 rounded-[8px] mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length > 0 ? (
          <div className="space-y-10">
            {/* Grade de 1 coluna no celular, 2 em 768 px (md), 3 em 1024 px (lg) e 4 em 1280 px (xl), espaçamento 24 px (gap-6) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {items.map((item) => (
                <PropertyCard key={item.code} property={item} />
              ))}
            </div>

            {/* "Mostrar mais" como pílula de contorno centralizada */}
            {page < totalPages && (
              <div className="flex justify-center pt-6 pb-4">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="rounded-full px-8 py-3 text-sm font-medium border-border hover:bg-muted text-foreground min-h-[44px] transition-all"
                >
                  {loadingMore ? 'Carregando mais imóveis...' : 'Mostrar mais'}
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Estado vazio: "Nenhum imóvel com esses filtros." com a linha "Remova um filtro ou fale com a imobiliária." e as pílulas "Limpar filtros" e "Falar com a imobiliária" */
          <div className="py-20 text-center space-y-4 max-w-md mx-auto">
            <h3 className="text-xl font-semibold text-foreground tracking-tight">
              Nenhum imóvel com esses filtros.
            </h3>
            <p className="text-sm text-muted-foreground">
              Remova um filtro ou fale com a imobiliária.
            </p>
            <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="outline"
                onClick={handleClearFilters}
                className="rounded-full px-5 py-2.5 text-sm font-medium border-border min-h-[44px]"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Limpar filtros
              </Button>
              <Button
                variant="outline"
                onClick={() => setEmptyContactOpen(true)}
                className="rounded-full px-5 py-2.5 text-sm font-medium border-border min-h-[44px]"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Falar com a imobiliária
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de contato acionado pelo estado vazio */}
      <PublicContactModal open={emptyContactOpen} onOpenChange={setEmptyContactOpen} />
    </PublicLayout>
  )
}
export default BuscarPage
