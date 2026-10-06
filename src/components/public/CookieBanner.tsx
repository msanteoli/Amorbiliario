import React, { useEffect, useState } from 'react'
import { getConsent, setConsent } from '@/lib/marketing'
import { Button } from '@/components/ui/button'

interface CookieBannerProps {
  forceOpen?: boolean
  onClose?: () => void
}

export const CookieBanner: React.FC<CookieBannerProps> = ({ forceOpen, onClose }) => {
  const [isVisible, setIsVisible] = useState(false)

  // Verifica se as variáveis de Meta ou Google estão configuradas
  const metaId = (import.meta.env.VITE_META_PIXEL_ID || '').trim()
  const googleId = (import.meta.env.VITE_GOOGLE_ADS_ID || '').trim()
  const hasMarketingPixels = Boolean(metaId || googleId)

  useEffect(() => {
    if (!hasMarketingPixels) {
      setIsVisible(false)
      return
    }

    if (forceOpen) {
      setIsVisible(true)
      return
    }

    const consent = getConsent()
    if (!consent) {
      setIsVisible(true)
    } else {
      setIsVisible(false)
    }
  }, [forceOpen, hasMarketingPixels])

  if (!hasMarketingPixels || !isVisible) {
    return null
  }

  const handleAccept = () => {
    setConsent('accepted')
    setIsVisible(false)
    if (onClose) onClose()
  }

  const handleDecline = () => {
    setConsent('declined')
    setIsVisible(false)
    if (onClose) onClose()
  }

  return (
    <div
      role="region"
      aria-label="Aviso de cookies e privacidade"
      className="fixed bottom-0 inset-x-0 z-50 p-4 bg-background/95 backdrop-blur-md border-t border-border shadow-lg"
    >
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-foreground text-center sm:text-left">
          Usamos cookies de marketing para medir o resultado dos nossos anúncios. Você pode recusar
          sem perder nada no site.
        </p>
        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-center">
          <Button
            type="button"
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={handleDecline}
          >
            Recusar
          </Button>
          <Button
            type="button"
            variant="default"
            className="flex-1 sm:flex-none"
            onClick={handleAccept}
          >
            Aceitar
          </Button>
        </div>
      </div>
    </div>
  )
}
