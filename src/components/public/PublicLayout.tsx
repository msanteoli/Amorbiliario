import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { PublicContactModal } from './PublicContactModal'
import { CookieBanner } from './CookieBanner'
import { FloatingWhatsAppButton } from './FloatingWhatsAppButton'
import { ThemeToggle } from '@/components/ThemeToggle'

/**
 * Itens de menu configuráveis no topo para facilitar a manutenção pela equipe
 */
export interface HeaderMenuItem {
  label: string
  actionKey: 'comprar' | 'alugar' | 'contato'
}

export const HEADER_MENU_ITEMS: HeaderMenuItem[] = [
  { label: 'Comprar', actionKey: 'comprar' },
  { label: 'Alugar', actionKey: 'alugar' },
  { label: 'Falar com a imobiliária', actionKey: 'contato' },
]

import { getFilters, PublicFiltersResponse } from '@/services/publicSite'

/**
 * Cache simples em memória do resultado de getFilters() para evitar chamadas duplicadas
 * ao alternar ou re-renderizar componentes do site público.
 */
let filtersCachePromise: Promise<PublicFiltersResponse> | null = null
function loadCachedFilters(): Promise<PublicFiltersResponse> {
  if (!filtersCachePromise) {
    filtersCachePromise = getFilters().catch((err) => {
      filtersCachePromise = null
      throw err
    })
  }
  return filtersCachePromise
}

