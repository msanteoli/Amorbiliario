import React, { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  getProperty,
  getFilters,
  PublicPropertyDetail,
  PublicOrganization,
} from '@/services/publicSite'
import { addViewed } from '@/lib/searchMemory'
import { initCampaignFromUrl } from '@/lib/campaign'
import { initMarketingScripts } from '@/lib/marketing'
import {
  formatPrice,
  formatCurrencyBR,
  getFullPhotoUrl,
  PUBLIC_PROPERTY_TYPE_LABELS,
} from '@/lib/publicSiteUtils'
import { PublicLayout } from '@/components/public/PublicLayout'
import { PublicContactModal } from '@/components/public/PublicContactModal'
import { PhotoZoom } from '@/components/public/PhotoZoom'
import { Enter } from '@/components/public/Enter'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Home,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Building,
  Receipt,
  MessageCircle,
  Calendar,
  AlertCircle,
  Grid,
} from 'lucide-react'

interface DayGroup {
  dateKey: string // YYYY-MM-DD
  dayLabel: string // "qui 08/10"
  slots: Array<{ start: string; end: string; timeLabel: string }>
}

export const ImovelPublicoPage: React.FC = () => {
  const { codigo } = useParams<{ codigo: string }>()
  const [property, setProperty] = useState<PublicPropertyDetail | null>(null)
  const [orgName, setOrgName] = useState('Imobdigital')
  const [orgData, setOrgData] = useState<PublicOrganization | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Galeria de fotos / Zoom
  const [photoZoomOpen, setPhotoZoomOpen] = useState(false)
  const [photoZoomIndex, setPhotoZoomIndex] = useState(0)
  const [mobilePhotoIndex, setMobilePhotoIndex] = useState(0)
  const [zoomSourceEl, setZoomSourceEl] = useState<HTMLElement | null>(null)

  const openZoom = (idx: number, e?: React.MouseEvent | React.KeyboardEvent) => {
    setPhotoZoomIndex(idx)
    if (e && e.currentTarget) {
      setZoomSourceEl(e.currentTarget as HTMLElement)
    } else {
      // Se chamado sem evento direto (ex: botão ver todas as fotos), usa a foto principal do mosaico se existir
      const mainPhotoEl = document.getElementById('property-main-photo')
      setZoomSourceEl(mainPhotoEl)
    }
    setPhotoZoomOpen(true)
  }

  // O botão "Falar no WhatsApp" da ficha abre o formulário de contato (que cria o lead)
  const handleFichaWhatsAppClick = () => {
    setContactOpen(true)
  }

  // Modal de contato / agendar visita
  const [contactOpen, setContactOpen] = useState(false)

  // Horários de visita disponíveis
  const [slots, setSlots] = useState<Array<{ start: string; end: string }>>([])
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null)
  const [selectedSlotStart, setSelectedSlotStart] = useState<string | null>(null)

  useEffect(() => {
    initCampaignFromUrl()
    initMarketingScripts()
  }, [])

  // Carrega dados da imobiliária (nome e whatsapp_enabled)
  useEffect(() => {
    getFilters()
      .then((res) => {
        if (res.organization) {
          setOrgData(res.organization)
          if (res.organization.name) {
            setOrgName(res.organization.name)
          }
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
        setLoading(false)
      })
  }, [codigo])

  // Agrupamento de horários por dia (faixa horizontal de dias + horários do dia em 2 colunas)
  const dayGroups: DayGroup[] = useMemo(() => {
    if (!slots || slots.length === 0) return []

    const dias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
    const map = new Map<string, DayGroup>()

    for (const slot of slots) {
      try {
        const d = new Date(slot.start)
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        const dateKey = `${year}-${month}-${day}`

        const diaSemana = dias[d.getDay()]
        const dayLabel = `${diaSemana} ${day}/${month}`

        const hour = String(d.getHours()).padStart(2, '0')
        const min = String(d.getMinutes()).padStart(2, '0')
        const timeLabel = `${hour}:${min}`

        if (!map.has(dateKey)) {
          map.set(dateKey, {
            dateKey,
            dayLabel,
            slots: [],
          })
        }
        map.get(dateKey)!.slots.push({
          start: slot.start,
          end: slot.end,
          timeLabel,
        })
      } catch {
        // Ignora slot inválido
      }
    }

    return Array.from(map.values())
  }, [slots])

  // Seleciona automaticamente o primeiro dia com horários
  useEffect(() => {
    if (dayGroups.length > 0 && !selectedDayKey) {
      setSelectedDayKey(dayGroups[0].dateKey)
    }
  }, [dayGroups, selectedDayKey])

  // Atualiza document.title e meta description da ficha
  useEffect(() => {
    const prevTitle = document.title
    let metaDescriptionEl = document.querySelector('meta[name="description"]')
    const prevMetaDesc = metaDescriptionEl ? metaDescriptionEl.getAttribute('content') : null

    if (notFound) {
      document.title = `Imóvel indisponível | ${orgName}`
    } else if (property) {
      const loc = [property.neighborhood, property.city].filter(Boolean).join(', ')
      document.title = `${property.title}${loc ? ` — ${loc}` : ''} | ${orgName}`

      // Meta descrição com os primeiros 150 caracteres da descrição em texto puro
      if (property.description) {
        const pureDesc = property.description.replace(/\s+/g, ' ').trim().slice(0, 150)

        if (!metaDescriptionEl) {
          metaDescriptionEl = document.createElement('meta')
          metaDescriptionEl.setAttribute('name', 'description')
          document.head.appendChild(metaDescriptionEl)
        }
        metaDescriptionEl.setAttribute('content', pureDesc)
      }
    }

    return () => {
      document.title = prevTitle
      if (prevMetaDesc !== null && metaDescriptionEl) {
        metaDescriptionEl.setAttribute('content', prevMetaDesc)
      }
    }
  }, [property, notFound, orgName])

  const photos = property?.photos || []

  if (loading) {
    return (
      <PublicLayout
        orgName={orgName}
        whatsappEnabled={orgData?.whatsapp_enabled}
        showContactButton={false}
      >
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
      <PublicLayout
        orgName={orgName}
        whatsappEnabled={orgData?.whatsapp_enabled}
        showContactButton={false}
      >
        <Enter step={0} className="max-w-md mx-auto px-4 py-24 text-center space-y-5">
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
        </Enter>
      </PublicLayout>
    )
  }

  if (errorMessage || !property) {
    return (
      <PublicLayout
        orgName={orgName}
        whatsappEnabled={orgData?.whatsapp_enabled}
        showContactButton={false}
      >
        <Enter step={0} className="max-w-md mx-auto px-4 py-24 text-center space-y-4">
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
        </Enter>
      </PublicLayout>
    )
  }

  const typeLabel = PUBLIC_PROPERTY_TYPE_LABELS[property.type] || property.type
  const salePriceStr = property.sale ? formatPrice(property.sale, 'sale') : null
  const rentPriceStr = property.rent ? formatPrice(property.rent, 'rent') : null

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

  const activeDayGroup = dayGroups.find((g) => g.dateKey === selectedDayKey) || dayGroups[0]

  return (
    <PublicLayout
      orgName={orgName}
      whatsappEnabled={orgData?.whatsapp_enabled}
      showContactButton={true}
      floatingWaClassName="bottom-20 lg:bottom-4"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6 pb-28 md:pb-16">
        {/* Passo 0: Linha "Voltar para a busca" e código */}
        <Enter step={0} className="flex items-center justify-between">
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
        </Enter>

        {/* Passo 1: O bloco de fotos (mosaico no desktop, foto única no celular) */}
        <Enter step={1}>
          {photos.length > 0 ? (
            <div>
              {/* Desktop: Mosaico 1 grande + 4 menores em grade 2x2 */}
              <div className="hidden md:relative md:grid md:grid-cols-2 gap-2.5 h-[420px] lg:h-[480px] rounded-[12px] overflow-hidden select-none">
                <div
                  id="property-main-photo"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => openZoom(0, e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openZoom(0, e)
                    }
                  }}
                  className="relative h-full w-full cursor-zoom-in overflow-hidden bg-muted group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.97] transition-transform duration-100"
                >
                  <img
                    src={getFullPhotoUrl(photos[0]) || ''}
                    alt={property.title}
                    className="h-full w-full object-cover group-hover:opacity-95 transition-opacity"
                  />
                </div>

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
                        onClick={(e) => openZoom(photoIdx, e)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            openZoom(photoIdx, e)
                          }
                        }}
                        className="relative h-full w-full cursor-zoom-in overflow-hidden bg-muted group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.97] transition-transform duration-100"
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

                {/* Pílula "Ver todas as fotos" (abre pela foto grande) */}
                <button
                  type="button"
                  onClick={() => openZoom(0)}
                  className="absolute bottom-4 right-4 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card/95 hover:bg-card text-foreground text-xs font-semibold shadow-md backdrop-blur transition-all min-h-[44px]"
                >
                  <Grid className="h-3.5 w-3.5" />
                  <span>Ver todas as fotos ({photos.length})</span>
                </button>
              </div>

              {/* Celular: Uma foto grande com contador "1 / N" */}
              <div
                id="property-mobile-photo"
                role="button"
                tabIndex={0}
                onClick={(e) => openZoom(mobilePhotoIndex, e)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openZoom(mobilePhotoIndex, e)
                  }
                }}
                className="md:hidden relative aspect-[4/3] w-full rounded-[12px] overflow-hidden bg-muted border border-border active:scale-[0.97] transition-transform duration-100 cursor-zoom-in"
              >
                <img
                  src={getFullPhotoUrl(photos[mobilePhotoIndex]) || ''}
                  alt={`${property.title} - Foto ${mobilePhotoIndex + 1}`}
                  className="h-full w-full object-cover"
                />

                {photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setMobilePhotoIndex((prev) => (prev - 1 + photos.length) % photos.length)
                      }}
                      aria-label="Foto anterior"
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-background/80 text-foreground flex items-center justify-center shadow min-h-[44px] min-w-[44px]"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setMobilePhotoIndex((prev) => (prev + 1) % photos.length)
                      }}
                      aria-label="Próxima foto"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-background/80 text-foreground flex items-center justify-center shadow min-h-[44px] min-w-[44px]"
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
        </Enter>

        {/* Layout Principal: Coluna de Conteúdo (esquerda) e Cartão de Ação (direita no desktop) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start pt-2">
          {/* Conteúdo textual da ficha */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            {/* Passo 2: Título, tipo/bairro e dados */}
            <Enter step={2} className="space-y-2">
              <h1 className="text-[26px] sm:text-[32px] font-semibold text-foreground tracking-tight leading-tight">
                {property.title}
              </h1>

              <p className="text-base text-muted-foreground font-normal">
                {typeLabel} em {[property.neighborhood, property.city].filter(Boolean).join(', ')}
              </p>

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
            </Enter>

            <hr className="border-t border-border" />

            {/* Passo 3: "Sobre este imóvel", condomínio, taxas e encargos */}
            <Enter step={3} className="space-y-6">
              {/* Descrição: até 70 caracteres por linha, texto simples */}
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

              {/* Seção Condomínio (quando condominium não for nulo) */}
              {property.condominium && (
                <>
                  <hr className="border-t border-border" />
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Building className="h-5 w-5 text-muted-foreground" />
                      <h2 className="text-lg font-semibold text-foreground">Condomínio</h2>
                    </div>

                    <div className="rounded-[8px] border border-border bg-card p-5 space-y-4">
                      {/* Nome do condomínio */}
                      <div>
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-1">
                          Nome
                        </span>
                        <p className="text-base font-semibold text-foreground">
                          {property.condominium.name}
                        </p>
                      </div>

                      {/* Itens de lazer (um por linha, como lista) */}
                      {property.condominium.amenities &&
                        property.condominium.amenities
                          .split('\n')
                          .map((item) => item.trim())
                          .filter(Boolean).length > 0 && (
                          <div className="pt-3 border-t border-border space-y-2">
                            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground block">
                              Itens de lazer
                            </span>
                            <ul className="space-y-1.5 text-sm text-foreground">
                              {property.condominium.amenities
                                .split('\n')
                                .map((item) => item.trim())
                                .filter(Boolean)
                                .map((amenity, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <span
                                      className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0"
                                      aria-hidden="true"
                                    />
                                    <span>{amenity}</span>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        )}

                      {/* Regras do condomínio (texto) */}
                      {property.condominium.rules && property.condominium.rules.trim() && (
                        <div className="pt-3 border-t border-border space-y-2">
                          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground block">
                            Regras
                          </span>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed max-w-[70ch]">
                            {property.condominium.rules.trim()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Condomínio e IPTU */}
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
            </Enter>

            {/* Passo 4: No celular: "Falar no WhatsApp" no corpo da página */}
            <Enter step={4} className="pt-4 md:hidden">
              <Button
                type="button"
                variant="outline"
                onClick={handleFichaWhatsAppClick}
                className="w-full rounded-[8px] h-12 text-sm font-medium border-border min-h-[44px] gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                Falar no WhatsApp
              </Button>
            </Enter>
          </div>

          {/* Cartão de ação fixo (desktop) - A animação vai no div de DENTRO do contêiner sticky, não no próprio sticky */}
          <div className="hidden lg:block lg:col-span-5 xl:col-span-4 sticky top-28">
            <Enter step={3}>
              <div className="rounded-[16px] border border-border bg-card p-6 shadow-[0_6px_16px_rgba(0,0,0,0.12)] dark:shadow-none space-y-6">
                {/* Preço em peso 600 */}
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

                {/* Escolha de horário de visita:
                    Faixa horizontal de dias ("qui 08/10", rolagem horizontal sem barra)
                    Abaixo, os horários do dia escolhido em chips de 44 px e 2 colunas, sem rolagem interna. */}
                {dayGroups.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">
                        Escolha o dia e horário da visita
                      </span>
                      {selectedSlotStart && (
                        <button
                          type="button"
                          onClick={() => setSelectedSlotStart(null)}
                          className="text-[11px] text-muted-foreground hover:text-foreground underline min-h-[44px] inline-flex items-center"
                        >
                          Desmarcar
                        </button>
                      )}
                    </div>

                    {/* Faixa horizontal de dias com rolagem sem barra */}
                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
                      {dayGroups.map((group) => {
                        const isSel = group.dateKey === selectedDayKey
                        return (
                          <button
                            key={group.dateKey}
                            type="button"
                            onClick={() => {
                              setSelectedDayKey(group.dateKey)
                              setSelectedSlotStart(null)
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all shrink-0 min-h-[44px] ${
                              isSel
                                ? 'bg-primary text-primary-foreground border-primary font-semibold'
                                : 'border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30'
                            }`}
                          >
                            {group.dayLabel}
                          </button>
                        )
                      })}
                    </div>

                    {/* Horários do dia escolhido em chips de 44 px e 2 colunas, SEM rolagem interna */}
                    {activeDayGroup && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {activeDayGroup.slots.map((slot) => {
                          const isSlotSel = selectedSlotStart === slot.start
                          return (
                            <button
                              key={slot.start}
                              type="button"
                              onClick={() => setSelectedSlotStart(isSlotSel ? null : slot.start)}
                              className={`h-11 px-3 rounded-[8px] text-xs font-medium border transition-all min-h-[44px] flex items-center justify-center ${
                                isSlotSel
                                  ? 'bg-primary text-primary-foreground border-primary font-semibold'
                                  : 'border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30'
                              }`}
                            >
                              {slot.timeLabel}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Botões de Ação */}
                <div className="space-y-3 pt-2">
                  <Button
                    type="button"
                    onClick={() => setContactOpen(true)}
                    className="w-full rounded-[8px] h-12 text-sm font-medium min-h-[48px] gap-2"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>Agendar visita</span>
                  </Button>

                  {/* "Falar no WhatsApp" (abre modal de contato, criando o lead) */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleFichaWhatsAppClick}
                    className="w-full rounded-[8px] h-12 text-sm font-medium border-border min-h-[48px] gap-2"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>Falar no WhatsApp</span>
                  </Button>
                </div>
              </div>
            </Enter>
          </div>
        </div>

        {/* Celular: barra fixa no rodapé (não anima) */}
        <div className="fixed bottom-0 inset-x-0 z-30 px-4 py-3 bg-background/95 backdrop-blur-md border-t border-border lg:hidden shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
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

            <Button
              type="button"
              onClick={() => setContactOpen(true)}
              className="rounded-[8px] h-11 px-6 text-sm font-medium shrink-0 min-h-[44px]"
            >
              Agendar visita
            </Button>
          </div>
        </div>

        {/* Zoom de fotos na ficha (PhotoZoom no lugar de PhotoViewerModal) */}
        <PhotoZoom
          open={photoZoomOpen}
          onOpenChange={setPhotoZoomOpen}
          photos={photos}
          currentIndex={photoZoomIndex}
          onIndexChange={(newIdx) => {
            setPhotoZoomIndex(newIdx)
            // No celular, ao navegar no zoom, atualiza a foto única da página
            setMobilePhotoIndex(newIdx)
          }}
          propertyTitle={property.title}
          sourceElement={zoomSourceEl}
        />

        {/* Modal de Contato / Agendar visita (não anima) */}
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
