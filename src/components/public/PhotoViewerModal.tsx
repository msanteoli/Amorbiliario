import React, { useEffect, useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { getFullPhotoUrl } from '@/lib/publicSiteUtils'
import { ChevronLeft, ChevronRight, X, Home } from 'lucide-react'

interface PhotoViewerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  photos: string[]
  initialIndex?: number
  propertyTitle: string
}

export const PhotoViewerModal: React.FC<PhotoViewerModalProps> = ({
  open,
  onOpenChange,
  photos,
  initialIndex = 0,
  propertyTitle,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex)
    }
  }, [open, initialIndex])

  const nextPhoto = useCallback(() => {
    if (!photos.length) return
    setCurrentIndex((prev) => (prev + 1) % photos.length)
  }, [photos.length])

  const prevPhoto = useCallback(() => {
    if (!photos.length) return
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length)
  }, [photos.length])

  // Navegação por teclado (Escape, ArrowLeft, ArrowRight)
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        nextPhoto()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prevPhoto()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, nextPhoto, prevPhoto])

  if (!photos.length) return null

  const currentUrl = getFullPhotoUrl(photos[currentIndex])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] sm:max-w-5xl h-[90vh] p-0 bg-background/95 backdrop-blur-xl border-border flex flex-col overflow-hidden rounded-[16px] shadow-2xl">
        <DialogTitle className="sr-only">Fotos de {propertyTitle}</DialogTitle>

        {/* Topo do visualizador */}
        <div className="h-14 px-4 sm:px-6 flex items-center justify-between border-b border-border/60 shrink-0">
          <div className="text-sm font-medium text-foreground truncate max-w-[240px] sm:max-w-md">
            {currentIndex + 1} de {photos.length} · {propertyTitle}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar galeria"
            className="w-10 h-10 rounded-full hover:bg-muted text-foreground flex items-center justify-center transition-colors min-h-[44px] min-w-[44px]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Área da foto com controles */}
        <div className="relative flex-1 flex items-center justify-center p-4 overflow-hidden select-none">
          {currentUrl ? (
            <img
              src={currentUrl}
              alt={`${propertyTitle} - Foto ${currentIndex + 1}`}
              className="max-h-full max-w-full object-contain rounded-[8px]"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground p-8">
              <Home className="h-16 w-16 stroke-[1.5]" />
              <span className="text-sm mt-2 font-medium">Foto indisponível</span>
            </div>
          )}

          {/* Botões de seta */}
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={prevPhoto}
                aria-label="Foto anterior"
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-background/80 hover:bg-background border border-border text-foreground flex items-center justify-center shadow-md transition-all min-h-[44px] min-w-[44px]"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={nextPhoto}
                aria-label="Próxima foto"
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-background/80 hover:bg-background border border-border text-foreground flex items-center justify-center shadow-md transition-all min-h-[44px] min-w-[44px]"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
        </div>

        {/* Faixa inferior de miniaturas */}
        {photos.length > 1 && (
          <div className="h-20 border-t border-border/60 px-4 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0 bg-background/50">
            {photos.map((ph, idx) => {
              const thumbUrl = getFullPhotoUrl(ph)
              const isActive = idx === currentIndex
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`Ir para a foto ${idx + 1}`}
                  className={`relative shrink-0 w-16 h-12 rounded-[6px] overflow-hidden border-2 transition-all min-h-[44px] ${
                    isActive
                      ? 'border-primary ring-1 ring-primary'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  {thumbUrl && (
                    <img
                      src={thumbUrl}
                      alt={`Miniatura ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
