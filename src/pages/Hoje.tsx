import { useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getTodayData,
  TodayResponse,
  TodaySection,
  TodayLeadItem,
  TodayVisitItem,
  TodayTaskItem,
  TodayPropertyItem,
  TodayStageCountItem,
  AgendaItem,
  PainelPeriod,
  formatTodayErrorMessage,
} from '@/services/today'
import {
  PeriodSelector,
  IndicatorCard,
  MiniBarChart,
  StatCard,
  StageBars,
} from '@/components/painel/PainelBlocks'
import {
  formatDateBahia,
  formatTimeBahia,
  formatDateTimeBahia,
  getVisitById,
  VisitRecord,
} from '@/services/visits'
import { LEAD_STAGE_LABELS, LeadStage } from '@/services/leads'
import { listOwnersWithoutProperty, OwnerWithoutPropertyItem } from '@/services/properties'
import { Cota } from '@/components/Cota'
import { cn } from '@/lib/utils'
import {
  getPanelLayout,
  savePanelLayout,
  resetPanelLayout,
  PanelBlock,
  PanelLayout,
} from '@/services/panelLayout'
import {
  PANEL_BLOCK_TITLES,
  PANEL_CATALOG,
  colSpanClass,
  getDefaultBlocks,
  resolveBlocks,
} from '@/components/painel/painelRegistry'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  RefreshCw,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  X,
  CheckSquare,
  MapPin,
  Lock,
  Phone,
  LayoutGrid,
  GripVertical,
  Plus,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import { getRoleLabel } from '@/lib/roles'
import { useAuth } from '@/contexts/AuthContext'
import {
  getGoogleStatus,
  getGoogleConnectUrl,
  GoogleConnectionStatus,
  GoogleIntegrationConfigError,
} from '@/services/googleCalendar'
import { Calendar } from 'lucide-react'
import { PendingVisitsConfirmationBlock } from '@/components/agenda/PendingVisitsConfirmationBlock'
import { VisitDetailModal } from '@/components/agenda/VisitDetailModal'
import { getLeadStageBadgeVariant, getVisitStatusBadgeVariant } from '@/lib/badgeVariants'

