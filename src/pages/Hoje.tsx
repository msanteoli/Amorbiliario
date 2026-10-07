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
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  RefreshCw,
  AlertCircle,
  Clock,
  Calendar,
  CheckSquare,
  Building,
  User,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react'

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

  // Helper para contagem formatada
  const renderCountBadge = (section?: TodaySection<unknown>) => {
    if (!section) return null
    const text = section.more ? '500 ou mais' : String(section.count)
    return (
      <Badge
        variant={section.count > 0 ? 'secondary' : 'outline'}
        className="font-semibold text-xs"
      >
        {text}
      </Badge>
    )
  }

  // Título da página baseado no role retornado
  const pageTitle = (() => {
    if (!data) return 'Hoje'
    if (data.role === 'sdr') return 'Hoje — SDR'
    if (data.role === 'corretor') return 'Hoje — Corretor'
    if (data.role === 'admin') return 'Hoje — Administração'
    return 'Hoje'
  })()

  // Checa se o próximo passo está atrasado comparado com o momento atual
  const isOverdue = (dateStr?: string | null) => {
    if (!dateStr) return false
    const d = new Date(dateStr)
    return !isNaN(d.getTime()) && d.getTime() < Date.now()
  }

  // Renderizador de seção de Leads (Leads novos sem dono, dedupe, próximos passos vencidos, etc.)
  const renderLeadSection = (
    title: string,
    section: TodaySection<TodayLeadItem> | undefined,
    itemClick: (item: TodayLeadItem) => void,
    options?: {
      isNextStepOverdueHighlight?: boolean
      helpText?: string
    },
  ) => {
    if (!section) return null

    return (
      <Card className="flex flex-col">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold">{title}</CardTitle>
              {options?.helpText && (
                <p className="text-xs text-muted-foreground mt-0.5">{options.helpText}</p>
              )}
            </div>
            {renderCountBadge(section)}
          </div>
        </CardHeader>
        <CardContent className="pt-3 flex-1 flex flex-col justify-between">
          {section.items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nada por aqui.</p>
          ) : (
            <ul className="divide-y divide-border">
              {section.items.map((lead) => (
                <li
                  key={lead.id}
                  onClick={() => itemClick(lead)}
                  className="py-2.5 first:pt-0 last:pb-0 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2 transition-colors flex items-center justify-between gap-2 group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-foreground truncate group-hover:text-primary">
                      {lead.name || 'Lead sem nome'}
                    </p>
                    {options?.isNextStepOverdueHighlight ? (
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs">
                        {lead.next_step && (
                          <span className="text-muted-foreground truncate max-w-[200px]">
                            {lead.next_step}
                          </span>
                        )}
                        {lead.next_step_due && (
                          <span className="text-destructive font-semibold flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDateTimeBahia(lead.next_step_due)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        {lead.created && <span>Criado em {formatDateBahia(lead.created)}</span>}
                        {lead.stage && (
                          <span>• {LEAD_STAGE_LABELS[lead.stage as LeadStage] || lead.stage}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary shrink-0 transition-transform group-hover:translate-x-0.5" />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    )
  }

  // Renderizador de visitas
  const renderVisitSection = (
    title: string,
    section: TodaySection<TodayVisitItem> | undefined,
    options?: {
      highlightTimeAndPerson?: boolean
      showDate?: boolean
      fullWidthMobile?: boolean
    },
  ) => {
    if (!section) return null

    return (
      <Card
        className={`flex flex-col ${options?.fullWidthMobile ? 'col-span-1 md:col-span-2' : ''}`}
      >
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            {renderCountBadge(section)}
          </div>
        </CardHeader>
        <CardContent className="pt-3 flex-1 flex flex-col justify-between">
          {section.items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nada por aqui.</p>
          ) : (
            <ul className="divide-y divide-border">
              {section.items.map((v) => (
                <li
                  key={v.id}
                  onClick={() => navigate('/agenda')}
                  className="py-2.5 first:pt-0 last:pb-0 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2 transition-colors flex items-center justify-between gap-2 group"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                          options?.highlightTimeAndPerson
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-primary/10 text-primary'
                        }`}
                      >
                        {options?.showDate
                          ? `${formatDateBahia(v.start_at)} às ${formatTimeBahia(v.start_at)}`
                          : formatTimeBahia(v.start_at)}
                      </span>
                      <span
                        className={`font-medium text-sm truncate ${
                          options?.highlightTimeAndPerson
                            ? 'font-bold text-foreground'
                            : 'text-foreground'
                        }`}
                      >
                        {v.person_name || 'Sem nome'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {v.property_code && (
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          Imóvel {v.property_code}
                        </span>
                      )}
                      {v.broker_name && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {v.broker_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary shrink-0 transition-transform group-hover:translate-x-0.5" />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    )
  }

  // Renderizador de tarefas
  const renderTaskSection = (
    title: string,
    section: TodaySection<TodayTaskItem> | undefined,
    options?: {
      showAssigned?: boolean
    },
  ) => {
    if (!section) return null

    return (
      <Card className="flex flex-col">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            {renderCountBadge(section)}
          </div>
        </CardHeader>
        <CardContent className="pt-3 flex-1 flex flex-col justify-between">
          {section.items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nada por aqui.</p>
          ) : (
            <ul className="divide-y divide-border">
              {section.items.map((task) => {
                const overdue = isOverdue(task.due_at)
                return (
                  <li
                    key={task.id}
                    onClick={() => navigate('/agenda?tab=tarefas')}
                    className="py-2.5 first:pt-0 last:pb-0 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2 transition-colors flex items-center justify-between gap-2 group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-foreground truncate group-hover:text-primary">
                        {task.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs">
                        {options?.showAssigned && task.assigned_name && (
                          <span className="text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {task.assigned_name}
                          </span>
                        )}
                        {task.due_at && (
                          <span
                            className={`flex items-center gap-1 ${
                              overdue ? 'text-destructive font-semibold' : 'text-muted-foreground'
                            }`}
                          >
                            <Clock className="h-3 w-3" />
                            {formatDateTimeBahia(task.due_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    )
  }

  // Renderizador de Leads por etapa (Admin)
  const renderLeadsByStageSection = (section: TodaySection<TodayStageCountItem> | undefined) => {
    if (!section) return null

    return (
      <Card className="flex flex-col">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base font-semibold">Leads por etapa</CardTitle>
            {renderCountBadge(section)}
          </div>
        </CardHeader>
        <CardContent className="pt-3 flex-1 flex flex-col justify-between">
          {section.items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nada por aqui.</p>
          ) : (
            <ul className="divide-y divide-border">
              {section.items.map((item) => (
                <li
                  key={item.stage}
                  onClick={() => navigate(`/leads?stage=${encodeURIComponent(item.stage)}`)}
                  className="py-2.5 first:pt-0 last:pb-0 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2 transition-colors flex items-center justify-between gap-2 group"
                >
                  <span className="font-medium text-sm text-foreground group-hover:text-primary">
                    {LEAD_STAGE_LABELS[item.stage as LeadStage] || item.stage}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-semibold text-xs">
                      {item.count}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    )
  }

  // Renderizador de Imóveis pendentes de revisão (Admin)
  const renderPropertiesPendingSection = (section: TodaySection<TodayPropertyItem> | undefined) => {
    if (!section) return null

    return (
      <Card className="flex flex-col">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base font-semibold">Imóveis pendentes de revisão</CardTitle>
            {renderCountBadge(section)}
          </div>
        </CardHeader>
        <CardContent className="pt-3 flex-1 flex flex-col justify-between">
          {section.items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nada por aqui.</p>
          ) : (
            <ul className="divide-y divide-border">
              {section.items.map((prop) => (
                <li
                  key={prop.id}
                  onClick={() => navigate(`/imoveis/${prop.id}`)}
                  className="py-2.5 first:pt-0 last:pb-0 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2 transition-colors flex items-center justify-between gap-2 group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs bg-muted px-1.5 py-0.5 rounded">
                        {prop.code}
                      </span>
                      <p className="font-medium text-sm text-foreground truncate group-hover:text-primary">
                        {prop.title || 'Sem título'}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {prop.last_reviewed_at
                        ? `Última revisão: ${formatDateBahia(prop.last_reviewed_at)}`
                        : 'Nunca revisado'}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary shrink-0 transition-transform group-hover:translate-x-0.5" />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {pageTitle}
          </h1>
          {data?.generated_at && (
            <p className="text-xs text-muted-foreground mt-1">
              Última atualização às {formatTimeBahia(data.generated_at)} (
              {formatDateBahia(data.generated_at)}) — Fuso Bahia
            </p>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => loadData(true)}
          disabled={loading || refreshing}
          className="gap-2 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Atualizar</span>
        </Button>
      </div>

      {/* Erro de carregamento */}
      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm font-medium">{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Esqueletos enquanto carrega primeira vez */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-8 rounded-full" />
              </div>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </Card>
          ))}
        </div>
      )}

      {/* Seções por papel */}
      {!loading && data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {/* PAINEL SDR:
              - Leads novos sem dono (new_unassigned_leads; /leads/:id)
              - Pendências de duplicidade (dedupe_pending; /leads?tab=pendencias)
              - Próximos passos vencidos (overdue_next_steps; /leads/:id)
              - Visitas pendentes de agenda (pending_visits; /agenda)
              - Minhas tarefas atrasadas e de hoje (my_tasks_due; /agenda?tab=tarefas)
              - Visitas de hoje (visits_today; /agenda)
          */}
          {data.role === 'sdr' && (
            <>
              {renderLeadSection(
                'Leads novos sem dono',
                data.sections.new_unassigned_leads,
                (lead) => navigate(`/leads/${lead.id}`),
              )}

              {renderLeadSection('Pendências de duplicidade', data.sections.dedupe_pending, () =>
                navigate('/leads?tab=pendencias'),
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

          {/* PAINEL CORRETOR:
              - Visitas de hoje (visits_today; no celular primeiro e largura toda)
              - Visitas a confirmar (visits_to_confirm; destaque na hora e na pessoa)
              - Minhas tarefas atrasadas e de hoje (my_tasks_due)
              - Leads com próximo passo vencido (overdue_next_steps)
          */}
          {data.role === 'corretor' && (
            <>
              {renderVisitSection('Visitas de hoje', data.sections.visits_today, {
                fullWidthMobile: true,
              })}

              {renderVisitSection('Visitas a confirmar', data.sections.visits_to_confirm, {
                highlightTimeAndPerson: true,
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

          {/* PAINEL ADMIN:
              - Leads por etapa (leads_by_stage; /leads já filtrado pela etapa)
              - Visitas da semana (visits_week; dia, hora, imóvel, pessoa, corretor)
              - Leads parados sem dono (stalled_leads; texto de ajuda: "Novos, sem corretor, há mais de 24 horas")
              - Imóveis pendentes de revisão (properties_pending_review; código, título e última revisão; /imoveis/:id)
              - Tarefas atrasadas da equipe (overdue_tasks; título, responsável, prazo)
          */}
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
