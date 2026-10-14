import { useState, useEffect, useRef, useId, useCallback } from 'react'
import { useLocation, Link, Outlet, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { useAuth } from '@/contexts/AuthContext'
import { getOrganization } from '@/services/admin'
import { AmorbiliarioLogo } from '@/components/AmorbiliarioLogo'
import { listLeads } from '@/services/leads'
import { listVisits } from '@/services/visits'
import { QuickSearchModal } from '@/components/QuickSearchModal'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import {
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu as MenuIcon,
  User,
  Building,
  Settings,
} from 'lucide-react'
import {
  PAINEL_NAV_ITEM,
  CONFIGURACOES_NAV_ITEM,
  NAV_GROUPS,
  isItemVisibleForRole,
  isNavItemActive,
  getBreadcrumbForPath,
  type NavItemConfig,
  type NavGroupConfig,
} from '@/config/navegacao'

const SIDEBAR_COLLAPSED_KEY = 'imobdigital_nav_collapsed'
const GROUP_COLLAPSED_KEY_PREFIX = 'imobdigital_group_open_'

function getFormattedRole(role?: string): string {
  if (role === 'admin') return 'Administrador(a)'
  if (role === 'sdr') return 'SDR'
  if (role === 'corretor') return 'Corretor(a)'
  return 'Colaborador(a)'
}

function getUserInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return parts[0].slice(0, 2).toUpperCase()
  }
  if (email && email.trim()) {
    const beforeAt = email.split('@')[0]
    return beforeAt.slice(0, 2).toUpperCase()
  }
  return 'ID'
}

function getUserDisplayName(name?: string, email?: string): string {
  if (name && name.trim()) return name.trim()
  if (email && email.trim()) return email.split('@')[0]
  return 'Usuário'
}