export default function Hoje() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [data, setData] = useState<TodayResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [ownersWithoutProp, setOwnersWithoutProp] = useState<OwnerWithoutPropertyItem[]>([])
  const [dismissedCount, setDismissedCount] = useState<number | null>(null)
  const [googleStatus, setGoogleStatus] = useState<GoogleConnectionStatus | null>(null)
  const [googleConnecting, setGoogleConnecting] = useState(false)
  const [googleConfigError, setGoogleConfigError] = useState<string | null>(null)

  // Arranjo dos quadros (spec 2026-10-23): salvo na conta; sem arranjo vale o padrão da função
  const [savedLayout, setSavedLayout] = useState<PanelLayout | null>(null)
  const [layoutReady, setLayoutReady] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<PanelBlock[]>([])
  const [savingLayout, setSavingLayout] = useState(false)
  const [layoutError, setLayoutError] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => {
    let alive = true
    getPanelLayout()
      .then((l) => {
        if (alive) setSavedLayout(l)
      })
      .catch(() => {
        // Sem arranjo salvo (ou falha ao ler): vale o padrão
        if (alive) setSavedLayout(null)
      })
      .finally(() => {
        if (alive) setLayoutReady(true)
      })
    return () => {
      alive = false
    }
  }, [])

  // Estado para modal de remarcar visita quando acionado pela Hoje
  const [rescheduleVisitModalOpen, setRescheduleVisitModalOpen] = useState(false)
  const [rescheduleTargetVisit, setRescheduleTargetVisit] = useState<VisitRecord | null>(null)
  const [initialRescheduleAction, setInitialRescheduleAction] = useState<boolean>(false)

  // Carrega o descarte guardado no localStorage para o usuário logado
  useEffect(() => {
    if (!user?.id) {
      setDismissedCount(null)
      return
    }
    try {
      const storageKey = `aviso-proprietarios-sem-imovel:${user.id}`
      const stored = localStorage.getItem(storageKey)
      if (stored !== null && stored.trim() !== '') {
        const parsed = Number(stored)
        if (!Number.isNaN(parsed) && Number.isFinite(parsed) && parsed >= 0) {
          setDismissedCount(parsed)
          return
        }
      }
      setDismissedCount(null)
    } catch {
      // Falha silenciosa em caso de restrição no localStorage (modo anônimo, cookies bloqueados)
      setDismissedCount(null)
    }
  }, [user?.id])

  const handleDismissOwnersWarning = useCallback(() => {
    const currentCount = ownersWithoutProp.length
    setDismissedCount(currentCount)
    if (user?.id) {
      try {
        const storageKey = `aviso-proprietarios-sem-imovel:${user.id}`
        localStorage.setItem(storageKey, String(currentCount))
      } catch {
        // Falha silenciosa se o localStorage estiver bloqueado
      }
    }
  }, [ownersWithoutProp.length, user?.id])

  const loadOwnersWarning = useCallback(async () => {
    try {
      const items = await listOwnersWithoutProperty()
      setOwnersWithoutProp(items || [])
    } catch {
      // Requisito: Se a chamada falhar (rede, 403, 5xx), falha silenciosa: nem aviso, nem erro na tela
      setOwnersWithoutProp([])
    }
  }, [])

  // Período dos indicadores (semana ou mês): lembrado por usuário no navegador
  const [period, setPeriod] = useState<PainelPeriod>('semana')
  const periodRef = useRef<PainelPeriod>('semana')

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setErrorMessage(null)

      try {
        const resp = await getTodayData(periodRef.current)
        setData(resp)
        if (resp.role === 'admin') {
          loadOwnersWarning()
        } else {
          setOwnersWithoutProp([])
        }

        // Google Agenda: visível só para corretor e admin
        if (resp.role === 'admin' || resp.role === 'corretor') {
          try {
            const gStatus = await getGoogleStatus()
            setGoogleStatus(gStatus.status)
          } catch {
            // Falha silenciosa: não mostra nada se a chamada falhar
            setGoogleStatus(null)
          }
        } else {
          setGoogleStatus(null)
        }
      } catch (err) {
        setErrorMessage(formatTodayErrorMessage(err))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [loadOwnersWarning],
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  // Volta ao período que a pessoa escolheu da última vez
  useEffect(() => {
    if (!user?.id) return
    try {
      const saved = localStorage.getItem(`painel-periodo:${user.id}`)
      if ((saved === 'semana' || saved === 'mes') && saved !== periodRef.current) {
        periodRef.current = saved
        setPeriod(saved)
        loadData(true)
      }
    } catch {
      // localStorage bloqueado: segue com a semana
    }
  }, [user?.id, loadData])

  const handlePeriodChange = (p: PainelPeriod) => {
    if (p === periodRef.current) return
    periodRef.current = p
    setPeriod(p)
    if (user?.id) {
      try {
        localStorage.setItem(`painel-periodo:${user.id}`, p)
      } catch {
        // sem persistência: vale só nesta visita
      }
    }
    loadData(true)
  }

  const handleReschedulePendingItem = async (pendingItem: { id: string }) => {
    try {
      const fullVisit = await getVisitById(pendingItem.id)
      setRescheduleTargetVisit(fullVisit)
      setInitialRescheduleAction(true)
      setRescheduleVisitModalOpen(true)
    } catch {
      // Falha ao carregar visita para remarcar
    }
  }

  const handleConnectGoogle = async () => {
    setGoogleConfigError(null)
    setGoogleConnecting(true)
    try {
      const url = await getGoogleConnectUrl()
      if (url) {
        window.location.href = url
      }
    } catch (err) {
      if (err instanceof GoogleIntegrationConfigError) {
        setGoogleConfigError('Integração com o Google ainda não configurada.')
      } else {
        const errorObj = err as { status?: number; data?: { message?: string } } | undefined
        if (errorObj?.status === 503) {
          setGoogleConfigError('Integração com o Google ainda não configurada.')
        } else {
          setGoogleConfigError('Integração com o Google ainda não configurada.')
        }
      }
      setGoogleConnecting(false)
    }
  }

  // Contagem em .eyebrow ao lado do título da seção
  const renderCountEyebrow = (section?: TodaySection<unknown>) => {
    if (!section) return null
    const text = section.more ? '500 ou mais' : String(section.count)
    return <span className="eyebrow tabular text-muted-foreground ml-2 text-xs">({text})</span>
  }

  // Checa se o prazo está atrasado
  const isOverdue = (dateStr?: string | null) => {
    if (!dateStr) return false
    const d = new Date(dateStr)
    return !isNaN(d.getTime()) && d.getTime() < Date.now()
  }

  // 1. Seção de Leads
  const renderLeadSection = (
    title: string,
    section: TodaySection<TodayLeadItem> | undefined,
    itemClick: (item: TodayLeadItem) => void,
    options?: {
      isNextStepOverdueHighlight?: boolean
      isDedupe?: boolean
      isNewUnassigned?: boolean
      helpText?: string
    },
  ) => {
    if (!section) return null

    const countDisplay = section.more ? '500+' : section.count

    // Para leads novos sem corretor: ordenar atrasados (overdue=true) primeiro, mantendo a ordem relativa
    const itemsToRender = options?.isNewUnassigned
      ? [...section.items].sort((a, b) => {
          const aOverdue = Boolean(a.overdue)
          const bOverdue = Boolean(b.overdue)
          if (aOverdue === bOverdue) return 0
          return aOverdue ? -1 : 1
        })
      : section.items

    const hasAnyOverdue = options?.isNewUnassigned && itemsToRender.some((i) => i.overdue)

    return (
      <section className="space-y-2">
        <div className="border-b border-border pb-2">
          <Cota
            title={title}
            count={countDisplay}
            isAttention={Boolean(
              options?.isNextStepOverdueHighlight || options?.isDedupe || hasAnyOverdue,
            )}
          />
          {options?.helpText && (
            <p className="text-xs text-muted-foreground mt-1">{options.helpText}</p>
          )}
        </div>

        {itemsToRender.length === 0 ? (
          <div className="py-4 text-xs text-muted-foreground">Nada por aqui.</div>
        ) : (
          <div className="divide-y divide-border">
            {itemsToRender.map((lead) => {
              const overdue = lead.next_step_due && isOverdue(lead.next_step_due)
              const isUnassignedOverdue = Boolean(options?.isNewUnassigned && lead.overdue)
              return (
                <div
                  key={lead.id}
                  onClick={() => itemClick(lead)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      itemClick(lead)
                    }
                  }}
                  className={`min-h-[56px] py-3 flex items-center justify-between gap-4 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                    isUnassignedOverdue
                      ? 'bg-attention/10 hover:bg-attention/15 border-l-2 border-attention px-2.5'
                      : 'hover:bg-muted/40'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm truncate ${
                        isUnassignedOverdue
                          ? 'font-medium text-attention'
                          : 'font-normal text-foreground'
                      }`}
                    >
                      {lead.name || 'Lead sem nome'}
                    </p>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {options?.isNextStepOverdueHighlight ? (
                        <span>
                          {lead.next_step ? `${lead.next_step} — ` : ''}
                          {lead.next_step_due && (
                            <span className="text-attention font-normal dado text-xs">
                              Atrasado: {formatDateTimeBahia(lead.next_step_due)}
                            </span>
                          )}
                        </span>
                      ) : options?.isDedupe ? (
                        <span>Duplicidade detectada</span>
                      ) : (
                        <span>
                          {lead.created && `Criado em ${formatDateBahia(lead.created)}`}
                          {isUnassignedOverdue && (
                            <span className="text-attention font-normal dado text-xs ml-2">
                              • Mais de 1h sem corretor
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {options?.isDedupe ? (
                      <Badge variant="attention">Pendência de duplicidade</Badge>
                    ) : isUnassignedOverdue ? (
                      <Badge variant="attention">Passou de 1 hora sem corretor</Badge>
                    ) : options?.isNextStepOverdueHighlight && overdue ? (
                      <Badge variant="attention">Atrasado</Badge>
                    ) : lead.stage ? (
                      <Badge variant={getLeadStageBadgeVariant(lead.stage)}>
                        {LEAD_STAGE_LABELS[lead.stage as LeadStage] || lead.stage}
                      </Badge>
                    ) : null}
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    )
  }

  // 2. Seção de Visitas
  const renderVisitSection = (
    title: string,
    section: TodaySection<TodayVisitItem> | undefined,
    options?: {
      isCorretorVisitsToday?: boolean
      isVisitToConfirm?: boolean
      showDate?: boolean
    },
  ) => {
    if (!section) return null

    const countDisplay = section.more ? '500+' : section.count

    return (
      <section className="space-y-2">
        <div className="border-b border-border pb-2">
          <Cota title={title} count={countDisplay} />
        </div>

        {section.items.length === 0 ? (
          <div className="py-4 text-xs text-muted-foreground">Nada por aqui.</div>
        ) : (
          <div className="divide-y divide-border">
            {section.items.map((v) => {
              return (
                <div
                  key={v.id}
                  onClick={() => navigate('/agenda')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate('/agenda')
                    }
                  }}
                  className="min-h-[56px] py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {/* No celular para visitas de hoje do corretor: hora em destaque à esquerda */}
                  {options?.isCorretorVisitsToday && (
                    <div className="shrink-0 text-left pr-2">
                      <span className="dado text-base font-normal text-foreground block">
                        {formatTimeBahia(v.start_at)}
                      </span>
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-normal text-foreground truncate">
                      {v.person_name || 'Sem nome'}
                    </p>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {options?.showDate && v.start_at && (
                        <span className="dado mr-2 text-xs">
                          {formatDateBahia(v.start_at)} às {formatTimeBahia(v.start_at)}
                        </span>
                      )}
                      {!options?.isCorretorVisitsToday && !options?.showDate && v.start_at && (
                        <span className="dado mr-2 text-xs">{formatTimeBahia(v.start_at)}</span>
                      )}
                      {v.property_code && (
                        <span className="mr-2">
                          Imóvel{' '}
                          <span className="dado text-muted-foreground">{v.property_code}</span>
                        </span>
                      )}
                      {v.broker_name && <span>• {v.broker_name}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {options?.isVisitToConfirm ? (
                      <Badge variant={getVisitStatusBadgeVariant('agendada')}>Agendada</Badge>
                    ) : !v.start_at ? (
                      <Badge variant={getVisitStatusBadgeVariant('pendente_agenda')}>
                        Pendente de agenda
                      </Badge>
                    ) : (
                      <Badge variant={getVisitStatusBadgeVariant(v.status || 'agendada')}>
                        {v.status === 'pendente_agenda'
                          ? 'Pendente de agenda'
                          : v.status === 'confirmada'
                            ? 'Confirmada'
                            : v.status === 'realizada'
                              ? 'Realizada'
                              : 'Agendada'}
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    )
  }

  // 3. Seção de Tarefas
  const renderTaskSection = (
    title: string,
    section: TodaySection<TodayTaskItem> | undefined,
    options?: {
      showAssigned?: boolean
    },
  ) => {
    if (!section) return null

    const countDisplay = section.more ? '500+' : section.count

    return (
      <section className="space-y-2">
        <div className="border-b border-border pb-2">
          <Cota
            title={title}
            count={countDisplay}
            isAttention={title.toLowerCase().includes('atrasad')}
          />
        </div>

        {section.items.length === 0 ? (
          <div className="py-4 text-xs text-muted-foreground">Nada por aqui.</div>
        ) : (
          <div className="divide-y divide-border">
            {section.items.map((task) => {
              const overdue = isOverdue(task.due_at)
              return (
                <div
                  key={task.id}
                  onClick={() => navigate('/agenda?tab=tarefas')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate('/agenda?tab=tarefas')
                    }
                  }}
                  className="min-h-[56px] py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-normal text-foreground truncate">{task.title}</p>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {options?.showAssigned && task.assigned_name && (
                        <span className="mr-2">Resp.: {task.assigned_name}</span>
                      )}
                      {task.due_at && (
                        <span
                          className={
                            overdue ? 'text-attention font-normal dado text-xs' : 'dado text-xs'
                          }
                        >
                          {overdue ? 'Atrasado: ' : 'Prazo: '}
                          {formatDateTimeBahia(task.due_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {overdue ? (
                      <Badge variant="attention">Atrasada</Badge>
                    ) : (
                      <Badge variant="default">Aberta</Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    )
  }

  // 4. Seção Leads por etapa (Admin)
  const renderLeadsByStageSection = (section: TodaySection<TodayStageCountItem> | undefined) => {
    if (!section) return null

    const countDisplay = section.more ? '500+' : section.count

    return (
      <section className="space-y-2">
        <div className="border-b border-border pb-2">
          <Cota title="Leads por etapa" count={countDisplay} />
        </div>

        {section.items.length === 0 ? (
          <div className="py-4 text-xs text-muted-foreground">Nada por aqui.</div>
        ) : (
          <div className="divide-y divide-border">
            {section.items.map((item) => (
              <div
                key={item.stage}
                onClick={() => navigate(`/leads?stage=${encodeURIComponent(item.stage)}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/leads?stage=${encodeURIComponent(item.stage)}`)
                  }
                }}
                className="min-h-[56px] py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <span className="text-sm font-normal text-foreground truncate">
                  {LEAD_STAGE_LABELS[item.stage as LeadStage] || item.stage}
                </span>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="dado text-sm font-normal text-foreground">{item.count}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    )
  }

  // 5. Imóveis pendentes de revisão (Admin)
  const renderPropertiesPendingSection = (section: TodaySection<TodayPropertyItem> | undefined) => {
    if (!section) return null

    const countDisplay = section.more ? '500+' : section.count

    return (
      <section className="space-y-2">
        <div className="border-b border-border pb-2">
          <Cota title="Imóveis pendentes de revisão" count={countDisplay} isAttention={true} />
        </div>

        {section.items.length === 0 ? (
          <div className="py-4 text-xs text-muted-foreground">Nada por aqui.</div>
        ) : (
          <div className="divide-y divide-border">
            {section.items.map((prop) => (
              <div
                key={prop.id}
                onClick={() => navigate(`/imoveis/${prop.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/imoveis/${prop.id}`)
                  }
                }}
                className="min-h-[56px] py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-normal text-foreground truncate">
                    <span className="dado text-muted-foreground mr-1">[{prop.code}]</span>
                    <span>{prop.title || 'Sem título'}</span>{' '}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {prop.last_reviewed_at ? (
                      <span>
                        Última revisão:{' '}
                        <span className="dado text-xs">
                          {formatDateBahia(prop.last_reviewed_at)}
                        </span>
                      </span>
                    ) : (
                      'Nunca revisado'
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="attention">Pendente</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    )
  }

  // Saudação pela hora de Feira de Santana (UTC-3)
  const greetingText = (() => {
    const h = new Date(Date.now() - 3 * 3600000).getUTCHours()
    const base = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
    const first = String(user?.name || '')
      .trim()
      .split(' ')[0]
    return first ? `${base}, ${first}` : base
  })()

  // Agenda do dia: tarefas, visitas, bloqueios e atendimentos (próximos passos de leads) numa linha do tempo só
  const openAgendaItem = (it: AgendaItem) => {
    if (it.kind === 'atendimento') navigate(`/leads/${it.lead_id || it.id}`)
    else if (it.kind === 'tarefa') navigate('/agenda?tab=tarefas')
    else navigate('/agenda')
  }

  const renderAgendaSection = () => {
    const items = data?.agenda || []
    const kindLabel: Record<string, string> = {
      tarefa: 'Tarefa',
      visita: 'Visita',
      bloqueio: 'Bloqueio',
      atendimento: 'Atendimento',
    }
    const kindIcon = (kind: string) =>
      kind === 'visita' ? (
        <MapPin className="h-4 w-4" />
      ) : kind === 'bloqueio' ? (
        <Lock className="h-4 w-4" />
      ) : kind === 'atendimento' ? (
        <Phone className="h-4 w-4" />
      ) : (
        <CheckSquare className="h-4 w-4" />
      )
    return (
      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <Cota
          title="Minha agenda de hoje"
          count={items.length}
          isAttention={items.some((i) => i.overdue)}
        />
        {items.length === 0 ? (
          <div className="py-6 text-sm text-muted-foreground">Nada na agenda de hoje.</div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((it) => (
              <div
                key={`${it.kind}:${it.id}`}
                onClick={() => openAgendaItem(it)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openAgendaItem(it)
                  }
                }}
                className="min-h-[56px] py-3 flex items-center gap-3 cursor-pointer hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <span className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                  {kindIcon(it.kind)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-normal text-foreground truncate">{it.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {kindLabel[it.kind] || it.kind}
                    {it.at && (
                      <span className="dado text-xs">
                        {' · '}
                        {it.overdue ? formatDateTimeBahia(it.at) : formatTimeBahia(it.at)}
                      </span>
                    )}
                    {it.pendencia && ' · pendência do cadastro'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {it.overdue && <Badge variant="attention">Atrasada</Badge>}
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    )
  }

  // Indicadores da função: 3 cartões (o primeiro em destaque) e o gráfico do período
  const renderIndicators = () => {
    const ind = data?.indicators
    if (!ind) {
      return (
        <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Indicadores indisponíveis agora. Tente atualizar.
        </div>
      )
    }
    const chartTitle =
      (data?.role === 'sdr'
        ? 'Leads recebidos'
        : data?.role === 'corretor'
          ? 'Visitas'
          : 'Negociações fechadas') + (ind.period === 'semana' ? ' por dia' : ' por semana')
    return (
      <div className="space-y-4">
        {ind.items.map((it, idx) => (
          <IndicatorCard key={it.key} item={it} highlight={idx === 0} />
        ))}
        <MiniBarChart title={chartTitle} labels={ind.chart.labels} values={ind.chart.values} />
      </div>
    )
  }

  // Painéis de apoio por função: só números e gráficos (nada de listas)
  const renderSupportPanels = () => {
    if (!data) return null
    const cnt = (s?: TodaySection<unknown>) => (s ? (s.more ? '500+' : s.count) : 0)
    if (data.role === 'sdr') {
      const unassigned = data.sections.new_unassigned_leads
      const late = unassigned ? unassigned.items.filter((i) => i.overdue).length : 0
      return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Leads novos sem dono"
            value={cnt(unassigned)}
            attention={late > 0}
            hint={late > 0 ? `${late} passaram de 1 hora sem corretor` : undefined}
            onClick={() => navigate('/leads?stage=novo')}
          />
          <StatCard
            title="Pendências de duplicidade"
            value={cnt(data.sections.dedupe_pending)}
            onClick={() => navigate('/leads?tab=pendencias')}
          />
          <StatCard
            title="Visitas pendentes de agenda"
            value={cnt(data.sections.pending_visits)}
            onClick={() => navigate('/agenda')}
          />
        </div>
      )
    }
    if (data.role === 'admin') {
      const stages = data.sections.leads_by_stage?.items || []
      return (
        <div className="space-y-4">
          <StageBars
            title="Leads por etapa"
            items={stages}
            labelOf={(s) => LEAD_STAGE_LABELS[s as LeadStage] || s}
            onPick={(s) => navigate(`/leads?stage=${encodeURIComponent(s)}`)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Leads parados sem dono"
              value={cnt(data.sections.stalled_leads)}
              attention={(data.sections.stalled_leads?.count || 0) > 0}
              hint="Novos, sem corretor, há mais de 24 horas"
              onClick={() => navigate('/leads?stage=novo')}
            />
            <StatCard
              title="Imóveis pendentes de revisão"
              value={cnt(data.sections.properties_pending_review)}
              attention={(data.sections.properties_pending_review?.count || 0) > 0}
              onClick={() => navigate('/imoveis')}
            />
            <StatCard
              title="Visitas da semana"
              value={cnt(data.sections.visits_week)}
              onClick={() => navigate('/agenda')}
            />
          </div>
        </div>
      )
    }
    return null
  }

  // Quadros do Painel: cada id do registro (painelRegistry) vira um pedaço da tela, com o conteúdo que já existia
  const unavailableCard = (
    <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
      Indicador indisponível agora. Tente atualizar.
    </div>
  )

  const renderBlock = (id: string): ReactNode => {
    if (!data) return null
    const ind = data.indicators
    const cnt = (s?: TodaySection<unknown>) => (s ? (s.more ? '500+' : s.count) : 0)

    if (id === 'agenda') return renderAgendaSection()
    if (id === 'visitas_confirmar') {
      return (
        <PendingVisitsConfirmationBlock
          onRescheduleClick={data.role === 'corretor' ? undefined : handleReschedulePendingItem}
          onGoogleStatusChange={(status) => setGoogleStatus(status)}
        />
      )
    }
    if (id === 'grafico') {
      if (!ind) return unavailableCard
      const chartTitle =
        (data.role === 'sdr'
          ? 'Leads recebidos'
          : data.role === 'corretor'
            ? 'Visitas'
            : 'Negociações fechadas') + (ind.period === 'semana' ? ' por dia' : ' por semana')
      return <MiniBarChart title={chartTitle} labels={ind.chart.labels} values={ind.chart.values} />
    }
    if (id.startsWith('ind:')) {
      const idx = ind ? ind.items.findIndex((i) => i.key === id.slice(4)) : -1
      if (!ind || idx < 0) return unavailableCard
      return <IndicatorCard item={ind.items[idx]} highlight={idx === 0} />
    }
    if (id === 'apoio:leads_sem_dono') {
      const unassigned = data.sections.new_unassigned_leads
      const late = unassigned ? unassigned.items.filter((i) => i.overdue).length : 0
      return (
        <StatCard
          title="Leads novos sem dono"
          value={cnt(unassigned)}
          attention={late > 0}
          hint={late > 0 ? `${late} passaram de 1 hora sem corretor` : undefined}
          onClick={() => navigate('/leads?stage=novo')}
        />
      )
    }
    if (id === 'apoio:duplicidade') {
      return (
        <StatCard
          title="Pendências de duplicidade"
          value={cnt(data.sections.dedupe_pending)}
          onClick={() => navigate('/leads?tab=pendencias')}
        />
      )
    }
    if (id === 'apoio:visitas_pendentes') {
      return (
        <StatCard
          title="Visitas pendentes de agenda"
          value={cnt(data.sections.pending_visits)}
          onClick={() => navigate('/agenda')}
        />
      )
    }
    if (id === 'apoio:etapas') {
      return (
        <StageBars
          title="Leads por etapa"
          items={data.sections.leads_by_stage?.items || []}
          labelOf={(s) => LEAD_STAGE_LABELS[s as LeadStage] || s}
          onPick={(s) => navigate(`/leads?stage=${encodeURIComponent(s)}`)}
        />
      )
    }
    if (id === 'apoio:parados') {
      return (
        <StatCard
          title="Leads parados sem dono"
          value={cnt(data.sections.stalled_leads)}
          attention={(data.sections.stalled_leads?.count || 0) > 0}
          hint="Novos, sem corretor, há mais de 24 horas"
          onClick={() => navigate('/leads?stage=novo')}
        />
      )
    }
    if (id === 'apoio:revisao') {
      return (
        <StatCard
          title="Imóveis pendentes de revisão"
          value={cnt(data.sections.properties_pending_review)}
          attention={(data.sections.properties_pending_review?.count || 0) > 0}
          onClick={() => navigate('/imoveis')}
        />
      )
    }
    if (id === 'apoio:visitas_semana') {
      return (
        <StatCard
          title="Visitas da semana"
          value={cnt(data.sections.visits_week)}
          onClick={() => navigate('/agenda')}
        />
      )
    }
    return null
  }

  // Modo Personalizar: nada vai ao servidor até o "Concluir"
  const startEditing = () => {
    if (!data) return
    setDraft(resolveBlocks(data.role, savedLayout))
    setLayoutError(null)
    setEditing(true)
  }

  // Edição do rascunho (parte 3): mover, tamanho, remover e adicionar
  const moveBlock = (id: string, toIndex: number) => {
    setDraft((cur) => {
      const from = cur.findIndex((b) => b.id === id)
      if (from < 0) return cur
      const to = Math.max(0, Math.min(cur.length - 1, toIndex))
      if (to === from) return cur
      const next = [...cur]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  const setBlockWidth = (id: string, w: PanelBlockWidth) => {
    setDraft((cur) => cur.map((b) => (b.id === id ? { ...b, w } : b)))
  }

  const removeBlock = (id: string) => {
    setDraft((cur) => cur.filter((b) => b.id !== id))
  }

  const addBlock = (id: string) => {
    const role = data?.role || ''
    const def = getDefaultBlocks(role).find((b) => b.id === id)
    setDraft((cur) =>
      cur.length >= 20 || cur.some((b) => b.id === id) ? cur : [...cur, { id, w: def ? def.w : 4 }],
    )
  }

  // Voltar ao padrão: troca o rascunho pelo padrão da função; só vale (e apaga o arranjo salvo) no Concluir
  const resetDraftToDefault = () => {
    setDraft(getDefaultBlocks(data?.role || ''))
    setConfirmReset(false)
    setAddOpen(false)
  }

  const cancelEditing = () => {
    setConfirmReset(false)
    setAddOpen(false)
    setDragId(null)
    setEditing(false)
    setLayoutError(null)
  }

  const finishEditing = async () => {
    setSavingLayout(true)
    setLayoutError(null)
    try {
      const isDefault = JSON.stringify(draft) === JSON.stringify(getDefaultBlocks(data?.role || ''))
      if (isDefault) {
        await resetPanelLayout()
        setSavedLayout(null)
      } else {
        await savePanelLayout(draft)
        setSavedLayout({ version: 1, blocks: draft })
      }
      setConfirmReset(false)
      setAddOpen(false)
      setEditing(false)
    } catch (err) {
      setLayoutError(formatTodayErrorMessage(err, 'Não foi possível gravar o arranjo do painel.'))
    } finally {
      setSavingLayout(false)
    }
  }

  const renderPainelGrid = () => {
    if (!data) return null
    const blocks = editing ? draft : resolveBlocks(data.role, savedLayout)
    const missing = (PANEL_CATALOG[data.role] || []).filter((id) => !draft.some((b) => b.id === id))
    const sizes: Array<{ w: PanelBlockWidth; label: string; title: string }> = [
      { w: 4, label: 'P', title: 'Pequeno' },
      { w: 6, label: 'M', title: 'Médio' },
      { w: 8, label: 'G', title: 'Grande' },
      { w: 12, label: 'Total', title: 'Largura total' },
    ]
    const addBar = editing ? (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAddOpen((v) => !v)}
            disabled={draft.length >= 20}
            className="rounded-full font-normal gap-2"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Adicionar quadro</span>
          </Button>
          {draft.length >= 20 && (
            <span className="text-xs text-muted-foreground">Limite de 20 quadros.</span>
          )}
          {!confirmReset ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmReset(true)}
              className="rounded-full font-normal"
            >
              Voltar ao padrão
            </Button>
          ) : (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-2 rounded-full border border-border bg-card px-3 py-1"
            >
              <span className="text-xs text-foreground">
                Descartar seu arranjo e voltar ao padrão?
              </span>
              <Button
                type="button"
                size="sm"
                onClick={resetDraftToDefault}
                className="rounded-full font-normal h-7"
              >
                Sim, voltar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmReset(false)}
                className="rounded-full font-normal h-7"
              >
                Não
              </Button>
            </div>
          )}
        </div>
        {addOpen && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            {missing.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todos os quadros já estão na tela.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {missing.map((id) => (
                  <Button
                    key={id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addBlock(id)}
                    className="rounded-full font-normal"
                  >
                    {PANEL_BLOCK_TITLES[id] || id}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    ) : null

    if (blocks.length === 0) {
      return (
        <div className="space-y-4">
          {addBar}
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Seu painel está vazio. Use Personalizar para adicionar quadros.
          </div>
        </div>
      )
    }
    return (
      <div className="space-y-4">
        {addBar}
        <div className="grid grid-cols-1 lg:grid-cols-12 lg:grid-flow-dense gap-6 items-start">
          {blocks.map((b, index) => (
            <div
              key={b.id}
              data-bloco={b.id}
              draggable={editing}
              onDragStart={(e) => {
                if (!editing) return
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', b.id)
                setDragId(b.id)
              }}
              onDragOver={(e) => {
                if (editing && dragId) e.preventDefault()
              }}
              onDrop={(e) => {
                if (!editing || !dragId) return
                e.preventDefault()
                moveBlock(dragId, index)
                setDragId(null)
              }}
              onDragEnd={() => setDragId(null)}
              className={cn(
                'min-w-0 empty:hidden',
                colSpanClass(b.w),
                b.id === 'agenda' && b.w === 8 && 'lg:row-span-4',
                editing && 'rounded-xl border-2 border-dashed border-border p-2 space-y-2',
                editing && dragId === b.id && 'opacity-50',
              )}
            >
              {editing && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Mover ${PANEL_BLOCK_TITLES[b.id] || b.id} (setas do teclado)`}
                    title="Arraste, ou use as setas do teclado"
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                        e.preventDefault()
                        moveBlock(b.id, index - 1)
                      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                        e.preventDefault()
                        moveBlock(b.id, index + 1)
                      }
                    }}
                    className="hidden lg:block cursor-grab p-1 rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <p className="flex-1 min-w-0 truncate text-xs font-medium text-muted-foreground">
                    {PANEL_BLOCK_TITLES[b.id] || b.id}
                  </p>
                  <div className="inline-flex lg:hidden gap-1">
                    <button
                      type="button"
                      aria-label={`Subir ${PANEL_BLOCK_TITLES[b.id] || b.id}`}
                      title="Subir"
                      disabled={index === 0}
                      onClick={() => moveBlock(b.id, index - 1)}
                      className="p-1.5 rounded border border-border text-muted-foreground disabled:opacity-40"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Descer ${PANEL_BLOCK_TITLES[b.id] || b.id}`}
                      title="Descer"
                      disabled={index === blocks.length - 1}
                      onClick={() => moveBlock(b.id, index + 1)}
                      className="p-1.5 rounded border border-border text-muted-foreground disabled:opacity-40"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="hidden lg:inline-flex rounded-full border border-border p-0.5">
                    {sizes.map((s) => (
                      <button
                        key={s.w}
                        type="button"
                        title={s.title}
                        aria-pressed={b.w === s.w}
                        onClick={() => setBlockWidth(b.id, s.w)}
                        className={cn(
                          'h-6 rounded-full px-2 text-[11px] transition-colors',
                          b.w === s.w
                            ? 'bg-primary text-primary-foreground font-medium'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    aria-label={`Remover ${PANEL_BLOCK_TITLES[b.id] || b.id}`}
                    title="Remover quadro"
                    onClick={() => removeBlock(b.id)}
                    className="p-1 rounded text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {editing ? (
                <div className="pointer-events-none select-none">{renderBlock(b.id)}</div>
              ) : (
                renderBlock(b.id)
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Top Header: Título .display-sm ("Hoje"), papel e horário de atualização abaixo, botão Atualizar em pílula de contorno */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="display-sm text-foreground">{greetingText}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {data?.role ? `${getRoleLabel(data.role)} • ` : ''}
            {data?.generated_at ? (
              <span>
                Atualizado às <span className="tabular">{formatTimeBahia(data.generated_at)}</span>{' '}
                (<span className="tabular">{formatDateBahia(data.generated_at)}</span>) — Fuso Bahia
              </span>
            ) : (
              'Carregando dados...'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <PeriodSelector
            value={period}
            onChange={handlePeriodChange}
            disabled={loading || refreshing}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
            className="rounded-full font-normal gap-2 self-start sm:self-auto shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </Button>
          {!editing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={startEditing}
              disabled={loading || !data || !layoutReady}
              className="rounded-full font-normal gap-2 shrink-0"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Personalizar</span>
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={cancelEditing}
                disabled={savingLayout}
                className="rounded-full font-normal shrink-0"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={finishEditing}
                disabled={savingLayout}
                className="rounded-full font-normal shrink-0"
              >
                {savingLayout ? 'Gravando...' : 'Concluir'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Faixa de atenção da Google Agenda (visível só para corretor e admin se nao_conectado ou reconectar) */}
      {(googleStatus === 'nao_conectado' || googleStatus === 'reconectar') && (
        <div
          role="region"
          aria-label="Aviso de conexão da Google Agenda"
          className="rounded-lg border border-border bg-card text-card-foreground p-4 sm:p-5 flex flex-col gap-3 shadow-none"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-foreground shrink-0 mt-0.5 sm:mt-0">
                <Calendar className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {googleStatus === 'nao_conectado'
                  ? 'Conecte sua agenda do Google para receber suas visitas confirmadas'
                  : 'Reconecte sua agenda do Google'}
              </p>
            </div>
            <div className="flex flex-col sm:items-end gap-1 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleConnectGoogle}
                disabled={googleConnecting}
                className="rounded-full font-normal min-h-[44px] h-11 px-5 text-sm self-start sm:self-auto"
              >
                {googleConnecting ? 'Conectando...' : 'Conectar Google Agenda'}
              </Button>
            </div>
          </div>

          {/* Mensagem quando servidor responde 503 ao tentar conectar */}
          {googleConfigError && (
            <p className="text-xs text-destructive font-normal" role="alert">
              {googleConfigError}
            </p>
          )}

          {/* Texto de privacidade */}
          <p className="text-xs text-muted-foreground leading-relaxed pt-1 border-t border-border/50">
            O Imobdigital só cria, atualiza e apaga eventos de visita na sua agenda. Não lê seus
            outros eventos. Você pode desconectar quando quiser.
          </p>
        </div>
      )}

      {/* Erro de carregamento: mensagem do servidor e pílula Tentar novamente */}
      {errorMessage && (
        <div className="rounded-lg border border-destructive p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-destructive text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(false)}
            className="rounded-full font-normal border-destructive text-destructive hover:bg-destructive/10 shrink-0 self-start sm:self-auto"
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Esqueletos enquanto carrega primeira vez: esqueletos de linhas com divisores */}
      {(loading || !layoutReady) && (
        <div className="space-y-6">
          {[1, 2, 3].map((sectionIndex) => (
            <div key={sectionIndex} className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <div className="divide-y divide-border">
                {[1, 2, 3].map((lineIndex) => (
                  <div
                    key={lineIndex}
                    className="min-h-[56px] py-3 flex items-center justify-between"
                  >
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-3/4 max-w-sm" />
                      <Skeleton className="h-3 w-1/2 max-w-xs" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Painel: aviso fixo (admin) no topo e, abaixo, a grade de quadros (arranjo da pessoa ou padrão da função) */}
      {!loading && data && layoutReady && (
        <div className="space-y-8">
          {layoutError && editing && (
            <div
              role="alert"
              className="rounded-lg border border-destructive p-3 text-sm text-destructive"
            >
              {layoutError}
            </div>
          )}

          {/* ADMIN */}
          {data.role === 'admin' && (
            <>
              {/* Aviso de proprietários sem imóvel (M7) */}
              {ownersWithoutProp.length > 0 &&
                (dismissedCount === null || ownersWithoutProp.length > dismissedCount) && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="relative rounded-lg border border-attention/30 bg-attention/10 p-4 sm:pr-12 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <button
                      type="button"
                      onClick={handleDismissOwnersWarning}
                      aria-label="Fechar aviso"
                      title="Fechar aviso"
                      className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-attention/20 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Fechar aviso</span>
                    </button>

                    <div className="flex items-start gap-3 min-w-0 pr-6 sm:pr-0">
                      <AlertTriangle className="h-5 w-5 text-attention shrink-0 mt-0.5" />
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {ownersWithoutProp.length === 1
                            ? '1 proprietário sem imóvel ligado'
                            : `${ownersWithoutProp.length} proprietários sem imóvel ligado`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Proprietário é quem tem um imóvel com a imobiliária. Quem vendeu o imóvel
                          continua como cliente.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate('/admin?tab=sem-imovel')}
                      className="rounded-full border-attention/40 text-foreground hover:bg-attention/15 min-h-[44px] h-11 px-5 text-xs font-normal shrink-0 self-start sm:self-auto"
                    >
                      Ver lista
                    </Button>
                  </div>
                )}
            </>
          )}

          {renderPainelGrid()}
        </div>
      )}

      {/* Modal de Remarcação de Visita (quando acionado pelo atalho Remarcar) */}
      <VisitDetailModal
        visit={rescheduleTargetVisit}
        open={rescheduleVisitModalOpen}
        initialAction={initialRescheduleAction ? 'remarcar' : null}
        onOpenChange={(open) => {
          setRescheduleVisitModalOpen(open)
          if (!open) {
            setRescheduleTargetVisit(null)
            setInitialRescheduleAction(false)
          }
        }}
        onUpdated={() => {
          loadData(true)
          setRescheduleVisitModalOpen(false)
          setRescheduleTargetVisit(null)
          setInitialRescheduleAction(false)
        }}
      />
    </div>
  )
}
