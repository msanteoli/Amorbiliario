import React, { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getProperty, getFilters, PublicPropertyDetail } from '@/services/publicSite'
import { addViewed } from '@/lib/searchMemory'
import { initCampaignFromUrl } from '@/lib/campaign'
import { initMarketingScripts, trackWhatsapp } from '@/lib/marketing'
import {
  formatPrice,
  formatCurrencyBR,
  getFullPhotoUrl,
  PUBLIC_PROPERTY_TYPE_LABELS,
} from '@/lib/publicSiteUtils'
import { PublicLayout } from '@/components/public/PublicLayout'
import { PublicContactModal } from '@/components/public/PublicContactModal'
import { PhotoViewerModal } from '@/components/public/PhotoViewerModal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Home,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Bed,
  Bath,
  Car,
  Maximize2,
  Building,
  Receipt,
  MessageCircle,
  Calendar,
  AlertCircle,
  Grid,
} from 'lucide-react'

export const ImovelPublicoPage: React.FC = () => {
  const { codigo } = useParams<{ codigo: string }>()
  const [property, setProperty] = useState<PublicPropertyDetail | null>(null)
  const [orgName, setOrgName] = useState('Imobdigital')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Galeria de fotos
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false)
  const [photoViewerInitialIndex, setPhotoViewerInitialIndex] = useState(0)
  const [mobilePhotoIndex, setMobilePhotoIndex] = useState(0)

  // Modal de contato / agendar visita
  const [contactOpen, setContactOpen] = useState(false)

  // Horários de visita disponíveis
  const [slots, setSlots] = useState<Array<{ start: string; end: string }>>([])
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)

  useEffect(() => {
    initCampaignFromUrl()
    initMarketingScripts()
  }, [])

  // Carrega nome da imobiliária
  useEffect(() => {
    getFilters()
      .then((res) => {
        if (res.organization?.name) {
          setOrgName(res.organization.name)
        }
      })
      .catch(() => {
        // Fallback default
      })
  }, [])

  // Carrega imóvel
  useEffect(() => {
    if (!codigo) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setLoading(true)
    setNotFound(false)
    setErrorMessage(null)

    getProperty(codigo)
      .then((data) => {
        setProperty(data)
        setMobilePhotoIndex(0)
        addViewed(data.code)

        // Busca slots de visita
        const backendUrl = (import.meta.env.VITE_POCKETBASE_URL || '').replace(/\/$/, '')
        setLoadingSlots(true)
        fetch(`${backendUrl}/backend/v1/public/properties/${encodeURIComponent(data.code)}/slots`)
          .then((res) => (res.ok ? res.json() : null))
          .then((slotsData) => {
            if (slotsData && Array.isArray(slotsData.slots)) {
              setSlots(slotsData.slots)
            }
          })
          .catch(() => {
            // slots são opcionais caso dê erro
          })
          .finally(() => {
            setLoadingSlots(false)
          })
      })
      .catch((err: unknown) => {
        const status = (err as { status?: number })?.status
        if (status === 404) {
          setNotFound(true)
        } else {
          const msg = err instanceof Error ? err.message : 'Erro ao carregar imóvel.'
          setErrorMessage(msg)
        }
      })
      .finally(() => {
        setLoadingSlots(false)
        setLoading(false)
      })
  }, [codigo])

  const photos = property?.photos || []

  const openViewer = (idx: number) => {
    setPhotoViewerInitialIndex(idx)
    setPhotoViewerOpen(true)
  }

  const handleWhatsAppClick = () => {
    if (!property) return
    trackWhatsapp(property.code)
    const msg = `Olá! Vi o imóvel ${property.code} no site e gostaria de mais informações.`
    // Abre contato pelo modal se não houver link direto ou abre wa.me padrão
    const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(waUrl, '_blank', 'noopener,noreferrer')
  }

  // Identificador de transição único por imóvel (mesmo do PropertyCard)
  const transitionName = property
    ? `property-hero-${property.code.replace(/[^a-zA-Z0-9_-]/g, '_')}`
    : undefined

  if (loading) {
    return (
      <PublicLayout orgName={orgName} showContactButton={false}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
          <Skeleton className="h-6 w-36 rounded-[8px]" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-[420px]">
            <Skeleton className="h-full w-full rounded-[12px]" />
            <div className="hidden md:grid grid-cols-2 gap-3 h-full">
              <Skeleton className="h-full w-full rounded-[12px]" />
              <Skeleton className="h-full w-full rounded-[12px]" />
              <Skeleton className="h-full w-full rounded-[12px]" />
              <Skeleton className="h-full w-full rounded-[12px]" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 pt-4">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-9 w-3/4 rounded-[8px]" />
              <Skeleton className="h-5 w-1/3 rounded-[8px]" />
              <Skeleton className="h-4 w-1/2 rounded-[8px]" />
              <Skeleton className="h-32 w-full rounded-[8px] mt-6" />
            </div>
            <div className="hidden lg:block">
              <Skeleton className="h-80 w-full rounded-[16px]" />
            </div>
          </div>
        </div>
      </PublicLayout>
    )
  }

  if (notFound) {
    return (
      <PublicLayout orgName={orgName} showContactButton={false}>
        <div className="max-w-md mx-auto px-4 py-24 text-center space-y-5">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <AlertCircle className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground tracking-tight">
              Este imóvel não está mais disponível.
            </h2>
            <p className="text-sm text-muted-foreground">
              Ele pode ter sido vendido, alugado ou retirado de exibição.
            </p>
          </div>
          <div className="pt-2">
            <Button asChild variant="outline" size="lg" className="rounded-full px-6 min-h-[44px]">
              <Link to="/buscar">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Ver outros imóveis
              </Link>
            </Button>
          </div>
        </div>
      </PublicLayout>
    )
  }

  if (errorMessage || !property) {
    return (
      <PublicLayout orgName={orgName} showContactButton={false}>
        <div className="max-w-md mx-auto px-4 py-24 text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Erro ao carregar imóvel</h2>
          <p className="text-sm text-muted-foreground">
            {errorMessage || 'Não foi possível exibir os detalhes.'}
          </p>
          <Button asChild variant="outline" className="rounded-[8px] min-h-[44px]">
            <Link to="/buscar">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para busca
            </Link>
          </Button>
        </div>
      </PublicLayout>
    )
  }

  const typeLabel = PUBLIC_PROPERTY_TYPE_LABELS[property.type] || property.type
  const salePriceStr = property.sale ? formatPrice(property.sale, 'sale') : null
  const rentPriceStr = property.rent ? formatPrice(property.rent, 'rent') : null

  // Dados formatados para linha separada por pontos
  const specsItems: string[] = []
  if (property.bedrooms > 0) {
    specsItems.push(`${property.bedrooms} ${property.bedrooms === 1 ? 'quarto' : 'quartos'}`)
  }
  if (property.bathrooms > 0) {
    specsItems.push(`${property.bathrooms} ${property.bathrooms === 1 ? 'banheiro' : 'banheiros'}`)
  }
  if (property.parking > 0) {
    specsItems.push(`${property.parking} ${property.parking === 1 ? 'vaga' : 'vagas'}`)
  }
  if (property.area > 0) {
    specsItems.push(`${property.area} m²`)
  }

  // Formata slot para pílula
  const formatSlotLabel = (isoStart: string) => {
    try {
      const d = new Date(isoStart)
      const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
      const diaSemana = dias[d.getDay()]
      const dia = String(d.getDate()).padStart(2, '0')
      const mes = String(d.getMonth() + 1).padStart(2, '0')
      const hora = String(d.getHours()).padStart(2, '0')
      const min = String(d.getMinutes()).padStart(2, '0')
      return `${diaSemana}, ${dia}/${mes} às ${hora}h${min !== '00' ? min : ''}`
    } catch {
      return isoStart
    }
  }

  return (
    <PublicLayout orgName={orgName} showContactButton={true}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6 pb-28 md:pb-16">
        {/* Navegação de volta e código */}
        <div className="flex items-center justify-between">
          <Link
            to="/buscar"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar para a busca</span>
          </Link>
          <span className="text-xs font-mono font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            Cód. {property.code}
          </span>
        </div>

        {/* Mosaico de fotos: no desktop, uma foto grande à esquerda (metade da largura) e quatro menores à direita em grade 2x2, raio 12 px nos cantos externos, com a pílula "Ver todas as fotos" no canto da grade. No celular, uma foto grande com contador "1 / N" e deslizar para as outras. */}
        {photos.length > 0 ? (
          <div>
            {/* Desktop: Mosaico 1 grande + 4 menores em grade 2x2 */}
            <div className="hidden md:relative md:grid md:grid-cols-2 gap-2.5 h-[420px] lg:h-[480px] rounded-[12px] overflow-hidden select-none">
              {/* Foto Principal à esquerda */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => openViewer(0)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openViewer(0)
                  }
                }}
                className="relative h-full w-full cursor-pointer overflow-hidden bg-muted group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <img
                  src={getFullPhotoUrl(photos[0]) || ''}
                  alt={property.title}
                  style={transitionName ? { viewTransitionName: transitionName } : undefined}
                  className="h-full w-full object-cover group-hover:opacity-95 transition-opacity"
                />
              </div>

              {/* 4 Fotos menores à direita em grade 2x2 */}
              <div className="grid grid-cols-2 grid-rows-2 gap-2.5 h-full">
                {Array.from({ length: 4 }).map((_, i) => {
                  const photoIdx = i + 1
                  const photoItem = photos[photoIdx]
                  if (!photoItem) {
                    return (
                      <div
                        key={i}
                        className="h-full w-full bg-muted/60 flex items-center justify-center text-muted-foreground/40"
                      >
                        <Home className="h-8 w-8 stroke-[1.5]" />
                      </div>
                    )
                  }
                  return (
                    <div
                      key={i}
                      role="button"
                      tabIndex={0}
                      onClick={() => openViewer(photoIdx)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openViewer(photoIdx)
                        }
                      }}
                      className="relative h-full w-full cursor-pointer overflow-hidden bg-muted group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <img
                        src={getFullPhotoUrl(photoItem) || ''}
                        alt={`${property.title} - Foto ${photoIdx + 1}`}
                        className="h-full w-full object-cover group-hover:opacity-95 transition-opacity"
                      />
                    </div>
                  )
                })}
              </div>

              {/* Pílula "Ver todas as fotos" no canto da grade */}
              <button
                type="button"
                onClick={() => openViewer(0)}
                className="absolute bottom-4 right-4 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card/95 hover:bg-card text-foreground text-xs font-semibold shadow-md backdrop-blur transition-all min-h-[44px]"
              >
                <Grid className="h-3.5 w-3.5" />
                <span>Ver todas as fotos ({photos.length})</span>
              </button>
            </div>

            {/* Celular: Uma foto grande com contador "1 / N" e deslizar para as outras */}
            <div className="md:hidden relative aspect-[4/3] w-full rounded-[12px] overflow-hidden bg-muted border border-border">
              <img
                src={getFullPhotoUrl(photos[mobilePhotoIndex]) || ''}
                alt={`${property.title} - Foto ${mobilePhotoIndex + 1}`}
                style={
                  mobilePhotoIndex === 0 && transitionName
                    ? { viewTransitionName: transitionName }
                    : undefined
                }
                className="h-full w-full object-cover"
                onClick={() => openViewer(mobilePhotoIndex)}
              />

              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setMobilePhotoIndex((prev) => (prev - 1 + photos.length) % photos.length)
                    }
                    aria-label="Foto anterior"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 text-foreground flex items-center justify-center shadow min-h-[44px] min-w-[44px]"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobilePhotoIndex((prev) => (prev + 1) % photos.length)}
                    aria-label="Próxima foto"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 text-foreground flex items-center justify-center shadow min-h-[44px] min-w-[44px]"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full font-medium">
                    {mobilePhotoIndex + 1} / {photos.length}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="aspect-[16/9] md:h-[380px] w-full rounded-[12px] bg-muted border border-border flex flex-col items-center justify-center text-muted-foreground/60 p-6">
            <Home className="h-16 w-16 stroke-[1.5]" />
            <span className="text-sm mt-2 font-medium">Sem fotos cadastradas</span>
          </div>
        )}

        {/* Layout Principal: Coluna de Conteúdo (esquerda) e Cartão de Ação Fixo (direita no desktop) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start pt-2">
          {/* Conteúdo textual da ficha */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            {/* Título: peso 600 (26 px no celular, 32 px no desktop) */}
            <div className="space-y-2">
              <h1 className="text-[26px] sm:text-[32px] font-semibold text-foreground tracking-tight leading-tight">
                {property.title}
              </h1>

              {/* "tipo em bairro, cidade" em texto de apoio */}
              <p className="text-base text-muted-foreground font-normal">
                {typeLabel} em {[property.neighborhood, property.city].filter(Boolean).join(', ')}
              </p>

              {/* Fileira de dados (quartos, banheiros, vagas, área) separada por pontos */}
              {specsItems.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-sm font-medium text-foreground">
                  {specsItems.map((spec, i) => (
                    <React.Fragment key={i}>
                      <span>{spec}</span>
                      {i < specsItems.length - 1 && (
                        <span className="text-muted-foreground/60">·</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>

            {/* Divisor de 1 px */}
            <hr className="border-t border-border" />

            {/* Descrição: em 16 px (peso 400, até 70 caracteres por linha), texto simples, quebras preservadas */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Sobre este imóvel</h2>
              {property.description ? (
                <p className="text-base font-normal text-muted-foreground whitespace-pre-wrap leading-relaxed max-w-[70ch]">
                  {property.description}
                </p>
              ) : (
                <p className="text-base font-normal text-muted-foreground italic">
                  Nenhuma descrição informada.
                </p>
              )}
            </div>

            {/* Condomínio e IPTU quando houver */}
            {(property.condo_fee > 0 || property.iptu > 0) && (
              <>
                <hr className="border-t border-border" />
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold text-foreground">Taxas e encargos</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                    {property.condo_fee > 0 && (
                      <div className="p-4 rounded-[12px] border border-border bg-card space-y-1">
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <Building className="h-4 w-4" />
                          <span>Condomínio</span>
                        </div>
                        <div className="text-base font-semibold text-foreground tabular">
                          {formatCurrencyBR(property.condo_fee)}/mês
                        </div>
                      </div>
                    )}
                    {property.iptu > 0 && (
                      <div className="p-4 rounded-[12px] border border-border bg-card space-y-1">
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <Receipt className="h-4 w-4" />
                          <span>IPTU</span>
                        </div>
                        <div className="text-base font-semibold text-foreground tabular">
                          {formatCurrencyBR(property.iptu)}/ano
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* No celular: "Falar no WhatsApp" fica no corpo da página */}
            <div className="pt-4 md:hidden">
              <Button
                type="button"
                variant="outline"
                onClick={handleWhatsAppClick}
                className="w-full rounded-[8px] h-12 text-sm font-medium border-border min-h-[44px] gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                Falar no WhatsApp
              </Button>
            </div>
          </div>

          {/* Cartão de ação fixo (desktop): à direita, acompanhando a rolagem (sticky) */}
          <div className="hidden lg:block lg:col-span-5 xl:col-span-4 sticky top-28">
            <div className="rounded-[16px] border border-border bg-card p-6 shadow-[0_6px_16px_rgba(0,0,0,0.12)] dark:shadow-none space-y-6">
              {/* Preço em peso 600 (venda e locação) */}
              <div className="space-y-1 tabular">
                {salePriceStr && (
                  <div>
                    <span className="text-xs text-muted-foreground uppercase font-medium tracking-wider">
                      Venda
                    </span>
                    <div className="text-2xl font-semibold text-foreground">{salePriceStr}</div>
                  </div>
                )}
                {rentPriceStr && (
                  <div className={salePriceStr ? 'pt-2 border-t border-border/80' : ''}>
                    <span className="text-xs text-muted-foreground uppercase font-medium tracking-wider">
                      Locação
                    </span>
                    <div className="text-2xl font-semibold text-foreground">{rentPriceStr}</div>
                  </div>
                )}
                {!salePriceStr && !rentPriceStr && (
                  <div className="text-xl font-semibold text-muted-foreground">
                    Valor não informado
                  </div>
                )}
              </div>

              {/* Escolha de horário de visita em pílulas selecionáveis (se houver slots) */}
              {slots.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      Horários para visita
                    </span>
                    {selectedSlot && (
                      <button
                        type="button"
                        onClick={() => setSelectedSlot(null)}
                        className="text-[11px] text-muted-foreground hover:text-foreground underline min-h-[44px] inline-flex items-center"
                      >
                        Desmarcar
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                    {slots.slice(0, 12).map((slot) => {
                      const isSel = selectedSlot === slot.start
                      return (
                        <button
                          key={slot.start}
                          type="button"
                          onClick={() => setSelectedSlot(isSel ? null : slot.start)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all min-h-[36px] ${
                            isSel
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30'
                          }`}
                        >
                          {formatSlotLabel(slot.start)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Botão "Agendar visita" (ação principal, preenchido, raio 8 px, 48 px de altura) */}
              <div className="space-y-3 pt-2">
                <Button
                  type="button"
                  onClick={() => setContactOpen(true)}
                  className="w-full rounded-[8px] h-12 text-sm font-medium min-h-[48px] gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  <span>Agendar visita</span>
                </Button>

                {/* "Falar no WhatsApp" (contorno) */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleWhatsAppClick}
                  className="w-full rounded-[8px] h-12 text-sm font-medium border-border min-h-[48px] gap-2"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Falar no WhatsApp</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Celular: o cartão vira barra fixa no rodapé com o preço à esquerda e "Agendar visita" à direita. Espaço reservado no fim da página (pb-28) */}
        <div className="fixed bottom-0 inset-x-0 z-30 px-4 py-3 bg-background/95 backdrop-blur-md border-t border-border lg:hidden shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            {/* Preço à esquerda */}
            <div className="tabular min-w-0 flex-1">
              {salePriceStr && (
                <div className="text-base font-semibold text-foreground truncate">
                  {salePriceStr}
                </div>
              )}
              {rentPriceStr && !salePriceStr && (
                <div className="text-base font-semibold text-foreground truncate">
                  {rentPriceStr}
                </div>
              )}
              {!salePriceStr && !rentPriceStr && (
                <div className="text-sm font-medium text-muted-foreground truncate">Consulte</div>
              )}
              <div className="text-[11px] text-muted-foreground truncate">Cód. {property.code}</div>
            </div>

            {/* "Agendar visita" à direita */}
            <Button
              type="button"
              onClick={() => setContactOpen(true)}
              className="rounded-[8px] h-11 px-6 text-sm font-medium shrink-0 min-h-[44px]"
            >
              Agendar visita
            </Button>
          </div>
        </div>

        {/* Modal do visualizador de fotos em tela cheia */}
        <PhotoViewerModal
          open={photoViewerOpen}
          onOpenChange={setPhotoViewerOpen}
          photos={photos}
          initialIndex={photoViewerInitialIndex}
          propertyTitle={property.title}
        />

        {/* Modal de Contato / Agendar visita */}
        <PublicContactModal
          open={contactOpen}
          onOpenChange={setContactOpen}
          propertyCode={property.code}
        />
      </div>
    </PublicLayout>
  )
}
export default ImovelPublicoPage