export function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const role = user?.role

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const [orgName, setOrgName] = useState<string>('')
  const [quickSearchOpen, setQuickSearchOpen] = useState(false)
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)

  // Contadores para os badges numéricos do menu lateral
  const [leadsBadgeCount, setLeadsBadgeCount] = useState<number | null>(null)
  const [agendaBadgeCount, setAgendaBadgeCount] = useState<number | null>(null)

  // Estado recolhido da barra lateral desktop (salvo em localStorage)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
    } catch {
      return false
    }
  })

  // Estado dos grupos recolhíveis (Atendimento, Imóveis) - começam abertos por padrão
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {
      atendimento: true,
      imoveis: true,
    }
    try {
      NAV_GROUPS.forEach((g) => {
        const saved = localStorage.getItem(`${GROUP_COLLAPSED_KEY_PREFIX}${g.id}`)
        if (saved !== null) {
          initial[g.id] = saved === 'true'
        }
      })
    } catch {
      // Ignora erro de storage
    }
    return initial
  })

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => {
      const nextState = !prev[groupId]
      try {
        localStorage.setItem(`${GROUP_COLLAPSED_KEY_PREFIX}${groupId}`, String(nextState))
      } catch {
        // Ignora erro de storage
      }
      return { ...prev, [groupId]: nextState }
    })
  }

  // Toggle do menu recolhido
  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      } catch {
        // Ignora erro de storage
      }
      return next
    })
  }

  // Atalho global Ctrl+K ou ⌘K
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setQuickSearchOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  // Carrega nome da organização
  useEffect(() => {
    let mounted = true
    getOrganization()
      .then((org) => {
        if (mounted && org?.name) {
          setOrgName(org.name)
        }
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  // Carrega contagens de Leads e Agenda para badges
  const loadBadgeCounts = useCallback(async () => {
    if (!role) return
    try {
      // 1. Leads:
      // admin / SDR: leads novos sem dono (newUnassignedOnly)
      // corretor: leads seus com prazo vencido (expiredOnly + assigned_to = user.id)
      if (role === 'admin' || role === 'sdr') {
        const res = await listLeads({ perPage: 1, newUnassignedOnly: true })
        setLeadsBadgeCount(res.totalItems > 0 ? res.totalItems : null)
      } else if (role === 'corretor' && user?.id) {
        const res = await listLeads({ perPage: 1, assigned_to: user.id, expiredOnly: true })
        setLeadsBadgeCount(res.totalItems > 0 ? res.totalItems : null)
      }

      // 2. Agenda: visitas de hoje
      const now = new Date()
      const startOfDayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const endOfDayIso = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999,
      ).toISOString()
      const brokerParam = role === 'corretor' ? user?.id : undefined
      const visitRes = await listVisits({
        brokerId: brokerParam,
        startDateIso: startOfDayIso,
        endDateIso: endOfDayIso,
        perPage: 1,
      })
      setAgendaBadgeCount(visitRes.totalItems > 0 ? visitRes.totalItems : null)
    } catch {
      // Silencioso se der erro de rede
    }
  }, [role, user?.id])

  useEffect(() => {
    loadBadgeCounts()
  }, [loadBadgeCounts, location.pathname])

  // Se a rota atual estiver em um grupo recolhido, ele se abre sozinho
  useEffect(() => {
    NAV_GROUPS.forEach((g) => {
      const hasActive = g.items.some(
        (item) =>
          isItemVisibleForRole(item, role) &&
          isNavItemActive(item.href, location.pathname, location.search),
      )
      if (hasActive && !openGroups[g.id]) {
        setOpenGroups((prev) => ({ ...prev, [g.id]: true }))
        try {
          localStorage.setItem(`${GROUP_COLLAPSED_KEY_PREFIX}${g.id}`, 'true')
        } catch {
          /* intentionally ignored */
        }
      }
    })
  }, [location.pathname, location.search, role, openGroups])

  // Indicador deslizante ativo no menu desktop
  const navRef = useRef<HTMLElement>(null)
  const [activeIndicatorStyle, setActiveIndicatorStyle] = useState<{
    top: number
    height: number
    visible: boolean
  }>({
    top: 0,
    height: 40,
    visible: false,
  })

  const updateActiveIndicator = useCallback(() => {
    if (!navRef.current) return
    const activeEl = navRef.current.querySelector<HTMLElement>('[aria-current="page"]')
    if (activeEl) {
      const navRect = navRef.current.getBoundingClientRect()
      const activeRect = activeEl.getBoundingClientRect()
      setActiveIndicatorStyle({
        top: activeRect.top - navRect.top + navRef.current.scrollTop,
        height: activeRect.height,
        visible: true,
      })
    } else {
      setActiveIndicatorStyle((prev) => ({ ...prev, visible: false }))
    }
  }, [])

  useEffect(() => {
    updateActiveIndicator()
    const timer = setTimeout(updateActiveIndicator, 50)
    const timer2 = setTimeout(updateActiveIndicator, 260)
    return () => {
      clearTimeout(timer)
      clearTimeout(timer2)
    }
  }, [updateActiveIndicator, location.pathname, location.search, openGroups, sidebarCollapsed])

  // Identificador de grupo
  const atendimentoGroupId = useId()
  const imoveisGroupId = useId()

  // Usuário display
  const userInitials = getUserInitials(user?.name, user?.email)
  const userDisplayName = getUserDisplayName(user?.name, user?.email)
  const userRoleFormatted = getFormattedRole(user?.role)
  const breadcrumb = getBreadcrumbForPath(location.pathname)

  // Itens visíveis para o papel
  const visibleGroups: NavGroupConfig[] = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => isItemVisibleForRole(item, role)),
  })).filter((g) => g.items.length > 0)

  // Render do link de item desktop
  const renderDesktopNavLink = (item: NavItemConfig) => {
    const Icon = item.icon
    const isActive = isNavItemActive(item.href, location.pathname, location.search)

    let badgeCount: number | null = null
    if (item.id === 'leads') badgeCount = leadsBadgeCount
    if (item.id === 'agenda') badgeCount = agendaBadgeCount

    if (sidebarCollapsed) {
      return (
        <Tooltip key={item.id} delayDuration={0}>
          <TooltipTrigger asChild>
            <Link
              to={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group relative flex items-center justify-center w-10 h-10 mx-auto rounded-[4px] transition-colors z-10',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nav-accent)]',
                isActive
                  ? 'text-[var(--nav-ink)]'
                  : 'text-[var(--nav-fg)] hover:text-[var(--nav-ink)] hover:bg-[var(--nav-hover)]',
              )}
            >
              <Icon
                className={cn(
                  'h-[18px] w-[18px] shrink-0 transition-transform active:scale-90',
                  isActive ? 'text-[var(--nav-accent)]' : 'text-[var(--nav-fg)]',
                )}
                strokeWidth={1.75}
              />
              <span className="sr-only">{item.label}</span>
              {badgeCount !== null && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--nav-accent)]" />
              )}
            </Link>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={12}
            className="bg-[var(--nav-bg)] text-[var(--nav-ink)] border-[var(--nav-line)]"
          >
            {item.label}
          </TooltipContent>
        </Tooltip>
      )
    }

    return (
      <Link
        key={item.id}
        to={item.href}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'group relative flex items-center justify-between h-10 px-3 rounded-[4px] font-sans text-sm transition-colors z-10 select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nav-accent)]',
          isActive
            ? 'text-[var(--nav-ink)] font-medium'
            : 'text-[var(--nav-fg)] hover:text-[var(--nav-ink)] hover:bg-[var(--nav-hover)]',
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Icon
            className={cn(
              'h-[18px] w-[18px] shrink-0 transition-transform active:scale-90',
              isActive ? 'text-[var(--nav-accent)]' : 'text-[var(--nav-fg)]',
            )}
            strokeWidth={1.75}
          />
          <span className="truncate">{item.label}</span>
        </div>

        {badgeCount !== null && (
          <span className="font-mono text-[11px] text-[var(--nav-mute)] pl-2 tabular">
            {badgeCount}
          </span>
        )}
      </Link>
    )
  }

  // ═════════════════════════════════════════════════════════════════════
  // CELULAR (abaixo de 768px):
  // 5 posições na barra inferior: Painel, Leads, Agenda, Imóveis e Mais.
  // "Mais" abre folha escura de baixo para cima com os demais itens do papel:
  // - Atendimento: Clientes
  // - Imóveis: Condomínios
  // - Configurações: Configurações
  // ═════════════════════════════════════════════════════════════════════
  const mobileFixedItems: NavItemConfig[] = [
    PAINEL_NAV_ITEM,
    {
      id: 'leads',
      label: 'Leads',
      href: '/leads',
      icon: NAV_GROUPS[0].items[0].icon,
      roles: ['admin', 'sdr', 'corretor'],
    },
    {
      id: 'agenda',
      label: 'Agenda',
      href: '/agenda',
      icon: NAV_GROUPS[0].items[2].icon,
      roles: ['admin', 'sdr', 'corretor'],
    },
    {
      id: 'imoveis',
      label: 'Imóveis',
      href: '/imoveis',
      icon: NAV_GROUPS[1].items[0].icon,
      roles: ['admin', 'sdr', 'corretor'],
    },
  ]

  // Indicador do celular (5 posições: 0, 1, 2, 3, 4)
  const getMobileActiveIndex = (): number => {
    if (isNavItemActive(PAINEL_NAV_ITEM.href, location.pathname, location.search)) return 0
    if (isNavItemActive('/leads', location.pathname, location.search)) return 1
    if (isNavItemActive('/agenda', location.pathname, location.search)) return 2
    if (isNavItemActive('/imoveis', location.pathname, location.search)) return 3

    // Itens que pertencem ao Mais: /clientes, /condominios, /configuracoes, /admin, /portais, /backup
    if (
      isNavItemActive('/clientes', location.pathname, location.search) ||
      isNavItemActive('/condominios', location.pathname, location.search) ||
      isNavItemActive('/configuracoes', location.pathname, location.search) ||
      isNavItemActive('/admin', location.pathname, location.search) ||
      isNavItemActive('/portais', location.pathname, location.search) ||
      isNavItemActive('/backup', location.pathname, location.search)
    ) {
      return 4
    }
    return -1
  }

  const mobileActiveIndex = getMobileActiveIndex()
  const isMoreActive = mobileActiveIndex === 4

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Busca rápida com Ctrl+K */}
      <QuickSearchModal open={quickSearchOpen} onClose={() => setQuickSearchOpen(false)} />

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* MENU LATERAL DESKTOP (>= 768px): 248 px de largura, fundo escuro */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <aside
        aria-label="Barra de navegação"
        className={cn(
          'hidden md:flex flex-col shrink-0 border-r border-[var(--nav-line)] bg-[var(--nav-bg)] text-[var(--nav-fg)] transition-[width] duration-200 select-none relative z-30',
          sidebarCollapsed ? 'w-[68px]' : 'w-[248px]',
        )}
      >
        {/* Topo de 64 px */}
        <div
          className={cn(
            'group/top h-16 flex items-center border-b border-[var(--nav-line)] px-4 relative',
            sidebarCollapsed ? 'justify-center' : 'justify-between',
          )}
        >
          <Link
            to="/hoje"
            className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nav-accent)] rounded-[4px]"
            title="Ir para o início"
            aria-label="Ir para o início"
          >
            {/* SVG do cômodo com porta aberta (26 px, traço em --nav-accent) */}
            <svg
              viewBox="0 0 48 48"
              fill="none"
              className="w-[26px] h-[26px] text-[var(--nav-accent)] shrink-0"
              aria-hidden="true"
            >
              <path
                d="M22 42H6V6h36v36h-4"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="square"
              />
              <path d="M38 42V26" stroke="currentColor" strokeWidth="4" strokeLinecap="square" />
              <path d="M22 42a16 16 0 0 1 16-16" stroke="currentColor" strokeWidth="2" />
            </svg>

            {!sidebarCollapsed && <AmorbiliarioLogo className="h-[18px] text-[var(--nav-ink)]" />}
          </Link>

          {/* Botão de 32 px com seta ‹ que recolhe o menu */}
          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            aria-expanded={!sidebarCollapsed}
            aria-label={sidebarCollapsed ? 'Abrir menu' : 'Recolher menu'}
            className={cn(
              'w-8 h-8 rounded-[4px] flex items-center justify-center text-[var(--nav-mute)] hover:text-[var(--nav-ink)] hover:bg-[var(--nav-hover)] transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nav-accent)]',
              sidebarCollapsed
                ? 'absolute inset-0 m-auto opacity-0 group-hover/top:opacity-100 focus:opacity-100'
                : 'opacity-100',
            )}
          >
            <ChevronLeft
              className={cn(
                'h-4 w-4 transition-transform duration-200',
                sidebarCollapsed ? 'rotate-180' : '',
              )}
            />
          </button>
        </div>

        {/* Busca rápida no menu lateral */}
        <div className="p-3">
          {sidebarCollapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setQuickSearchOpen(true)}
                  aria-label="Buscar"
                  className={cn(
                    'w-10 h-10 mx-auto rounded-[4px] border border-[var(--nav-line)] bg-white/[0.03] flex items-center justify-center text-[var(--nav-mute)] hover:text-[var(--nav-ink)] hover:bg-[var(--nav-hover)] transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nav-accent)]',
                  )}
                >
                  <Search className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                sideOffset={12}
                className="bg-[var(--nav-bg)] text-[var(--nav-ink)] border-[var(--nav-line)]"
              >
                Buscar (Ctrl K)
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={() => setQuickSearchOpen(true)}
              className={cn(
                'w-full h-[38px] px-3 rounded-[4px] border border-[var(--nav-line)] bg-white/[0.03] flex items-center justify-between text-[var(--nav-mute)] hover:text-[var(--nav-ink)] hover:bg-[var(--nav-hover)] transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nav-accent)] select-none',
              )}
            >
              <div className="flex items-center gap-2.5">
                <Search className="h-4 w-4 text-[var(--nav-mute)]" />
                <span className="text-sm font-sans text-[var(--nav-fg)]">Buscar</span>
              </div>
              <kbd className="font-mono text-[11px] px-1.5 py-0.5 rounded border border-[var(--nav-line)] bg-white/[0.04] text-[var(--nav-mute)]">
                Ctrl K
              </kbd>
            </button>
          )}
        </div>

        {/* Navegação Principal */}
        <nav
          ref={navRef}
          aria-label="Menu principal"
          className="flex-1 flex flex-col justify-between px-3 py-1 overflow-y-auto overflow-x-hidden relative"
        >
          {/* Indicador que desliza por trás dos itens */}
          {activeIndicatorStyle.visible && (
            <div
              className="absolute left-3 right-3 rounded-[4px] bg-[var(--nav-active)] transition-all duration-[260ms] pointer-events-none z-0"
              style={{
                top: `${activeIndicatorStyle.top}px`,
                height: `${activeIndicatorStyle.height}px`,
                transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}
              aria-hidden="true"
            >
              {/* Filete de 3px à esquerda com brilho */}
              <span
                className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l bg-[var(--nav-accent)]"
                style={{
                  boxShadow: '0 0 10px 1px rgba(142, 166, 255, 0.55)',
                }}
              />
            </div>
          )}

          <div className="space-y-3">
            {/* Painel (sozinho no topo) */}
            <div>{renderDesktopNavLink(PAINEL_NAV_ITEM)}</div>

            {/* Grupos de navegação */}
            {visibleGroups.map((group) => {
              const isOpen = openGroups[group.id] !== false
              const groupId = group.id === 'atendimento' ? atendimentoGroupId : imoveisGroupId
              const listId = `group-list-${group.id}`

              return (
                <div key={group.id} role="group" aria-labelledby={groupId} className="space-y-1">
                  {sidebarCollapsed ? (
                    <div
                      className="my-2 border-t border-[var(--nav-line)] mx-1"
                      aria-hidden="true"
                    />
                  ) : (
                    <button
                      type="button"
                      id={groupId}
                      onClick={() => toggleGroup(group.id)}
                      aria-expanded={isOpen}
                      aria-controls={listId}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-1.5 font-sans font-medium text-[12px] text-[var(--nav-mute)] hover:text-[var(--nav-ink)] rounded-[4px] transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nav-accent)]',
                      )}
                    >
                      <span>{group.title}</span>
                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 transition-transform duration-200',
                          isOpen ? '' : '-rotate-90',
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  )}

                  {/* Conteúdo recolhível com animação grid-template-rows */}
                  <div
                    id={listId}
                    className={cn(
                      'grid transition-all duration-[240ms] ease-out',
                      sidebarCollapsed || isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                    )}
                  >
                    <div className="overflow-hidden">
                      <ul className="space-y-0.5 list-none p-0 m-0">
                        {group.items.map((item) => (
                          <li key={item.id}>{renderDesktopNavLink(item)}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Rodapé do menu: divisor --nav-line e Configurações */}
          <div className="pt-3 pb-2 mt-auto">
            <div className="border-t border-[var(--nav-line)] mb-2" />
            <div>{renderDesktopNavLink(CONFIGURACOES_NAV_ITEM)}</div>
          </div>
        </nav>
      </aside>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* ÁREA PRINCIPAL */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* BARRA SUPERIOR DESKTOP (64 px, fixa no topo da área de conteúdo, fundo canvas 88% com blur 8px) */}
        <header className="hidden md:flex h-16 shrink-0 items-center justify-between border-b border-border px-6 sticky top-0 z-20 bg-background/88 backdrop-blur-[8px]">
          {/* Breadcrumb à esquerda: Atendimento / Leads */}
          <div className="flex items-center gap-2 text-sm font-sans">
            {breadcrumb.group && (
              <>
                <span className="text-muted-foreground">{breadcrumb.group}</span>
                <span className="text-muted-foreground/60">/</span>
              </>
            )}
            <span className="font-semibold text-foreground">{breadcrumb.screen}</span>
          </div>

          {/* Usuário logado à direita (Dropdown) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Menu do usuário"
                className={cn(
                  'flex items-center gap-3 p-1.5 rounded-lg hover:bg-muted/50 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring select-none text-left',
                )}
              >
                {/* Círculo de 34 px em primary com iniciais em primary-foreground (Plex Sans 600, 13 px) */}
                <div className="w-[34px] h-[34px] rounded-full bg-primary text-primary-foreground font-sans font-semibold text-[13px] flex items-center justify-center shrink-0 shadow-sm">
                  {userInitials}
                </div>

                <div className="min-w-0">
                  <div className="font-sans font-semibold text-[14px] leading-tight text-foreground truncate">
                    {userDisplayName}
                  </div>
                  <div className="font-sans text-[12px] leading-tight text-muted-foreground truncate">
                    {userRoleFormatted} {orgName ? `· ${orgName}` : ''}
                  </div>
                </div>

                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-[230px] rounded-[8px] p-2 border border-border bg-popover shadow-md font-sans"
            >
              <DropdownMenuLabel className="font-normal px-2 py-1.5">
                <div className="text-sm font-semibold text-foreground truncate">
                  {userDisplayName}
                </div>
                <div className="text-xs text-muted-foreground truncate font-mono">
                  {user?.email}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => navigate('/configuracoes')}
                className="cursor-pointer font-sans text-xs py-2 px-2"
              >
                <Settings className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>Minha conta e preferências</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-destructive focus:text-destructive font-sans text-xs py-2 px-2"
              >
                <LogOut className="h-4 w-4 mr-2" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* BARRA SUPERIOR CELULAR (< 768px): 56 px */}
        <header className="md:hidden sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur">
          {/* Símbolo e palavra à esquerda */}
          <Link
            to="/hoje"
            className="flex items-center gap-2 min-w-0"
            aria-label="Ir para o início"
          >
            <svg
              viewBox="0 0 48 48"
              fill="none"
              className="w-6 h-6 text-primary shrink-0"
              aria-hidden="true"
            >
              <path
                d="M22 42H6V6h36v36h-4"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="square"
              />
              <path d="M38 42V26" stroke="currentColor" strokeWidth="4" strokeLinecap="square" />
              <path d="M22 42a16 16 0 0 1 16-16" stroke="currentColor" strokeWidth="2" />
            </svg>
            <AmorbiliarioLogo className="h-[12px] min-[380px]:h-[14px] text-foreground max-w-[150px] min-[380px]:max-w-none" />
          </Link>

          {/* Lupa e círculo com iniciais à direita */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setQuickSearchOpen(true)}
              aria-label="Buscar"
              className="w-11 h-11 flex items-center justify-center rounded-full text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Search className="h-5 w-5" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Minha conta"
                  className="w-11 h-11 flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-sans font-semibold text-[13px] flex items-center justify-center">
                    {userInitials}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 p-2 font-sans">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {userDisplayName}
                  </div>
                  <div className="text-xs text-muted-foreground truncate font-mono">
                    {user?.email}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {userRoleFormatted} {orgName ? `· ${orgName}` : ''}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate('/configuracoes')}
                  className="cursor-pointer text-xs"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  <span>Minha conta e preferências</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-destructive focus:text-destructive text-xs"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* CONTEÚDO PRINCIPAL (com animação screen-fade-in) */}
        <main
          key={location.pathname}
          className="flex-1 p-4 sm:p-6 md:p-8 pb-24 md:pb-8 screen-fade-in"
        >
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* BARRA INFERIOR CELULAR: fundo escuro (--nav-bg), 5 posições */}
        {/* Painel, Leads, Agenda, Imóveis e Mais */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <nav
          aria-label="Menu principal móvel"
          className="md:hidden fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 items-center border-t border-[var(--nav-line)] bg-[var(--nav-bg)] px-1 py-1"
        >
          {/* Traço superior de 2px que desliza até o item ativo (260ms) */}
          {mobileActiveIndex >= 0 && (
            <div
              className="absolute top-0 h-[2px] bg-[var(--nav-accent)] transition-all duration-[260ms] ease-out pointer-events-none"
              style={{
                width: '20%',
                left: `${mobileActiveIndex * 20}%`,
              }}
              aria-hidden="true"
            />
          )}

          {mobileFixedItems.map((item, index) => {
            const Icon = item.icon
            const isActive = mobileActiveIndex === index

            return (
              <Link
                key={item.id}
                to={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex flex-col items-center justify-center min-h-[44px] h-12 w-full px-0.5 rounded-[4px] transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nav-accent)]',
                  isActive ? 'text-[var(--nav-ink)] font-medium' : 'text-[var(--nav-mute)]',
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 shrink-0 transition-transform active:scale-90',
                    isActive ? 'text-[var(--nav-accent)]' : 'text-[var(--nav-mute)]',
                  )}
                  strokeWidth={1.75}
                />
                <span className="text-[10px] font-sans leading-tight truncate max-w-full text-center mt-0.5">
                  {item.label}
                </span>
              </Link>
            )
          })}

          {/* 5º item: Mais (abre a folha inferior) */}
          <button
            type="button"
            onClick={() => setMobileMoreOpen(true)}
            aria-label="Mais opções de navegação"
            aria-haspopup="dialog"
            aria-expanded={mobileMoreOpen}
            className={cn(
              'relative flex flex-col items-center justify-center min-h-[44px] h-12 w-full px-0.5 rounded-[4px] transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nav-accent)]',
              isMoreActive ? 'text-[var(--nav-ink)] font-medium' : 'text-[var(--nav-mute)]',
            )}
          >
            <MenuIcon
              className={cn(
                'h-5 w-5 shrink-0 transition-transform active:scale-90',
                isMoreActive ? 'text-[var(--nav-accent)]' : 'text-[var(--nav-mute)]',
              )}
              strokeWidth={1.75}
            />
            <span className="text-[10px] font-sans leading-tight truncate max-w-full text-center mt-0.5">
              Mais
            </span>
          </button>
        </nav>

        {/* Folha escura "Mais" (Sheet de baixo para cima, 260ms) */}
        <Sheet open={mobileMoreOpen} onOpenChange={setMobileMoreOpen}>
          <SheetContent
            side="bottom"
            className="p-4 rounded-t-2xl max-h-[85vh] overflow-y-auto bg-[var(--nav-bg)] text-[var(--nav-fg)] border-t border-[var(--nav-line)]"
          >
            <SheetHeader className="text-left pb-2 border-b border-[var(--nav-line)]">
              <SheetTitle className="text-base font-normal text-[var(--nav-ink)] font-sans">
                Mais opções
              </SheetTitle>
              <SheetDescription className="text-xs text-[var(--nav-mute)] font-sans">
                Acesse as demais áreas do sistema
              </SheetDescription>
            </SheetHeader>

            <div className="py-3 space-y-4 font-sans">
              {/* Atendimento: Clientes */}
              <div className="space-y-1">
                <h3 className="px-2 font-medium text-[12px] text-[var(--nav-mute)]">Atendimento</h3>
                <Link
                  to="/clientes"
                  onClick={() => setMobileMoreOpen(false)}
                  className={cn(
                    'flex items-center justify-between p-3 min-h-[44px] rounded-lg transition-colors text-sm',
                    isNavItemActive('/clientes', location.pathname, location.search)
                      ? 'bg-[var(--nav-active)] text-[var(--nav-ink)] font-medium'
                      : 'text-[var(--nav-fg)] hover:bg-[var(--nav-hover)]',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-[var(--nav-accent)]" />
                    <span>Clientes</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[var(--nav-mute)]" />
                </Link>
              </div>

              {/* Imóveis: Condomínios */}
              <div className="space-y-1">
                <h3 className="px-2 font-medium text-[12px] text-[var(--nav-mute)]">Imóveis</h3>
                <Link
                  to="/condominios"
                  onClick={() => setMobileMoreOpen(false)}
                  className={cn(
                    'flex items-center justify-between p-3 min-h-[44px] rounded-lg transition-colors text-sm',
                    isNavItemActive('/condominios', location.pathname, location.search)
                      ? 'bg-[var(--nav-active)] text-[var(--nav-ink)] font-medium'
                      : 'text-[var(--nav-fg)] hover:bg-[var(--nav-hover)]',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Building className="h-4 w-4 text-[var(--nav-accent)]" />
                    <span>Condomínios</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[var(--nav-mute)]" />
                </Link>
              </div>

              {/* Configurações: Configurações */}
              <div className="space-y-1">
                <h3 className="px-2 font-medium text-[12px] text-[var(--nav-mute)]">
                  Configurações
                </h3>
                <Link
                  to="/configuracoes"
                  onClick={() => setMobileMoreOpen(false)}
                  className={cn(
                    'flex items-center justify-between p-3 min-h-[44px] rounded-lg transition-colors text-sm',
                    isNavItemActive('/configuracoes', location.pathname, location.search)
                      ? 'bg-[var(--nav-active)] text-[var(--nav-ink)] font-medium'
                      : 'text-[var(--nav-fg)] hover:bg-[var(--nav-hover)]',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Settings className="h-4 w-4 text-[var(--nav-accent)]" />
                    <span>Configurações</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[var(--nav-mute)]" />
                </Link>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
