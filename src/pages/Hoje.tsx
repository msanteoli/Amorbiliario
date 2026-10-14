import { useState, useEffect, useCallback } from 'react'
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
  formatTodayErrorMessage,
} from '@/services/today'
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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw, ChevronRight, AlertCircle, AlertTriangle } from 'lucide-react'
import { getRoleLabel } from '@/lib/roles'
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
  const [data, setData] = useState<TodayResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [ownersWithoutProp, setOwnersWithoutProp] = useState<OwnerWithoutPropertyItem[]>([])
  const [googleStatus, setGoogleStatus] = useState<GoogleConnectionStatus | null>(null)
  const [googleConnecting, setGoogleConnecting] = useState(false)
  const [googleConfigError, setGoogleConfigError] = useState<string | null>(null)

  // Estado para modal de remarcar visita quando acionado pela Hoje
  const [rescheduleVisitModalOpen, setRescheduleVisitModalOpen] = useState(false)
  const [rescheduleTargetVisit, setRescheduleTargetVisit] = useState<VisitRecord | null>(null)
  const [initialRescheduleAction, setInitialRescheduleAction] = useState<boolean>(false)

  const loadOwnersWarning = useCallback(async () => {
    try {
      const items = await listOwnersWithoutProperty()
      setOwnersWithoutProp(items || [])
    } catch {
      // Requisito: Se a chamada falhar (rede, 403, 5xx), falha silenciosa: nem aviso, nem erro na tela
      setOwnersWithoutProp([])
    }
  }, [])

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setErrorMessage(null)

      try {
        const resp = await getTodayData()
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

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Top Header: Título .display-sm ("Hoje"), papel e horário de atualização abaixo, botão Atualizar em pílula de contorno */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="display-sm text-foreground">Hoje</h1>
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
      {loading && (
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

      {/* Seções por papel */}
      {!loading && data && (
        <div className="space-y-8">
          {/* SDR */}
          {data.role === 'sdr' && (
            <>
              {/* Bloco "Aguardando confirmação" para SDR */}
              <PendingVisitsConfirmationBlock
                onRescheduleClick={handleReschedulePendingItem}
                onGoogleStatusChange={(status) => setGoogleStatus(status)}
              />

              {renderLeadSection(
                'Leads novos sem dono',
                data.sections.new_unassigned_leads,
                (lead) => navigate(`/leads/${lead.id}`),
                { isNewUnassigned: true },
              )}

              {renderLeadSection(
                'Pendências de duplicidade',
                data.sections.dedupe_pending,
                () => navigate('/leads?tab=pendencias'),
                { isDedupe: true },
              )}

              {renderLeadSection(
                'Próximos passos vencidos',
                data.sections.overdue_next_steps,
                (lead) => navigate(`/leads/${lead.id}`),
                { isNextStepOverdueHighlight: true },
              )}

              {renderVisitSection('Visitas pendentes de agenda', data.sections.pending_visits)}

              {renderTaskSection('Minhas tarefas atrasadas e de hoje', data.sections.my_tasks_due)}

              {renderVisitSection('Visitas de hoje', data.sections.visits_today)}
            </>
          )}

          {/* CORRETOR (no celular e desktop: "Visitas para confirmar" no topo via PendingVisitsConfirmationBlock) */}
          {data.role === 'corretor' && (
            <>
              {/* Bloco 1: Corretor: "Visitas para confirmar" no topo */}
              <PendingVisitsConfirmationBlock
                onGoogleStatusChange={(status) => setGoogleStatus(status)}
              />

              {renderVisitSection('Visitas de hoje', data.sections.visits_today, {
                isCorretorVisitsToday: true,
              })}

              {renderTaskSection('Minhas tarefas atrasadas e de hoje', data.sections.my_tasks_due)}

              {renderLeadSection(
                'Leads com próximo passo vencido',
                data.sections.overdue_next_steps,
                (lead) => navigate(`/leads/${lead.id}`),
                { isNextStepOverdueHighlight: true },
              )}
            </>
          )}

          {/* ADMIN */}
          {data.role === 'admin' && (
            <>
              {/* Bloco "Aguardando confirmação" para Admin */}
              <PendingVisitsConfirmationBlock
                onRescheduleClick={handleReschedulePendingItem}
                onGoogleStatusChange={(status) => setGoogleStatus(status)}
              />

              {/* Aviso de proprietários sem imóvel (M7) */}
              {ownersWithoutProp.length > 0 && (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-lg border border-attention/30 bg-attention/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3 min-w-0">
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

              {renderLeadsByStageSection(data.sections.leads_by_stage)}

              {renderVisitSection('Visitas da semana', data.sections.visits_week, {
                showDate: true,
              })}

              {renderLeadSection(
                'Leads parados sem dono',
                data.sections.stalled_leads,
                (lead) => navigate(`/leads/${lead.id}`),
                { helpText: 'Novos, sem corretor, há mais de 24 horas' },
              )}

              {renderPropertiesPendingSection(data.sections.properties_pending_review)}

              {renderTaskSection('Tarefas atrasadas da equipe', data.sections.overdue_tasks, {
                showAssigned: true,
              })}
            </>
          )}
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
