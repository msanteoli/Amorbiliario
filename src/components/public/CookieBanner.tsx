import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
      className="fixed bottom-16 sm:bottom-4 inset-x-4 max-w-xl mx-auto z-50 p-4 sm:p-5 bg-card/98 backdrop-blur-md border border-border rounded-[12px] shadow-[0_6px_16px_rgba(0,0,0,0.12)] dark:shadow-none"
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-foreground text-left leading-relaxed">
          Usamos cookies de marketing para medir o resultado dos nossos anúncios. Você pode recusar
          sem perder nada no site.{' '}
          <Link
            to="/privacidade"
            className="text-foreground underline underline-offset-4 hover:opacity-80 transition-opacity whitespace-nowrap"
          >
            Saiba mais
          </Link>
          .
        </p>
        <div className="flex items-center gap-3 w-full justify-end">
          {/* Duas ações com o mesmo peso visual: "Aceitar" preenchida e "Recusar" de contorno */}
          <Button
            type="button"
            variant="outline"
            className="rounded-[8px] h-10 px-5 text-sm font-medium border-border min-h-[44px]"
            onClick={handleDecline}
          >
            Recusar
          </Button>
          <Button
            type="button"
            variant="default"
            className="rounded-[8px] h-10 px-5 text-sm font-medium min-h-[44px]"
            onClick={handleAccept}
          >
            Aceitar
          </Button>
        </div>
      </div>
    </div>
  )
}
