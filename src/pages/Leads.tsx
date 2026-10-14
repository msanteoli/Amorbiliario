import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  listLeads,
  listAllLeadsForFunnel,
  listDedupePendingLeads,
  resolveDedupe,
  getLeadById,
  LeadRecord,
  LeadStage,
  LeadOrigin,
  LeadUserRecord,
  LEAD_STAGE_LABELS,
  LEAD_ORIGIN_LABELS,
  formatLeadErrorMessage,
  listEligibleLeadAssignees,
} from '@/services/leads'
import { formatPhoneNumber } from '@/lib/clientUtils'
import { useAuth } from '@/contexts/AuthContext'
import { DirectLeadModal } from '@/components/leads/DirectLeadModal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Search,
  Plus,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  FilterX,
  List,
  Kanban,
  AlertTriangle,
  Clock,
  Home,
  CheckCircle2,
  UserCheck,
} from 'lucide-react'

const STAGE_ORDER: LeadStage[] = [
  'novo',
  'em_atendimento',
  'visita_marcada',
  'proposta',
  'ganho',
  'perdido',
]

import { getLeadStageBadgeVariant, type BadgeVariant } from '@/lib/badgeVariants'
export type { BadgeVariant }

export function getStageBadgeVariant(stage: LeadStage): BadgeVariant {
  return getLeadStageBadgeVariant(stage)
}

export function getStageBadgeColor(stage: LeadStage): string {
  // Mantido para compatibilidade onde string de classe direta é esperada
  switch (stage) {
    case 'novo':
      return 'bg-info/15 text-info-foreground border-info/30'
    case 'em_atendimento':
      return 'bg-primary/10 text-primary border-primary/20'
    case 'visita_marcada':
      return 'bg-info/15 text-info-foreground border-info/30'
    case 'proposta':
      return 'bg-primary/10 text-primary border-primary/20'
    case 'ganho':
      return 'bg-success/15 text-success-foreground border-success/30'
    case 'perdido':
      return 'bg-destructive/15 text-destructive border-destructive/30'
    default:
      return 'bg-muted text-muted-foreground'
  }
}
export function formatDateTimeBR(dateIso?: string | null): string {
  if (!dateIso) return '-'
  try {
    const d = new Date(dateIso)
    if (isNaN(d.getTime())) return dateIso
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateIso
  }
}

export function isLeadNextStepOverdue(lead: LeadRecord): boolean {
  if (!lead.next_step_due) return false
  if (lead.stage === 'ganho' || lead.stage === 'perdido') return false
  const due = new Date(lead.next_step_due).getTime()
  return due < Date.now()
}

