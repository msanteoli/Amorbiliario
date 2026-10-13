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
import { GoogleSyncBadge } from '@/components/agenda/GoogleSyncBadge'
import { getGoogleStatus } from '@/services/googleCalendar'

import { Cota } from '@/components/Cota'
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
  const [visitsTotalItems, setVisitsTotalItems] = useState(0)
  const [userNeedsGoogleReconnect, setUserNeedsGoogleReconnect] = useState(false)

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

  // Carregar lista de corretores ativos para filtros e status do google
  useEffect(() => {
    if (canFilterBroker) {
      listActiveBrokers()
        .then(setBrokersList)
        .catch(() => {})
    }
    if (role === 'corretor' || role === 'admin') {
      getGoogleStatus()
        .then((res) => {
          setUserNeedsGoogleReconnect(res.status === 'reconectar')
        })
        .catch(() => {
          setUserNeedsGoogleReconnect(false)
        })
    }
  }, [canFilterBroker, role])

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
        setVisitsTotalItems(vList.totalItems || 0)
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
        setVisitsTotalItems(vList.totalItems || vList.items.length)
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
        <Alert className="bg-success/10 text-success border-success/30">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <AlertDescription className="font-medium text-sm flex items-center justify-between text-foreground">
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

        {/* Botões de Ação Superiores: o da aba aberta preenchido, o outro de contorno */}
        <div className="flex items-center gap-2">
          {canCreateVisit && (
            <Button
              variant={activeTab === 'visitas' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCreateVisitOpen(true)}
              className="gap-1.5 text-xs font-normal rounded-full"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Agendar visita</span>
            </Button>
          )}

          <Button
            variant={activeTab === 'tarefas' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCreateTaskOpen(true)}
            className="gap-1.5 text-xs font-normal rounded-full"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nova tarefa</span>
          </Button>
        </div>
      </div>

      {/* Abas Principais: Visitas e Tarefas */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'visitas' | 'tarefas')}
        className="w-full"
      >
        <TabsList className="inline-flex h-9 items-center justify-start rounded-full bg-secondary p-1 text-muted-foreground">
          <TabsTrigger
            value="visitas"
            className="rounded-full px-4 py-1 text-xs font-normal data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
          >
            Visitas
          </TabsTrigger>
          <TabsTrigger
            value="tarefas"
            className="rounded-full px-4 py-1 text-xs font-normal data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
          >
            Tarefas
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ABA 1: VISITAS */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="visitas" className="space-y-6 pt-4">
          {/* Barra de Ferramentas / Filtros de Visitas */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 py-3 border-y border-border">
            {/* Seletor de Visão: Semana, Dia, Lista como grupo de pílulas */}
            <div className="inline-flex rounded-full border border-border p-0.5 bg-background">
              <button
                type="button"
                onClick={() => setVisitView('semana')}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  visitView === 'semana'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Semana
              </button>
              <button
                type="button"
                onClick={() => setVisitView('dia')}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  visitView === 'dia'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Dia
              </button>
              <button
                type="button"
                onClick={() => setVisitView('lista')}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  visitView === 'lista'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Lista
              </button>
            </div>

            {/* Controles do meio: Navegação de datas (Semana / Dia) */}
            {visitView !== 'lista' && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 min-h-[36px] min-w-[36px] rounded-full"
                  onClick={handlePrev}
                  title="Anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 rounded-full px-3 font-normal"
                  onClick={handleToday}
                >
                  Hoje
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 min-h-[36px] min-w-[36px] rounded-full"
                  onClick={handleNext}
                  title="Próxima"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <span className="text-xs font-normal tabular text-foreground px-2">
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
                    <SelectTrigger className="h-8 text-xs rounded-full">
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
                    <SelectTrigger className="h-8 text-xs rounded-full">
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
                <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  <Checkbox
                    id="show-cancelled"
                    checked={showCancelledVisits}
                    onCheckedChange={(checked) => setShowCancelledVisits(Boolean(checked))}
                  />
                  <span>Mostrar canceladas</span>
                </label>
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
              {/* VISÃO SEMANA: 7 colunas desktop, empilhado no celular       */}
              {/* ────────────────────────────────────────────────────────── */}
              {visitView === 'semana' && (
                <>
                  {/* Desktop: 7 colunas com divisores de 1px */}
                  <div className="hidden md:grid md:grid-cols-7 divide-x divide-border border border-border rounded-lg overflow-hidden bg-background">
                    {weekDays.map((day) => {
                      const dayVisits = visitsByDateKey[day.key] || []
                      const dayParts = day.label.split(' ')
                      const dayName = dayParts[0] // Seg, Ter, ...
                      const dayNum = dayParts[1] || '' // 21/04
                      return (
                        <div key={day.key} className="flex flex-col min-h-[420px] p-2">
                          {/* Cabeçalho do dia: eyebrow para dia da semana e número */}
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
                            <span className="eyebrow text-muted-foreground">{dayName}</span>
                            {day.isToday ? (
                              <span className="w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center text-[11px] tabular font-normal">
                                {dayNum.split('/')[0]}
                              </span>
                            ) : (
                              <span className="text-xs font-normal tabular text-foreground">
                                {dayNum}
                              </span>
                            )}
                          </div>

                          {/* Visitas do dia */}
                          <div className="space-y-1.5 flex-1 overflow-y-auto">
                            {dayVisits.length === 0 ? (
                              <span className="text-xs text-muted-foreground block text-center py-4">
                                —
                              </span>
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
                                    className={`w-full text-left p-2 rounded-lg border border-border text-xs transition-colors hover:bg-muted/40 ${
                                      isCancelled ? 'opacity-40' : ''
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <span className="dado font-normal text-foreground">
                                        {formatTimeBahia(v.start_at)}
                                      </span>
                                      {getVisitStatusBadge(v.status)}
                                    </div>
                                    <div className="font-normal text-foreground truncate">
                                      [{propCode}]
                                    </div>
                                    <div className="text-muted-foreground truncate text-[11px]">
                                      {personName}
                                    </div>
                                    {v.status === 'confirmada' && (
                                      <div className="pt-1">
                                        <GoogleSyncBadge
                                          googleSync={v.google_sync}
                                          brokerId={v.broker_id}
                                          brokerNeedsReconnect={
                                            v.broker_id === user?.id && userNeedsGoogleReconnect
                                          }
                                          visitStatus={v.status}
                                          showConnectAction={false}
                                        />
                                      </div>
                                    )}
                                  </button>
                                )
                              })
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Celular: dias empilhados, cabeçalho fixo ao rolar e visitas em linhas */}
                  <div className="md:hidden space-y-4">
                    {weekDays.map((day) => {
                      const dayVisits = visitsByDateKey[day.key] || []
                      const dayParts = day.label.split(' ')
                      const dayName = dayParts[0]
                      const dayNum = dayParts[1] || ''

                      return (
                        <div key={day.key} className="space-y-1">
                          {/* Cabeçalho fixo ao rolar */}
                          <div className="sticky top-14 z-10 bg-background/95 backdrop-blur py-2 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="eyebrow text-muted-foreground">{dayName}</span>
                              {day.isToday ? (
                                <span className="w-5 h-5 rounded-full bg-foreground text-background flex items-center justify-center text-[10px] tabular font-normal">
                                  {dayNum.split('/')[0]}
                                </span>
                              ) : (
                                <span className="text-xs font-normal tabular text-foreground">
                                  {dayNum}
                                </span>
                              )}
                            </div>
                            <span className="eyebrow tabular text-muted-foreground text-[11px]">
                              {dayVisits.length} visita(s)
                            </span>
                          </div>

                          {dayVisits.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">Nada por aqui.</p>
                          ) : (
                            <div className="divide-y divide-border">
                              {dayVisits.map((v) => {
                                const isCancelled = v.status === 'cancelada'
                                const propCode = v.expand?.property_id?.code || 'Imóvel'
                                const personName =
                                  v.expand?.lead_id?.name || v.expand?.client_id?.name || 'Cliente'
                                return (
                                  <div
                                    key={v.id}
                                    onClick={() => handleOpenVisitDetail(v)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault()
                                        handleOpenVisitDetail(v)
                                      }
                                    }}
                                    className={`min-h-[56px] py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/40 transition-colors ${
                                      isCancelled ? 'opacity-40' : ''
                                    }`}
                                  >
                                    <div className="shrink-0">
                                      <span className="dado font-normal text-foreground">
                                        {formatTimeBahia(v.start_at)}
                                      </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-normal text-foreground truncate">
                                        [{propCode}] {personName}
                                      </p>
                                      {v.status === 'confirmada' && (
                                        <div className="pt-1">
                                          <GoogleSyncBadge
                                            googleSync={v.google_sync}
                                            brokerId={v.broker_id}
                                            brokerNeedsReconnect={
                                              v.broker_id === user?.id && userNeedsGoogleReconnect
                                            }
                                            visitStatus={v.status}
                                            showConnectAction={false}
                                          />
                                        </div>
                                      )}
                                    </div>
                                    <div className="shrink-0">{getVisitStatusBadge(v.status)}</div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {/* ────────────────────────────────────────────────────────── */}
              {/* VISÃO DIA: visitas do dia em linhas com hora à esquerda     */}
              {/* ────────────────────────────────────────────────────────── */}
              {visitView === 'dia' && (
                <div className="space-y-2">
                  {(() => {
                    const dayVisits = visitsByDateKey[currentDayKey] || []
                    if (dayVisits.length === 0) {
                      return <p className="text-xs text-muted-foreground py-4">Nada por aqui.</p>
                    }

                    return (
                      <div className="divide-y divide-border">
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
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  handleOpenVisitDetail(v)
                                }
                              }}
                              className={`min-h-[56px] py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/40 transition-colors ${
                                isCancelled ? 'opacity-40' : ''
                              }`}
                            >
                              <div className="shrink-0 text-left">
                                <span className="dado font-normal text-foreground block">
                                  {formatTimeBahia(v.start_at)}
                                </span>
                                {v.end_at && (
                                  <span className="dado text-[11px] text-muted-foreground">
                                    até {formatTimeBahia(v.end_at)}
                                  </span>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-normal text-foreground truncate">
                                  [<span className="dado">{prop?.code || 'Imóvel'}</span>]{' '}
                                  {prop?.title || ''}
                                </p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  Pessoa: {personName} • Corretor: {brokerName}
                                </p>
                                {v.status === 'confirmada' && (
                                  <div className="pt-1">
                                    <GoogleSyncBadge
                                      googleSync={v.google_sync}
                                      brokerId={v.broker_id}
                                      brokerNeedsReconnect={
                                        v.broker_id === user?.id && userNeedsGoogleReconnect
                                      }
                                      visitStatus={v.status}
                                      showConnectAction={false}
                                    />
                                  </div>
                                )}
                              </div>

                              <div className="shrink-0">{getVisitStatusBadge(v.status)}</div>
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
                  {/* Seção no topo: Pendentes de agenda */}
                  {pendingVisits.length > 0 && (
                    <div className="space-y-2">
                      <div className="border-b border-border pb-2">
                        <Cota
                          title="Pendentes de agenda"
                          count={pendingVisits.length}
                          isAttention={true}
                        />
                      </div>

                      <div className="divide-y divide-border">
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
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  handleOpenVisitDetail(pv)
                                }
                              }}
                              className="min-h-[56px] py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/40 transition-colors"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-normal text-foreground truncate">
                                  [{prop?.code || 'Imóvel'}] {prop?.title || ''}
                                </p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  Pessoa: {personName} • Corretor: {brokerName}
                                </p>
                              </div>
                              <div className="shrink-0">
                                <Badge variant="attention">Pendente de agenda</Badge>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Lista com paginação */}
                  <div className="space-y-2">
                    <div className="border-b border-border pb-2">
                      <Cota
                        title="Visitas"
                        count={visitsTotalItems > 0 ? visitsTotalItems : visitsList.length}
                      />
                    </div>

                    {visitsList.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4">Nada por aqui.</p>
                    ) : (
                      <div className="divide-y divide-border">
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
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  handleOpenVisitDetail(v)
                                }
                              }}
                              className="min-h-[56px] py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/40 transition-colors"
                            >
                              <div className="shrink-0 text-left">
                                <span className="dado font-normal text-foreground block">
                                  {formatDateTimeBahia(v.start_at)}
                                </span>
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-normal text-foreground truncate">
                                  [{prop?.code || 'Imóvel'}] {prop?.title || ''}
                                </p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  Pessoa: {personName} • Corretor: {brokerName}
                                </p>
                                {v.status === 'confirmada' && (
                                  <div className="pt-1">
                                    <GoogleSyncBadge
                                      googleSync={v.google_sync}
                                      brokerId={v.broker_id}
                                      brokerNeedsReconnect={
                                        v.broker_id === user?.id && userNeedsGoogleReconnect
                                      }
                                      visitStatus={v.status}
                                      showConnectAction={false}
                                    />
                                  </div>
                                )}
                              </div>

                              <div className="shrink-0">{getVisitStatusBadge(v.status)}</div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Paginação da lista de visitas */}
                    {visitsTotalPages > 1 && (
                      <div className="flex items-center justify-between pt-4 border-t border-border">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setVisitsPage((p) => Math.max(1, p - 1))}
                          disabled={visitsPage <= 1}
                          className="h-8 text-xs rounded-full font-normal"
                        >
                          Anterior
                        </Button>
                        <span className="text-xs tabular text-muted-foreground">
                          Página {visitsPage} de {visitsTotalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setVisitsPage((p) => Math.min(visitsTotalPages, p + 1))}
                          disabled={visitsPage >= visitsTotalPages}
                          className="h-8 text-xs rounded-full font-normal"
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
        <TabsContent value="tarefas" className="space-y-6 pt-4">
          {/* Barra de Filtros de Tarefas em pílulas */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 py-3 border-y border-border">
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
                  <SelectTrigger className="h-8 text-xs rounded-full">
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
                    <SelectTrigger className="h-8 text-xs rounded-full">
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
              <label className="flex items-center gap-2 pl-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                <Checkbox
                  id="overdue-only"
                  checked={tasksOverdueOnly}
                  onCheckedChange={(c) => {
                    setTasksOverdueOnly(Boolean(c))
                    setTasksPage(1)
                  }}
                />
                <span>Atrasadas</span>
              </label>
            </div>

            {/* Busca por título */}
            <div className="relative w-full md:w-60">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por título..."
                value={tasksSearch}
                onChange={(e) => {
                  setTasksSearch(e.target.value)
                  setTasksPage(1)
                }}
                className="pl-8 h-8 text-xs rounded-full"
              />
            </div>
          </div>

          {loadingTasks ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-xs">Carregando tarefas...</p>
            </div>
          ) : tasksList.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">Nada por aqui.</p>
          ) : (
            <>
              {/* Tarefas: lista em linhas com caixa de conclusão à esquerda (alvo de 44px), título, prazo e responsável */}
              <div className="divide-y divide-border">
                {tasksList.map((t) => {
                  const assigneeName =
                    t.expand?.assigned_to?.name || t.expand?.assigned_to?.email || 'Sem responsável'
                  const overdue = isTaskOverdue(t)
                  const isDone = t.status === 'concluida'

                  return (
                    <div
                      key={t.id}
                      onClick={() => handleOpenTaskDetail(t)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleOpenTaskDetail(t)
                        }
                      }}
                      className="min-h-[56px] py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      {/* Caixa de conclusão à esquerda com alvo mínimo de 44px */}
                      <div
                        className="shrink-0 flex items-center justify-center min-h-[44px] min-w-[44px]"
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (t.status === 'aberta') {
                            try {
                              await completeTask(t.id)
                              loadTasksData()
                            } catch (err) {
                              alert(extractTaskErrorMessage(err))
                            }
                          }
                        }}
                      >
                        <Checkbox
                          checked={isDone}
                          disabled={t.status !== 'aberta'}
                          className="h-4 w-4 rounded"
                          aria-label={`Concluir tarefa: ${t.title}`}
                        />
                      </div>

                      {/* Título, prazo e responsável */}
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-normal truncate ${
                            isDone ? 'line-through text-muted-foreground' : 'text-foreground'
                          }`}
                        >
                          {t.title}
                        </p>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {t.due_at && (
                            <span
                              className={`dado mr-2 ${overdue ? 'text-attention font-normal' : ''}`}
                            >
                              {overdue ? 'Atrasado: ' : 'Prazo: '}
                              {formatTaskDateTimeBahia(t.due_at)}
                            </span>
                          )}
                          <span>• Resp.: {assigneeName}</span>
                        </div>
                      </div>

                      {/* Situação em pílula Badge */}
                      <div className="shrink-0">{getTaskStatusBadge(t)}</div>
                    </div>
                  )
                })}
              </div>

              {/* Paginação de Tarefas */}
              {tasksTotalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTasksPage((p) => Math.max(1, p - 1))}
                    disabled={tasksPage <= 1}
                    className="h-8 text-xs rounded-full font-normal"
                  >
                    Anterior
                  </Button>
                  <span className="text-xs tabular text-muted-foreground">
                    Página {tasksPage} de {tasksTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTasksPage((p) => Math.min(tasksTotalPages, p + 1))}
                    disabled={tasksPage >= tasksTotalPages}
                    className="h-8 text-xs rounded-full font-normal"
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