interface PublicLayoutProps {
  children: React.ReactNode
  orgName?: string
  whatsappEnabled?: boolean
  showContactButton?: boolean
  onSelectPurpose?: (purpose: 'venda' | 'locacao') => void
  onOpenContact?: () => void
  floatingWaClassName?: string
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({
  children,
  orgName = 'Imobdigital',
  whatsappEnabled,
  showContactButton = true,
  onSelectPurpose,
  onOpenContact,
  floatingWaClassName,
}) => {
  const [internalContactOpen, setInternalContactOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [cookiePreferencesOpen, setCookiePreferencesOpen] = useState(false)
  const [isWhatsappEnabled, setIsWhatsappEnabled] = useState<boolean>(whatsappEnabled ?? false)

  React.useEffect(() => {
    if (whatsappEnabled !== undefined) {
      setIsWhatsappEnabled(whatsappEnabled)
      return
    }

    let mounted = true
    loadCachedFilters()
      .then((res) => {
        if (mounted && res?.organization) {
          setIsWhatsappEnabled(Boolean(res.organization.whatsapp_enabled))
        }
      })
      .catch(() => {
        // Se falhar a busca de filtros, mantém oculto
        if (mounted) {
          setIsWhatsappEnabled(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [whatsappEnabled])

  const metaId = (import.meta.env.VITE_META_PIXEL_ID || '').trim()
  const googleId = (import.meta.env.VITE_GOOGLE_ADS_ID || '').trim()
  const hasMarketingPixels = Boolean(metaId || googleId)

  const handleOpenContactModal = () => {
    if (onOpenContact) {
      onOpenContact()
    } else {
      setInternalContactOpen(true)
    }
  }

  const handleMenuItemClick = (item: HeaderMenuItem) => {
    setMobileMenuOpen(false)

    if (item.actionKey === 'comprar') {
      if (onSelectPurpose) {
        onSelectPurpose('venda')
      } else {
        const heroEl = document.getElementById('hero-search-card')
        if (heroEl) {
          heroEl.scrollIntoView({ behavior: 'smooth' })
        }
      }
    } else if (item.actionKey === 'alugar') {
      if (onSelectPurpose) {
        onSelectPurpose('locacao')
      } else {
        const heroEl = document.getElementById('hero-search-card')
        if (heroEl) {
          heroEl.scrollIntoView({ behavior: 'smooth' })
        }
      }
    } else if (item.actionKey === 'contato') {
      handleOpenContactModal()
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20">
      {/* Cabeçalho estilo Airbnb: barra fixa no topo com divisor de 1 px e fundo opaco sem transparência */}
      <header className="pub-enter-header sticky top-0 z-40 w-full border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="h-20 flex items-center justify-between gap-3 sm:gap-4">
            {/* À esquerda: nome da imobiliária em texto (peso 600, sem logo) */}
            <div className="flex-1 min-w-0 flex items-center">
              <Link
                to="/"
                className="text-lg sm:text-xl font-semibold tracking-tight text-foreground hover:opacity-90 transition-opacity truncate min-h-[44px] inline-flex items-center"
              >
                {orgName}
              </Link>
            </div>

            {/* No desktop (a partir de md): Comprar, Alugar e a pílula de contorno Falar com a imobiliária */}
            <nav
              className="hidden md:flex items-center gap-2 lg:gap-3 shrink-0"
              aria-label="Menu principal"
            >
              {HEADER_MENU_ITEMS.map((item) => {
                if (item.actionKey === 'contato') {
                  if (!showContactButton) return null
                  return (
                    <Button
                      key={item.actionKey}
                      type="button"
                      variant="outline"
                      size="default"
                      onClick={() => handleMenuItemClick(item)}
                      aria-label={item.label}
                      className="font-medium text-sm rounded-full border-border hover:bg-muted text-foreground h-11 md:h-11 min-h-[44px] md:min-h-[44px] px-5 py-2.5 inline-flex items-center justify-center transition-colors shrink-0"
                    >
                      {item.label}
                    </Button>
                  )
                }

                return (
                  <button
                    key={item.actionKey}
                    type="button"
                    onClick={() => handleMenuItemClick(item)}
                    className="text-sm font-medium text-foreground hover:text-muted-foreground transition-colors px-3 py-2 min-h-[44px] inline-flex items-center"
                  >
                    {item.label}
                  </button>
                )
              })}
            </nav>

            {/* No celular: botão de menu (ícone, 44 px) à direita */}
            <div className="md:hidden shrink-0 flex items-center">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Abrir menu de navegação"
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[8px] border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Folha móvel de navegação para celular */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent
          side="right"
          className="w-[280px] sm:w-[320px] p-6 flex flex-col justify-between"
        >
          <div className="space-y-6">
            <SheetHeader className="text-left">
              <SheetTitle className="text-lg font-semibold text-foreground">{orgName}</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-2" aria-label="Menu móvel">
              {HEADER_MENU_ITEMS.map((item) => {
                if (item.actionKey === 'contato') {
                  if (!showContactButton) return null
                  return (
                    <Button
                      key={item.actionKey}
                      type="button"
                      variant="outline"
                      onClick={() => handleMenuItemClick(item)}
                      className="w-full justify-start rounded-full font-medium text-sm border-border h-11 min-h-[44px] mt-2"
                    >
                      {item.label}
                    </Button>
                  )
                }

                return (
                  <button
                    key={item.actionKey}
                    type="button"
                    onClick={() => handleMenuItemClick(item)}
                    className="w-full text-left py-3 px-3 text-base font-medium text-foreground hover:bg-muted rounded-[8px] transition-colors min-h-[44px] flex items-center"
                  >
                    {item.label}
                  </button>
                )
              })}
            </nav>
          </div>
          <div className="pt-6 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Tema</span>
            <ThemeToggle size="sm" />
          </div>
        </SheetContent>
      </Sheet>

      {/* Conteúdo da página */}
      <main className="flex-1">{children}</main>

      {/* Botão flutuante de WhatsApp (exibido somente quando organization.whatsapp_enabled for verdadeiro) */}
      {isWhatsappEnabled && <FloatingWhatsAppButton className={floatingWaClassName} />}

      {/* Rodapé: o nome e o ano, o ThemeToggle e, se existir, "Preferências de cookies" */}
      <footer className="border-t border-border bg-background pt-8 pb-24 px-4 text-center text-sm text-muted-foreground">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground leading-normal py-2">
            © {new Date().getFullYear()}{' '}
            <Link to="/" className="font-semibold text-foreground hover:underline inline">
              {orgName}
            </Link>
            . Todos os direitos reservados.
          </p>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-x-4 gap-y-2">
            <Link
              to="/privacidade"
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors min-h-[44px] inline-flex items-center px-1"
            >
              Política de Privacidade
            </Link>
            {hasMarketingPixels && (
              <button
                type="button"
                onClick={() => setCookiePreferencesOpen(true)}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors min-h-[44px] inline-flex items-center px-1"
              >
                Preferências de cookies
              </button>
            )}
            <div className="min-h-[44px] inline-flex items-center">
              <ThemeToggle large />
            </div>
          </div>
        </div>
      </footer>

      {/* Modal de contato */}
      <PublicContactModal open={internalContactOpen} onOpenChange={setInternalContactOpen} />

      {/* Banner de cookies */}
      <CookieBanner
        forceOpen={cookiePreferencesOpen}
        onClose={() => setCookiePreferencesOpen(false)}
      />
    </div>
  )
}
