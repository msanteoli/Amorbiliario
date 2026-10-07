import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PublicContactModal } from './PublicContactModal'
import { CookieBanner } from './CookieBanner'
import { ThemeToggle } from '@/components/ThemeToggle'

interface PublicLayoutProps {
  children: React.ReactNode
  orgName?: string
  showContactButton?: boolean
  headerCenterSlot?: React.ReactNode
  mobileSubHeaderSlot?: React.ReactNode
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({
  children,
  orgName = 'Imobdigital',
  showContactButton = true,
  headerCenterSlot,
  mobileSubHeaderSlot,
}) => {
  const [contactOpen, setContactOpen] = useState(false)
  const [cookiePreferencesOpen, setCookiePreferencesOpen] = useState(false)

  const metaId = (import.meta.env.VITE_META_PIXEL_ID || '').trim()
  const googleId = (import.meta.env.VITE_GOOGLE_ADS_ID || '').trim()
  const hasMarketingPixels = Boolean(metaId || googleId)

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20">
      {/* Cabeçalho estilo Airbnb: barra fixa no topo com divisor de 1 px */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="h-20 flex items-center justify-between gap-3 sm:gap-4">
            {/* À esquerda: nome da imobiliária em texto (peso 600, sem ícone nem quadro colorido) */}
            <div className="flex-1 min-w-0 flex items-center">
              <Link
                to="/buscar"
                className="text-lg sm:text-xl font-semibold tracking-tight text-foreground hover:opacity-90 transition-opacity truncate"
              >
                {orgName}
              </Link>
            </div>

            {/* No centro (desktop): a busca em pílula */}
            {headerCenterSlot && (
              <div className="hidden md:flex flex-1 items-center justify-center px-4 max-w-2xl">
                {headerCenterSlot}
              </div>
            )}

            {/* À direita: botão "Falar com a imobiliária" (de contorno, raio 8 px) */}
            <div className="shrink-0 flex items-center">
              {showContactButton && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setContactOpen(true)}
                  aria-label="Falar com a imobiliária"
                  className="font-medium text-sm rounded-[8px] border-border hover:bg-muted text-foreground h-11 px-3 sm:px-4 min-h-[44px] min-w-[44px] inline-flex items-center justify-center transition-colors shrink-0"
                >
                  <MessageSquare className="h-4 w-4 sm:hidden shrink-0" aria-hidden="true" />
                  <span className="hidden sm:inline">Falar com a imobiliária</span>
                </Button>
              )}
            </div>
          </div>

          {/* No celular: a pílula de busca ocupa a largura toda numa segunda linha abaixo do nome */}
          {mobileSubHeaderSlot && (
            <div className="pb-3 md:hidden w-full">{mobileSubHeaderSlot}</div>
          )}
        </div>
      </header>

      {/* Conteúdo da página */}
      <main className="flex-1">{children}</main>

      {/* Rodapé: o nome e o ano, o ThemeToggle e, se existir, "Preferências de cookies" em texto simples, num divisor de 1 px */}
      <footer className="border-t border-border bg-background py-8 px-4 text-center text-sm text-muted-foreground">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {orgName}. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4">
            <ThemeToggle size="sm" />
            {hasMarketingPixels && (
              <button
                type="button"
                onClick={() => setCookiePreferencesOpen(true)}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors min-h-[44px] inline-flex items-center"
              >
                Preferências de cookies
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Modal de contato */}
      <PublicContactModal open={contactOpen} onOpenChange={setContactOpen} />

      {/* Banner de cookies */}
      <CookieBanner
        forceOpen={cookiePreferencesOpen}
        onClose={() => setCookiePreferencesOpen(false)}
      />
    </div>
  )
}
