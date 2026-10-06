import { useLocation, Link, Outlet } from 'react-router-dom'
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
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
                I
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-base leading-tight">Imobdigital</span>
                <span className="text-xs text-muted-foreground">Gestão Imobiliária</span>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = location.pathname === item.url
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild isActive={isActive}>
                          <Link to={item.url} className="flex items-center gap-3">
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

          <SidebarFooter className="border-t border-sidebar-border p-3">
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

          <main className="flex-1 p-4 sm:p-6 md:p-8">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
