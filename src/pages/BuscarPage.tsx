import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import {
  getFilters,
  searchProperties,
  PublicFiltersResponse,
  PublicPropertyListItem,
} from '@/services/publicSite'
import { PUBLIC_PROPERTY_TYPE_LABELS } from '@/lib/publicSiteUtils'
import { setFilters as saveFiltersToMemory } from '@/lib/searchMemory'
import { initCampaignFromUrl } from '@/lib/campaign'
import { initMarketingScripts } from '@/lib/marketing'
import { useAuth } from '@/contexts/AuthContext'
import { PublicLayout } from '@/components/public/PublicLayout'
import { PropertyCard } from '@/components/public/PropertyCard'
import { HeroSearchCard } from '@/components/public/HeroSearchCard'
import { FeaturedSlider } from '@/components/public/FeaturedSlider'
import { CompactSearchBar } from '@/components/public/CompactSearchBar'
import { Enter } from '@/components/public/Enter'
import { SearchFilterBar, FilterValues } from '@/components/public/SearchFilterBar'
import { CategoryBar } from '@/components/public/CategoryBar'
import { PublicContactModal } from '@/components/public/PublicContactModal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, RotateCcw, X, MessageSquare } from 'lucide-react'

export const BuscarPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  // Se o usuário está em "/" e autenticado, redireciona para "/hoje"
  useEffect(() => {
    if (location.pathname === '/' && !authLoading && isAuthenticated) {
      navigate('/hoje', { replace: true })
    }
  }, [location.pathname, authLoading, isAuthenticated, navigate])

  // Filtros dinâmicos obtidos de /public/filters
  const [filterMeta, setFilterMeta] = useState<PublicFiltersResponse | null>(null)
  const [metaError, setMetaError] = useState<string | null>(null)

  // Imóveis em destaque para o slide do hero (searchProperties sort 'recent', per_page 8, até 5 com capa)
  const [featuredProperties, setFeaturedProperties] = useState<PublicPropertyListItem[]>([])
  const [featuredLoading, setFeaturedLoading] = useState(true)

  // Lista de imóveis e paginação da grade
  const [items, setItems] = useState<PublicPropertyListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Modais de contato e filtros completos
  const [contactOpen, setContactOpen] = useState(false)
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)

  // Controle da barra compacta ao rolar para baixo com busca ativa
  const [showCompactBar, setShowCompactBar] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

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

  // Atualiza título da página
  const orgName = filterMeta?.organization?.name || 'Imobdigital'
  useEffect(() => {
    const prevTitle = document.title
    document.title = `Imóveis para comprar e alugar | ${orgName}`
    return () => {
      document.title = prevTitle
    }
  }, [orgName])

  // Campanha e scripts
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

  // Carrega destaques do slider: searchProperties sort 'recent', per_page 8, até 5 com capa
  useEffect(() => {
    let mounted = true
    setFeaturedLoading(true)
    searchProperties({
      sort: 'recent',
      per_page: 8,
    })
      .then((res) => {
        if (!mounted) return
        const withCover = res.items.filter((p) => Boolean(p.cover)).slice(0, 5)
        setFeaturedProperties(withCover)
      })
      .catch(() => {
        // slider vazio é tratado escondendo o slide e centralizando a busca
      })
      .finally(() => {
        if (mounted) setFeaturedLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  // Sincroniza currentFilters com a URL
  useEffect(() => {
    setCurrentFilters(getFilterValuesFromUrl())
  }, [getFilterValuesFromUrl])

  // Busca imóveis na grade
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

  // Verifica se há busca ativa (filtros além da finalidade padrão)
  const isSearchActive = Boolean(
    currentFilters.type ||
    currentFilters.neighborhood ||
    currentFilters.bedrooms ||
    currentFilters.parking ||
    currentFilters.min_price ||
    currentFilters.max_price ||
    (currentFilters.sort && currentFilters.sort !== 'recent'),
  )

  // Observa rolagem para exibir barra compacta quando rolar abaixo do hero com busca ativa
  useEffect(() => {
    const handleScroll = () => {
      if (!heroRef.current) return
      const rect = heroRef.current.getBoundingClientRect()
      // Se passou da base do hero e há busca ativa
      if (rect.bottom < 80 && isSearchActive) {
        setShowCompactBar(true)
      } else {
        setShowCompactBar(false)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [isSearchActive])

  // Handler para aplicar novos filtros
  const handleFiltersChange = (newValues: FilterValues, shouldScroll = false) => {
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

    if (shouldScroll) {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches

      // Verifica se a busca é ativa com esses novos valores
      const willBeSearchActive = Boolean(
        newValues.type ||
        newValues.neighborhood ||
        newValues.bedrooms ||
        newValues.parking ||
        newValues.min_price ||
        newValues.max_price ||
        (newValues.sort && newValues.sort !== 'recent'),
      )

      setTimeout(() => {
        if (!resultsRef.current) return

        // Altura do cabeçalho fixo (h-20 = 80px)
        const headerEl = document.querySelector('header')
        const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 80

        // Altura da barra compacta: quando há busca ativa e rola abaixo do hero, ela fica visível
        const compactBarEl = document.getElementById('compact-search-bar')
        const compactBarHeight = willBeSearchActive
          ? compactBarEl
            ? compactBarEl.getBoundingClientRect().height
            : 58
          : 0

        // Margem de rolagem: altura do cabeçalho + a da barra compacta + 16 px (ou só cabeçalho + 16px se sem busca ativa)
        const totalOffset = headerHeight + compactBarHeight + 16

        const elementPosition = resultsRef.current.getBoundingClientRect().top + window.pageYOffset
        const targetScroll = Math.max(0, elementPosition - totalOffset)

        window.scrollTo({
          top: targetScroll,
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
        })
      }, 50)
    }
  }

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

  // Se o visitante acessou / e o auth ainda está carregando, mostra o esqueleto
  if (location.pathname === '/' && authLoading) {
    return (
      <PublicLayout
        orgName={orgName}
        whatsappEnabled={filterMeta?.organization?.whatsapp_enabled}
        showContactButton={true}
      >
        <div className="w-full bg-muted py-8 sm:py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 bg-card rounded-[24px] p-6 sm:p-8 space-y-4">
                <Skeleton className="h-12 w-3/4 rounded-[8px]" />
                <Skeleton className="h-6 w-1/2 rounded-[8px]" />
                <Skeleton className="h-14 w-full rounded-full mt-4" />
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-10 w-24 rounded-full" />
                  <Skeleton className="h-10 w-24 rounded-full" />
                </div>
              </div>
              <div className="lg:col-span-5 hidden lg:block">
                <Skeleton className="aspect-[4/3] w-full rounded-[24px]" />
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[4/3] w-full rounded-[12px]" />
                <Skeleton className="h-5 w-3/4 rounded-[8px]" />
                <Skeleton className="h-4 w-1/2 rounded-[8px]" />
              </div>
            ))}
          </div>
        </div>
      </PublicLayout>
    )
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

  const hasFeatured = featuredProperties.length > 0
  const showTwoColumns = featuredLoading || hasFeatured

  return (
    <PublicLayout
      orgName={orgName}
      whatsappEnabled={filterMeta?.organization?.whatsapp_enabled}
      showContactButton={true}
      onSelectPurpose={(p) => {
        handleFiltersChange({ ...currentFilters, purpose: p }, false)
        const heroEl = document.getElementById('hero-search-card')
        if (heroEl) {
          heroEl.scrollIntoView({ behavior: 'smooth' })
        }
      }}
      onOpenContact={() => setContactOpen(true)}
    >
      {/* 3) ÁREA DE DESTAQUE (HERO): largura total, cerca de 520 px no desktop, fundo muted */}
      <section
        ref={heroRef}
        aria-label="Destaque da página inicial"
        className="w-full bg-muted py-6 sm:py-8 lg:py-12 border-b border-border overflow-hidden"
      >
        <div key={location.pathname} className="max-w-7xl mx-auto px-4 sm:px-6">
          <div
            className={
              showTwoColumns
                ? 'grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center'
                : 'max-w-[720px] mx-auto'
            }
          >
            {/* Cartão de busca: NUNCA desmonta, permanece na mesma posição da árvore */}
            <div className={showTwoColumns ? 'lg:col-span-7 w-full flex items-center' : 'w-full'}>
              <HeroSearchCard
                values={currentFilters}
                neighborhoods={filterMeta?.neighborhoods || []}
                types={filterMeta?.types || []}
                onSearch={(newVals) => handleFiltersChange(newVals, true)}
                onOpenMoreFilters={() => setMoreFiltersOpen(true)}
              />
            </div>

            {/* Slide de destaques (ou esqueleto enquanto carrega) */}
            {showTwoColumns && (
              <div className="lg:col-span-5 w-full flex items-center justify-center">
                {featuredLoading ? (
                  /* Esqueleto reservando a vaga do slide: desktop à direita, celular abaixo do cartão */
                  <div className="w-full">
                    <Skeleton className="aspect-[4/3] max-h-[300px] md:aspect-auto md:h-[360px] md:max-h-none lg:aspect-[4/3] lg:h-auto w-full rounded-[16px] lg:rounded-[24px]" />
                  </div>
                ) : (
                  /* Slide com classe de entrada normal no passo 2 */
                  <Enter step={2} className="w-full">
                    <FeaturedSlider properties={featuredProperties} />
                  </Enter>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Barra de busca compacta fixa logo abaixo do cabeçalho quando rolar com busca ativa (não anima) */}
      {showCompactBar && (
        <CompactSearchBar
          values={currentFilters}
          onAlterarClick={() => {
            const heroEl = document.getElementById('hero-search-card')
            if (heroEl) {
              heroEl.scrollIntoView({ behavior: 'smooth' })
            }
          }}
        />
      )}

      {/* 6) CATEGORIAS E RESULTADOS: faixa de categorias com 44 px de altura. Passo 5 da entrada (no contêiner de fora) */}
      <Enter key={`cat-${location.pathname}`} step={5}>
        <CategoryBar
          types={filterMeta?.types || []}
          selectedType={currentFilters.type}
          onSelectType={(newType) => {
            handleFiltersChange({ ...currentFilters, type: newType }, true)
          }}
        />
      </Enter>

      <div
        ref={resultsRef}
        id="resultados"
        className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6 scroll-mt-[154px] sm:scroll-mt-[154px]"
      >
        {/* Título "Imóveis disponíveis" (peso 600) com contagem em texto de apoio */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 pb-1">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
              Imóveis disponíveis
            </h2>
            {!loading && !searchError && (
              <p className="text-sm text-muted-foreground">
                {total === 1 ? '1 imóvel disponível' : `${total} imóveis disponíveis`}
              </p>
            )}
          </div>
        </div>

        {/* Filtros ativos como pílulas removíveis (o "x" com 44 px de toque) */}
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
                  className="inline-flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-4 ml-2 min-h-[44px] inline-flex items-center px-2"
            >
              Limpar todos
            </button>
          </div>
        )}

        {/* Mensagem de Erro */}
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

        {/* Grade de Resultados ou Esqueleto de Carregamento */}
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

            {/* "Mostrar mais" */}
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
          /* Estado vazio */
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
                onClick={() => setContactOpen(true)}
                className="rounded-full px-5 py-2.5 text-sm font-medium border-border min-h-[44px]"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Falar com a imobiliária
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Painel Completo de Filtros (Sheet no celular com rodapé fixo / Dialog no desktop) */}
      <SearchFilterBar
        open={moreFiltersOpen}
        onOpenChange={setMoreFiltersOpen}
        values={currentFilters}
        neighborhoods={filterMeta?.neighborhoods || []}
        types={filterMeta?.types || []}
        onChange={(newVals) => handleFiltersChange(newVals, true)}
        onClear={handleClearFilters}
      />

      {/* Modal de contato */}
      <PublicContactModal open={contactOpen} onOpenChange={setContactOpen} />
    </PublicLayout>
  )
}

export default BuscarPage
