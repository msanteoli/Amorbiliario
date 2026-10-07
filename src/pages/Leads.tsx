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

export function getStageBadgeColor(stage: LeadStage): string {
  switch (stage) {
    case 'novo':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800'
    case 'em_atendimento':
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
    case 'visita_marcada':
      return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800'
    case 'proposta':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800'
    case 'ganho':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
    case 'perdido':
      return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
    default:
      return 'bg-secondary text-secondary-foreground'
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe oportunidades, etapas de negociação e atendimento a novos contatos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canManageLeads && (
            <Button onClick={() => navigate('/leads/novo')} className="gap-2 shrink-0">
              <Plus className="h-4 w-4" />
              <span>Novo lead</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs bar: Lista, Funil, Pendências */}
      <div className="flex flex-col gap-3">
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as 'lista' | 'funil' | 'pendencias')}
          className="w-full"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-2">
            <TabsList className="bg-muted">
              <TabsTrigger value="lista" className="gap-2">
                <List className="h-4 w-4" />
                <span>Lista</span>
              </TabsTrigger>
              <TabsTrigger value="funil" className="gap-2">
                <Kanban className="h-4 w-4" />
                <span>Funil</span>
              </TabsTrigger>
              {canManageLeads && (
                <TabsTrigger value="pendencias" className="gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Pendências</span>
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {/* Filtros para Lista e Funil (compartilhados) */}
          {activeTab !== 'pendencias' && (
            <Card className="mt-4 border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, telefone ou e-mail..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
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
                      <SelectTrigger className="w-[170px]">
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
                      <SelectTrigger className="w-[180px]">
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
                        <SelectTrigger className="w-[180px]">
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
                    <Button
                      type="button"
                      variant={filterExpired ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setFilterExpired(!filterExpired)
                        setCurrentPage(1)
                      }}
                      className="gap-1.5"
                    >
                      <Clock className="h-4 w-4" />
                      <span>Vencidos</span>
                    </Button>

                    {/* Atalho Novos sem dono (só admin e SDR) */}
                    {canManageLeads && (
                      <Button
                        type="button"
                        variant={filterNewUnassigned ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          const nextVal = !filterNewUnassigned
                          setFilterNewUnassigned(nextVal)
                          if (nextVal) {
                            setSelectedStage('')
                            setSelectedAssigned('')
                          }
                          setCurrentPage(1)
                        }}
                        className="gap-1.5"
                      >
                        <UserCheck className="h-4 w-4" />
                        <span>Novos sem dono</span>
                      </Button>
                    )}

                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClearFilters}
                        title="Limpar filtros"
                        className="shrink-0"
                      >
                        <FilterX className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
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
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">Carregando leads...</p>
              </div>
            ) : leads.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                  <Kanban className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <h3 className="text-base font-semibold">Nenhum lead encontrado</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
                    {hasActiveFilters
                      ? 'Nenhum lead corresponde aos filtros aplicados. Tente ajustar os termos.'
                      : isCorretor
                        ? 'Você não possui leads atribuídos a você no momento.'
                        : 'Ainda não há leads cadastrados.'}
                  </p>
                  {hasActiveFilters ? (
                    <Button variant="outline" size="sm" onClick={handleClearFilters}>
                      Limpar filtros
                    </Button>
                  ) : canManageLeads ? (
                    <Button onClick={() => navigate('/leads/novo')} size="sm">
                      Cadastrar primeiro lead
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Desktop: Tabela */}
                <div className="hidden md:block rounded-md border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Etapa</TableHead>
                        <TableHead>Atribuído</TableHead>
                        <TableHead>Próximo passo / Prazo</TableHead>
                        <TableHead>Imóvel de interesse</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.map((lead) => {
                        const assigneeName =
                          lead.expand?.assigned_to?.name ||
                          lead.expand?.assigned_to?.email ||
                          'Sem dono'
                        const isOverdue = isLeadNextStepOverdue(lead)
                        const propCode = lead.expand?.property_id?.code

                        return (
                          <TableRow
                            key={lead.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => navigate(`/leads/${lead.id}`)}
                          >
                            <TableCell className="font-medium text-foreground">
                              <div className="flex items-center gap-2">
                                <Link
                                  to={`/leads/${lead.id}`}
                                  className="hover:underline font-semibold text-primary"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {lead.name}
                                </Link>
                                {lead.client_id && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] font-normal border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  >
                                    Já é cliente
                                  </Badge>
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {lead.phone ? formatPhoneNumber(lead.phone) : '-'}
                            </TableCell>

                            <TableCell className="text-muted-foreground">
                              {LEAD_ORIGIN_LABELS[lead.origin] || lead.origin}
                            </TableCell>

                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-xs font-medium ${getStageBadgeColor(lead.stage)}`}
                              >
                                {LEAD_STAGE_LABELS[lead.stage] || lead.stage}
                              </Badge>
                            </TableCell>

                            <TableCell className="text-sm text-muted-foreground">
                              {assigneeName}
                            </TableCell>

                            <TableCell>
                              {lead.next_step ? (
                                <div className="space-y-0.5 text-xs">
                                  <div className="font-medium text-foreground line-clamp-1">
                                    {lead.next_step}
                                  </div>
                                  {lead.next_step_due && (
                                    <div
                                      className={`text-[11px] ${
                                        isOverdue
                                          ? 'text-destructive font-semibold flex items-center gap-1'
                                          : 'text-muted-foreground'
                                      }`}
                                    >
                                      {isOverdue && <Clock className="h-3 w-3 shrink-0" />}
                                      <span>{formatDateTimeBR(lead.next_step_due)}</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>

                            <TableCell>
                              {propCode ? (
                                <Badge variant="secondary" className="font-mono text-xs">
                                  {propCode}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile: Cards */}
                <div className="grid grid-cols-1 gap-3 md:hidden">
                  {leads.map((lead) => {
                    const assigneeName =
                      lead.expand?.assigned_to?.name ||
                      lead.expand?.assigned_to?.email ||
                      'Sem dono'
                    const isOverdue = isLeadNextStepOverdue(lead)
                    const propCode = lead.expand?.property_id?.code

                    return (
                      <Card
                        key={lead.id}
                        className="cursor-pointer hover:border-primary/50 transition-colors"
                        onClick={() => navigate(`/leads/${lead.id}`)}
                      >
                        <CardHeader className="p-4 pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <CardTitle className="text-base font-semibold leading-tight text-primary">
                                {lead.name}
                              </CardTitle>
                              <div className="flex flex-wrap gap-1.5 items-center">
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${getStageBadgeColor(lead.stage)}`}
                                >
                                  {LEAD_STAGE_LABELS[lead.stage] || lead.stage}
                                </Badge>
                                {lead.client_id && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] font-normal border-emerald-300 text-emerald-700 bg-emerald-50"
                                  >
                                    Já é cliente
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {propCode && (
                              <Badge variant="secondary" className="font-mono text-xs">
                                {propCode}
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 space-y-2 text-xs text-muted-foreground">
                          <div className="flex items-center justify-between gap-2">
                            <span>{LEAD_ORIGIN_LABELS[lead.origin] || lead.origin}</span>
                            <span className="font-medium text-foreground">
                              Atribuído: {assigneeName}
                            </span>
                          </div>

                          {lead.phone && (
                            <div className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground/70" />
                              <span>{formatPhoneNumber(lead.phone)}</span>
                            </div>
                          )}

                          {lead.next_step && (
                            <div className="pt-1 border-t border-border/60">
                              <span className="font-medium text-foreground block">
                                {lead.next_step}
                              </span>
                              {lead.next_step_due && (
                                <span
                                  className={`text-[11px] block mt-0.5 ${
                                    isOverdue ? 'text-destructive font-semibold' : ''
                                  }`}
                                >
                                  Prazo: {formatDateTimeBR(lead.next_step_due)}
                                </span>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>

                {/* Paginação */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <span className="text-xs text-muted-foreground order-2 sm:order-1">
                    Mostrando {leads.length} de {totalItems} lead{totalItems === 1 ? '' : 's'}
                  </span>
                  <div className="flex items-center gap-2 order-1 sm:order-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1 || loading}
                      className="gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span>Anterior</span>
                    </Button>
                    <span className="text-xs font-medium px-2">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages || loading}
                      className="gap-1"
                    >
                      <span>Próxima</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* TAB 2: FUNIL */}
          <TabsContent value="funil" className="mt-4">
            {loadingFunnel ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">Carregando funil...</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  Total de leads no funil: <strong>{funnelLeads.length}</strong>
                </div>

                {/* Desktop: Colunas lado a lado com rolagem horizontal suave */}
                <div className="hidden lg:grid lg:grid-cols-6 gap-3 items-start overflow-x-auto pb-4">
                  {STAGE_ORDER.map((stageKey) => {
                    const columnLeads = funnelByStage[stageKey] || []
                    return (
                      <div
                        key={stageKey}
                        className="flex flex-col rounded-lg border bg-muted/30 p-2.5 min-h-[420px]"
                      >
                        <div className="flex items-center justify-between pb-2 mb-2 border-b">
                          <span className="text-xs font-semibold text-foreground">
                            {LEAD_STAGE_LABELS[stageKey]}
                          </span>
                          <Badge variant="secondary" className="text-xs font-bold">
                            {columnLeads.length}
                          </Badge>
                        </div>

                        <div className="flex-1 space-y-2 overflow-y-auto max-h-[650px] pr-0.5">
                          {columnLeads.length === 0 ? (
                            <div className="py-8 text-center text-[11px] text-muted-foreground">
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
                                <Card
                                  key={item.id}
                                  className="cursor-pointer hover:border-primary/50 transition-colors shadow-sm bg-card"
                                  onClick={() => navigate(`/leads/${item.id}`)}
                                >
                                  <CardContent className="p-2.5 space-y-1.5">
                                    <div className="font-semibold text-xs text-primary leading-tight line-clamp-1">
                                      {item.name}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground flex justify-between gap-1">
                                      <span>{LEAD_ORIGIN_LABELS[item.origin] || item.origin}</span>
                                      {item.client_id && (
                                        <Badge
                                          variant="outline"
                                          className="text-[9px] px-1 py-0 h-4 border-emerald-300 text-emerald-700 bg-emerald-50"
                                        >
                                          Cliente
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-foreground/80">
                                      {assigneeName}
                                    </div>
                                    {item.next_step_due && (
                                      <div
                                        className={`text-[10px] ${
                                          isOverdue
                                            ? 'text-destructive font-semibold flex items-center gap-1'
                                            : 'text-muted-foreground'
                                        }`}
                                      >
                                        {isOverdue && <Clock className="h-2.5 w-2.5 shrink-0" />}
                                        <span>{formatDateTimeBR(item.next_step_due)}</span>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Mobile / Tablet: Abas de etapas para visualização compacta */}
                <div className="lg:hidden">
                  <Tabs defaultValue="novo" className="w-full">
                    <TabsList className="grid grid-cols-3 sm:grid-cols-6 h-auto p-1 bg-muted">
                      {STAGE_ORDER.map((stageKey) => (
                        <TabsTrigger
                          key={stageKey}
                          value={stageKey}
                          className="text-xs py-1.5 px-1 flex flex-col gap-0.5"
                        >
                          <span className="truncate max-w-[80px]">
                            {LEAD_STAGE_LABELS[stageKey]}
                          </span>
                          <span className="text-[10px] font-bold opacity-80">
                            ({(funnelByStage[stageKey] || []).length})
                          </span>
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {STAGE_ORDER.map((stageKey) => {
                      const columnLeads = funnelByStage[stageKey] || []
                      return (
                        <TabsContent key={stageKey} value={stageKey} className="mt-3 space-y-2">
                          {columnLeads.length === 0 ? (
                            <div className="p-8 text-center text-xs text-muted-foreground border rounded-lg bg-card">
                              Nenhum lead nesta etapa.
                            </div>
                          ) : (
                            columnLeads.map((item) => {
                              const assigneeName =
                                item.expand?.assigned_to?.name ||
                                item.expand?.assigned_to?.email ||
                                'Sem dono'
                              const isOverdue = isLeadNextStepOverdue(item)
                              return (
                                <Card
                                  key={item.id}
                                  className="cursor-pointer hover:border-primary/50 transition-colors"
                                  onClick={() => navigate(`/leads/${item.id}`)}
                                >
                                  <CardContent className="p-3 space-y-1.5 text-xs">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-semibold text-sm text-primary">
                                        {item.name}
                                      </span>
                                      {item.client_id && (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50"
                                        >
                                          Já é cliente
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-muted-foreground flex justify-between">
                                      <span>
                                        Origem: {LEAD_ORIGIN_LABELS[item.origin] || item.origin}
                                      </span>
                                      <span>Atribuído: {assigneeName}</span>
                                    </div>
                                    {item.next_step && (
                                      <div className="pt-1 border-t text-muted-foreground">
                                        <span className="text-foreground block">
                                          {item.next_step}
                                        </span>
                                        {item.next_step_due && (
                                          <span
                                            className={`text-[11px] block mt-0.5 ${
                                              isOverdue ? 'text-destructive font-semibold' : ''
                                            }`}
                                          >
                                            Prazo: {formatDateTimeBR(item.next_step_due)}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              )
                            })
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
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm">Carregando pendências...</p>
                </div>
              ) : pendencias.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500/50 mb-3" />
                    <h3 className="text-base font-semibold">Nenhuma pendência de duplicidade</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mt-1">
                      Todos os contatos e leads recebidos foram validados ou não geraram conflito.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Estes leads foram cadastrados com telefone ou e-mail semelhante a outro já
                    existente, mas com dados discordantes. Revise as duas fichas e defina a
                    resolução:
                  </p>

                  <div className="space-y-4">
                    {pendencias.map(({ pending, original }) => {
                      const isWorking = resolvingId === pending.id

                      return (
                        <Card
                          key={pending.id}
                          className="border-amber-200 dark:border-amber-900/60"
                        >
                          <CardHeader className="bg-amber-50/50 dark:bg-amber-950/20 p-4 border-b border-amber-100 dark:border-amber-900/40">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                                <CardTitle className="text-base font-semibold text-foreground">
                                  Conflito detectado no lead: {pending.name}
                                </CardTitle>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleResolveSeparate(pending.id)}
                                  disabled={isWorking}
                                  className="text-xs"
                                >
                                  {isWorking ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                  ) : null}
                                  São pessoas diferentes
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => setConfirmSamePersonLead(pending)}
                                  disabled={isWorking}
                                  className="text-xs"
                                >
                                  É a mesma pessoa
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Lead pendente (novo) */}
                              <div className="p-3 rounded-lg border bg-card space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                                    Lead Novo (Pendente)
                                  </span>
                                  <Link
                                    to={`/leads/${pending.id}`}
                                    className="text-xs text-primary hover:underline font-medium"
                                  >
                                    Ver ficha completa →
                                  </Link>
                                </div>
                                <div className="text-sm font-semibold text-foreground">
                                  {pending.name}
                                </div>
                                <div className="space-y-1 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1.5">
                                    <Phone className="h-3.5 w-3.5 text-muted-foreground/70" />
                                    <span>
                                      {pending.phone
                                        ? formatPhoneNumber(pending.phone)
                                        : 'Sem telefone'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Mail className="h-3.5 w-3.5 text-muted-foreground/70" />
                                    <span>{pending.email || 'Sem e-mail'}</span>
                                  </div>
                                  <div className="pt-1 flex items-center gap-2">
                                    <span>
                                      Origem: {LEAD_ORIGIN_LABELS[pending.origin] || pending.origin}
                                    </span>
                                    <span>·</span>
                                    <span>
                                      Etapa: {LEAD_STAGE_LABELS[pending.stage] || pending.stage}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Lead existente (apontado por dedupe_of) */}
                              <div className="p-3 rounded-lg border bg-card space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Lead Existente (Anterior)
                                  </span>
                                  {original && (
                                    <Link
                                      to={`/leads/${original.id}`}
                                      className="text-xs text-primary hover:underline font-medium"
                                    >
                                      Ver ficha completa →
                                    </Link>
                                  )}
                                </div>
                                {original ? (
                                  <>
                                    <div className="text-sm font-semibold text-foreground">
                                      {original.name}
                                    </div>
                                    <div className="space-y-1 text-xs text-muted-foreground">
                                      <div className="flex items-center gap-1.5">
                                        <Phone className="h-3.5 w-3.5 text-muted-foreground/70" />
                                        <span>
                                          {original.phone
                                            ? formatPhoneNumber(original.phone)
                                            : 'Sem telefone'}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <Mail className="h-3.5 w-3.5 text-muted-foreground/70" />
                                        <span>{original.email || 'Sem e-mail'}</span>
                                      </div>
                                      <div className="pt-1 flex items-center gap-2">
                                        <span>
                                          Origem:{' '}
                                          {LEAD_ORIGIN_LABELS[original.origin] || original.origin}
                                        </span>
                                        <span>·</span>
                                        <span>
                                          Etapa:{' '}
                                          {LEAD_STAGE_LABELS[original.stage] || original.stage}
                                        </span>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-xs text-muted-foreground py-3">
                                    Lead apontado não encontrado ou sem acesso.
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Confirmação de Mesma Pessoa */}
      <AlertDialog
        open={Boolean(confirmSamePersonLead)}
        onOpenChange={(open) => !open && setConfirmSamePersonLead(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar duplicidade</AlertDialogTitle>
            <AlertDialogDescription>
              O lead mais novo será encerrado como duplicado. Nada é apagado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSamePerson}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
