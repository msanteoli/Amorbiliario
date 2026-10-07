import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  getFilters,
  searchProperties,
  PublicFiltersResponse,
  PublicPropertyListItem,
} from '@/services/publicSite'
import { setFilters as saveFiltersToMemory } from '@/lib/searchMemory'
import { initCampaignFromUrl } from '@/lib/campaign'
import { initMarketingScripts } from '@/lib/marketing'
import { PublicLayout } from '@/components/public/PublicLayout'
import { PropertyCard } from '@/components/public/PropertyCard'
import { SearchFilterBar, FilterValues } from '@/components/public/SearchFilterBar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, RotateCcw } from 'lucide-react'

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

  // Guarda de request em voo para evitar concorrência
  const abortControllerRef = useRef<AbortController | null>(null)

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
    // Purpose sempre tem valor padrão 'venda'
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

  const orgName = filterMeta?.organization?.name || 'Imobdigital'

  return (
    <PublicLayout orgName={orgName} showContactButton={true}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Barra de Filtros */}
        <SearchFilterBar
          values={currentFilters}
          neighborhoods={filterMeta?.neighborhoods || []}
          types={filterMeta?.types || []}
          onChange={handleFiltersChange}
          onClear={handleClearFilters}
        />

        {/* Resumo de resultados e contagem */}
        <div className="flex items-center justify-between pt-2">
          {!loading && !searchError && (
            <p className="text-sm sm:text-base font-semibold text-foreground">
              {total === 1 ? '1 imóvel encontrado' : `${total} imóveis encontrados`}
            </p>
          )}
        </div>

        {/* Mensagem de Erro */}
        {searchError && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{searchError}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFiltersChange(currentFilters)}
              className="shrink-0"
            >
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Grade de Resultados ou Esqueletos */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-3 bg-card">
                <Skeleton className="aspect-[4/3] w-full rounded-lg" />
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        ) : items.length > 0 ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item) => (
                <PropertyCard key={item.code} property={item} />
              ))}
            </div>

            {/* Botão Mostrar Mais */}
            {page < totalPages && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-8 font-normal h-12"
                >
                  {loadingMore ? 'Carregando mais imóveis...' : 'Mostrar mais'}
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Estado Vazio */
          <div className="py-16 text-center space-y-4 max-w-md mx-auto">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Nenhum imóvel encontrado com esses filtros.
            </h3>
            <p className="text-sm text-muted-foreground">
              Tente alterar os termos da busca ou remover alguns filtros para encontrar mais opções.
            </p>
            <div className="pt-2">
              <Button variant="outline" onClick={handleClearFilters} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Limpar filtros
              </Button>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  )
}
export default BuscarPage
