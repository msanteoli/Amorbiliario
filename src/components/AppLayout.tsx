import { useState } from 'react'
import { useLocation, Link, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  Building2,
  Calendar,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  Database,
  Home,
  Layers,
  LogOut,
  MoreHorizontal,
  Settings,
  User,
  UserCheck,
  Users,
} from 'lucide-react'
import { useEffect, useCallback } from 'react'

interface NavItem {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
}

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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)

  // Estado da Google Agenda (só para corretor e admin)
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
      // Falha silenciosa
      setGoogleStatus(null)
      setGoogleEmail('')
    }
  }, [isBrokerOrAdmin])

  useEffect(() => {
    loadGoogleStatus()
  }, [loadGoogleStatus])

  // Trata conexão / reconexão
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
        const errorObj = err as { status?: number; data?: { message?: string } } | undefined
        if (errorObj?.status === 503) {
          setGoogleConfigError('Integração com o Google ainda não configurada')
        } else {
          setGoogleConfigError('Integração com o Google ainda não configurada')
        }
      }
      setConnectingGoogle(false)
    }
  }

  // Trata confirmação de desconexão
  const handleConfirmDisconnect = async () => {
    setDisconnecting(true)
    try {
      await disconnectGoogle()
      setGoogleStatus('nao_conectado')
      setGoogleEmail('')
      setDisconnectModalOpen(false)
    } catch {
      // Falha tratada ou idempotente
      setDisconnectModalOpen(false)
    } finally {
      setDisconnecting(false)
    }
  }

  // Itens de navegação:
  // Desktop: todos os itens disponíveis para o papel
  // Celular: 4 itens fixos (Hoje, Leads, Imóveis, Agenda) e o botão Mais com os demais (Clientes, Condomínios, Backup, Administração)
  const canSeeBackup = role === 'admin' || role === 'sdr'

  const desktopItems: NavItem[] = [
    { title: 'Hoje', url: '/hoje', icon: CheckSquare },
    { title: 'Leads', url: '/leads', icon: Users },
    { title: 'Clientes', url: '/clientes', icon: UserCheck },
    { title: 'Imóveis', url: '/imoveis', icon: Home },
    { title: 'Condomínios', url: '/condominios', icon: Building2 },
    { title: 'Agenda', url: '/agenda', icon: CalendarDays },
    ...(canSeeBackup ? [{ title: 'Backup', url: '/backup', icon: Database }] : []),
    ...(role === 'admin'
      ? [
          { title: 'Portais', url: '/portais', icon: Layers },
          { title: 'Administração', url: '/admin', icon: Settings },
        ]
      : []),
  ]

  // Itens fixos do menu inferior móvel (máx 4)
  const mobileFixedItems: NavItem[] = [
    { title: 'Hoje', url: '/hoje', icon: CheckSquare },
    { title: 'Leads', url: '/leads', icon: Users },
    { title: 'Imóveis', url: '/imoveis', icon: Home },
    { title: 'Agenda', url: '/agenda', icon: CalendarDays },
  ]

  // Itens secundários acessíveis via folha "Mais"
  const mobileMoreItems: NavItem[] = [
    { title: 'Clientes', url: '/clientes', icon: UserCheck },
    { title: 'Condomínios', url: '/condominios', icon: Building2 },
    ...(canSeeBackup ? [{ title: 'Backup', url: '/backup', icon: Database }] : []),
    ...(role === 'admin'
      ? [
          { title: 'Portais', url: '/portais', icon: Layers },
          { title: 'Administração', url: '/admin', icon: Settings },
        ]
      : []),
  ]

  const currentScreenTitle = getScreenTitle(location.pathname)

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Barra lateral estreita no Desktop */}
      <aside className="hidden md:flex md:w-56 lg:w-60 flex-col shrink-0 border-r border-border bg-background">
        {/* Topo da barra lateral: apenas o nome Imobdigital em texto */}
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Link
            to="/hoje"
            className="text-base font-normal tracking-tight text-foreground hover:opacity-80 transition-opacity"
          >
            Imobdigital
          </Link>
        </div>

        {/* Itens de navegação: traço de 2px à esquerda e texto em foreground quando ativo */}
        <nav className="flex-1 py-4 space-y-1">
          {desktopItems.map((item) => {
            const Icon = item.icon
            const isActive =
              location.pathname === item.url || location.pathname.startsWith(`${item.url}/`)

            return (
              <Link
                key={item.url}
                to={item.url}
                className={cn(
                  'relative flex items-center gap-3 px-6 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'text-foreground font-normal'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {/* Traço de 2px à esquerda para item ativo */}
                {isActive && (
                  <span
                    className="absolute left-0 top-0 bottom-0 w-[2px] bg-foreground"
                    aria-hidden="true"
                  />
                )}
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.title}</span>
              </Link>
            )
          })}
        </nav>

        {/* Rodapé da barra lateral: seletor de tema e e-mail do usuário */}
        <div className="p-4 border-t border-border space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] eyebrow text-muted-foreground">Tema</span>
            <ThemeToggle size="sm" />
          </div>
          <div className="text-xs text-muted-foreground truncate" title={user?.email || ''}>
            {user?.email}
          </div>

          {/* Seção Google Agenda na barra lateral desktop (só corretor e admin) */}
          {isBrokerOrAdmin && googleStatus && (
            <div className="pt-2 border-t border-border space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium text-foreground">Google Agenda</span>
              </div>

              {googleStatus === 'conectado' && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground truncate" title={googleEmail || ''}>
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
                  {googleConfigError && (
                    <p className="text-[11px] text-destructive leading-tight">
                      {googleConfigError}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    O Imobdigital só cria, atualiza e apaga eventos de visita na sua agenda. Não lê
                    seus outros eventos. Você pode desconectar quando quiser.
                  </p>
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
                  {googleConfigError && (
                    <p className="text-[11px] text-destructive leading-tight">
                      {googleConfigError}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    O Imobdigital só cria, atualiza e apaga eventos de visita na sua agenda. Não lê
                    seus outros eventos. Você pode desconectar quando quiser.
                  </p>
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
            <span className="text-sm text-foreground">
              {user?.name || user?.email || 'Usuário'}
            </span>
            <Badge variant="outline" className="text-[11px] font-normal lowercase">
              {getRoleLabel(user?.role)}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={logout}
            className="gap-2 rounded-full font-normal"
            title="Sair do sistema"
          >
            <LogOut className="h-4 w-4" />
            <span>Sair</span>
          </Button>
        </header>

        {/* Cabeçalho Celular: título da tela atual e botão de menu do usuário à direita */}
        <header className="md:hidden sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur">
          <h1 className="text-base font-normal tracking-tight text-foreground truncate">
            {currentScreenTitle}
          </h1>

          <DropdownMenu open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 min-h-[44px] min-w-[44px] rounded-full"
                aria-label="Menu do usuário"
              >
                <User className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-lg p-2">
              <DropdownMenuLabel className="font-normal">
                <div className="text-sm font-medium text-foreground truncate">
                  {user?.name || user?.email || 'Usuário'}
                </div>
                <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
                <div className="mt-1">
                  <Badge variant="outline" className="text-[10px] font-normal">
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

        {/* Barra inferior de navegação no celular: 4 itens fixos + 1 item Mais, alvos de 48px, sem sobreposição */}
        <nav
          aria-label="Navegação móvel"
          className="md:hidden fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 items-center border-t border-border bg-background/95 backdrop-blur px-1 py-1 supports-[backdrop-filter]:bg-background/90"
        >
          {mobileFixedItems.map((item) => {
            const Icon = item.icon
            const isActive =
              location.pathname === item.url || location.pathname.startsWith(`${item.url}/`)

            return (
              <Link
                key={item.url}
                to={item.url}
                className={cn(
                  'relative flex flex-col items-center justify-center min-h-[48px] h-12 w-full px-0.5 rounded transition-colors',
                  isActive
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {/* Ponto de 4px acima do ícone quando ativo */}
                <span
                  className={cn(
                    'w-1 h-1 rounded-full mb-0.5 transition-opacity',
                    isActive ? 'bg-foreground opacity-100' : 'opacity-0',
                  )}
                  aria-hidden="true"
                />
                <Icon className="h-5 w-5 shrink-0" />
                <span className="text-[11px] leading-tight truncate max-w-full text-center mt-0.5">
                  {item.title}
                </span>
              </Link>
            )
          })}

          {/* Quinto item: Mais (abre a folha inferior) */}
          {(() => {
            const isMoreActive = mobileMoreItems.some(
              (item) =>
                location.pathname === item.url || location.pathname.startsWith(`${item.url}/`),
            )

            return (
              <button
                type="button"
                onClick={() => setMobileMoreOpen(true)}
                className={cn(
                  'relative flex flex-col items-center justify-center min-h-[48px] h-12 w-full px-0.5 rounded transition-colors',
                  isMoreActive
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-label="Abrir mais opções de navegação"
              >
                <span
                  className={cn(
                    'w-1 h-1 rounded-full mb-0.5 transition-opacity',
                    isMoreActive ? 'bg-foreground opacity-100' : 'opacity-0',
                  )}
                  aria-hidden="true"
                />
                <MoreHorizontal className="h-5 w-5 shrink-0" />
                <span className="text-[11px] leading-tight truncate max-w-full text-center mt-0.5">
                  Mais
                </span>
              </button>
            )
          })()}
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

        {/* Folha (Sheet) Mais opções de navegação */}
        <Sheet open={mobileMoreOpen} onOpenChange={setMobileMoreOpen}>
          <SheetContent side="bottom" className="p-4 rounded-t-2xl max-h-[85vh] overflow-y-auto">
            <SheetHeader className="text-left pb-2 border-b border-border">
              <SheetTitle className="text-base font-normal text-foreground">Mais opções</SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Acesse outras áreas do sistema Imobdigital
              </SheetDescription>
            </SheetHeader>

            <div className="py-3 space-y-1">
              {mobileMoreItems.map((item) => {
                const Icon = item.icon
                const isActive =
                  location.pathname === item.url || location.pathname.startsWith(`${item.url}/`)

                return (
                  <Link
                    key={item.url}
                    to={item.url}
                    onClick={() => setMobileMoreOpen(false)}
                    className={cn(
                      'flex items-center justify-between p-3 min-h-[48px] rounded-lg transition-colors text-sm',
                      isActive
                        ? 'bg-muted text-foreground font-medium'
                        : 'text-foreground hover:bg-muted/50',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-foreground shrink-0">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span>{item.title}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                )
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