export default function Leads() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const isCorretor = user?.role === 'corretor'
  const canManageLeads = user?.role === 'admin' || user?.role === 'sdr'

  const [searchParams] = useSearchParams()

  // View state: 'lista' | 'funil' | 'pendencias'
  const [activeTab, setActiveTab] = useState<'lista' | 'funil' | 'pendencias'>(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'pendencias' || tabParam === 'funil' || tabParam === 'lista') {
      return tabParam
    }
    return 'lista'
  })

  // Pagination and data for Table / List
  const [leads, setLeads] = useState<LeadRecord[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Funnel data
  const [funnelLeads, setFunnelLeads] = useState<LeadRecord[]>([])
  const [loadingFunnel, setLoadingFunnel] = useState(false)

  // Pendências data
  interface DedupePair {
    pending: LeadRecord
    original: LeadRecord | null
  }
  const [pendencias, setPendencias] = useState<DedupePair[]>([])
  const [loadingPendencias, setLoadingPendencias] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [confirmSamePersonLead, setConfirmSamePersonLead] = useState<LeadRecord | null>(null)

  // Modal Direcionar Lead
  const [directingLead, setDirectingLead] = useState<LeadRecord | null>(null)
  const [assignedSuccessMessageByLeadId, setAssignedSuccessMessageByLeadId] = useState<
    Record<string, string>
  >({})

  // Filters
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedStage, setSelectedStage] = useState<LeadStage | ''>(() => {
    const st = searchParams.get('stage') as LeadStage
    if (st && STAGE_ORDER.includes(st)) {
      return st
    }
    return ''
  })
  const [selectedOrigin, setSelectedOrigin] = useState<LeadOrigin | ''>('')
  const [selectedAssigned, setSelectedAssigned] = useState<string>('')
  const [filterExpired, setFilterExpired] = useState(false)
  const [filterNewUnassigned, setFilterNewUnassigned] = useState(false)

  // Assignees list
  const [eligibleAssignees, setEligibleAssignees] = useState<LeadUserRecord[]>([])

  // Search debounce 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Load assignees for admin and SDR
  useEffect(() => {
    if (canManageLeads) {
      listEligibleLeadAssignees()
        .then(setEligibleAssignees)
        .catch(() => {
          // silencia falha de carregamento de usuários
        })
    }
  }, [canManageLeads])

  // Load leads for Table / List
  const fetchListLeads = () => {
    let active = true
    setLoading(true)
    setErrorMessage(null)

    listLeads({
      page: currentPage,
      perPage: 10,
      search: debouncedSearch,
      stage: filterNewUnassigned ? undefined : selectedStage || undefined,
      origin: selectedOrigin || undefined,
      assigned_to: canManageLeads
        ? filterNewUnassigned
          ? 'unassigned'
          : selectedAssigned || undefined
        : undefined,
      expiredOnly: filterExpired,
      newUnassignedOnly: filterNewUnassigned,
      sort: '-created',
    })
      .then((res) => {
        if (!active) return
        setLeads(res.items)
        setTotalItems(res.totalItems)
        setTotalPages(res.totalPages || 1)
      })
      .catch((err) => {
        if (!active) return
        setErrorMessage(formatLeadErrorMessage(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }

  const handleLeadDirected = (leadId: string, assignedUserName: string) => {
    const successMsg = `Lead direcionado a ${assignedUserName}.`
    setAssignedSuccessMessageByLeadId((prev) => ({
      ...prev,
      [leadId]: successMsg,
    }))
    // Atualiza estado local de leads e funnel
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              assigned_to: 'assigned',
              expand: {
                ...l.expand,
                assigned_to: { id: 'assigned', name: assignedUserName },
              },
            }
          : l,
      ),
    )
    setFunnelLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              assigned_to: 'assigned',
              expand: {
                ...l.expand,
                assigned_to: { id: 'assigned', name: assignedUserName },
              },
            }
          : l,
      ),
    )
    // Refaz fetch para sincronizar dados reais do backend
    if (activeTab === 'lista') {
      fetchListLeads()
    } else if (activeTab === 'funil') {
      fetchFunnelLeads()
    }
  }

  useEffect(() => {
    if (activeTab === 'lista') {
      const cleanup = fetchListLeads()
      return cleanup
    }
  }, [
    activeTab,
    currentPage,
    debouncedSearch,
    selectedStage,
    selectedOrigin,
    selectedAssigned,
    filterExpired,
    filterNewUnassigned,
  ])

  // Load leads for Funnel
  const fetchFunnelLeads = () => {
    let active = true
    setLoadingFunnel(true)
    setErrorMessage(null)

    listAllLeadsForFunnel({
      search: debouncedSearch,
      stage: filterNewUnassigned ? undefined : selectedStage || undefined,
      origin: selectedOrigin || undefined,
      assigned_to: canManageLeads
        ? filterNewUnassigned
          ? 'unassigned'
          : selectedAssigned || undefined
        : undefined,
      expiredOnly: filterExpired,
      newUnassignedOnly: filterNewUnassigned,
      sort: '-created',
    })
      .then((items) => {
        if (!active) return
        setFunnelLeads(items)
      })
      .catch((err) => {
        if (!active) return
        setErrorMessage(formatLeadErrorMessage(err))
      })
      .finally(() => {
        if (active) setLoadingFunnel(false)
      })

    return () => {
      active = false
    }
  }

  useEffect(() => {
    if (activeTab === 'funil') {
      const cleanup = fetchFunnelLeads()
      return cleanup
    }
  }, [
    activeTab,
    debouncedSearch,
    selectedStage,
    selectedOrigin,
    selectedAssigned,
    filterExpired,
    filterNewUnassigned,
  ])

  // Load Pendências
  const fetchPendencias = async () => {
    if (!canManageLeads) return
    setLoadingPendencias(true)
    setErrorMessage(null)
    try {
      const items = await listDedupePendingLeads()
      const pairs: DedupePair[] = await Promise.all(
        items.map(async (pending) => {
          let original: LeadRecord | null = null
          if (pending.dedupe_of) {
            try {
              original = await getLeadById(pending.dedupe_of)
            } catch {
              original = null
            }
          }
          return { pending, original }
        }),
      )
      setPendencias(pairs)
    } catch (err) {
      setErrorMessage(formatLeadErrorMessage(err))
    } finally {
      setLoadingPendencias(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'pendencias' && canManageLeads) {
      fetchPendencias()
    }
  }, [activeTab, canManageLeads])

  const handleClearFilters = () => {
    setSearchInput('')
    setSelectedStage('')
    setSelectedOrigin('')
    setSelectedAssigned('')
    setFilterExpired(false)
    setFilterNewUnassigned(false)
    setCurrentPage(1)
  }

  const hasActiveFilters =
    Boolean(searchInput) ||
    Boolean(selectedStage) ||
    Boolean(selectedOrigin) ||
    Boolean(selectedAssigned) ||
    filterExpired ||
    filterNewUnassigned

  const handleResolveSeparate = async (leadId: string) => {
    try {
      setResolvingId(leadId)
      await resolveDedupe(leadId, 'separate')
      await fetchPendencias()
    } catch (err) {
      setErrorMessage(formatLeadErrorMessage(err))
    } finally {
      setResolvingId(null)
    }
  }

  const handleConfirmSamePerson = async () => {
    if (!confirmSamePersonLead) return
    const leadId = confirmSamePersonLead.id
    try {
      setResolvingId(leadId)
      setConfirmSamePersonLead(null)
      await resolveDedupe(leadId, 'same_person')
      await fetchPendencias()
    } catch (err) {
      setErrorMessage(formatLeadErrorMessage(err))
    } finally {
      setResolvingId(null)
    }
  }

  // Agrupamento para Funil
  const funnelByStage = useMemo(() => {
    const grouped: Record<LeadStage, LeadRecord[]> = {
      novo: [],
      em_atendimento: [],
      visita_marcada: [],
      proposta: [],
      ganho: [],
      perdido: [],
    }
    funnelLeads.forEach((l) => {
      if (grouped[l.stage]) {
        grouped[l.stage].push(l)
      }
    })
    return grouped
  }, [funnelLeads])

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="display-sm text-foreground">Leads</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Acompanhe oportunidades, etapas de negociação e atendimento a novos contatos.
          </p>
        </div>

        {canManageLeads && (
          <Button
            onClick={() => navigate('/leads/novo')}
            className="hidden sm:inline-flex rounded-full px-5 h-10 gap-2 font-medium"
          >
            <Plus className="h-4 w-4" />
            <span>Novo lead</span>
          </Button>
        )}
      </div>

      {/* Botão flutuante no celular (FAB 56px) */}
      {canManageLeads && (
        <button
          type="button"
          onClick={() => navigate('/leads/novo')}
          aria-label="Novo lead"
          className="sm:hidden fixed right-4 bottom-20 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-none border border-border flex items-center justify-center active:scale-95 transition-transform"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Tabs bar: Lista, Funil, Pendências */}
      <div className="flex flex-col gap-3">
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as 'lista' | 'funil' | 'pendencias')}
          className="w-full"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={() => setActiveTab('lista')}
                className={`h-9 px-4 rounded-full text-xs font-normal border transition-colors inline-flex items-center gap-1.5 ${
                  activeTab === 'lista'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-foreground border-border hover:bg-muted'
                }`}
              >
                <List className="h-3.5 w-3.5" />
                <span>Lista</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('funil')}
                className={`h-9 px-4 rounded-full text-xs font-normal border transition-colors inline-flex items-center gap-1.5 ${
                  activeTab === 'funil'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-foreground border-border hover:bg-muted'
                }`}
              >
                <Kanban className="h-3.5 w-3.5" />
                <span>Funil</span>
              </button>
              {canManageLeads && (
                <button
                  type="button"
                  onClick={() => setActiveTab('pendencias')}
                  className={`h-9 px-4 rounded-full text-xs font-normal border transition-colors inline-flex items-center gap-1.5 ${
                    activeTab === 'pendencias'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-transparent text-foreground border-border hover:bg-muted'
                  }`}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Pendências</span>
                  {pendencias.length > 0 && (
                    <Badge variant="attention" className="ml-0.5 px-1.5 py-0 text-[10px] tabular">
                      {pendencias.length}
                    </Badge>
                  )}
                </button>
              )}
            </div>
            <div className="text-xs text-muted-foreground tabular hidden sm:block">
              {activeTab === 'lista' && `${totalItems} lead(s)`}
              {activeTab === 'funil' && `${funnelLeads.length} lead(s)`}
              {activeTab === 'pendencias' && `${pendencias.length} pendência(s)`}
            </div>
          </div>

          {/* Filtros para Lista e Funil (compartilhados) */}
          {activeTab !== 'pendencias' && (
            <div className="mt-3 space-y-2.5">
              {/* Campo de busca em pílula de 48px */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar por nome, telefone ou e-mail..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full h-12 pl-11 pr-4 rounded-full border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Fileira de filtros em pílulas com rolagem lateral no celular */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {/* Etapa */}
                <Select
                  value={selectedStage || 'todas'}
                  onValueChange={(val) => {
                    setSelectedStage(val === 'todas' ? '' : (val as LeadStage))
                    if (filterNewUnassigned) setFilterNewUnassigned(false)
                    setCurrentPage(1)
                  }}
                  disabled={filterNewUnassigned}
                >
                  <SelectTrigger className="h-9 rounded-full px-3.5 text-xs border-border bg-background shrink-0 w-auto min-w-[130px]">
                    <SelectValue placeholder="Etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as etapas</SelectItem>
                    {STAGE_ORDER.map((st) => (
                      <SelectItem key={st} value={st}>
                        {LEAD_STAGE_LABELS[st]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Origem */}
                <Select
                  value={selectedOrigin || 'todas'}
                  onValueChange={(val) => {
                    setSelectedOrigin(val === 'todas' ? '' : (val as LeadOrigin))
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="h-9 rounded-full px-3.5 text-xs border-border bg-background shrink-0 w-auto min-w-[130px]">
                    <SelectValue placeholder="Origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as origens</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="portal">Portais imobiliários</SelectItem>
                    <SelectItem value="indicacao_balcao">Indicação ou balcão</SelectItem>
                    <SelectItem value="site_redes_outros">Instagram, site e outros</SelectItem>
                  </SelectContent>
                </Select>

                {/* Atribuído (só admin e SDR) */}
                {canManageLeads && (
                  <Select
                    value={filterNewUnassigned ? 'unassigned' : selectedAssigned || 'todos'}
                    onValueChange={(val) => {
                      if (filterNewUnassigned) setFilterNewUnassigned(false)
                      setSelectedAssigned(val === 'todos' ? '' : val)
                      setCurrentPage(1)
                    }}
                    disabled={filterNewUnassigned}
                  >
                    <SelectTrigger className="h-9 rounded-full px-3.5 text-xs border-border bg-background shrink-0 w-auto min-w-[130px]">
                      <SelectValue placeholder="Atribuído" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os atribuídos</SelectItem>
                      <SelectItem value="unassigned">Sem dono</SelectItem>
                      {eligibleAssignees.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name || u.email || 'Usuário'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Atalho Vencidos */}
                <button
                  type="button"
                  onClick={() => {
                    setFilterExpired(!filterExpired)
                    setCurrentPage(1)
                  }}
                  className={`h-9 px-3.5 rounded-full text-xs font-normal border transition-colors inline-flex items-center gap-1.5 shrink-0 ${
                    filterExpired
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:bg-muted'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>Vencidos</span>
                </button>

                {/* Atalho Novos sem dono */}
                {canManageLeads && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !filterNewUnassigned
                      setFilterNewUnassigned(nextVal)
                      if (nextVal) {
                        setSelectedStage('')
                        setSelectedAssigned('')
                      }
                      setCurrentPage(1)
                    }}
                    className={`h-9 px-3.5 rounded-full text-xs font-normal border transition-colors inline-flex items-center gap-1.5 shrink-0 ${
                      filterNewUnassigned
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-foreground border-border hover:bg-muted'
                    }`}
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>Novos sem dono</span>
                  </button>
                )}

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="text-xs text-muted-foreground hover:text-foreground shrink-0 px-2 py-1 underline"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Erro global se houver */}
          {errorMessage && (
            <div className="flex items-center gap-2 p-4 mt-4 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: LISTA */}
          <TabsContent value="lista" className="mt-4 space-y-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-16 rounded-lg border border-border animate-pulse bg-muted/40"
                  />
                ))}
              </div>
            ) : leads.length === 0 ? (
              <div className="p-12 text-center rounded-[8px] border border-border bg-card grade-planta">
                <div className="max-w-sm mx-auto bg-card/90 backdrop-blur-sm p-6 rounded-[8px] border border-border shadow-none">
                  <p className="text-sm text-muted-foreground mb-4">
                    {hasActiveFilters
                      ? 'Nenhum lead corresponde aos filtros aplicados.'
                      : 'Nenhum lead por aqui. Cadastre o primeiro.'}
                  </p>
                  {hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="text-xs text-primary underline"
                    >
                      Limpar filtros
                    </button>
                  ) : canManageLeads ? (
                    <Button
                      onClick={() => navigate('/leads/novo')}
                      className="rounded-[4px] px-5 h-10 gap-2 font-medium"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Novo lead</span>
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
                {/* Desktop: Lista de linhas com divisores e cabeçalho em .eyebrow */}
                <div className="hidden md:block rounded-lg border border-border bg-card overflow-hidden">
                  <div className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-border text-left eyebrow text-muted-foreground">
                    <div className="col-span-3">Nome</div>
                    <div className="col-span-2">Telefone</div>
                    <div className="col-span-1">Origem</div>
                    <div className="col-span-2">Situação</div>
                    <div className="col-span-2">Atribuído</div>
                    <div className="col-span-2 text-right">Próximo passo</div>
                  </div>
                  <div className="divide-y divide-border">
                    {leads.map((lead) => {
                      const assigneeName =
                        lead.expand?.assigned_to?.name ||
                        lead.expand?.assigned_to?.email ||
                        'Sem dono'
                      const isOverdue = isLeadNextStepOverdue(lead)

                      return (
                        <div
                          key={lead.id}
                          onClick={() => navigate(`/leads/${lead.id}`)}
                          className="grid grid-cols-12 gap-3 px-4 py-3.5 items-center hover:bg-muted/40 cursor-pointer transition-colors"
                        >
                          <div className="col-span-3 flex items-center gap-2 min-w-0">
                            <span className="font-normal text-sm text-foreground truncate">
                              {lead.name}
                            </span>
                            {lead.client_id && (
                              <Badge variant="default" className="text-[10px] shrink-0">
                                Já é cliente
                              </Badge>
                            )}
                          </div>
                          <div className="col-span-2 text-xs text-muted-foreground tabular whitespace-nowrap">
                            {lead.phone ? formatPhoneNumber(lead.phone) : '—'}
                          </div>
                          <div className="col-span-1 text-xs text-muted-foreground truncate">
                            {LEAD_ORIGIN_LABELS[lead.origin] || lead.origin}
                          </div>
                          <div className="col-span-2 flex items-center gap-1">
                            <Badge variant={getStageBadgeVariant(lead.stage)} className="text-xs">
                              {LEAD_STAGE_LABELS[lead.stage] || lead.stage}
                            </Badge>
                          </div>
                          <div className="col-span-2 text-xs text-muted-foreground truncate">
                            {assigneeName}
                          </div>
                          <div className="col-span-2 text-right text-xs space-y-1">
                            {assignedSuccessMessageByLeadId[lead.id] ? (
                              <div className="text-[11px] text-success font-medium text-right">
                                {assignedSuccessMessageByLeadId[lead.id]}
                              </div>
                            ) : lead.next_step ? (
                              <div className="space-y-0.5">
                                <span className="text-foreground line-clamp-1 block">
                                  {lead.next_step}
                                </span>
                                {lead.next_step_due && (
                                  <span
                                    className={`tabular text-[11px] block ${
                                      isOverdue
                                        ? 'text-attention font-medium'
                                        : 'text-muted-foreground'
                                    }`}
                                  >
                                    {isOverdue && 'Atrasado: '}
                                    {formatDateTimeBR(lead.next_step_due)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                            {canManageLeads && lead.origin === 'site' && !lead.assigned_to && (
                              <div
                                className="flex justify-end pt-0.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setDirectingLead(lead)}
                                  className="h-6 rounded-full px-2.5 text-[11px] font-normal border-border"
                                >
                                  Direcionar
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Mobile: Lista de linhas empilhadas de ~72px com divisores de 1px */}
                <div className="md:hidden rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
                  {leads.map((lead) => {
                    const assigneeName =
                      lead.expand?.assigned_to?.name ||
                      lead.expand?.assigned_to?.email ||
                      'Sem dono'
                    const isOverdue = isLeadNextStepOverdue(lead)

                    return (
                      <div
                        key={lead.id}
                        onClick={() => navigate(`/leads/${lead.id}`)}
                        className="p-3.5 flex flex-col justify-between min-h-[72px] hover:bg-muted/40 cursor-pointer active:bg-muted/60 transition-colors gap-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-normal text-sm text-foreground truncate">
                              {lead.name}
                            </span>
                            {lead.client_id && (
                              <Badge variant="default" className="text-[10px] shrink-0">
                                Já é cliente
                              </Badge>
                            )}
                          </div>
                          <Badge
                            variant={getStageBadgeVariant(lead.stage)}
                            className="text-xs shrink-0"
                          >
                            {LEAD_STAGE_LABELS[lead.stage] || lead.stage}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
                          <span className="tabular">
                            {lead.phone ? formatPhoneNumber(lead.phone) : assigneeName}
                          </span>
                          {lead.next_step && (
                            <span
                              className={`truncate text-[11px] ${
                                isOverdue ? 'text-attention font-medium' : 'text-muted-foreground'
                              }`}
                            >
                              {isOverdue && 'Atrasado: '}
                              {lead.next_step}
                            </span>
                          )}
                        </div>
                        {assignedSuccessMessageByLeadId[lead.id] && (
                          <div className="text-[11px] text-success font-medium">
                            {assignedSuccessMessageByLeadId[lead.id]}
                          </div>
                        )}
                        {canManageLeads && lead.origin === 'site' && !lead.assigned_to && (
                          <div
                            className="pt-1 flex justify-end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDirectingLead(lead)}
                              className="h-7 rounded-full px-3 text-[11px] font-normal border-border"
                            >
                              Direcionar
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Paginação em pílulas com a página atual em texto de apoio */}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-muted-foreground tabular">
                    Página {currentPage} de {totalPages} ({totalItems} leads)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1 || loading}
                      className="h-9 rounded-full px-4 text-xs font-normal border-border gap-1"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      <span>Anterior</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages || loading}
                      className="h-9 rounded-full px-4 text-xs font-normal border-border gap-1"
                    >
                      <span>Próxima</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* TAB 2: FUNIL */}
          <TabsContent value="funil" className="mt-4">
            {loadingFunnel ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 rounded-lg border border-border animate-pulse bg-muted/40"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Desktop: Colunas com cabeçalho em .eyebrow e contagem, cartões de lead de 8px com borda 1px sem sombra */}
                <div className="hidden lg:grid lg:grid-cols-6 gap-3 items-start overflow-x-auto pb-4">
                  {STAGE_ORDER.map((stageKey) => {
                    const columnLeads = funnelByStage[stageKey] || []
                    return (
                      <div
                        key={stageKey}
                        className="flex flex-col rounded-lg border border-border bg-card p-2.5 min-h-[420px]"
                      >
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
                          <span className="eyebrow text-muted-foreground">
                            {LEAD_STAGE_LABELS[stageKey]}
                          </span>
                          <span className="tabular text-xs text-muted-foreground">
                            {columnLeads.length}
                          </span>
                        </div>

                        <div className="flex-1 space-y-2 overflow-y-auto max-h-[650px]">
                          {columnLeads.length === 0 ? (
                            <div className="py-8 text-center text-xs text-muted-foreground">
                              Nenhum lead
                            </div>
                          ) : (
                            columnLeads.map((item) => {
                              const assigneeName =
                                item.expand?.assigned_to?.name ||
                                item.expand?.assigned_to?.email ||
                                'Sem dono'
                              const isOverdue = isLeadNextStepOverdue(item)
                              return (
                                <div
                                  key={item.id}
                                  onClick={() => navigate(`/leads/${item.id}`)}
                                  className="p-3 rounded-lg border border-border bg-card hover:bg-muted/40 cursor-pointer transition-colors space-y-1.5"
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-normal text-xs text-foreground line-clamp-1">
                                      {item.name}
                                    </span>
                                    {item.client_id && (
                                      <Badge
                                        variant="default"
                                        className="text-[9px] px-1 py-0 h-4 shrink-0"
                                      >
                                        Já é cliente
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground flex justify-between gap-1">
                                    <span>{LEAD_ORIGIN_LABELS[item.origin] || item.origin}</span>
                                    <span className="truncate">{assigneeName}</span>
                                  </div>
                                  {item.next_step_due && (
                                    <div
                                      className={`tabular text-[10px] ${
                                        isOverdue
                                          ? 'text-attention font-medium'
                                          : 'text-muted-foreground'
                                      }`}
                                    >
                                      {isOverdue && 'Atrasado: '}
                                      {formatDateTimeBR(item.next_step_due)}
                                    </div>
                                  )}
                                  {assignedSuccessMessageByLeadId[item.id] && (
                                    <div className="text-[11px] text-success font-medium">
                                      {assignedSuccessMessageByLeadId[item.id]}
                                    </div>
                                  )}
                                  {canManageLeads &&
                                    item.origin === 'site' &&
                                    !item.assigned_to && (
                                      <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => setDirectingLead(item)}
                                          className="w-full h-7 rounded-full text-[11px] font-normal border-border"
                                        >
                                          Direcionar
                                        </Button>
                                      </div>
                                    )}
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Mobile / Tablet: Uma coluna por vez, com as etapas como pílulas rolantes no topo (a escolhida preenchida) e as linhas da etapa abaixo */}
                <div className="lg:hidden">
                  <Tabs defaultValue="novo" className="w-full">
                    <div className="overflow-x-auto no-scrollbar py-1">
                      <TabsList className="inline-flex gap-1.5 p-0 bg-transparent h-auto">
                        {STAGE_ORDER.map((stageKey) => (
                          <TabsTrigger
                            key={stageKey}
                            value={stageKey}
                            className="h-9 px-3.5 rounded-full text-xs font-normal border border-border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary shrink-0 gap-1"
                          >
                            <span>{LEAD_STAGE_LABELS[stageKey]}</span>
                            <span className="tabular text-[10px] opacity-75">
                              ({(funnelByStage[stageKey] || []).length})
                            </span>
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </div>

                    {STAGE_ORDER.map((stageKey) => {
                      const columnLeads = funnelByStage[stageKey] || []
                      return (
                        <TabsContent key={stageKey} value={stageKey} className="mt-3">
                          {columnLeads.length === 0 ? (
                            <div className="p-8 text-center text-xs text-muted-foreground border border-border rounded-lg bg-card">
                              Nenhum lead nesta etapa.
                            </div>
                          ) : (
                            <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
                              {columnLeads.map((item) => {
                                const assigneeName =
                                  item.expand?.assigned_to?.name ||
                                  item.expand?.assigned_to?.email ||
                                  'Sem dono'
                                const isOverdue = isLeadNextStepOverdue(item)
                                return (
                                  <div
                                    key={item.id}
                                    onClick={() => navigate(`/leads/${item.id}`)}
                                    className="p-3.5 flex flex-col justify-between min-h-[72px] hover:bg-muted/40 cursor-pointer active:bg-muted/60 transition-colors gap-1.5"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="font-normal text-sm text-foreground truncate">
                                          {item.name}
                                        </span>
                                        {item.client_id && (
                                          <Badge variant="default" className="text-[10px] shrink-0">
                                            Já é cliente
                                          </Badge>
                                        )}
                                      </div>
                                      <Badge
                                        variant={getStageBadgeVariant(item.stage)}
                                        className="text-xs shrink-0"
                                      >
                                        {LEAD_STAGE_LABELS[item.stage] || item.stage}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
                                      <span>{assigneeName}</span>
                                      {item.next_step && (
                                        <span
                                          className={`truncate text-[11px] ${
                                            isOverdue
                                              ? 'text-attention font-medium'
                                              : 'text-muted-foreground'
                                          }`}
                                        >
                                          {isOverdue && 'Atrasado: '}
                                          {item.next_step}
                                        </span>
                                      )}
                                    </div>
                                    {assignedSuccessMessageByLeadId[item.id] && (
                                      <div className="text-[11px] text-success font-medium">
                                        {assignedSuccessMessageByLeadId[item.id]}
                                      </div>
                                    )}
                                    {canManageLeads &&
                                      item.origin === 'site' &&
                                      !item.assigned_to && (
                                        <div
                                          className="pt-1 flex justify-end"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setDirectingLead(item)}
                                            className="h-7 rounded-full px-3 text-[11px] font-normal border-border"
                                          >
                                            Direcionar
                                          </Button>
                                        </div>
                                      )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </TabsContent>
                      )
                    })}
                  </Tabs>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB 3: PENDÊNCIAS (admin e SDR) */}
          {canManageLeads && (
            <TabsContent value="pendencias" className="mt-4 space-y-4">
              {loadingPendencias ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-28 rounded-lg border border-border animate-pulse bg-muted/40"
                    />
                  ))}
                </div>
              ) : pendencias.length === 0 ? (
                <div className="p-12 text-center rounded-lg border border-border bg-card">
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Nenhuma pendência de duplicidade por aqui.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Revise as duas fichas e defina a resolução de duplicidade:
                  </p>

                  <div className="space-y-4">
                    {pendencias.map(({ pending, original }) => {
                      const isWorking = resolvingId === pending.id

                      return (
                        <div
                          key={pending.id}
                          className="rounded-lg border border-border bg-card overflow-hidden"
                        >
                          <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="attention">Pendência de duplicidade</Badge>
                              <span className="text-sm font-normal text-foreground">
                                {pending.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResolveSeparate(pending.id)}
                                disabled={isWorking}
                                className="h-9 rounded-full px-4 text-xs font-normal border-border"
                              >
                                {isWorking && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                                São pessoas diferentes
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setConfirmSamePersonLead(pending)}
                                disabled={isWorking}
                                className="h-9 rounded-full px-4 text-xs font-normal border-border"
                              >
                                É a mesma pessoa
                              </Button>
                            </div>
                          </div>

                          <div className="p-4">
                            {/* Cada pendência mostra os dois leads lado a lado no desktop e empilhados no celular */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Lead pendente */}
                              <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="eyebrow text-muted-foreground">
                                    Lead Novo (Pendente)
                                  </span>
                                  <Link
                                    to={`/leads/${pending.id}`}
                                    className="text-xs text-primary underline"
                                  >
                                    Ver ficha
                                  </Link>
                                </div>
                                <div className="text-sm font-normal text-foreground">
                                  {pending.name}
                                </div>
                                <div className="space-y-1 text-xs text-muted-foreground tabular">
                                  <div>
                                    Telefone:{' '}
                                    {pending.phone ? formatPhoneNumber(pending.phone) : '—'}
                                  </div>
                                  <div>E-mail: {pending.email || '—'}</div>
                                  <div className="pt-1 flex items-center gap-2">
                                    <span>
                                      Origem: {LEAD_ORIGIN_LABELS[pending.origin] || pending.origin}
                                    </span>
                                    <span>•</span>
                                    <Badge
                                      variant={getStageBadgeVariant(pending.stage)}
                                      className="text-[10px]"
                                    >
                                      {LEAD_STAGE_LABELS[pending.stage] || pending.stage}
                                    </Badge>
                                  </div>
                                </div>
                              </div>

                              {/* Lead existente */}
                              <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="eyebrow text-muted-foreground">
                                    Lead Existente (Anterior)
                                  </span>
                                  {original && (
                                    <Link
                                      to={`/leads/${original.id}`}
                                      className="text-xs text-primary underline"
                                    >
                                      Ver ficha
                                    </Link>
                                  )}
                                </div>
                                {original ? (
                                  <>
                                    <div className="text-sm font-normal text-foreground">
                                      {original.name}
                                    </div>
                                    <div className="space-y-1 text-xs text-muted-foreground tabular">
                                      <div>
                                        Telefone:{' '}
                                        {original.phone ? formatPhoneNumber(original.phone) : '—'}
                                      </div>
                                      <div>E-mail: {original.email || '—'}</div>
                                      <div className="pt-1 flex items-center gap-2">
                                        <span>
                                          Origem:{' '}
                                          {LEAD_ORIGIN_LABELS[original.origin] || original.origin}
                                        </span>
                                        <span>•</span>
                                        <Badge
                                          variant={getStageBadgeVariant(original.stage)}
                                          className="text-[10px]"
                                        >
                                          {LEAD_STAGE_LABELS[original.stage] || original.stage}
                                        </Badge>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-xs text-muted-foreground py-2">
                                    Lead apontado não encontrado.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* MODAL DIRECIONAR LEAD */}
      {directingLead && (
        <DirectLeadModal
          leadId={directingLead.id}
          leadName={directingLead.name}
          open={Boolean(directingLead)}
          onOpenChange={(open) => {
            if (!open) setDirectingLead(null)
          }}
          onSuccess={(assignedUserName) => {
            handleLeadDirected(directingLead.id, assignedUserName)
          }}
        />
      )}

      {/* Confirmação de Mesma Pessoa */}
      <AlertDialog
        open={Boolean(confirmSamePersonLead)}
        onOpenChange={(open) => !open && setConfirmSamePersonLead(null)}
      >
        <AlertDialogContent className="rounded-lg border border-border p-5 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-normal">
              Confirmar duplicidade
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              O lead mais novo será encerrado como duplicado. Nada é apagado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="h-9 rounded-full px-4 text-xs font-normal border-border">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSamePerson}
              className="h-9 rounded-full px-4 text-xs font-normal bg-primary text-primary-foreground"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
