import type React from 'react'
import type { UserRole } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  Inbox,
  Users,
  CalendarDays,
  Building2,
  Building,
  Settings,
} from 'lucide-react'

export interface NavItemConfig {
  id: string
  label: string
  href: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  roles: UserRole[]
}

export interface NavGroupConfig {
  id: string
  title: string
  collapsible?: boolean
  items: NavItemConfig[]
}

/**
 * Item isolado do topo ("Painel" - rota /hoje)
 */
export const PAINEL_NAV_ITEM: NavItemConfig = {
  id: 'painel',
  label: 'Painel',
  href: '/hoje',
  icon: LayoutDashboard,
  roles: ['admin', 'sdr', 'corretor'],
}

/**
 * Para retrocompatibilidade caso algo ainda importe HOJE_NAV_ITEM
 */
export const HOJE_NAV_ITEM: NavItemConfig = PAINEL_NAV_ITEM

/**
 * Item de rodapé ("Configurações" - rota /configuracoes)
 */
export const CONFIGURACOES_NAV_ITEM: NavItemConfig = {
  id: 'configuracoes',
  label: 'Configurações',
  href: '/configuracoes',
  icon: Settings,
  roles: ['admin', 'sdr', 'corretor'],
}

/**
 * Grupos principais de navegação:
 * - Atendimento: Leads (/leads), Clientes (/clientes), Agenda (/agenda)
 * - Imóveis: Imóveis (/imoveis), Condomínios (/condominios)
 */
export const NAV_GROUPS: NavGroupConfig[] = [
  {
    id: 'atendimento',
    title: 'Atendimento',
    collapsible: true,
    items: [
      {
        id: 'leads',
        label: 'Leads',
        href: '/leads',
        icon: Inbox,
        roles: ['admin', 'sdr', 'corretor'],
      },
      {
        id: 'clientes',
        label: 'Clientes',
        href: '/clientes',
        icon: Users,
        roles: ['admin', 'sdr', 'corretor'],
      },
      {
        id: 'agenda',
        label: 'Agenda',
        href: '/agenda',
        icon: CalendarDays,
        roles: ['admin', 'sdr', 'corretor'],
      },
    ],
  },
  {
    id: 'imoveis',
    title: 'Imóveis',
    collapsible: true,
    items: [
      {
        id: 'imoveis',
        label: 'Imóveis',
        href: '/imoveis',
        icon: Building2,
        roles: ['admin', 'sdr', 'corretor'],
      },
      {
        id: 'condominios',
        label: 'Condomínios',
        href: '/condominios',
        icon: Building,
        roles: ['admin', 'sdr', 'corretor'],
      },
    ],
  },
]

/**
 * Lista plana com todos os itens do sistema para conferência, busca e checagem de papéis.
 */
export const ALL_NAV_ITEMS: NavItemConfig[] = [
  PAINEL_NAV_ITEM,
  ...NAV_GROUPS.flatMap((group) => group.items),
  CONFIGURACOES_NAV_ITEM,
]

/**
 * Retorna se o item está visível para o papel do usuário logado.
 */
export function isItemVisibleForRole(item: NavItemConfig, role?: UserRole): boolean {
  if (!role) return false
  return item.roles.includes(role)
}

/**
 * Filtra os grupos de navegação removendo itens invisíveis ao papel.
 * Grupos que ficarem com zero itens visíveis são omitidos.
 */
export function getVisibleGroupsForRole(role?: UserRole): NavGroupConfig[] {
  if (!role) return []
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0)
}

/**
 * Avalia se um item do menu corresponde à rota atual (inclusive subrotas).
 */
export function isNavItemActive(
  itemHref: string,
  currentPath: string,
  _currentSearch = '',
): boolean {
  const [itemPath] = itemHref.split('?')

  // Tratamento específico de rota raiz e Hoje/Painel
  if (itemPath === '/hoje') {
    return currentPath === '/hoje' || currentPath.startsWith('/hoje/')
  }

  // Demais rotas: correspondência exata ou de subrota (/imoveis -> /imoveis, /imoveis/123)
  if (currentPath === itemPath) return true
  if (currentPath.startsWith(`${itemPath}/`)) return true

  // Configurações: /admin, /portais, /integracoes, /site, /backup também fazem parte de Configurações para efeito de menu
  if (itemPath === '/configuracoes') {
    if (
      currentPath === '/configuracoes' ||
      currentPath.startsWith('/configuracoes/') ||
      currentPath === '/admin' ||
      currentPath.startsWith('/admin/') ||
      currentPath === '/portais' ||
      currentPath.startsWith('/portais/') ||
      currentPath === '/integracoes' ||
      currentPath.startsWith('/integracoes/') ||
      currentPath === '/site' ||
      currentPath.startsWith('/site/') ||
      currentPath === '/backup' ||
      currentPath.startsWith('/backup/')
    ) {
      return true
    }
  }

  return false
}

/**
 * Encontra a informação de breadcrumb para a rota atual:
 * { group: 'Atendimento', screen: 'Leads' } ou { screen: 'Painel' }
 */
export function getBreadcrumbForPath(pathname: string): { group?: string; screen: string } {
  if (pathname === '/hoje' || pathname.startsWith('/hoje/')) {
    return { screen: 'Painel' }
  }

  if (pathname === '/leads' || pathname.startsWith('/leads/')) {
    return { group: 'Atendimento', screen: 'Leads' }
  }
  if (pathname === '/clientes' || pathname.startsWith('/clientes/')) {
    return { group: 'Atendimento', screen: 'Clientes' }
  }
  if (pathname === '/agenda' || pathname.startsWith('/agenda/')) {
    return { group: 'Atendimento', screen: 'Agenda' }
  }

  if (pathname === '/imoveis' || pathname.startsWith('/imoveis/')) {
    return { group: 'Imóveis', screen: 'Imóveis' }
  }
  if (pathname === '/condominios' || pathname.startsWith('/condominios/')) {
    return { group: 'Imóveis', screen: 'Condomínios' }
  }

  if (
    pathname === '/configuracoes' ||
    pathname.startsWith('/configuracoes/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/portais' ||
    pathname.startsWith('/portais/') ||
    pathname === '/integracoes' ||
    pathname.startsWith('/integracoes/') ||
    pathname === '/site' ||
    pathname.startsWith('/site/') ||
    pathname === '/backup' ||
    pathname.startsWith('/backup/')
  ) {
    return { screen: 'Configurações' }
  }

  return { screen: 'Imobdigital' }
}
