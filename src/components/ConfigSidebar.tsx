import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { User, Users, Building, UserX, FileText, Globe, Database, Key } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ConfigSectionItem {
  id: string
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: Array<'admin' | 'sdr' | 'corretor'>
}

export const CONFIG_SECTIONS: ConfigSectionItem[] = [
  {
    id: 'minha-conta',
    label: 'Minha conta',
    href: '/configuracoes',
    icon: User,
    roles: ['admin', 'sdr', 'corretor'],
  },
  {
    id: 'equipe',
    label: 'Equipe',
    href: '/admin?aba=usuarios',
    icon: Users,
    roles: ['admin'],
  },
  {
    id: 'organizacao',
    label: 'Organização',
    href: '/admin?aba=organizacao',
    icon: Building,
    roles: ['admin'],
  },
  {
    id: 'proprietarios',
    label: 'Proprietários sem imóvel',
    href: '/admin?aba=proprietarios',
    icon: UserX,
    roles: ['admin'],
  },
  {
    id: 'auditoria',
    label: 'Auditoria',
    href: '/admin?aba=auditoria',
    icon: FileText,
    roles: ['admin'],
  },
  {
    id: 'mcp',
    label: 'Acesso MCP',
    href: '/admin?aba=mcp',
    icon: Key,
    roles: ['admin'],
  },
  {
    id: 'portais',
    label: 'Portais',
    href: '/portais',
    icon: Globe,
    roles: ['admin'],
  },
  {
    id: 'backup',
    label: 'Backup',
    href: '/backup',
    icon: Database,
    roles: ['admin', 'sdr'],
  },
]

interface ConfigSidebarProps {
  currentSection?: string
  className?: string
}

export function ConfigSidebar({ currentSection, className }: ConfigSidebarProps) {
  const { user } = useAuth()
  const role = user?.role
  const location = useLocation()

  const visibleSections = CONFIG_SECTIONS.filter(
    (item) => role && item.roles.includes(role as 'admin' | 'sdr' | 'corretor'),
  )

  const isSectionActive = (item: ConfigSectionItem): boolean => {
    if (currentSection) {
      return currentSection === item.id
    }

    const currentPath = location.pathname
    const currentSearch = location.search

    if (item.id === 'minha-conta') {
      return currentPath === '/configuracoes'
    }

    if (item.href.startsWith('/admin')) {
      if (currentPath !== '/admin') return false
      const [_, query] = item.href.split('?')
      const targetAba = new URLSearchParams(query).get('aba')
      const currentParams = new URLSearchParams(currentSearch)
      const currentAbaRaw = currentParams.get('aba') || currentParams.get('tab')
      const currentAba =
        currentAbaRaw === 'sem-imovel' ? 'proprietarios' : currentAbaRaw || 'usuarios'
      return targetAba === currentAba
    }

    if (item.href === '/portais') {
      return currentPath === '/portais' || currentPath.startsWith('/portais/')
    }

    if (item.href === '/backup') {
      return currentPath === '/backup' || currentPath.startsWith('/backup/')
    }

    return false
  }

  return (
    <aside
      aria-label="Seções de Configurações"
      className={cn(
        'w-full md:w-[220px] shrink-0 border-b md:border-b-0 md:border-r border-border pb-4 md:pb-0 md:pr-4',
        className,
      )}
    >
      <div className="text-xs font-medium font-sans text-muted-foreground uppercase tracking-wider mb-2 hidden md:block">
        Configurações
      </div>
      <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
        {visibleSections.map((item) => {
          const Icon = item.icon
          const active = isSectionActive(item)
          return (
            <Link
              key={item.id}
              to={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 text-sm rounded-md font-sans transition-colors whitespace-nowrap shrink-0 md:shrink',
                active
                  ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  active ? 'text-primary-foreground' : 'text-muted-foreground',
                )}
              />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
