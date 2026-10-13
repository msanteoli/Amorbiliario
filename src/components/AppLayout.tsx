import { useState, useEffect, useCallback, useId } from 'react'
import { useLocation, Link, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { ThemeToggle } from '@/components/ThemeToggle'
import { getRoleLabel } from '@/lib/roles'
import { getOrganization } from '@/services/admin'
import {
  getGoogleStatus,
  getGoogleConnectUrl,
  disconnectGoogle,
  GoogleConnectionStatus,
  GoogleIntegrationConfigError,
} from '@/services/googleCalendar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu as MenuIcon,
  User,
} from 'lucide-react'
import {
  HOJE_NAV_ITEM,
  NAV_GROUPS,
  isItemVisibleForRole,
  isNavItemActive,
  type NavItemConfig,
  type NavGroupConfig,
} from '@/config/navegacao'

const CONFIG_COLLAPSED_STORAGE_KEY = 'imobdigital_nav_config_open'
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'imobdigital_sidebar_collapsed'

// Mapa de títulos de telas para exibição no cabeçalho do celular
function getScreenTitle(pathname: string): string {
  if (pathname === '/hoje' || pathname.startsWith('/hoje/')) return 'Hoje'
  if (pathname === '/agenda' || pathname.startsWith('/agenda/')) return 'Agenda'
  if (pathname === '/leads' || pathname.startsWith('/leads/')) return 'Leads'
  if (pathname === '/clientes' || pathname.startsWith('/clientes/')) return 'Clientes'
  if (pathname === '/imoveis' || pathname.startsWith('/imoveis/')) return 'Imóveis'
  if (pathname === '/condominios' || pathname.startsWith('/condominios/')) return 'Condomínios'
  if (pathname === '/backup' || pathname.startsWith('/backup/')) return 'Backup'
  if (pathname === '/portais' || pathname.startsWith('/portais/')) return 'Portais'
  if (pathname === '/admin/importar-imoveis') return 'Importar imóveis'
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'Administração'
  return 'Imobdigital'
}

