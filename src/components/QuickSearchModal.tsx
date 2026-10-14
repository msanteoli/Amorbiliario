import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { ALL_NAV_ITEMS, isItemVisibleForRole, type NavItemConfig } from '@/config/navegacao'
import { searchPropertiesForQuickFind } from '@/services/properties'
import { searchLeadsForQuickFind } from '@/services/leads'
import { searchClientsForQuickFind } from '@/services/clients'
import { Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuickSearchModalProps {
  open: boolean
  onClose: () => void
}

interface SearchGroupItem {
  id: string
  title: string
  subtitle?: string
  badge?: string
  href: string
  group: 'Telas' | 'Imóveis' | 'Leads' | 'Clientes'
}

export function QuickSearchModal({ open, onClose }: QuickSearchModalProps) {
  const { user } = useAuth()
  const role = user?.role
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const [screenResults, setScreenResults] = useState<SearchGroupItem[]>([])
  const [propertyResults, setPropertyResults] = useState<SearchGroupItem[]>([])
  const [leadResults, setLeadResults] = useState<SearchGroupItem[]>([])
  const [clientResults, setClientResults] = useState<SearchGroupItem[]>([])

  // Foca no input sempre que abrir
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setScreenResults([])
      setPropertyResults([])
      setLeadResults([])
      setClientResults([])
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }, [open])

  // Busca telas visíveis para o papel
  // Memorizado: um array novo a cada renderização fazia o efeito de busca rodar sem parar (laço infinito)
  const visibleNavItems: NavItemConfig[] = useMemo(
    () => ALL_NAV_ITEMS.filter((item) => isItemVisibleForRole(item, role)),
    [role],
  )

  // Executa busca com debounce de 250ms a partir de 2 letras
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      // Só limpa se houver o que limpar: um [] novo a cada vez provocava nova renderização
      setScreenResults((prev) => (prev.length ? [] : prev))
      setPropertyResults((prev) => (prev.length ? [] : prev))
      setLeadResults((prev) => (prev.length ? [] : prev))
      setClientResults((prev) => (prev.length ? [] : prev))
      setLoading(false)
      setSelectedIndex(0)
      return
    }

    setLoading(true)

    // 1. Telas síncronas
    const lower = trimmed.toLowerCase()
    const matchedScreens: SearchGroupItem[] = visibleNavItems
      .filter((item) => item.label.toLowerCase().includes(lower))
      .slice(0, 5)
      .map((item) => ({
        id: `tela-${item.id}`,
        title: item.label,
        href: item.href,
        group: 'Telas',
      }))
    setScreenResults(matchedScreens)

    const timer = setTimeout(async () => {
      try {
        const [props, leads, clients] = await Promise.all([
          searchPropertiesForQuickFind(trimmed, 5).catch(() => []),
          searchLeadsForQuickFind(trimmed, 5).catch(() => []),
          searchClientsForQuickFind(trimmed, 5).catch(() => []),
        ])

        setPropertyResults(
          props.map((p) => ({
            id: `prop-${p.id}`,
            title: p.code,
            subtitle: p.title,
            href: `/imoveis/${p.id}`,
            group: 'Imóveis' as const,
          })),
        )

        setLeadResults(
          leads.map((l) => ({
            id: `lead-${l.id}`,
            title: l.name,
            subtitle: l.phone,
            badge: l.stage,
            href: `/leads/${l.id}`,
            group: 'Leads' as const,
          })),
        )

        setClientResults(
          clients.map((c) => ({
            id: `client-${c.id}`,
            title: c.name,
            subtitle: c.phone,
            href: `/clientes/${c.id}`,
            group: 'Clientes' as const,
          })),
        )
      } finally {
        setLoading(false)
        setSelectedIndex(0)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [query, visibleNavItems])

  // Lista plana de todos os resultados combinados para controle do teclado
  const allResults: SearchGroupItem[] = [
    ...screenResults,
    ...propertyResults,
    ...leadResults,
    ...clientResults,
  ]

  const handleSelect = useCallback(
    (item: SearchGroupItem) => {
      onClose()
      navigate(item.href)
    },
    [navigate, onClose],
  )

  // Tratamento do teclado (setas para cima/baixo, Enter e Esc)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }

    if (allResults.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % allResults.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + allResults.length) % allResults.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const current = allResults[selectedIndex]
      if (current) {
        handleSelect(current)
      }
    }
  }

  // Rola até o item selecionado
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[aria-selected="true"]')
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  if (!open) return null

  const hasSearchTerm = query.trim().length >= 2
  const hasNoResults = hasSearchTerm && !loading && allResults.length === 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Busca rápida"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] mt-[12vh] bg-card text-card-foreground border border-border rounded-lg shadow-2xl overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Campo de busca grande */}
        <div className="relative flex items-center border-b border-border px-4 py-3 bg-card">
          <Search className="h-5 w-5 text-muted-foreground shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Código do imóvel, nome, telefone ou tela"
            aria-autocomplete="list"
            aria-controls="quick-search-listbox"
            className="w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none font-sans"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-2" />}
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted border border-border rounded ml-2">
            ESC
          </kbd>
        </div>

        {/* Lista de resultados agrupada */}
        <div
          ref={listRef}
          id="quick-search-listbox"
          role="listbox"
          aria-label="Resultados da busca"
          className="max-h-[60vh] overflow-y-auto p-2 space-y-3"
        >
          {query.trim().length > 0 && query.trim().length < 2 && (
            <div className="p-4 text-center text-xs text-muted-foreground font-sans">
              Digite pelo menos 2 caracteres para buscar...
            </div>
          )}

          {hasNoResults && (
            <div className="p-6 text-center text-sm text-muted-foreground font-sans">
              Nada encontrado. Tente o código do imóvel (AP-0031) ou parte do nome.
            </div>
          )}

          {screenResults.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-medium font-sans text-muted-foreground">
                Telas
              </div>
              <ul className="space-y-0.5 list-none p-0 m-0">
                {screenResults.map((item) => {
                  const idx = allResults.findIndex((r) => r.id === item.id)
                  const isSelected = idx === selectedIndex
                  return (
                    <li
                      key={item.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 text-sm rounded cursor-pointer font-sans transition-colors',
                        isSelected
                          ? 'bg-primary text-primary-foreground font-medium'
                          : 'hover:bg-muted text-foreground',
                      )}
                    >
                      <span>{item.title}</span>
                      <span
                        className={cn(
                          'text-xs',
                          isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground',
                        )}
                      >
                        Navegar
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {propertyResults.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-medium font-sans text-muted-foreground">
                Imóveis
              </div>
              <ul className="space-y-0.5 list-none p-0 m-0">
                {propertyResults.map((item) => {
                  const idx = allResults.findIndex((r) => r.id === item.id)
                  const isSelected = idx === selectedIndex
                  return (
                    <li
                      key={item.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 text-sm rounded cursor-pointer font-sans transition-colors',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted text-foreground',
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-mono text-xs font-semibold px-1.5 py-0.5 bg-muted/80 text-foreground rounded">
                          {item.title}
                        </span>
                        <span className="truncate text-sm">{item.subtitle}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {leadResults.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-medium font-sans text-muted-foreground">
                Leads
              </div>
              <ul className="space-y-0.5 list-none p-0 m-0">
                {leadResults.map((item) => {
                  const idx = allResults.findIndex((r) => r.id === item.id)
                  const isSelected = idx === selectedIndex
                  return (
                    <li
                      key={item.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 text-sm rounded cursor-pointer font-sans transition-colors',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted text-foreground',
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-medium text-sm truncate">{item.title}</span>
                        {item.subtitle && (
                          <span
                            className={cn(
                              'text-xs font-mono',
                              isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground',
                            )}
                          >
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                      {item.badge && (
                        <span
                          className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded capitalize shrink-0 ml-2',
                            isSelected
                              ? 'bg-primary-foreground/20 text-primary-foreground'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {clientResults.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-medium font-sans text-muted-foreground">
                Clientes
              </div>
              <ul className="space-y-0.5 list-none p-0 m-0">
                {clientResults.map((item) => {
                  const idx = allResults.findIndex((r) => r.id === item.id)
                  const isSelected = idx === selectedIndex
                  return (
                    <li
                      key={item.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 text-sm rounded cursor-pointer font-sans transition-colors',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted text-foreground',
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-medium text-sm truncate">{item.title}</span>
                        {item.subtitle && (
                          <span
                            className={cn(
                              'text-xs font-mono',
                              isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground',
                            )}
                          >
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {!hasSearchTerm && (
            <div className="p-4 text-center text-xs text-muted-foreground font-sans space-y-1">
              <p>Digite pelo menos 2 caracteres para pesquisar</p>
              <p className="text-[11px] text-muted-foreground/80">
                Busca em Telas, Imóveis, Leads e Clientes
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
