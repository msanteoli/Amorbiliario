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
import { useAuth } from '@/contexts/AuthContext'
import { ThemeToggle } from '@/components/ThemeToggle'
import { getRoleLabel } from '@/lib/roles'
import {
  CalendarDays,
  CheckSquare,
  Home,
  LogOut,
  Settings,
  User,
  UserCheck,
  Users,
} from 'lucide-react'

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
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'Administração'
  return 'Imobdigital'
}

export function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const role = user?.role

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Navigation items defined by specification:
  // admin: Hoje, Leads, Clientes, Imóveis, Agenda, Administração
  // sdr: Hoje, Leads, Clientes, Imóveis, Agenda
  // corretor: Hoje, Leads, Clientes, Imóveis, Agenda
  const baseItems: NavItem[] = [
    { title: 'Hoje', url: '/hoje', icon: CheckSquare },
    { title: 'Leads', url: '/leads', icon: Users },
    { title: 'Clientes', url: '/clientes', icon: UserCheck },
    { title: 'Imóveis', url: '/imoveis', icon: Home },
    { title: 'Agenda', url: '/agenda', icon: CalendarDays },
  ]

  const navItems: NavItem[] =
    role === 'admin'
      ? [...baseItems, { title: 'Administração', url: '/admin', icon: Settings }]
      : baseItems

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
          {navItems.map((item) => {
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
            <DropdownMenuContent align="end" className="w-56 rounded-lg p-2">
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
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setMobileMenuOpen(false)
                  logout()
                }}
                className="text-destructive focus:text-destructive cursor-pointer"
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

        {/* Barra inferior de navegação no celular: alvos de 48px, ícone de 22px, ponto de 4px acima do ativo */}
        <nav
          aria-label="Navegação móvel"
          className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t border-border bg-background/95 backdrop-blur px-1 py-1 supports-[backdrop-filter]:bg-background/90"
        >
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              location.pathname === item.url || location.pathname.startsWith(`${item.url}/`)

            return (
              <Link
                key={item.url}
                to={item.url}
                className={cn(
                  'relative flex flex-col items-center justify-center min-h-[48px] h-12 flex-1 px-0.5 rounded transition-colors',
                  isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
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
                <Icon className="h-[22px] w-[22px] shrink-0" />
                <span
                  className={cn(
                    'leading-tight truncate max-w-full text-center mt-0.5',
                    navItems.length >= 6 ? 'text-[10px]' : 'text-[11px]',
                  )}
                >
                  {item.title}
                </span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
