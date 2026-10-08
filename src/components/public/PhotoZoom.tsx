import React, { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X, Home } from 'lucide-react'
import { getFullPhotoUrl } from '@/lib/publicSiteUtils'

export interface PhotoZoomProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  photos: string[]
  currentIndex: number
  onIndexChange: (index: number) => void
  propertyTitle: string
  sourceElement: HTMLElement | null
}

interface Rect {
  top: number
  left: number
  width: number
  height: number
  borderRadius: string
}

/**
 * Calcula o retângulo de destino centralizado, com proporção 4:3,
 * cabendo em até 70% da viewport (ou 94% abaixo de 768px),
 * arredondado ao pixel real do dispositivo.
 */
function computeTargetRect(): Rect {
  if (typeof window === 'undefined') {
    return { top: 0, left: 0, width: 0, height: 0, borderRadius: '12px' }
  }

  const dpr = window.devicePixelRatio || 1
  const vw = window.innerWidth
  const vh = window.innerHeight

  const isMobile = vw < 768
  const factor = isMobile ? 0.94 : 0.7

  const maxW = vw * factor
  const maxH = vh * factor

  // Proporção 4:3 -> W / H = 4 / 3 => W = 4/3 * H, H = 3/4 * W
  let w = maxW
  let h = (w * 3) / 4

  if (h > maxH) {
    h = maxH
    w = (h * 4) / 3
  }

  // Arredonda ao pixel real do aparelho (dispositivo)
  const roundDevPix = (val: number) => Math.round(val * dpr) / dpr

  const finalW = roundDevPix(w)
  const finalH = roundDevPix(h)
  const finalLeft = roundDevPix((vw - finalW) / 2)
  const finalTop = roundDevPix((vh - finalH) / 2)

  return {
    top: finalTop,
    left: finalLeft,
    width: finalW,
    height: finalH,
    borderRadius: '12px',
  }
}

function getElementRect(el: HTMLElement): Rect {
  const rect = el.getBoundingClientRect()
  const comp = window.getComputedStyle(el)
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    borderRadius: comp.borderRadius || '12px',
  }
}

