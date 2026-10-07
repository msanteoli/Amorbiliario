import { useLocation, Link, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { ThemeToggle } from '@/components/ThemeToggle'
import { getRoleLabel } from '@/lib/roles'
import { CalendarDays, CheckSquare, Home, LogOut, Settings, UserCheck, Users } from 'lucide-react'

interface NavItem {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
}

export function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()

  const role = user?.role

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

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <Sidebar>
          <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-normal text-lg">
                I
              </div>
              <div className="flex flex-col">
                <span className="font-normal text-base leading-tight text-foreground">
                  Imobdigital
                </span>
                <span className="text-xs eyebrow text-muted-foreground">Gestão</span>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="eyebrow text-muted-foreground px-3">
                Menu
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive =
                      location.pathname === item.url || location.pathname.startsWith(`${item.url}/`)
                    return (
                      <SidebarMenuItem key={item.url} className="relative">
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r bg-primary" />
                        )}
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className="h-10 rounded-md font-normal transition-colors"
                        >
                          <Link to={item.url} className="flex items-center gap-3 pl-3">
                            <Icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border p-3 space-y-3">
            <div className="px-1">
              <div className="text-xs eyebrow text-muted-foreground mb-1.5">Tema</div>
              <ThemeToggle size="sm" className="w-full justify-between" />
            </div>
            <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
              <span className="truncate">{user?.email}</span>
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex flex-1 flex-col min-w-0">
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="-ml-1" />
              <span className="text-sm font-medium text-muted-foreground hidden sm:inline-block">
                Imobdigital
              </span>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2 text-right">
                <span className="text-sm font-medium text-foreground max-w-[140px] truncate sm:max-w-none">
                  {user?.name || user?.email || 'Usuário'}
                </span>
                <Badge variant="secondary" className="font-normal text-xs">
                  {getRoleLabel(user?.role)}
                </Badge>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="gap-2"
                title="Sair do sistema"
              >
                <LogOut className="h-4 w-4" />
                <span>Sair</span>
              </Button>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 md:p-8 pb-20 md:pb-8">
            <Outlet />
          </main>

          {/* Barra inferior de navegação no celular com alvos de toque mínimos de 44px */}
          <nav
            aria-label="Navegação móvel"
            className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border bg-background/95 backdrop-blur px-2 py-1 supports-[backdrop-filter]:bg-background/80"
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
                    'flex flex-col items-center justify-center min-h-[44px] min-w-[44px] flex-1 py-1 rounded-md text-xs font-normal transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-5 w-5 mb-0.5" />
                  <span className="text-[10px] leading-tight truncate max-w-[64px]">
                    {item.title}
                  </span>
                </Link>
              )
            })}
          </nav>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