export function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const role = user?.role
  const [orgName, setOrgName] = useState<string>('')

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)

  // Barra lateral desktop recolhida (só ícones)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next))
      } catch {
        // Silencioso se sem acesso ao storage
      }
      return next
    })
  }

  // Grupo "Configurações" recolhido / expandido
  // Começa FECHADO por padrão, lembra a escolha no navegador, mas se a rota atual for de Configurações, abre sozinho.
  const [configOpen, setConfigOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(CONFIG_COLLAPSED_STORAGE_KEY)
      return saved === 'true'
    } catch {
      return false
    }
  })

  // IDs acessíveis para aria-labelledby
  const groupLabelIdAtendimento = useId()
  const groupLabelIdImoveis = useId()
  const groupLabelIdConfig = useId()

  // Google Calendar integration status
  const isBrokerOrAdmin = role === 'admin' || role === 'corretor'
  const [googleStatus, setGoogleStatus] = useState<GoogleConnectionStatus | null>(null)
  const [googleEmail, setGoogleEmail] = useState<string>('')
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [connectingGoogle, setConnectingGoogle] = useState(false)
  const [googleConfigError, setGoogleConfigError] = useState<string | null>(null)

  const loadGoogleStatus = useCallback(async () => {
    if (!isBrokerOrAdmin) {
      setGoogleStatus(null)
      setGoogleEmail('')
      return
    }
    try {
      const res = await getGoogleStatus()
      setGoogleStatus(res.status)
      setGoogleEmail(res.google_email || '')
    } catch {
      setGoogleStatus(null)
      setGoogleEmail('')
    }
  }, [isBrokerOrAdmin])

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

  useEffect(() => {
    loadGoogleStatus()
  }, [loadGoogleStatus])

  // Trata conexão / reconexão Google Agenda
  const handleConnectGoogle = async () => {
    setGoogleConfigError(null)
    setConnectingGoogle(true)
    try {
      const url = await getGoogleConnectUrl()
      if (url) {
        window.location.href = url
      }
    } catch (err) {
      if (err instanceof GoogleIntegrationConfigError) {
        setGoogleConfigError('Integração com o Google ainda não configurada')
      } else {
        setGoogleConfigError('Integração com o Google ainda não configurada')
      }
      setConnectingGoogle(false)
    }
  }

  // Trata desconexão Google Agenda
  const handleConfirmDisconnect = async () => {
    setDisconnecting(true)
    try {
      await disconnectGoogle()
      setGoogleStatus('nao_conectado')
      setGoogleEmail('')
      setDisconnectModalOpen(false)
    } catch {
      setDisconnectModalOpen(false)
    } finally {
      setDisconnecting(false)
    }
  }

  // Abre automaticamente o grupo Configurações se a rota atual for de uma configuração
  const configGroup = NAV_GROUPS.find((g) => g.id === 'configuracoes')
  const isCurrentRouteInConfig = Boolean(
    configGroup?.items.some(
      (item) =>
        isItemVisibleForRole(item, role) &&
        isNavItemActive(item.href, location.pathname, location.search),
    ),
  )

  useEffect(() => {
    if (isCurrentRouteInConfig) {
      setConfigOpen(true)
    }
  }, [isCurrentRouteInConfig])

  const handleToggleConfig = () => {
    setConfigOpen((prev) => {
      const next = !prev
      try {
        localStorage.setItem(CONFIG_COLLAPSED_STORAGE_KEY, String(next))
      } catch {
        // Silencioso se sem storage
      }
      return next
    })
  }

  // Grupos filtrados pelo papel atual
  const visibleGroups: NavGroupConfig[] = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => isItemVisibleForRole(item, role)),
  })).filter((g) => g.items.length > 0)

  const atendimentoGroup = visibleGroups.find((g) => g.id === 'atendimento')
  const imoveisGroup = visibleGroups.find((g) => g.id === 'imoveis')
  const configuracoesGroup = visibleGroups.find((g) => g.id === 'configuracoes')

  const showHoje = isItemVisibleForRole(HOJE_NAV_ITEM, role)
  const isHojeActive = isNavItemActive(HOJE_NAV_ITEM.href, location.pathname, location.search)

  // ═════════════════════════════════════════════════════════════════════
  // CELULAR (abaixo de 768px):
  // 5 posições na barra inferior: Hoje, Leads, Agenda, Imóveis e Mais.
  // "Mais" abre uma folha (Sheet) com os demais itens que o papel vê,
  // organizados nos mesmos grupos e títulos do desktop:
  // - Atendimento: Clientes
  // - Imóveis: Condomínios
  // - Configurações: os itens do papel
  // ═════════════════════════════════════════════════════════════════════
  const mobileFixedIds = ['hoje', 'leads', 'agenda', 'imoveis']

  // Itens fixos na barra inferior: Hoje, Leads, Agenda, Imóveis
  const mobileFixedNavItems: NavItemConfig[] = [
    HOJE_NAV_ITEM,
    ...(atendimentoGroup?.items.filter((i) => i.id === 'leads') || []),
    ...(atendimentoGroup?.items.filter((i) => i.id === 'agenda') || []),
    ...(imoveisGroup?.items.filter((i) => i.id === 'imoveis') || []),
  ].filter((item) => isItemVisibleForRole(item, role))

  // Grupos para a folha "Mais" (exclui os 4 fixos do celular)
  const mobileMoreGroups: NavGroupConfig[] = visibleGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => !mobileFixedIds.includes(item.id)),
    }))
    .filter((g) => g.items.length > 0)

  // O botão "Mais" fica ativo se a rota atual for qualquer um dos itens presentes na folha Mais
  const isMoreActive = mobileMoreGroups.some((group) =>
    group.items.some((item) => isNavItemActive(item.href, location.pathname, location.search)),
  )

  const currentScreenTitle = getScreenTitle(location.pathname)

  // Renderizador de link de item de menu (Desktop)
  const renderDesktopNavLink = (item: NavItemConfig) => {
    const Icon = item.icon
    const isActive = isNavItemActive(item.href, location.pathname, location.search)

    if (sidebarCollapsed) {
      return (
        <Tooltip key={item.id} delayDuration={0}>
          <TooltipTrigger asChild>
            <Link
              to={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex items-center justify-center w-10 h-10 mx-auto rounded-[4px] transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground',
              )}
            >
              {/* Filete de 2px em primary à esquerda */}
              {isActive && (
                <span
                  className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-sidebar-primary rounded-r"
                  aria-hidden="true"
                />
              )}
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  isActive ? 'text-sidebar-primary' : 'text-muted-foreground',
                )}
              />
              <span className="sr-only">{item.label}</span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={12}>
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
          'relative flex items-center gap-3 px-3 py-2 text-sm rounded-[4px] transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
          isActive
            ? 'bg-sidebar-accent text-sidebar-primary font-medium'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground',
        )}
      >
        {/* Filete de 2px em primary à esquerda */}
        {isActive && (
          <span
            className="absolute left-0 top-1 bottom-1 w-[2px] bg-sidebar-primary rounded-r"
            aria-hidden="true"
          />
        )}
        <Icon
          className={cn(
            'h-4 w-4 shrink-0',
            isActive ? 'text-sidebar-primary' : 'text-muted-foreground',
          )}
        />
        <span className="truncate">{item.label}</span>
      </Link>
    )
  }

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Barra lateral Desktop (a partir de 768 px) */}
      <aside
        className={cn(
          'hidden md:flex flex-col shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200',
          sidebarCollapsed ? 'w-16' : 'w-56 lg:w-60',
        )}
      >
        {/* Topo da barra lateral: assinatura da marca Planta */}
        <div
          className={cn(
            'h-16 flex items-center border-b border-sidebar-border',
            sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-5',
          )}
        >
          <Link
            to="/hoje"
            className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring rounded-[4px]"
            title="Ir para o início"
            aria-label="Ir para o início"
          >
            <svg
              viewBox="0 0 48 48"
              fill="none"
              className="w-7 h-7 text-sidebar-primary shrink-0"
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
            {!sidebarCollapsed && (
              <span className="font-sans font-semibold text-[22px] leading-none tracking-[-0.02em] text-foreground lowercase">
                imobdigital
              </span>
            )}
          </Link>

          {/* Botão de recolher/expandir barra lateral */}
          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              className="h-8 w-8 rounded-[4px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring transition-colors"
              title="Recolher barra lateral"
              aria-label="Recolher barra lateral"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Botão expandir quando recolhida (topo abaixo do logo) */}
        {sidebarCollapsed && (
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              className="h-8 w-8 rounded-[4px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring transition-colors"
              title="Expandir barra lateral"
              aria-label="Expandir barra lateral"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Menu principal acessível com navegação por teclado */}
        <nav
          aria-label="Menu principal"
          className="flex-1 flex flex-col justify-between py-3 overflow-y-auto overflow-x-hidden"
        >
          {/* Parte superior: Hoje (sozinho) + Atendimento + Imóveis */}
          <div className="space-y-4 px-2">
            {/* "Hoje" sozinho fora de grupo */}
            {showHoje && <div>{renderDesktopNavLink(HOJE_NAV_ITEM)}</div>}

            {/* Grupo Atendimento (SEMPRE aberto) */}
            {atendimentoGroup && (
              <div role="group" aria-labelledby={groupLabelIdAtendimento} className="space-y-1">
                {sidebarCollapsed ? (
                  <div className="my-2 border-t border-border mx-1" aria-hidden="true" />
                ) : (
                  <h2
                    id={groupLabelIdAtendimento}
                    className="px-3 pt-2 pb-1 font-sans font-medium text-[12px] leading-4 text-muted-foreground select-none"
                  >
                    Atendimento
                  </h2>
                )}
                <ul className="space-y-1 list-none p-0 m-0">
                  {atendimentoGroup.items.map((item) => (
                    <li key={item.id}>{renderDesktopNavLink(item)}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Grupo Imóveis (SEMPRE aberto) */}
            {imoveisGroup && (
              <div role="group" aria-labelledby={groupLabelIdImoveis} className="space-y-1">
                {sidebarCollapsed ? (
                  <div className="my-2 border-t border-border mx-1" aria-hidden="true" />
                ) : (
                  <h2
                    id={groupLabelIdImoveis}
                    className="px-3 pt-2 pb-1 font-sans font-medium text-[12px] leading-4 text-muted-foreground select-none"
                  >
                    Imóveis
                  </h2>
                )}
                <ul className="space-y-1 list-none p-0 m-0">
                  {imoveisGroup.items.map((item) => (
                    <li key={item.id}>{renderDesktopNavLink(item)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Parte inferior: Grupo Configurações encostado no rodapé acima do usuário */}
          {configuracoesGroup && (
            <div className="px-2 pt-4 mt-auto">
              <div role="group" aria-labelledby={groupLabelIdConfig} className="space-y-1">
                {sidebarCollapsed ? (
                  <>
                    <div className="my-2 border-t border-border mx-1" aria-hidden="true" />
                    {/* Barra recolhida: mostra os itens de configurações com tooltip */}
                    <ul className="space-y-1 list-none p-0 m-0">
                      {configuracoesGroup.items.map((item) => (
                        <li key={item.id}>{renderDesktopNavLink(item)}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <>
                    {/* Botão que recolhe / expande o grupo Configurações */}
                    <button
                      type="button"
                      id={groupLabelIdConfig}
                      onClick={handleToggleConfig}
                      aria-expanded={configOpen}
                      aria-controls="configuracoes-items-list"
                      className="w-full flex items-center justify-between px-3 py-1.5 font-sans font-medium text-[12px] leading-4 text-muted-foreground hover:text-foreground rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring transition-colors select-none text-left"
                    >
                      <span>Configurações</span>
                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 transition-transform duration-200',
                          configOpen ? 'rotate-180' : '',
                        )}
                        aria-hidden="true"
                      />
                    </button>

                    {configOpen && (
                      <ul
                        id="configuracoes-items-list"
                        className="space-y-1 list-none p-0 m-0 pt-0.5 animate-accordion-down"
                      >
                        {configuracoesGroup.items.map((item) => (
                          <li key={item.id}>{renderDesktopNavLink(item)}</li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </nav>

        {/* Rodapé da barra lateral: Menu do usuário (avatar, nome, organização, tema, Google Agenda, Sair) */}
        <div className="p-3 border-t border-sidebar-border space-y-3">
          {sidebarCollapsed ? (
            /* Versão recolhida: avatar como gatilho do dropdown */
            <div className="flex flex-col items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Minha conta"
                    className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-foreground font-medium text-xs hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring transition-colors"
                  >
                    {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="right" sideOffset={12} className="w-64 p-2">
                  <DropdownMenuLabel className="font-normal">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {user?.name || user?.email || 'Usuário'}
                    </div>
                    {orgName && (
                      <div className="text-xs text-muted-foreground truncate -mt-0.5">
                        {orgName}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
                    <div className="mt-1">
                      <Badge variant="outline" className="text-[10px] font-medium lowercase">
                        {getRoleLabel(user?.role)}
                      </Badge>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Tema</span>
                    <ThemeToggle size="sm" />
                  </div>
                  {isBrokerOrAdmin && googleStatus && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="px-2 py-2 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          <span className="font-medium text-foreground">Google Agenda</span>
                        </div>
                        {googleStatus === 'conectado' && (
                          <div className="space-y-1.5">
                            <p
                              className="text-[11px] text-muted-foreground truncate"
                              title={googleEmail || ''}
                            >
                              conectada como {googleEmail || 'sua conta'}
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setDisconnectModalOpen(true)}
                              className="w-full h-8 text-xs font-normal rounded-full"
                            >
                              Desconectar
                            </Button>
                          </div>
                        )}
                        {googleStatus === 'reconectar' && (
                          <div className="space-y-1.5">
                            <p className="text-xs text-attention font-medium">Precisa reconectar</p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleConnectGoogle}
                              disabled={connectingGoogle}
                              className="w-full h-8 text-xs font-normal rounded-full"
                            >
                              {connectingGoogle ? 'Conectando...' : 'Conectar'}
                            </Button>
                          </div>
                        )}
                        {googleStatus === 'nao_conectado' && (
                          <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground">Não conectada</p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleConnectGoogle}
                              disabled={connectingGoogle}
                              className="w-full h-8 text-xs font-normal rounded-full"
                            >
                              {connectingGoogle ? 'Conectando...' : 'Conectar Google Agenda'}
                            </Button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={logout}
                    className="text-destructive focus:text-destructive cursor-pointer"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    <span>Sair</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            /* Versão expandida: avatar + nome + organização + dropdown de ações */
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-foreground font-medium text-xs shrink-0">
                    {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span
                      className="text-xs font-medium text-foreground block truncate"
                      title={user?.name || user?.email || ''}
                    >
                      {user?.name || user?.email || 'Usuário'}
                    </span>
                    {orgName && (
                      <span
                        className="text-[11px] text-muted-foreground block truncate -mt-0.5"
                        title={orgName}
                      >
                        {orgName}
                      </span>
                    )}
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Mais opções da conta"
                      className="h-7 w-7 rounded-[4px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring transition-colors shrink-0"
                    >
                      <User className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="top" sideOffset={8} className="w-60 p-2">
                    <DropdownMenuLabel className="font-normal">
                      <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
                      <div className="mt-1">
                        <Badge variant="outline" className="text-[10px] font-medium lowercase">
                          {getRoleLabel(user?.role)}
                        </Badge>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={logout}
                      className="text-destructive focus:text-destructive cursor-pointer"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      <span>Sair</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Tema na barra lateral expandida */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-sidebar-border/60">
                <span className="text-[11px] eyebrow text-muted-foreground">Tema</span>
                <ThemeToggle size="sm" />
              </div>

              {/* Google Agenda na barra lateral desktop (só corretor e admin) */}
              {isBrokerOrAdmin && googleStatus && (
                <div className="pt-2 border-t border-sidebar-border/60 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-medium text-foreground text-[11px]">Google Agenda</span>
                  </div>

                  {googleStatus === 'conectado' && (
                    <div className="space-y-1">
                      <p
                        className="text-[11px] text-muted-foreground truncate"
                        title={googleEmail || ''}
                      >
                        conectada como {googleEmail || 'sua conta'}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDisconnectModalOpen(true)}
                        className="w-full h-7 text-[11px] font-normal rounded-full"
                      >
                        Desconectar
                      </Button>
                    </div>
                  )}

                  {googleStatus === 'reconectar' && (
                    <div className="space-y-1">
                      <p className="text-[11px] text-attention font-medium">Precisa reconectar</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleConnectGoogle}
                        disabled={connectingGoogle}
                        className="w-full h-7 text-[11px] font-normal rounded-full"
                      >
                        {connectingGoogle ? 'Conectando...' : 'Conectar'}
                      </Button>
                      {googleConfigError && (
                        <p className="text-[10px] text-destructive leading-tight">
                          {googleConfigError}
                        </p>
                      )}
                    </div>
                  )}

                  {googleStatus === 'nao_conectado' && (
                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground">Não conectada</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleConnectGoogle}
                        disabled={connectingGoogle}
                        className="w-full h-7 text-[11px] font-normal rounded-full"
                      >
                        {connectingGoogle ? 'Conectando...' : 'Conectar Google Agenda'}
                      </Button>
                      {googleConfigError && (
                        <p className="text-[10px] text-destructive leading-tight">
                          {googleConfigError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Área principal */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Cabeçalho Desktop */}
        <header className="hidden md:flex h-16 shrink-0 items-center justify-end gap-4 border-b border-border px-6 bg-background">
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-sm font-medium text-foreground block">
                {user?.name || user?.email || 'Usuário'}
              </span>
              {orgName && (
                <span className="text-xs text-muted-foreground block -mt-0.5">{orgName}</span>
              )}
            </div>
            <Badge variant="outline" className="text-[11px] font-medium lowercase">
              {getRoleLabel(user?.role)}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={logout}
            className="gap-2 font-medium"
            title="Sair do sistema"
          >
            <LogOut className="h-4 w-4" />
            <span>Sair</span>
          </Button>
        </header>

        {/* Cabeçalho Celular: assinatura reduzida (símbolo) + título da tela atual e botão de menu do usuário à direita */}
        <header className="md:hidden sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Link to="/hoje" className="shrink-0" aria-label="Ir para o início">
              <svg
                viewBox="0 0 48 48"
                fill="none"
                className="w-7 h-7 text-primary shrink-0"
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
            </Link>
            <h1 className="text-base font-medium tracking-tight text-foreground truncate">
              {currentScreenTitle}
            </h1>
          </div>

          <DropdownMenu open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 min-h-[44px] min-w-[44px] rounded-[4px]"
                aria-label="Menu do usuário"
              >
                <User className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-64 rounded-[4px] p-2 shadow-modal dark:shadow-none"
            >
              <DropdownMenuLabel className="font-normal">
                <div className="text-sm font-semibold text-foreground truncate">
                  {user?.name || user?.email || 'Usuário'}
                </div>
                {orgName && (
                  <div className="text-xs text-muted-foreground truncate -mt-0.5">{orgName}</div>
                )}
                <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
                <div className="mt-1">
                  <Badge variant="outline" className="text-[10px] font-medium">
                    {getRoleLabel(user?.role)}
                  </Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Tema</span>
                <ThemeToggle size="sm" />
              </div>

              {/* Seção Google Agenda no Menu do usuário do celular (só corretor e admin) */}
              {isBrokerOrAdmin && googleStatus && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-2 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-medium text-foreground">Google Agenda</span>
                    </div>

                    {googleStatus === 'conectado' && (
                      <div className="space-y-2">
                        <p
                          className="text-xs text-muted-foreground truncate"
                          title={googleEmail || ''}
                        >
                          conectada como {googleEmail || 'sua conta'}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setMobileMenuOpen(false)
                            setDisconnectModalOpen(true)
                          }}
                          className="w-full min-h-[44px] h-10 text-xs font-normal rounded-full"
                        >
                          Desconectar
                        </Button>
                      </div>
                    )}

                    {googleStatus === 'reconectar' && (
                      <div className="space-y-2">
                        <p className="text-xs text-attention font-medium">Precisa reconectar</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleConnectGoogle}
                          disabled={connectingGoogle}
                          className="w-full min-h-[44px] h-10 text-xs font-normal rounded-full"
                        >
                          {connectingGoogle ? 'Conectando...' : 'Conectar'}
                        </Button>
                        {googleConfigError && (
                          <p className="text-[11px] text-destructive leading-tight">
                            {googleConfigError}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          O Imobdigital só cria, atualiza e apaga eventos de visita na sua agenda.
                          Não lê seus outros eventos. Você pode desconectar quando quiser.
                        </p>
                      </div>
                    )}

                    {googleStatus === 'nao_conectado' && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Não conectada</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleConnectGoogle}
                          disabled={connectingGoogle}
                          className="w-full min-h-[44px] h-10 text-xs font-normal rounded-full"
                        >
                          {connectingGoogle ? 'Conectando...' : 'Conectar Google Agenda'}
                        </Button>
                        {googleConfigError && (
                          <p className="text-[11px] text-destructive leading-tight">
                            {googleConfigError}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          O Imobdigital só cria, atualiza e apaga eventos de visita na sua agenda.
                          Não lê seus outros eventos. Você pode desconectar quando quiser.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setMobileMenuOpen(false)
                  logout()
                }}
                className="text-destructive focus:text-destructive cursor-pointer min-h-[44px]"
              >
                <LogOut className="h-4 w-4 mr-2" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Conteúdo principal - com pb-24 no mobile para não ser coberto pela barra inferior */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 pb-24 md:pb-8">
          <Outlet />
        </main>

        {/* Barra inferior de navegação no celular (abaixo de 768px): exatamente 5 posições */}
        {/* Hoje, Leads, Agenda, Imóveis e Mais — alvos de toque de 44px mínimo (h-12 / min-h-[44px]), sem sobreposição em 360px */}
        <nav
          aria-label="Menu principal móvel"
          className="md:hidden fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 items-center border-t border-border bg-card/95 backdrop-blur px-1 py-1 supports-[backdrop-filter]:bg-card/90"
        >
          {mobileFixedNavItems.map((item) => {
            const Icon = item.icon
            const isActive = isNavItemActive(item.href, location.pathname, location.search)

            return (
              <Link
                key={item.id}
                to={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex flex-col items-center justify-center min-h-[44px] h-12 w-full px-0.5 rounded-[4px] transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                  isActive
                    ? 'text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {/* Traço indicador superior de 2px quando ativo */}
                {isActive && (
                  <span
                    className="absolute top-0 left-2 right-2 h-[2px] bg-primary rounded-full"
                    aria-hidden="true"
                  />
                )}
                <Icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-primary' : '')} />
                <span
                  className={cn(
                    'text-[10px] leading-tight truncate max-w-full text-center mt-0.5',
                    isActive ? 'text-primary' : '',
                  )}
                >
                  {item.label}
                </span>
              </Link>
            )
          })}

          {/* Quinto item da barra móvel: Mais (abre a folha inferior) */}
          <button
            type="button"
            onClick={() => setMobileMoreOpen(true)}
            aria-label="Mais opções de navegação"
            aria-haspopup="dialog"
            aria-expanded={mobileMoreOpen}
            className={cn(
              'relative flex flex-col items-center justify-center min-h-[44px] h-12 w-full px-0.5 rounded-[4px] transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
              isMoreActive
                ? 'text-primary font-medium'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {isMoreActive && (
              <span
                className="absolute top-0 left-2 right-2 h-[2px] bg-primary rounded-full"
                aria-hidden="true"
              />
            )}
            <MenuIcon className={cn('h-5 w-5 shrink-0', isMoreActive ? 'text-primary' : '')} />
            <span
              className={cn(
                'text-[10px] leading-tight truncate max-w-full text-center mt-0.5',
                isMoreActive ? 'text-primary' : '',
              )}
            >
              Mais
            </span>
          </button>
        </nav>

        {/* Modal de confirmação de desconexão da Google Agenda */}
        <AlertDialog open={disconnectModalOpen} onOpenChange={setDisconnectModalOpen}>
          <AlertDialogContent className="rounded-lg p-6 max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-normal text-foreground">
                Desconectar Google Agenda
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-muted-foreground">
                Os eventos futuros criados pelo Imobdigital serão removidos da sua agenda.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-0 pt-2">
              <AlertDialogCancel
                disabled={disconnecting}
                className="rounded-full font-normal min-h-[44px] h-11"
              >
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  handleConfirmDisconnect()
                }}
                disabled={disconnecting}
                className="rounded-full font-normal min-h-[44px] h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {disconnecting ? 'Desconectando...' : 'Desconectar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Folha (Sheet) "Mais" opções de navegação no Celular */}
        <Sheet open={mobileMoreOpen} onOpenChange={setMobileMoreOpen}>
          <SheetContent side="bottom" className="p-4 rounded-t-2xl max-h-[85vh] overflow-y-auto">
            <SheetHeader className="text-left pb-2 border-b border-border">
              <SheetTitle className="text-base font-normal text-foreground">Mais opções</SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Acesse as demais áreas do sistema Imobdigital
              </SheetDescription>
            </SheetHeader>

            <div className="py-3 space-y-4">
              {mobileMoreGroups.map((group) => (
                <div key={group.id} className="space-y-1">
                  <h3 className="px-2 font-sans font-medium text-[12px] leading-4 text-muted-foreground select-none">
                    {group.title}
                  </h3>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      const isActive = isNavItemActive(
                        item.href,
                        location.pathname,
                        location.search,
                      )

                      return (
                        <Link
                          key={item.id}
                          to={item.href}
                          onClick={() => setMobileMoreOpen(false)}
                          aria-current={isActive ? 'page' : undefined}
                          className={cn(
                            'flex items-center justify-between p-3 min-h-[48px] rounded-lg transition-colors text-sm',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                            isActive
                              ? 'bg-sidebar-accent text-sidebar-primary font-medium'
                              : 'text-foreground hover:bg-muted/50',
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                                isActive
                                  ? 'bg-sidebar-primary/10 text-sidebar-primary'
                                  : 'bg-muted text-foreground',
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <span>{item.label}</span>
                          </div>
                          <ChevronRight
                            className={cn(
                              'h-4 w-4',
                              isActive ? 'text-sidebar-primary' : 'text-muted-foreground',
                            )}
                          />
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
