import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getProperty, getFilters, PublicPropertyDetail } from '@/services/publicSite'
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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  Receipt,
  Building,
  MessageSquare,
  AlertCircle,
} from 'lucide-react'

export const ImovelPublicoPage: React.FC = () => {
  const { codigo } = useParams<{ codigo: string }>()
  const [property, setProperty] = useState<PublicPropertyDetail | null>(null)
  const [orgName, setOrgName] = useState('Imobdigital')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Galeria de fotos
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)

  // Modal de contato
  const [contactOpen, setContactOpen] = useState(false)

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
        setCurrentPhotoIndex(0)
        // Registra visita na memória do módulo
        addViewed(data.code)
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

  const photos = property?.photos || []

  const nextPhoto = () => {
    if (!photos.length) return
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length)
  }

  const prevPhoto = () => {
    if (!photos.length) return
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length)
  }

  if (loading) {
    return (
      <PublicLayout orgName={orgName} showContactButton={false}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="aspect-[16/9] sm:aspect-[21/9] w-full rounded-2xl" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-7 w-1/4" />
          </div>
          <Skeleton className="h-32 w-full" />
        </div>
      </PublicLayout>
    )
  }

  if (notFound) {
    return (
      <PublicLayout orgName={orgName} showContactButton={false}>
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-5">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <AlertCircle className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">
              Este imóvel não está mais disponível.
            </h2>
            <p className="text-sm text-muted-foreground">
              Ele pode ter sido vendido, alugado ou retirado de exibição.
            </p>
          </div>
          <div className="pt-2">
            <Button asChild variant="default" size="lg" className="gap-2">
              <Link to="/buscar">
                <ArrowLeft className="h-4 w-4" />
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
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Erro ao carregar imóvel</h2>
          <p className="text-sm text-muted-foreground">
            {errorMessage || 'Não foi possível exibir os detalhes.'}
          </p>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/buscar">
              <ArrowLeft className="h-4 w-4" />
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

  return (
    <PublicLayout orgName={orgName} showContactButton={true}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8 pb-28 md:pb-12">
        {/* Navegação de volta */}
        <div className="flex items-center justify-between">
          <Link
            to="/buscar"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar para a busca</span>
          </Link>
          <span className="text-xs font-mono font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-md">
            Cód. {property.code}
          </span>
        </div>

        {/* Galeria de Fotos */}
        <div className="space-y-3">
          <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full rounded-2xl overflow-hidden bg-muted border border-border flex items-center justify-center group shadow-sm">
            {photos.length > 0 ? (
              <>
                <img
                  src={getFullPhotoUrl(photos[currentPhotoIndex]) || ''}
                  alt={`${property.title} - Foto ${currentPhotoIndex + 1}`}
                  className="h-full w-full object-cover transition-all duration-300"
                />

                {/* Controles de Navegação (se mais de 1 foto) */}
                {photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={prevPhoto}
                      aria-label="Foto anterior"
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-opacity opacity-90 sm:opacity-0 group-hover:opacity-100 shadow-md"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button
                      type="button"
                      onClick={nextPhoto}
                      aria-label="Próxima foto"
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-opacity opacity-90 sm:opacity-0 group-hover:opacity-100 shadow-md"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>

                    <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full font-medium">
                      {currentPhotoIndex + 1} / {photos.length}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground/60 p-6">
                <Home className="h-16 w-16 stroke-[1.5]" />
                <span className="text-sm mt-2 font-medium">Sem fotos cadastradas</span>
              </div>
            )}
          </div>

          {/* Miniaturas em linha / deslizar no mobile */}
          {photos.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none snap-x">
              {photos.map((ph, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentPhotoIndex(idx)}
                  className={`relative shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 transition-all snap-start ${
                    idx === currentPhotoIndex
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={getFullPhotoUrl(ph) || ''}
                    alt={`Miniatura ${idx + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cabeçalho da Ficha: Preços, Título e Localização */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="font-medium text-xs">
                {typeLabel}
              </Badge>
              <span className="text-xs text-muted-foreground">Cód. {property.code}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-snug">
              {property.title}
            </h1>

            <p className="text-base text-muted-foreground">
              {[property.neighborhood, property.city].filter(Boolean).join(', ')}
            </p>
          </div>

          {/* Preços e Botão Desktop */}
          <div className="p-5 bg-card rounded-2xl border border-border shadow-sm space-y-4">
            <div className="space-y-1">
              {salePriceStr && (
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Venda
                  </span>
                  <div className="text-2xl font-extrabold text-foreground tracking-tight">
                    {salePriceStr}
                  </div>
                </div>
              )}
              {rentPriceStr && (
                <div className={salePriceStr ? 'pt-2 border-t border-border/80' : ''}>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Locação
                  </span>
                  <div className="text-2xl font-extrabold text-foreground tracking-tight">
                    {rentPriceStr}
                  </div>
                </div>
              )}
              {!salePriceStr && !rentPriceStr && (
                <div className="text-lg font-medium text-muted-foreground">Valor não informado</div>
              )}
            </div>

            {/* Taxas (Condomínio / IPTU) se maiores que zero */}
            {(property.condo_fee > 0 || property.iptu > 0) && (
              <div className="pt-3 border-t border-border/80 space-y-1 text-xs text-muted-foreground">
                {property.condo_fee > 0 && (
                  <div className="flex justify-between">
                    <span>Condomínio</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrencyBR(property.condo_fee)}/mês
                    </span>
                  </div>
                )}
                {property.iptu > 0 && (
                  <div className="flex justify-between">
                    <span>IPTU</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrencyBR(property.iptu)}/ano
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="hidden md:block pt-2">
              <Button
                size="lg"
                className="w-full gap-2 font-semibold h-11"
                onClick={() => setContactOpen(true)}
              >
                <MessageSquare className="h-4 w-4" />
                Tenho interesse
              </Button>
            </div>
          </div>
        </div>

        {/* Características do Imóvel */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Características</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {property.bedrooms > 0 && (
              <div className="p-3.5 bg-card rounded-xl border border-border flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Bed className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Quartos</div>
                  <div className="font-semibold text-sm text-foreground">
                    {property.bedrooms} {property.bedrooms === 1 ? 'quarto' : 'quartos'}
                  </div>
                </div>
              </div>
            )}

            {property.bathrooms > 0 && (
              <div className="p-3.5 bg-card rounded-xl border border-border flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Bath className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Banheiros</div>
                  <div className="font-semibold text-sm text-foreground">
                    {property.bathrooms} {property.bathrooms === 1 ? 'banheiro' : 'banheiros'}
                  </div>
                </div>
              </div>
            )}

            {property.parking > 0 && (
              <div className="p-3.5 bg-card rounded-xl border border-border flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Car className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Vagas</div>
                  <div className="font-semibold text-sm text-foreground">
                    {property.parking} {property.parking === 1 ? 'vaga' : 'vagas'}
                  </div>
                </div>
              </div>
            )}

            {property.area > 0 && (
              <div className="p-3.5 bg-card rounded-xl border border-border flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Maximize2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Área útil</div>
                  <div className="font-semibold text-sm text-foreground">{property.area} m²</div>
                </div>
              </div>
            )}

            {property.condo_fee > 0 && (
              <div className="p-3.5 bg-card rounded-xl border border-border flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Building className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Condomínio</div>
                  <div className="font-semibold text-sm text-foreground">
                    {formatCurrencyBR(property.condo_fee)}/mês
                  </div>
                </div>
              </div>
            )}

            {property.iptu > 0 && (
              <div className="p-3.5 bg-card rounded-xl border border-border flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">IPTU</div>
                  <div className="font-semibold text-sm text-foreground">
                    {formatCurrencyBR(property.iptu)}/ano
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Descrição do Imóvel: texto simples, quebras preservadas, NUNCA como HTML */}
        <div className="space-y-3 pt-2">
          <h2 className="text-lg font-semibold text-foreground">Sobre o imóvel</h2>
          <div className="p-5 bg-card rounded-2xl border border-border">
            {property.description ? (
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed text-sm sm:text-base font-normal">
                {property.description}
              </p>
            ) : (
              <p className="text-muted-foreground/80 italic text-sm">
                Nenhuma descrição informada para este imóvel.
              </p>
            )}
          </div>
        </div>

        {/* Botão fixo no rodapé do celular: Tenho interesse */}
        <div className="fixed bottom-0 inset-x-0 z-30 p-3 bg-background/95 backdrop-blur-md border-t border-border shadow-lg md:hidden">
          <Button
            size="lg"
            className="w-full gap-2 font-semibold h-12 shadow-sm"
            onClick={() => setContactOpen(true)}
          >
            <MessageSquare className="h-5 w-5" />
            Tenho interesse
          </Button>
        </div>

        {/* Modal / Sheet de Contato com o código do imóvel */}
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
