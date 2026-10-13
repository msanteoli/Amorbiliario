import type React from 'react'
import type { UserRole } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  Inbox,
  Users,
  CalendarDays,
  Building2,
  Building,
  UserCog,
  Landmark,
  UserX,
  ScrollText,
  Globe,
  Database,
} from 'lucide-react'

export interface NavItemConfig {
  id: string
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: UserRole[]
}

export interface NavGroupConfig {
  id: string
  title: string
  collapsible?: boolean
  items: NavItemConfig[]
}

/**
 * Item isolado do topo ("Hoje")
 */
export const HOJE_NAV_ITEM: NavItemConfig = {
  id: 'hoje',
  label: 'Hoje',
  href: '/hoje',
  icon: LayoutDashboard,
  roles: ['admin', 'sdr', 'corretor'],
}

/**
 * Grupos principais de navegação:
 * - Atendimento: Leads, Clientes, Agenda
 * - Imóveis: Imóveis, Condomínios
 * - Configurações: Equipe, Organização, Proprietários sem imóvel, Auditoria, Portais, Backup
 *
 * Visibilidade por papel:
 * - Hoje, Leads, Clientes, Agenda, Imóveis, Condomínios: admin, SDR e corretor.
 * - Equipe, Organização, Proprietários sem imóvel, Auditoria, Portais: só admin.
 * - Backup: admin e SDR.
 */
export const NAV_GROUPS: NavGroupConfig[] = [
  {
    id: 'atendimento',
    title: 'Atendimento',
    collapsible: false,
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
    collapsible: false,
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
  {
    id: 'configuracoes',
    title: 'Configurações',
    collapsible: true,
    items: [
      {
        id: 'equipe',
        label: 'Equipe',
        href: '/admin?aba=usuarios',
        icon: UserCog,
        roles: ['admin'],
      },
      {
        id: 'organizacao',
        label: 'Organização',
        href: '/admin?aba=organizacao',
        icon: Landmark,
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
        icon: ScrollText,
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
    ],
  },
]

/**
 * Lista plana com todos os itens do sistema, útil para conferência ou buscas.
 */
export const ALL_NAV_ITEMS: NavItemConfig[] = [
  HOJE_NAV_ITEM,
  ...NAV_GROUPS.flatMap((group) => group.items),
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
 * Avalia se um item do menu corresponde à rota atual (inclusive subrotas e parâmetros de aba).
 * Exemplo:
 * - /imoveis/123 corresponde a /imoveis
 * - /leads/abc corresponde a /leads
 * - /admin?aba=usuarios corresponde a /admin?aba=usuarios
 * - /admin (sem parâmetro) corresponde a /admin?aba=usuarios (aba padrão)
 * - /admin?aba=organizacao corresponde a /admin?aba=organizacao
 * - /admin?tab=sem-imovel corresponde a /admin?aba=proprietarios
 */
export function isNavItemActive(
  itemHref: string,
  currentPath: string,
  currentSearch: string,
): boolean {
  const [itemPath, itemQuery] = itemHref.split('?')
  const currentParams = new URLSearchParams(currentSearch)

  // Tratamento específico para itens apontados para /admin
  if (itemPath === '/admin') {
    if (currentPath !== '/admin') {
      return false
    }
    const itemAba = itemQuery ? new URLSearchParams(itemQuery).get('aba') : null
    const currentAbaRaw = currentParams.get('aba') || currentParams.get('tab')
    // Mapeamento de retrocompatibilidade para sem-imovel <-> proprietarios
    const currentAba =
      currentAbaRaw === 'sem-imovel' ? 'proprietarios' : currentAbaRaw || 'usuarios'

    return itemAba === currentAba
  }

  // Demais rotas: correspondência exata ou de subrota (/imoveis -> /imoveis, /imoveis/123)
  if (currentPath === itemPath) return true
  if (currentPath.startsWith(`${itemPath}/`)) return true

  return false
}
