import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PublicContactModal } from './PublicContactModal'
import { CookieBanner } from './CookieBanner'
import { ThemeToggle } from '@/components/ThemeToggle'

interface PublicLayoutProps {
  children: React.ReactNode
  orgName?: string
  showContactButton?: boolean
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({
  children,
  orgName = 'Imobdigital',
  showContactButton = true,
}) => {
  const [contactOpen, setContactOpen] = useState(false)
  const [cookiePreferencesOpen, setCookiePreferencesOpen] = useState(false)

  const metaId = (import.meta.env.VITE_META_PIXEL_ID || '').trim()
  const googleId = (import.meta.env.VITE_GOOGLE_ADS_ID || '').trim()
  const hasMarketingPixels = Boolean(metaId || googleId)

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20">
      {/* Cabeçalho simples com nome da imobiliária */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link
            to="/buscar"
            className="flex items-center gap-2.5 font-semibold text-lg text-foreground hover:opacity-90 transition-opacity"
          >
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <span className="truncate max-w-[200px] sm:max-w-md font-bold tracking-tight">
              {orgName}
            </span>
          </Link>

          {showContactButton && (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setContactOpen(true)}
              className="gap-2 font-medium shrink-0 h-9"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Falar com a imobiliária</span>
            </Button>
          )}
        </div>
      </header>

      {/* Conteúdo da página */}
      <main className="flex-1 pb-16">{children}</main>

      {/* Rodapé simples com link de preferências de cookies se houver tags */}
      <footer className="border-t border-border bg-background/50 py-8 px-4 text-center text-sm text-muted-foreground">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>
            © {new Date().getFullYear()} {orgName}. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4">
            <ThemeToggle size="sm" />
            {hasMarketingPixels && (
              <button
                type="button"
                onClick={() => setCookiePreferencesOpen(true)}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
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
