import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PublicPropertyListItem } from '@/services/publicSite'
import { formatPrice, getFullPhotoUrl } from '@/lib/publicSiteUtils'

interface FeaturedSliderProps {
  properties: PublicPropertyListItem[]
}

export const FeaturedSlider: React.FC<FeaturedSliderProps> = ({ properties }) => {
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const timerRef = useRef<number | null>(null)

  // Verifica se o usuário prefere redução de movimento
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const count = properties.length

  const handleNext = useCallback(() => {
    if (count <= 1) return
    setCurrentIndex((prev) => (prev + 1) % count)
  }, [count])

  const handlePrev = useCallback(() => {
    if (count <= 1) return
    setCurrentIndex((prev) => (prev - 1 + count) % count)
  }, [count])

  // Troca automática a cada 6 segundos, pausa com hover ou foco
  useEffect(() => {
    if (prefersReducedMotion || count <= 1 || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    timerRef.current = window.setInterval(() => {
      handleNext()
    }, 6000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [prefersReducedMotion, count, isPaused, handleNext])

  if (count === 0) return null

  const currentProperty = properties[currentIndex]
  const coverUrl = getFullPhotoUrl(currentProperty.cover)
  const targetUrl = `/buscar/${encodeURIComponent(currentProperty.code)}`
  const transitionName = `property-hero-${currentProperty.code.replace(/[^a-zA-Z0-9_-]/g, '_')}`

  const salePriceStr = currentProperty.sale ? formatPrice(currentProperty.sale, 'sale') : null
  const rentPriceStr = currentProperty.rent ? formatPrice(currentProperty.rent, 'rent') : null
  const priceDisplay = salePriceStr || rentPriceStr || 'Consulte'

  const handleSlideClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return
    }

    if (
      !prefersReducedMotion &&
      typeof document !== 'undefined' &&
      'startViewTransition' in document &&
      typeof (document as unknown as { startViewTransition: (cb: () => void) => void })
        .startViewTransition === 'function'
    ) {
      e.preventDefault()
      ;(
        document as unknown as { startViewTransition: (cb: () => void) => void }
      ).startViewTransition(() => {
        navigate(targetUrl)
      })
    }
  }

  return (
    <section
      role="region"
      aria-roledescription="carrossel"
      aria-label="Imóveis em destaque"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      className="relative w-full h-full flex flex-col justify-center"
    >
      {/* Contêiner da foto e faixa */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[16px] lg:rounded-[24px] bg-muted shadow-sm group">
        {/* Renderiza todos os slides empilhados com transição fade de 400ms */}
        {properties.map((prop, idx) => {
          const isCurrent = idx === currentIndex
          const propCoverUrl = getFullPhotoUrl(prop.cover)
          const propSale = prop.sale ? formatPrice(prop.sale, 'sale') : null
          const propRent = prop.rent ? formatPrice(prop.rent, 'rent') : null
          const propPrice = propSale || propRent || 'Consulte'
          const propTargetUrl = `/buscar/${encodeURIComponent(prop.code)}`
          const propTransName = `property-hero-${prop.code.replace(/[^a-zA-Z0-9_-]/g, '_')}`

          return (
            <div
              key={prop.code}
              role="group"
              aria-roledescription="slide"
              aria-label={`Imóvel ${idx + 1} de ${count}`}
              aria-hidden={!isCurrent}
              className={`absolute inset-0 transition-opacity duration-400 ease-in-out ${
                isCurrent ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              <Link
                to={propTargetUrl}
                onClick={handleSlideClick}
                tabIndex={isCurrent ? 0 : -1}
                className="block w-full h-full relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-[16px] lg:rounded-[24px]"
              >
                {propCoverUrl ? (
                  <img
                    src={propCoverUrl}
                    alt={prop.title}
                    style={isCurrent ? { viewTransitionName: propTransName } : undefined}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground">
                    Sem foto
                  </div>
                )}

                {/* Faixa na base (.on-photo): opaca com blur, título, "bairro, cidade", preço (peso 600) e seta */}
                <div className="absolute inset-x-0 bottom-0 on-photo p-4 sm:p-5 border-t border-line flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 text-left">
                    <h3 className="font-semibold text-sm sm:text-base text-foreground truncate">
                      {prop.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">
                      {[prop.neighborhood, prop.city].filter(Boolean).join(', ') || 'Localização'}
                    </p>
                    <div className="text-sm sm:text-base font-semibold text-foreground tabular mt-0.5">
                      {propPrice}
                    </div>
                  </div>

                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm group-hover:translate-x-0.5 transition-transform">
                    <ChevronRight className="h-5 w-5" />
                  </div>
                </div>
              </Link>
            </div>
          )
        })}

        {/* Botões anterior e próximo (círculos de 44 px, visíveis por teclado e toque) */}
        {count > 1 && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Imóvel anterior"
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full on-photo border border-line text-foreground flex items-center justify-center shadow-md hover:bg-background/90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Próximo imóvel"
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full on-photo border border-line text-foreground flex items-center justify-center shadow-md hover:bg-background/90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* Pontos de posição (área de toque de 44 px cada) */}
      {count > 1 && (
        <div className="flex items-center justify-center gap-1 pt-3" aria-hidden="true">
          {properties.map((_, dotIdx) => {
            const isSel = dotIdx === currentIndex
            return (
              <button
                key={dotIdx}
                type="button"
                tabIndex={-1}
                onClick={() => setCurrentIndex(dotIdx)}
                aria-label={`Ir para imóvel ${dotIdx + 1}`}
                className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <span
                  className={`block rounded-full transition-all ${
                    isSel
                      ? 'w-6 h-2 bg-primary'
                      : 'w-2 h-2 bg-muted-foreground/40 hover:bg-muted-foreground'
                  }`}
                />
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
