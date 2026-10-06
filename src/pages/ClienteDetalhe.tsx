import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  getClientById,
  getClientPrivate,
  ClientRecord,
  ClientPrivateRecord,
  formatErrorMessage,
} from '@/services/clients'
import {
  formatPhoneNumber,
  formatDate,
  maskCpfInput,
  KIND_LABELS,
  CONSENT_STATUS_LABELS,
} from '@/lib/clientUtils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/contexts/AuthContext'
import { CreateVisitModal } from '@/components/agenda/CreateVisitModal'
import { VisitDetailModal, getVisitStatusBadge } from '@/components/agenda/VisitDetailModal'
import { listVisitsByClient, VisitRecord, formatDateTimeBahia } from '@/services/visits'
import { CreateTaskModal } from '@/components/agenda/CreateTaskModal'
import { TaskDetailModal, getTaskStatusBadge } from '@/components/agenda/TaskDetailModal'
import {
  listTasksByClient,
  TaskRecord,
  formatTaskDateTimeBahia,
  isTaskOverdue,
  completeTask,
  extractTaskErrorMessage,
} from '@/services/tasks'
import {
  ArrowLeft,
  Edit,
  User,
  Phone,
  Mail,
  Calendar,
  ShieldCheck,
  Lock,
  Loader2,
  AlertCircle,
  Building2,
  Check,
  Clock,
} from 'lucide-react'

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const role = user?.role || ''
  const isAdmin = role === 'admin'
  const isSdr = role === 'sdr'
  const isCorretor = role === 'corretor'
  const canManageVisits = isAdmin || isSdr

  const [client, setClient] = useState<ClientRecord | null>(null)
  const [clientPrivate, setClientPrivate] = useState<ClientPrivateRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)

  // Visitas do cliente
  const [visits, setVisits] = useState<VisitRecord[]>([])
  const [createVisitModalOpen, setCreateVisitModalOpen] = useState(false)
  const [selectedVisit, setSelectedVisit] = useState<VisitRecord | null>(null)
  const [visitDetailModalOpen, setVisitDetailModalOpen] = useState(false)

  // Tarefas do cliente
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null)
  const [taskDetailModalOpen, setTaskDetailModalOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    setErrorMessage(null)

    Promise.all([
      getClientById(id),
      getClientPrivate(id),
      listVisitsByClient(id).catch(() => [] as VisitRecord[]),
      listTasksByClient(id).catch(() => [] as TaskRecord[]),
    ])
      .then(([clientData, privateData, clientVisits, clientTasks]) => {
        if (!active) return
        setClient(clientData)
        setClientPrivate(privateData)
        setVisits(clientVisits)
        setTasks(clientTasks)
      })
      .catch((err) => {
        if (!active) return
        setErrorMessage(formatErrorMessage(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [id])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-muted-foreground gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Carregando ficha do cliente...</p>
      </div>
    )
  }

  if (errorMessage || !client) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Button variant="ghost" onClick={() => navigate('/clientes')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar para Clientes</span>
        </Button>
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>
            {errorMessage || 'Cliente não encontrado ou você não tem permissão para visualizá-lo.'}
          </span>
        </div>
      </div>
    )
  }

  const respName =
    client.expand?.responsible_id?.name || client.expand?.responsible_id?.email || 'Não atribuído'

  // Regra: O corretor só vê "Criar tarefa" nas telas de cliente dele (responsible_id === user.id)
  const isClientResponsible = isCorretor && client.responsible_id === user?.id
  const canCreateTask = isAdmin || isSdr || isClientResponsible

  const reloadVisitsAndTasks = async () => {
    if (!id) return
    const [vs, ts] = await Promise.all([
      listVisitsByClient(id).catch(() => [] as VisitRecord[]),
      listTasksByClient(id).catch(() => [] as TaskRecord[]),
    ])
    setVisits(vs)
    setTasks(ts)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Banner de sucesso */}
      {successBanner && (
        <Alert className="border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
          <Check className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-sm font-medium flex items-center justify-between">
            <span>{successBanner}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSuccessBanner(null)}
              className="h-6 text-xs"
            >
              Fechar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Barra de Navegação Superior */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/clientes')}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{client.name}</h1>
            </div>
            <p className="text-xs text-muted-foreground">Ficha do cliente</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManageVisits && (
            <Button
              size="sm"
              onClick={() => setCreateVisitModalOpen(true)}
              className="gap-1.5 text-xs bg-primary"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Agendar visita</span>
            </Button>
          )}

          {canCreateTask && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateTaskModalOpen(true)}
              className="gap-1.5 text-xs"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Criar tarefa</span>
            </Button>
          )}

          <Button asChild variant="outline" size="sm" className="gap-2 shrink-0 text-xs">
            <Link to={`/clientes/${client.id}/editar`}>
              <Edit className="h-3.5 w-3.5" />
              <span>Editar</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Cartão de Informações Principais */}
      <Card className="border-border">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <span>Dados de contato e perfil</span>
            </CardTitle>
            <div className="flex flex-wrap gap-1.5">
              {client.kind && client.kind.length > 0 ? (
                client.kind.map((k) => (
                  <Badge key={k} variant="secondary" className="text-xs">
                    {KIND_LABELS[k] || k}
                  </Badge>
                ))
              ) : (
                <Badge variant="outline" className="text-xs">
                  Sem perfil definido
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Nome completo</span>
              <p className="text-sm font-semibold text-foreground">{client.name}</p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Responsável</span>
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{respName}</span>
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Telefone</span>
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{formatPhoneNumber(client.phone)}</span>
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">E-mail</span>
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{client.email || '-'}</span>
              </p>
            </div>
          </div>

          {/* Consentimento LGPD */}
          <div className="pt-6 border-t space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Consentimento LGPD</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/40 border">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Status</span>
                <p className="text-sm font-medium text-foreground">
                  {CONSENT_STATUS_LABELS[client.consent_status] ||
                    client.consent_status ||
                    'Sem informação'}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Data do consentimento</span>
                <p className="text-sm font-medium text-foreground">
                  {formatDate(client.consent_at)}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Canal de autorização</span>
                <p className="text-sm font-medium text-foreground">
                  {client.consent_channel || '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Seção Dados Pessoais (SÓ aparece se a consulta a client_private devolver um registro) */}
          {clientPrivate && (
            <div className="pt-6 border-t space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <Lock className="h-4 w-4 text-amber-500" />
                <span>Dados pessoais</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/40 border">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">CPF</span>
                  <p className="text-sm font-medium font-mono text-foreground">
                    {clientPrivate.cpf ? maskCpfInput(clientPrivate.cpf) : '-'}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Data de nascimento</span>
                  <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{formatDate(clientPrivate.birth_date)}</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SEÇÃO VISITAS DO CLIENTE */}
      <Card className="border-border">
        <CardHeader className="py-3 px-6 border-b flex flex-row items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span>Visitas ({visits.length})</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Visitas agendadas e realizadas para este cliente
            </CardDescription>
          </div>
          {canManageVisits && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreateVisitModalOpen(true)}
              className="text-xs h-8 gap-1"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Agendar visita</span>
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-6">
          {visits.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhuma visita registrada para este cliente.
            </p>
          ) : (
            <div className="divide-y rounded-md border">
              {visits.map((v) => {
                const prop = v.expand?.property_id
                const broker = v.expand?.broker_id
                return (
                  <div
                    key={v.id}
                    onClick={() => {
                      setSelectedVisit(v)
                      setVisitDetailModalOpen(true)
                    }}
                    className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-muted/40 cursor-pointer text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {formatDateTimeBahia(v.start_at)}
                        </span>
                        {getVisitStatusBadge(v.status)}
                      </div>
                      <p className="text-muted-foreground">
                        Imóvel:{' '}
                        <strong className="text-foreground">
                          [{prop?.code || '-'}] {prop?.title || ''}
                        </strong>
                        {broker && (
                          <span>
                            {' '}
                            · Corretor:{' '}
                            <strong className="text-foreground">
                              {broker.name || broker.email}
                            </strong>
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SEÇÃO TAREFAS DO CLIENTE */}
      <Card className="border-border">
        <CardHeader className="py-3 px-6 border-b flex flex-row items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span>Tarefas ({tasks.length})</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Tarefas operacionais vinculadas a este cliente
            </CardDescription>
          </div>
          {canCreateTask && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreateTaskModalOpen(true)}
              className="text-xs h-8 gap-1"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Criar tarefa</span>
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-6">
          {tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhuma tarefa vinculada a este cliente.
            </p>
          ) : (
            <div className="divide-y rounded-md border">
              {tasks.map((t) => {
                const overdue = isTaskOverdue(t)
                const assignee = t.expand?.assigned_to
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      setSelectedTask(t)
                      setTaskDetailModalOpen(true)
                    }}
                    className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-muted/40 cursor-pointer text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{t.title}</span>
                        {getTaskStatusBadge(t)}
                      </div>
                      <p className="text-muted-foreground">
                        Prazo:{' '}
                        <span className={overdue ? 'text-destructive font-bold' : ''}>
                          {formatTaskDateTimeBahia(t.due_at)}
                        </span>
                        {assignee && (
                          <span>
                            {' '}
                            · Responsável:{' '}
                            <strong className="text-foreground">
                              {assignee.name || assignee.email}
                            </strong>
                          </span>
                        )}
                      </p>
                    </div>
                    {t.status === 'aberta' && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          onClick={async () => {
                            try {
                              await completeTask(t.id)
                              if (client) {
                                const freshTasks = await listTasksByClient(client.id)
                                setTasks(freshTasks)
                              }
                            } catch (err) {
                              setErrorMessage(extractTaskErrorMessage(err))
                            }
                          }}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Concluir
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL AGENDAR VISITA */}
      {client && (
        <CreateVisitModal
          open={createVisitModalOpen}
          onOpenChange={setCreateVisitModalOpen}
          fixedTarget={{ client: { id: client.id, name: client.name } }}
          onSuccess={async (status) => {
            setSuccessBanner(
              status === 'agendada' ? 'Visita agendada.' : 'Pedido de visita registrado.',
            )
            await reloadVisitsAndTasks()
          }}
        />
      )}

      {/* MODAL DETALHE DA VISITA */}
      <VisitDetailModal
        visit={selectedVisit}
        open={visitDetailModalOpen}
        onOpenChange={setVisitDetailModalOpen}
        onUpdated={async () => {
          await reloadVisitsAndTasks()
          setVisitDetailModalOpen(false)
        }}
      />

      {/* MODAL CRIAR TAREFA */}
      {client && (
        <CreateTaskModal
          open={createTaskModalOpen}
          onOpenChange={setCreateTaskModalOpen}
          fixedBinding={{ client: { id: client.id, name: client.name } }}
          onCreated={async () => {
            setSuccessBanner('Tarefa criada com sucesso.')
            await reloadVisitsAndTasks()
          }}
        />
      )}

      {/* MODAL DETALHE DA TAREFA */}
      <TaskDetailModal
        task={selectedTask}
        open={taskDetailModalOpen}
        onOpenChange={setTaskDetailModalOpen}
        onUpdated={async () => {
          await reloadVisitsAndTasks()
          setTaskDetailModalOpen(false)
        }}
      />
    </div>
  )
}
