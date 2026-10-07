import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  VisitRecord,
  VisitStatus,
  VISIT_STATUS_LABELS,
  listVisits,
  listPendingVisits,
  listActiveBrokers,
  ActiveBroker,
  formatDateTimeBahia,
  formatDateBahia,
  formatTimeBahia,
  getDateKeyBahia,
  extractErrorMessage,
} from '@/services/visits'
import {
  TaskRecord,
  TaskStatus,
  TASK_STATUS_LABELS,
  listTasks,
  formatTaskDateTimeBahia,
  isTaskOverdue,
  completeTask,
  extractTaskErrorMessage,
} from '@/services/tasks'
import { useAuth } from '@/contexts/AuthContext'
import { VisitDetailModal, getVisitStatusBadge } from '@/components/agenda/VisitDetailModal'
import { CreateVisitModal } from '@/components/agenda/CreateVisitModal'
import { TaskDetailModal, getTaskStatusBadge } from '@/components/agenda/TaskDetailModal'
import { CreateTaskModal } from '@/components/agenda/CreateTaskModal'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Building2,
  User,
  CalendarDays,
  ListTodo,
  ExternalLink,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

export default function Agenda() {
  const { user } = useAuth()
  const role = user?.role || ''
  const isAdmin = role === 'admin'
  const isSdr = role === 'sdr'
  const isCorretor = role === 'corretor'
  const canFilterBroker = isAdmin || isSdr
  const canCreateVisit = isAdmin || isSdr

  const [searchParams] = useSearchParams()

  // Aba principal: "visitas" | "tarefas"
  const [activeTab, setActiveTab] = useState<'visitas' | 'tarefas'>(() => {
    const t = searchParams.get('tab')
    if (t === 'tarefas') return 'tarefas'
    return 'visitas'
  })

  // Notificação / mensagem de sucesso ou conflito
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null)

  // ═══════════════════════════════════════════════════════════════
  // ESTADOS DA ABA VISITAS
  // ═══════════════════════════════════════════════════════════════
  const [visitView, setVisitView] = useState<'semana' | 'dia' | 'lista'>('semana')
  const [selectedBrokerFilter, setSelectedBrokerFilter] = useState<string>('all')
  const [showCancelledVisits, setShowCancelledVisits] = useState<boolean>(false)
  const [statusFilterVisits, setStatusFilterVisits] = useState<string>('all')

  // Navegação de data (baseada no fuso Bahia UTC-3)
  const [currentDateBahia, setCurrentDateBahia] = useState<Date>(() => {
    // Data corrente em UTC-3
    const now = new Date()
    return new Date(now.getTime() - 3 * 3600 * 1000)
  })

  // Listas de visitas
  const [visitsList, setVisitsList] = useState<VisitRecord[]>([])
  const [pendingVisits, setPendingVisits] = useState<VisitRecord[]>([])
  const [loadingVisits, setLoadingVisits] = useState(false)
  const [visitsPage, setVisitsPage] = useState(1)
  const [visitsTotalPages, setVisitsTotalPages] = useState(1)

  // Corretores para o filtro
  const [brokersList, setBrokersList] = useState<ActiveBroker[]>([])

  // Modal detalhe da visita
  const [selectedVisit, setSelectedVisit] = useState<VisitRecord | null>(null)
  const [visitDetailOpen, setVisitDetailOpen] = useState(false)

  // Modal criar visita
  const [createVisitOpen, setCreateVisitOpen] = useState(false)

  // ═══════════════════════════════════════════════════════════════
  // ESTADOS DA ABA TAREFAS
  // ═══════════════════════════════════════════════════════════════
  const [tasksList, setTasksList] = useState<TaskRecord[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [tasksStatusFilter, setTasksStatusFilter] = useState<TaskStatus | 'all'>('aberta')
  const [tasksBrokerFilter, setTasksBrokerFilter] = useState<string>('all')
  const [tasksSearch, setTasksSearch] = useState('')
  const [tasksOverdueOnly, setTasksOverdueOnly] = useState(false)
  const [tasksPage, setTasksPage] = useState(1)
  const [tasksTotalPages, setTasksTotalPages] = useState(1)

  // Modal detalhe da tarefa
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null)
  const [taskDetailOpen, setTaskDetailOpen] = useState(false)

  // Modal criar tarefa
  const [createTaskOpen, setCreateTaskOpen] = useState(false)

  // Carregar lista de corretores ativos para filtros
  useEffect(() => {
    if (canFilterBroker) {
      listActiveBrokers()
        .then(setBrokersList)
        .catch(() => {})
    }
  }, [canFilterBroker])

  // ═══════════════════════════════════════════════════════════════
  // CARREGAR VISITAS
  // ═══════════════════════════════════════════════════════════════
  const loadVisitsData = useCallback(async () => {
    setLoadingVisits(true)
    try {
      const brokerId = canFilterBroker ? selectedBrokerFilter : undefined

      if (visitView === 'lista') {
        // Modo lista: paginação de 10, filtro por situação, pendentes no topo
        const [pVisits, vList] = await Promise.all([
          listPendingVisits(brokerId),
          listVisits({
            brokerId,
            status: statusFilterVisits !== 'all' ? statusFilterVisits : undefined,
            includePending: false,
            page: visitsPage,
            perPage: 10,
            sort: 'start_at',
          }),
        ])
        setPendingVisits(pVisits)
        setVisitsList(vList.items)
        setVisitsTotalPages(vList.totalPages || 1)
      } else {
        // Modo Semana ou Dia
        // Calculamos o intervalo de datas para buscar visitas no período
        const [pVisits, vList] = await Promise.all([
          listPendingVisits(brokerId),
          listVisits({
            brokerId,
            includePending: false,
            page: 1,
            perPage: 200,
            sort: 'start_at',
          }),
        ])
        setPendingVisits(pVisits)
        setVisitsList(vList.items)
      }
    } catch (err) {
      // ignore
    } finally {
      setLoadingVisits(false)
    }
  }, [canFilterBroker, selectedBrokerFilter, visitView, statusFilterVisits, visitsPage])

  useEffect(() => {
    if (activeTab === 'visitas') {
      loadVisitsData()
    }
  }, [activeTab, loadVisitsData])

  // ═══════════════════════════════════════════════════════════════
  // CARREGAR TAREFAS
  // ═══════════════════════════════════════════════════════════════
  const loadTasksData = useCallback(async () => {
    setLoadingTasks(true)
    try {
      const brokerId = canFilterBroker ? tasksBrokerFilter : undefined
      const res = await listTasks({
        status: tasksStatusFilter,
        assignedTo: brokerId,
        overdueOnly: tasksOverdueOnly,
        search: tasksSearch,
        page: tasksPage,
        perPage: 10,
      })
      setTasksList(res.items)
      setTasksTotalPages(res.totalPages || 1)
    } catch {
      // ignore
    } finally {
      setLoadingTasks(false)
    }
  }, [
    canFilterBroker,
    tasksBrokerFilter,
    tasksStatusFilter,
    tasksOverdueOnly,
    tasksSearch,
    tasksPage,
  ])

  useEffect(() => {
    if (activeTab === 'tarefas') {
      loadTasksData()
    }
  }, [activeTab, loadTasksData])

  // ═══════════════════════════════════════════════════════════════
  // CÁLCULOS DO CALENDÁRIO (SEMANA E DIA)
  // ═══════════════════════════════════════════════════════════════

  // Início da semana (Segunda-feira) para a data selecionada
  const weekDays = useMemo(() => {
    const d = new Date(currentDateBahia)
    // getUTCDay: 0=domingo, 1=segunda, ..., 6=sábado
    const dayOfWeek = d.getUTCDay()
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

    const monday = new Date(d)
    monday.setUTCDate(d.getUTCDate() + diffToMonday)

    const days: { date: Date; key: string; label: string; isToday: boolean }[] = []
    const todayBahiaKey = getDateKeyBahia(new Date().toISOString())

    const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(monday)
      dayDate.setUTCDate(monday.getUTCDate() + i)
      const yyyy = dayDate.getUTCFullYear()
      const mm = String(dayDate.getUTCMonth() + 1).padStart(2, '0')
      const dd = String(dayDate.getUTCDate()).padStart(2, '0')
      const key = `${yyyy}-${mm}-${dd}`
      days.push({
        date: dayDate,
        key,
        label: `${dayNames[i]} ${dd}/${mm}`,
        isToday: key === todayBahiaKey,
      })
    }
    return days
  }, [currentDateBahia])

  // Data do dia selecionado
  const currentDayKey = useMemo(() => {
    const yyyy = currentDateBahia.getUTCFullYear()
    const mm = String(currentDateBahia.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(currentDateBahia.getUTCDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }, [currentDateBahia])

  const currentDayLabel = useMemo(() => {
    const yyyy = currentDateBahia.getUTCFullYear()
    const mm = String(currentDateBahia.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(currentDateBahia.getUTCDate()).padStart(2, '0')
    return `${dd}/${mm}/${yyyy}`
  }, [currentDateBahia])

  // Navegação no calendário
  const handlePrev = () => {
    const d = new Date(currentDateBahia)
    if (visitView === 'semana') {
      d.setUTCDate(d.getUTCDate() - 7)
    } else {
      d.setUTCDate(d.getUTCDate() - 1)
    }
    setCurrentDateBahia(d)
  }

  const handleNext = () => {
    const d = new Date(currentDateBahia)
    if (visitView === 'semana') {
      d.setUTCDate(d.getUTCDate() + 7)
    } else {
      d.setUTCDate(d.getUTCDate() + 1)
    }
    setCurrentDateBahia(d)
  }

  const handleToday = () => {
    const now = new Date()
    setCurrentDateBahia(new Date(now.getTime() - 3 * 3600 * 1000))
  }

  // Agrupamento de visitas por data (yyyy-mm-dd)
  const visitsByDateKey = useMemo(() => {
    const map: Record<string, VisitRecord[]> = {}
    for (const v of visitsList) {
      if (!v.start_at) continue
      // Se visita estiver cancelada e a opção 'mostrar canceladas' não estiver marcada, esconde
      if (v.status === 'cancelada' && !showCancelledVisits) {
        continue
      }
      const key = getDateKeyBahia(v.start_at)
      if (!key) continue
      if (!map[key]) map[key] = []
      map[key].push(v)
    }
    // Ordenar visitas de cada dia por horário de início
    for (const k in map) {
      map[k].sort((a, b) => (a.start_at || '').localeCompare(b.start_at || ''))
    }
    return map
  }, [visitsList, showCancelledVisits])

  // Abertura do modal de detalhe da visita
  const handleOpenVisitDetail = (visit: VisitRecord) => {
    setSelectedVisit(visit)
    setVisitDetailOpen(true)
  }

  // Abertura do modal de detalhe da tarefa
  const handleOpenTaskDetail = (task: TaskRecord) => {
    setSelectedTask(task)
    setTaskDetailOpen(true)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Mensagem de sucesso global da página */}
      {alertSuccess && (
        <Alert className="bg-emerald-50 text-emerald-900 border-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="font-medium text-sm flex items-center justify-between">
            <span>{alertSuccess}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAlertSuccess(null)}
              className="h-6 text-xs"
            >
              Fechar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Cabeçalho da Agenda */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            <span>Agenda</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            Gerencie visitas a imóveis e tarefas operacionais da equipe
          </p>
        </div>

        {/* Botões de Ação Superiores */}
        <div className="flex items-center gap-2">
          {activeTab === 'visitas' && canCreateVisit && (
            <Button
              onClick={() => setCreateVisitOpen(true)}
              className="gap-1.5 text-xs font-semibold"
            >
              <Plus className="h-4 w-4" />
              <span>Agendar visita</span>
            </Button>
          )}

          {activeTab === 'tarefas' && (
            <Button
              onClick={() => setCreateTaskOpen(true)}
              className="gap-1.5 text-xs font-semibold"
            >
              <Plus className="h-4 w-4" />
              <span>Nova tarefa</span>
            </Button>
          )}
        </div>
      </div>

      {/* Abas Principais: Visitas e Tarefas */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'visitas' | 'tarefas')}
        className="w-full"
      >
        <TabsList className="grid w-full sm:w-64 grid-cols-2">
          <TabsTrigger value="visitas" className="gap-2 text-xs">
            <CalendarIcon className="h-4 w-4" />
            <span>Visitas</span>
          </TabsTrigger>
          <TabsTrigger value="tarefas" className="gap-2 text-xs">
            <ListTodo className="h-4 w-4" />
            <span>Tarefas</span>
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ABA 1: VISITAS */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="visitas" className="space-y-4 pt-4">
          {/* Barra de Ferramentas / Filtros de Visitas */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3 rounded-lg bg-card border">
            {/* Seletor de Visão: Semana, Dia, Lista */}
            <div className="flex items-center gap-1.5">
              <Button
                variant={visitView === 'semana' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setVisitView('semana')}
                className="text-xs h-8"
              >
                Semana
              </Button>
              <Button
                variant={visitView === 'dia' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setVisitView('dia')}
                className="text-xs h-8"
              >
                Dia
              </Button>
              <Button
                variant={visitView === 'lista' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setVisitView('lista')}
                className="text-xs h-8"
              >
                Lista
              </Button>
            </div>

            {/* Controles do meio: Navegação de datas (Semana / Dia) */}
            {visitView !== 'lista' && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handlePrev}
                  title="Anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleToday}>
                  Hoje
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleNext}
                  title="Próxima"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <span className="text-xs font-semibold text-foreground px-2">
                  {visitView === 'semana'
                    ? `${weekDays[0]?.label} a ${weekDays[6]?.label}`
                    : currentDayLabel}
                </span>
              </div>
            )}

            {/* Filtros da direita: Corretor e Canceladas */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Filtro por corretor (só admin e SDR) */}
              {canFilterBroker && (
                <div className="w-44">
                  <Select
                    value={selectedBrokerFilter}
                    onValueChange={(val) => {
                      setSelectedBrokerFilter(val)
                      setVisitsPage(1)
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Corretor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os corretores</SelectItem>
                      {brokersList.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Filtro de situação na visão lista */}
              {visitView === 'lista' && (
                <div className="w-40">
                  <Select
                    value={statusFilterVisits}
                    onValueChange={(val) => {
                      setStatusFilterVisits(val)
                      setVisitsPage(1)
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Situação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as situações</SelectItem>
                      <SelectItem value="agendada">Agendada</SelectItem>
                      <SelectItem value="confirmada">Confirmada</SelectItem>
                      <SelectItem value="realizada">Realizada</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                      <SelectItem value="nao_compareceu">Não compareceu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Opção: Mostrar canceladas (ocultar é o padrão) */}
              {visitView !== 'lista' && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="show-cancelled"
                    checked={showCancelledVisits}
                    onCheckedChange={(checked) => setShowCancelledVisits(Boolean(checked))}
                  />
                  <Label
                    htmlFor="show-cancelled"
                    className="text-xs cursor-pointer text-muted-foreground font-normal"
                  >
                    Mostrar canceladas
                  </Label>
                </div>
              )}
            </div>
          </div>

          {loadingVisits ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-xs">Carregando visitas...</p>
            </div>
          ) : (
            <>
              {/* ────────────────────────────────────────────────────────── */}
              {/* VISÃO SEMANA: 7 colunas no desktop, empilhado no celular   */}
              {/* ────────────────────────────────────────────────────────── */}
              {visitView === 'semana' && (
                <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
                  {weekDays.map((day) => {
                    const dayVisits = visitsByDateKey[day.key] || []
                    return (
                      <div
                        key={day.key}
                        className={`rounded-lg border bg-card p-2 min-h-[160px] md:min-h-[380px] flex flex-col ${
                          day.isToday ? 'border-primary/50 bg-primary/5' : ''
                        }`}
                      >
                        {/* Cabeçalho do dia */}
                        <div className="flex items-center justify-between pb-2 mb-2 border-b">
                          <span
                            className={`text-xs font-semibold ${
                              day.isToday ? 'text-primary' : 'text-foreground'
                            }`}
                          >
                            {day.label}
                          </span>
                          {dayVisits.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1">
                              {dayVisits.length}
                            </Badge>
                          )}
                        </div>

                        {/* Lista de visitas do dia */}
                        <div className="space-y-1.5 flex-1 overflow-y-auto">
                          {dayVisits.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground italic text-center py-4">
                              Sem visitas
                            </p>
                          ) : (
                            dayVisits.map((v) => {
                              const isCancelled = v.status === 'cancelada'
                              const propCode = v.expand?.property_id?.code || 'Imóvel'
                              const personName =
                                v.expand?.lead_id?.name || v.expand?.client_id?.name || 'Cliente'
                              return (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={() => handleOpenVisitDetail(v)}
                                  className={`w-full text-left p-2 rounded-lg border text-xs transition-colors ${
                                    isCancelled
                                      ? 'opacity-40 bg-zinc-100 dark:bg-zinc-900 border-dashed'
                                      : 'bg-background hover:border-primary/50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <span className="font-semibold text-primary text-[11px] flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {formatTimeBahia(v.start_at)}
                                    </span>
                                    {getVisitStatusBadge(v.status)}
                                  </div>
                                  <div className="font-medium text-foreground truncate text-[11px]">
                                    [{propCode}]
                                  </div>
                                  <div className="text-muted-foreground truncate text-[11px]">
                                    {personName}
                                  </div>
                                </button>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ────────────────────────────────────────────────────────── */}
              {/* VISÃO DIA: visitas do dia em ordem de horário              */}
              {/* ────────────────────────────────────────────────────────── */}
              {visitView === 'dia' && (
                <div className="space-y-3">
                  {(() => {
                    const dayVisits = visitsByDateKey[currentDayKey] || []
                    if (dayVisits.length === 0) {
                      return (
                        <div className="p-12 text-center text-muted-foreground border rounded-lg bg-card">
                          <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          <p className="text-sm font-medium">
                            Nenhuma visita agendada para este dia.
                          </p>
                        </div>
                      )
                    }

                    return (
                      <div className="divide-y rounded-lg border bg-card">
                        {dayVisits.map((v) => {
                          const isCancelled = v.status === 'cancelada'
                          const prop = v.expand?.property_id
                          const personName =
                            v.expand?.lead_id?.name || v.expand?.client_id?.name || 'Cliente'
                          const brokerName =
                            v.expand?.broker_id?.name ||
                            v.expand?.broker_id?.email ||
                            'Sem corretor'

                          return (
                            <div
                              key={v.id}
                              onClick={() => handleOpenVisitDetail(v)}
                              className={`p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer hover:bg-muted/40 transition-colors ${
                                isCancelled ? 'opacity-40' : ''
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-primary flex items-center gap-1">
                                    <Clock className="h-4 w-4" />
                                    {formatTimeBahia(v.start_at)}
                                    {v.end_at && ` - ${formatTimeBahia(v.end_at)}`}
                                  </span>
                                  {getVisitStatusBadge(v.status)}
                                </div>
                                <div className="text-sm font-semibold text-foreground">
                                  [{prop?.code || 'Imóvel'}] {prop?.title || ''}
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-3">
                                  <span>
                                    Pessoa:{' '}
                                    <strong className="text-foreground">{personName}</strong>
                                  </span>
                                  <span>
                                    Corretor:{' '}
                                    <strong className="text-foreground">{brokerName}</strong>
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* ────────────────────────────────────────────────────────── */}
              {/* VISÃO LISTA: pendentes no topo + visitas com paginação      */}
              {/* ────────────────────────────────────────────────────────── */}
              {visitView === 'lista' && (
                <div className="space-y-6">
                  {/* Seção Separada: Pendentes de agenda */}
                  {pendingVisits.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold flex items-center gap-1.5 text-amber-700">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Pendentes de agenda ({pendingVisits.length})</span>
                        </h2>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {pendingVisits.map((pv) => {
                          const prop = pv.expand?.property_id
                          const personName =
                            pv.expand?.lead_id?.name || pv.expand?.client_id?.name || 'Cliente'
                          const brokerName =
                            pv.expand?.broker_id?.name ||
                            pv.expand?.broker_id?.email ||
                            'Sem corretor'
                          return (
                            <div
                              key={pv.id}
                              onClick={() => handleOpenVisitDetail(pv)}
                              className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 hover:bg-amber-100/60 cursor-pointer flex items-center justify-between text-xs transition-colors"
                            >
                              <div className="space-y-0.5">
                                <p className="font-semibold text-foreground">
                                  [{prop?.code || 'Imóvel'}] {prop?.title || ''}
                                </p>
                                <p className="text-muted-foreground">
                                  Pessoa: <strong className="text-foreground">{personName}</strong>{' '}
                                  | Corretor: {brokerName}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className="bg-amber-100 text-amber-800 border-amber-300"
                              >
                                Pendente
                              </Badge>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Lista com paginação */}
                  <div className="space-y-2">
                    <h2 className="text-sm font-bold text-foreground">
                      Visitas agendadas e concluídas
                    </h2>
                    {visitsList.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground border rounded-lg bg-card">
                        <p className="text-xs">
                          Nenhuma visita encontrada para os filtros selecionados.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y rounded-lg border bg-card">
                        {visitsList.map((v) => {
                          const prop = v.expand?.property_id
                          const personName =
                            v.expand?.lead_id?.name || v.expand?.client_id?.name || 'Cliente'
                          const brokerName =
                            v.expand?.broker_id?.name ||
                            v.expand?.broker_id?.email ||
                            'Sem corretor'

                          return (
                            <div
                              key={v.id}
                              onClick={() => handleOpenVisitDetail(v)}
                              className="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-muted/40 cursor-pointer text-xs"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-primary flex items-center gap-1">
                                    <CalendarIcon className="h-3.5 w-3.5" />
                                    {formatDateTimeBahia(v.start_at)}
                                  </span>
                                  {getVisitStatusBadge(v.status)}
                                </div>
                                <p className="font-semibold text-foreground text-sm">
                                  [{prop?.code || 'Imóvel'}] {prop?.title || ''}
                                </p>
                                <p className="text-muted-foreground">
                                  Pessoa: <strong className="text-foreground">{personName}</strong>{' '}
                                  | Corretor: {brokerName}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Paginação da lista de visitas */}
                    {visitsTotalPages > 1 && (
                      <div className="flex items-center justify-between pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setVisitsPage((p) => Math.max(1, p - 1))}
                          disabled={visitsPage <= 1}
                          className="h-8 text-xs"
                        >
                          Anterior
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Página {visitsPage} de {visitsTotalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setVisitsPage((p) => Math.min(visitsTotalPages, p + 1))}
                          disabled={visitsPage >= visitsTotalPages}
                          className="h-8 text-xs"
                        >
                          Próxima
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ABA 2: TAREFAS */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="tarefas" className="space-y-4 pt-4">
          {/* Barra de Filtros de Tarefas */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3 rounded-lg bg-card border">
            <div className="flex flex-wrap items-center gap-2">
              {/* Filtro por Situação (padrão "Abertas") */}
              <div className="w-36">
                <Select
                  value={tasksStatusFilter}
                  onValueChange={(val) => {
                    setTasksStatusFilter(val as TaskStatus | 'all')
                    setTasksPage(1)
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Situação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aberta">Abertas</SelectItem>
                    <SelectItem value="concluida">Concluídas</SelectItem>
                    <SelectItem value="cancelada">Canceladas</SelectItem>
                    <SelectItem value="all">Todas as situações</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro por Responsável (só admin e SDR) */}
              {canFilterBroker && (
                <div className="w-44">
                  <Select
                    value={tasksBrokerFilter}
                    onValueChange={(val) => {
                      setTasksBrokerFilter(val)
                      setTasksPage(1)
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os responsáveis</SelectItem>
                      {brokersList.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Filtro: Atrasadas */}
              <div className="flex items-center space-x-2 pl-2">
                <Checkbox
                  id="overdue-only"
                  checked={tasksOverdueOnly}
                  onCheckedChange={(c) => {
                    setTasksOverdueOnly(Boolean(c))
                    setTasksPage(1)
                  }}
                />
                <Label
                  htmlFor="overdue-only"
                  className="text-xs cursor-pointer text-muted-foreground font-normal"
                >
                  Atrasadas
                </Label>
              </div>
            </div>

            {/* Busca por título */}
            <div className="relative w-full md:w-60">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por título..."
                value={tasksSearch}
                onChange={(e) => {
                  setTasksSearch(e.target.value)
                  setTasksPage(1)
                }}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>

          {loadingTasks ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-xs">Carregando tarefas...</p>
            </div>
          ) : tasksList.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground border rounded-lg bg-card">
              <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">Nenhuma tarefa encontrada.</p>
            </div>
          ) : (
            <>
              {/* Tabela no desktop */}
              <div className="hidden md:block rounded-lg border bg-card overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
                    <tr>
                      <th className="p-3">Título</th>
                      <th className="p-3">Prazo</th>
                      <th className="p-3">Responsável</th>
                      <th className="p-3">Vínculo</th>
                      <th className="p-3">Situação</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tasksList.map((t) => {
                      const assigneeName =
                        t.expand?.assigned_to?.name ||
                        t.expand?.assigned_to?.email ||
                        'Sem responsável'
                      const lead = t.expand?.lead_id
                      const client = t.expand?.client_id
                      const property = t.expand?.property_id
                      const overdue = isTaskOverdue(t)

                      return (
                        <tr
                          key={t.id}
                          className="hover:bg-muted/40 cursor-pointer transition-colors"
                          onClick={() => handleOpenTaskDetail(t)}
                        >
                          <td className="p-3 font-semibold text-foreground max-w-xs truncate">
                            {t.title}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={overdue ? 'text-destructive font-bold' : ''}>
                              {formatTaskDateTimeBahia(t.due_at)}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap text-muted-foreground">
                            {assigneeName}
                          </td>
                          <td className="p-3">
                            {lead && (
                              <Link
                                to={`/leads/${lead.id}`}
                                className="text-primary hover:underline inline-flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span>{lead.name}</span>
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            )}
                            {client && (
                              <Link
                                to={`/clientes/${client.id}`}
                                className="text-primary hover:underline inline-flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span>{client.name}</span>
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            )}
                            {property && (
                              <Link
                                to={`/imoveis/${property.id}`}
                                className="text-primary hover:underline inline-flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span>[{property.code}]</span>
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            )}
                            {!lead && !client && !property && '-'}
                          </td>
                          <td className="p-3 whitespace-nowrap">{getTaskStatusBadge(t)}</td>
                          <td
                            className="p-3 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {t.status === 'aberta' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                onClick={async () => {
                                  try {
                                    await completeTask(t.id)
                                    loadTasksData()
                                  } catch (err) {
                                    alert(extractTaskErrorMessage(err))
                                  }
                                }}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Concluir</span>
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Cartões no celular */}
              <div className="grid grid-cols-1 gap-2 md:hidden">
                {tasksList.map((t) => {
                  const assigneeName =
                    t.expand?.assigned_to?.name || t.expand?.assigned_to?.email || 'Sem responsável'
                  const lead = t.expand?.lead_id
                  const client = t.expand?.client_id
                  const property = t.expand?.property_id
                  const overdue = isTaskOverdue(t)

                  return (
                    <div
                      key={t.id}
                      onClick={() => handleOpenTaskDetail(t)}
                      className="p-3.5 rounded-lg border bg-card space-y-2 cursor-pointer text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-foreground text-sm leading-snug">
                          {t.title}
                        </h3>
                        {getTaskStatusBadge(t)}
                      </div>

                      <div className="space-y-0.5 text-muted-foreground">
                        <p>
                          Prazo:{' '}
                          <span
                            className={overdue ? 'text-destructive font-bold' : 'text-foreground'}
                          >
                            {formatTaskDateTimeBahia(t.due_at)}
                          </span>
                        </p>
                        <p>
                          Responsável: <span className="text-foreground">{assigneeName}</span>
                        </p>
                        {(lead || client || property) && (
                          <p>
                            Vínculo: {lead && <strong>Lead {lead.name}</strong>}
                            {client && <strong>Cliente {client.name}</strong>}
                            {property && <strong>Imóvel [{property.code}]</strong>}
                          </p>
                        )}
                      </div>

                      {t.status === 'aberta' && (
                        <div className="pt-2 flex justify-end" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 border-emerald-300 text-emerald-700"
                            onClick={async () => {
                              try {
                                await completeTask(t.id)
                                loadTasksData()
                              } catch (err) {
                                alert(extractTaskErrorMessage(err))
                              }
                            }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Concluir</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Paginação de Tarefas */}
              {tasksTotalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTasksPage((p) => Math.max(1, p - 1))}
                    disabled={tasksPage <= 1}
                    className="h-8 text-xs"
                  >
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Página {tasksPage} de {tasksTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTasksPage((p) => Math.min(tasksTotalPages, p + 1))}
                    disabled={tasksPage >= tasksTotalPages}
                    className="h-8 text-xs"
                  >
                    Próxima
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Modais de Visitas */}
      <VisitDetailModal
        visit={selectedVisit}
        open={visitDetailOpen}
        onOpenChange={setVisitDetailOpen}
        onUpdated={async () => {
          await loadVisitsData()
          setVisitDetailOpen(false)
        }}
      />

      <CreateVisitModal
        open={createVisitOpen}
        onOpenChange={setCreateVisitOpen}
        onSuccess={(status) => {
          setAlertSuccess(
            status === 'agendada' ? 'Visita agendada.' : 'Pedido de visita registrado.',
          )
          loadVisitsData()
        }}
      />

      {/* Modais de Tarefas */}
      <TaskDetailModal
        task={selectedTask}
        open={taskDetailOpen}
        onOpenChange={setTaskDetailOpen}
        onUpdated={async () => {
          await loadTasksData()
          setTaskDetailOpen(false)
        }}
      />

      <CreateTaskModal
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
        onCreated={() => {
          setAlertSuccess('Tarefa criada com sucesso.')
          loadTasksData()
        }}
      />
    </div>
  )
}
