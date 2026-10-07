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
import { formatDateBahia, formatTimeBahia, formatDateTimeBahia } from '@/services/visits'
import { LEAD_STAGE_LABELS, LeadStage } from '@/services/leads'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw, ChevronRight, AlertCircle } from 'lucide-react'
import { getRoleLabel } from '@/lib/roles'

// Mapeamento visual das situações de Lead conforme guia M9a
function getLeadStageBadgeVariant(
  stage: string,
): 'info' | 'default' | 'success' | 'destructive' | 'attention' {
  switch (stage) {
    case 'novo':
      return 'info'
    case 'em_atendimento':
      return 'default'
    case 'visita_marcada':
      return 'info'
    case 'proposta':
      return 'default'
    case 'ganho':
      return 'success'
    case 'perdido':
      return 'destructive'
    default:
      return 'default'
  }
}

export default function Hoje() {
  const navigate = useNavigate()
  const [data, setData] = useState<TodayResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setErrorMessage(null)

    try {
      const resp = await getTodayData()
      setData(resp)
    } catch (err) {
      setErrorMessage(formatTodayErrorMessage(err))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

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
      helpText?: string
    },
  ) => {
    if (!section) return null

    return (
      <section className="space-y-2">
        <div className="flex items-baseline justify-between border-b border-border pb-2">
          <div className="flex items-baseline">
            <h2 className="text-xl font-normal text-foreground">{title}</h2>
            {renderCountEyebrow(section)}
          </div>
          {options?.helpText && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {options.helpText}
            </span>
          )}
        </div>

        {section.items.length === 0 ? (
          <div className="py-4 text-xs text-muted-foreground">Nada por aqui.</div>
        ) : (
          <div className="divide-y divide-border">
            {section.items.map((lead) => {
              const overdue = lead.next_step_due && isOverdue(lead.next_step_due)
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
                  className="min-h-[56px] py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-normal text-foreground truncate">
                      {lead.name || 'Lead sem nome'}
                    </p>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {options?.isNextStepOverdueHighlight ? (
                        <span>
                          {lead.next_step ? `${lead.next_step} — ` : ''}
                          {lead.next_step_due && (
                            <span className="text-attention font-normal tabular">
                              Atrasado: {formatDateTimeBahia(lead.next_step_due)}
                            </span>
                          )}
                        </span>
                      ) : options?.isDedupe ? (
                        <span>Duplicidade detectada</span>
                      ) : (
                        <span>{lead.created && `Criado em ${formatDateBahia(lead.created)}`}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {options?.isDedupe ? (
                      <Badge variant="attention">Pendência de duplicidade</Badge>
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

    return (
      <section className="space-y-2">
        <div className="flex items-baseline justify-between border-b border-border pb-2">
          <div className="flex items-baseline">
            <h2 className="text-xl font-normal text-foreground">{title}</h2>
            {renderCountEyebrow(section)}
          </div>
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
                  {/* No celular para visitas de hoje do corretor: hora em destaque à esquerda (20px, font-medium, tabular) */}
                  {options?.isCorretorVisitsToday && (
                    <div className="shrink-0 text-left pr-2">
                      <span className="text-xl font-medium tabular text-foreground block">
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
                        <span className="tabular mr-2">
                          {formatDateBahia(v.start_at)} às {formatTimeBahia(v.start_at)}
                        </span>
                      )}
                      {!options?.isCorretorVisitsToday && !options?.showDate && v.start_at && (
                        <span className="tabular mr-2">{formatTimeBahia(v.start_at)}</span>
                      )}
                      {v.property_code && <span className="mr-2">Imóvel {v.property_code}</span>}
                      {v.broker_name && <span>• {v.broker_name}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {options?.isVisitToConfirm ? (
                      <Badge variant="default">Agendada</Badge>
                    ) : !v.start_at ? (
                      <Badge variant="attention">Pendente de agenda</Badge>
                    ) : (
                      <Badge variant="default">Agendada</Badge>
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

    return (
      <section className="space-y-2">
        <div className="flex items-baseline justify-between border-b border-border pb-2">
          <div className="flex items-baseline">
            <h2 className="text-xl font-normal text-foreground">{title}</h2>
            {renderCountEyebrow(section)}
          </div>
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
                          className={overdue ? 'text-attention font-normal tabular' : 'tabular'}
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

    return (
      <section className="space-y-2">
        <div className="flex items-baseline justify-between border-b border-border pb-2">
          <div className="flex items-baseline">
            <h2 className="text-xl font-normal text-foreground">Leads por etapa</h2>
            {renderCountEyebrow(section)}
          </div>
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
                  <span className="text-sm font-normal tabular text-foreground">{item.count}</span>
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

    return (
      <section className="space-y-2">
        <div className="flex items-baseline justify-between border-b border-border pb-2">
          <div className="flex items-baseline">
            <h2 className="text-xl font-normal text-foreground">Imóveis pendentes de revisão</h2>
            {renderCountEyebrow(section)}
          </div>
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
                    [{prop.code}] {prop.title || 'Sem título'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {prop.last_reviewed_at
                      ? `Última revisão: ${formatDateBahia(prop.last_reviewed_at)}`
                      : 'Nunca revisado'}
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
              {renderLeadSection(
                'Leads novos sem dono',
                data.sections.new_unassigned_leads,
                (lead) => navigate(`/leads/${lead.id}`),
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

          {/* CORRETOR (no celular: "Visitas de hoje" primeiro com hora em destaque) */}
          {data.role === 'corretor' && (
            <>
              {renderVisitSection('Visitas de hoje', data.sections.visits_today, {
                isCorretorVisitsToday: true,
              })}

              {renderVisitSection('Visitas a confirmar', data.sections.visits_to_confirm, {
                isVisitToConfirm: true,
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
    </div>
  )
}