export const PhotoZoom: React.FC<PhotoZoomProps> = ({
  open,
  onOpenChange,
  photos,
  currentIndex,
  onIndexChange,
  propertyTitle,
  sourceElement,
}) => {
  const [mounted, setMounted] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [activeRect, setActiveRect] = useState<Rect | null>(null)
  const [backdropOpacity, setBackdropOpacity] = useState(0)

  // Imagem exibida (com dissolução de 200 ms)
  const [displayIndex, setDisplayIndex] = useState(currentIndex)
  const [isDissolving, setIsDissolving] = useState(false)
  const dissolveTimerRef = useRef<number | null>(null)

  // Referências para foco e traps
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const lastActiveElementRef = useRef<HTMLElement | null>(null)
  const originalSourceRef = useRef<HTMLElement | null>(null)

  // Touch swipe
  const touchStartXRef = useRef<number | null>(null)
  const touchStartYRef = useRef<number | null>(null)

  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const count = photos.length

  const handleNext = useCallback(() => {
    if (count <= 1) return
    const nextIdx = (currentIndex + 1) % count
    onIndexChange(nextIdx)
  }, [count, currentIndex, onIndexChange])

  const handlePrev = useCallback(() => {
    if (count <= 1) return
    const prevIdx = (currentIndex - 1 + count) % count
    onIndexChange(prevIdx)
  }, [count, currentIndex, onIndexChange])

  // Dissolução ao mudar de foto dentro do zoom
  useEffect(() => {
    if (currentIndex !== displayIndex) {
      if (prefersReducedMotion) {
        setDisplayIndex(currentIndex)
      } else {
        setIsDissolving(true)
        if (dissolveTimerRef.current) clearTimeout(dissolveTimerRef.current)
        dissolveTimerRef.current = window.setTimeout(() => {
          setDisplayIndex(currentIndex)
          setIsDissolving(false)
        }, 100)
      }
    }
  }, [currentIndex, displayIndex, prefersReducedMotion])

  // Limpa o timer de dissolução
  useEffect(() => {
    return () => {
      if (dissolveTimerRef.current) clearTimeout(dissolveTimerRef.current)
    }
  }, [])

  // Início da abertura
  useEffect(() => {
    if (open) {
      setIsClosing(false)
      setDisplayIndex(currentIndex)
      lastActiveElementRef.current = (document.activeElement as HTMLElement) || null
      originalSourceRef.current = sourceElement

      if (sourceElement) {
        sourceElement.style.visibility = 'hidden'
      }

      setMounted(true)

      // Calcula geometria inicial
      const initialRect = sourceElement ? getElementRect(sourceElement) : computeTargetRect()

      setActiveRect(initialRect)
      setBackdropOpacity(0)

      if (prefersReducedMotion) {
        // Abre imediatamente sem animação
        setActiveRect(computeTargetRect())
        setBackdropOpacity(1)
        setTimeout(() => {
          closeButtonRef.current?.focus()
        }, 30)
      } else {
        // No próximo frame, anima até o destino
        const raf = requestAnimationFrame(() => {
          const target = computeTargetRect()
          setActiveRect(target)
          setBackdropOpacity(1)
        })

        const timer = setTimeout(() => {
          closeButtonRef.current?.focus()
        }, 360)

        return () => {
          cancelAnimationFrame(raf)
          clearTimeout(timer)
        }
      }
    }
  }, [open, sourceElement, prefersReducedMotion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Recalcula geometria de destino caso a janela mude de tamanho ou gire
  useEffect(() => {
    if (!mounted || isClosing) return

    const handleResize = () => {
      setActiveRect(computeTargetRect())
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [mounted, isClosing])

  // Trava a rolagem da página e teclas de rolagem enquanto aberto
  useEffect(() => {
    if (!mounted) return

    const originalOverflow = document.body.style.overflow
    const originalTouchAction = document.body.style.touchAction
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
    }

    const preventScrollKeys = (e: KeyboardEvent) => {
      // Space, PageUp, PageDown, End, Home, Up, Down
      if ([32, 33, 34, 35, 36, 38, 40].includes(e.keyCode)) {
        // Se não for seta de navegação nem controle focado
        if (
          e.key === ' ' ||
          e.key === 'PageUp' ||
          e.key === 'PageDown' ||
          e.key === 'Home' ||
          e.key === 'End'
        ) {
          e.preventDefault()
        }
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('keydown', preventScrollKeys, { passive: false })

    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.touchAction = originalTouchAction
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', preventScrollKeys)
    }
  }, [mounted])

  // Fecha o zoom
  const requestClose = useCallback(() => {
    if (isClosing || !mounted) return
    setIsClosing(true)

    const finishClosing = () => {
      if (originalSourceRef.current) {
        originalSourceRef.current.style.visibility = ''
      }
      setMounted(false)
      setIsClosing(false)
      setActiveRect(null)
      onOpenChange(false)

      // Devolve o foco ao elemento de origem ou ao último focado
      if (originalSourceRef.current) {
        originalSourceRef.current.focus?.()
      } else if (lastActiveElementRef.current) {
        lastActiveElementRef.current.focus?.()
      }
    }

    if (prefersReducedMotion) {
      finishClosing()
      return
    }

    // Retorna ao retângulo atual da origem
    const returnRect = originalSourceRef.current
      ? getElementRect(originalSourceRef.current)
      : activeRect || computeTargetRect()

    setActiveRect(returnRect)
    setBackdropOpacity(0)

    setTimeout(() => {
      finishClosing()
    }, 170)
  }, [isClosing, mounted, onOpenChange, prefersReducedMotion, activeRect])

  // Acessibilidade: navegação por teclado (Esc, setas, Tab trap)
  useEffect(() => {
    if (!mounted || isClosing) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        requestClose()
        return
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleNext()
        return
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrev()
        return
      }

      // Trap do Tab dentro do diálogo
      if (e.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        const first = focusableElements[0]
        const last = focusableElements[focusableElements.length - 1]

        if (!first || !last) return

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [mounted, isClosing, requestClose, handleNext, handlePrev])

  // Touch Swipe para mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX
    touchStartYRef.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return
    const endX = e.changedTouches[0].clientX
    const endY = e.changedTouches[0].clientY
    const diffX = endX - touchStartXRef.current
    const diffY = endY - touchStartYRef.current

    // Horizontal swipe predominante
    if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX < 0) {
        handleNext()
      } else {
        handlePrev()
      }
    }

    touchStartXRef.current = null
    touchStartYRef.current = null
  }

  if (!mounted || typeof document === 'undefined') {
    return null
  }

  const currentPhoto = photos[displayIndex]
  const currentUrl = currentPhoto ? getFullPhotoUrl(currentPhoto) : ''

  // Transições dinâmicas conforme a fase
  // Abertura: 350 ms, cubic-bezier(0.23, 1, 0.32, 1)
  // Fechamento: 160 ms, ease
  const cardTransition = prefersReducedMotion
    ? 'none'
    : isClosing
      ? 'top 160ms ease, left 160ms ease, width 160ms ease, height 160ms ease, border-radius 160ms ease'
      : 'top 350ms cubic-bezier(0.23, 1, 0.32, 1), left 350ms cubic-bezier(0.23, 1, 0.32, 1), width 350ms cubic-bezier(0.23, 1, 0.32, 1), height 350ms cubic-bezier(0.23, 1, 0.32, 1), border-radius 350ms cubic-bezier(0.23, 1, 0.32, 1)'

  const backdropTransition = prefersReducedMotion
    ? 'none'
    : isClosing
      ? 'opacity 160ms ease'
      : 'opacity 250ms ease'

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Fotos de ${propertyTitle}`}
      className="fixed inset-0 select-none"
      style={{ zIndex: 99999 }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Fundo escurecido: rgba(0, 0, 0, 0.42) com backdrop-filter blur(2px) */}
      <div
        role="button"
        tabIndex={-1}
        aria-label="Fechar zoom de foto"
        onClick={requestClose}
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.42)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          opacity: backdropOpacity,
          transition: backdropTransition,
          cursor: 'zoom-out',
        }}
        className="fixed inset-0 w-full h-full"
      />

      {/* Cartão flutuante nascido sobre a origem e animado até o destino */}
      {activeRect && (
        <div
          style={{
            position: 'fixed',
            top: activeRect.top,
            left: activeRect.left,
            width: activeRect.width,
            height: activeRect.height,
            borderRadius: activeRect.borderRadius,
            transition: cardTransition,
          }}
          className="overflow-hidden border border-border shadow-2xl bg-muted"
        >
          {/* Foto com proporção 4:3 e object-fit: cover */}
          {currentUrl ? (
            <img
              src={currentUrl}
              alt={`${propertyTitle} - Foto ${displayIndex + 1}`}
              style={{
                opacity: isDissolving ? 0.3 : 1,
                transition: prefersReducedMotion ? 'none' : 'opacity 200ms ease-in-out',
              }}
              className="w-full h-full object-cover pointer-events-none"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
              <Home className="h-12 w-12 stroke-[1.5]" />
              <span className="text-xs mt-2">Sem foto</span>
            </div>
          )}

          {/* Botão Fechar (44 px, .on-photo, canto superior direito) */}
          <button
            ref={closeButtonRef}
            type="button"
            onClick={requestClose}
            aria-label="Fechar fotos"
            className="absolute top-3 right-3 w-11 h-11 min-w-[44px] min-h-[44px] rounded-full on-photo border border-line text-foreground flex items-center justify-center shadow hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Contador "3 / 8" numa faixa .on-photo no canto inferior direito */}
          {count > 1 && (
            <div className="absolute bottom-3 right-3 on-photo border border-line px-3 py-1 rounded-full text-xs font-semibold tabular text-foreground shadow">
              {currentIndex + 1} / {count}
            </div>
          )}

          {/* Botões de navegação: anterior e próxima foto (círculos de 44 px, .on-photo) */}
          {count > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handlePrev()
                }}
                aria-label="Foto anterior"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 min-w-[44px] min-h-[44px] rounded-full on-photo border border-line text-foreground flex items-center justify-center shadow hover:opacity-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleNext()
                }}
                aria-label="Próxima foto"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 min-w-[44px] min-h-[44px] rounded-full on-photo border border-line text-foreground flex items-center justify-center shadow hover:opacity-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      )}
    </div>,
    document.body,
  )
}

export default PhotoZoom
