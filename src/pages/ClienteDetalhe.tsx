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
  maskCnpjInput,
  KIND_LABELS,
  PERSON_TYPE_LABELS,
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
  Trash2,
  UserX,
} from 'lucide-react'
import { deleteClient } from '@/services/adminDeletion'
import { DeleteRecordDialog, AnonymizeClientDialog } from '@/components/admin/DeleteRecordDialog'

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

  // Modais de exclusão e anonimização (M15b - só admin)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [anonymizeDialogOpen, setAnonymizeDialogOpen] = useState(false)

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
        <Alert className="border-success/30 bg-success/10 text-success">
          <Check className="h-4 w-4 text-success" />
          <AlertDescription className="text-sm font-medium flex items-center justify-between text-foreground">
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
          <button
            type="button"
            onClick={() => navigate('/clientes')}
            className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted shrink-0 text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="display-sm text-foreground">{client.name}</h1>
            </div>
            <p className="text-xs text-muted-foreground">Ficha do cliente</p>
          </div>
        </div>

        {/* Ações como pílulas, uma só preenchida (Editar) */}
        <div className="flex flex-wrap items-center gap-2">
          {canManageVisits && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateVisitModalOpen(true)}
              className="h-9 rounded-full px-4 text-xs font-normal border-border gap-1.5"
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
              className="h-9 rounded-full px-4 text-xs font-normal border-border gap-1.5"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Criar tarefa</span>
            </Button>
          )}

          <Button
            asChild
            size="sm"
            className="h-9 rounded-full px-5 text-xs font-medium bg-primary text-primary-foreground gap-1.5"
          >
            <Link to={`/clientes/${client.id}/editar`}>
              <Edit className="h-3.5 w-3.5" />
              <span>Editar</span>
            </Link>
          </Button>

          {isAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAnonymizeDialogOpen(true)}
                className="h-9 rounded-full px-4 text-xs font-normal border-border gap-1.5"
              >
                <UserX className="h-3.5 w-3.5" />
                <span>Anonimizar</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
                className="h-9 rounded-full px-4 text-xs font-normal border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Excluir</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Cartão de Informações Principais (8px borda 1px sem sombra, dados em linhas rótulo/valor com rótulo em .eyebrow) */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div className="eyebrow text-muted-foreground flex items-center gap-2">
            <User className="h-3.5 w-3.5" />
            <span>Dados de contato e perfil</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {client.kind && client.kind.length > 0 ? (
              client.kind.map((k) => (
                <Badge key={k} variant="default" className="text-xs">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="space-y-1">
            <span className="eyebrow text-muted-foreground block">Tipo de pessoa</span>
            <p className="text-sm font-normal text-foreground">
              {PERSON_TYPE_LABELS[client.person_type || 'fisica'] || 'Pessoa física'}
            </p>
          </div>

          <div className="space-y-1">
            <span className="eyebrow text-muted-foreground block">
              {client.person_type === 'juridica' ? 'Contato / Representante' : 'Nome completo'}
            </span>
            <p className="text-sm font-normal text-foreground">{client.name}</p>
          </div>

          {client.person_type === 'juridica' && client.company_name && (
            <div className="space-y-1">
              <span className="eyebrow text-muted-foreground block">Razão social</span>
              <p className="text-sm font-normal text-foreground">{client.company_name}</p>
            </div>
          )}

          <div className="space-y-1">
            <span className="eyebrow text-muted-foreground block">Telefone</span>
            <p className="dado text-foreground flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{formatPhoneNumber(client.phone)}</span>
            </p>
          </div>

          <div className="space-y-1">
            <span className="eyebrow text-muted-foreground block">E-mail</span>
            <p className="text-sm font-normal text-foreground flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate">{client.email || '—'}</span>
            </p>
          </div>

          <div className="space-y-1">
            <span className="eyebrow text-muted-foreground block">Responsável</span>
            <p className="text-sm font-normal text-foreground flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{respName}</span>
            </p>
          </div>
        </div>

        {/* Consentimento LGPD */}
        <div className="pt-4 border-t border-border space-y-3">
          <div className="eyebrow text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Consentimento LGPD</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3.5 rounded-lg bg-muted/20 border border-border text-xs">
            <div className="space-y-1">
              <span className="eyebrow text-muted-foreground block">Status</span>
              <p className="text-foreground">
                {CONSENT_STATUS_LABELS[client.consent_status] ||
                  client.consent_status ||
                  'Sem informação'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="eyebrow text-muted-foreground block">Data do consentimento</span>
              <p className="dado text-foreground">{formatDate(client.consent_at)}</p>
            </div>

            <div className="space-y-1">
              <span className="eyebrow text-muted-foreground block">Canal de autorização</span>
              <p className="text-foreground">{client.consent_channel || '—'}</p>
            </div>
          </div>
        </div>

        {/* Seção Dados Pessoais e Fiscais Confidenciais (client_private) */}
        {clientPrivate && (
          <div className="pt-4 border-t border-border space-y-3">
            <div className="eyebrow text-muted-foreground flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-attention" />
              <span>Dados confidenciais</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-3.5 rounded-lg bg-muted/20 border border-border text-xs">
              {client.person_type === 'juridica' && clientPrivate.cnpj && (
                <div className="space-y-1">
                  <span className="eyebrow text-muted-foreground block">CNPJ</span>
                  <p className="dado text-foreground">{maskCnpjInput(clientPrivate.cnpj)}</p>
                </div>
              )}

              <div className="space-y-1">
                <span className="eyebrow text-muted-foreground block">
                  {client.person_type === 'juridica' ? 'CPF do responsável' : 'CPF'}
                </span>
                <p className="dado text-foreground">
                  {clientPrivate.cpf ? maskCpfInput(clientPrivate.cpf) : '—'}
                </p>
              </div>

              {clientPrivate.rg && (
                <div className="space-y-1">
                  <span className="eyebrow text-muted-foreground block">RG</span>
                  <p className="dado text-foreground">{clientPrivate.rg}</p>
                </div>
              )}

              {clientPrivate.birth_date && (
                <div className="space-y-1">
                  <span className="eyebrow text-muted-foreground block">Data de nascimento</span>
                  <p className="dado text-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{formatDate(clientPrivate.birth_date)}</span>
                  </p>
                </div>
              )}

              {clientPrivate.address && (
                <div className="sm:col-span-2 lg:col-span-3 space-y-1">
                  <span className="eyebrow text-muted-foreground block">Endereço</span>
                  <p className="text-foreground">{clientPrivate.address}</p>
                </div>
              )}

              {clientPrivate.bank_details && (
                <div className="sm:col-span-2 lg:col-span-3 space-y-1">
                  <span className="eyebrow text-muted-foreground block">Dados bancários</span>
                  <p className="text-foreground whitespace-pre-wrap">
                    {clientPrivate.bank_details}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* SEÇÃO VISITAS DO CLIENTE */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="eyebrow text-muted-foreground flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            <span>Visitas ({visits.length})</span>
          </div>
          {canManageVisits && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreateVisitModalOpen(true)}
              className="h-8 rounded-full px-3 text-xs font-normal border-border gap-1"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Agendar</span>
            </Button>
          )}
        </div>

        {visits.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhuma visita registrada para este cliente.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
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
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-muted/40 cursor-pointer text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="dado text-foreground">
                        {formatDateTimeBahia(v.start_at)}
                      </span>
                      {getVisitStatusBadge(v.status)}
                    </div>
                    <p className="text-muted-foreground">
                      Imóvel: [<span className="dado">{prop?.code || '-'}</span>]{' '}
                      {prop?.title || ''}
                      {broker && <span> · Corretor: {broker.name || broker.email}</span>}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* SEÇÃO TAREFAS DO CLIENTE */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="eyebrow text-muted-foreground flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            <span>Tarefas ({tasks.length})</span>
          </div>
          {canCreateTask && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreateTaskModalOpen(true)}
              className="h-8 rounded-full px-3 text-xs font-normal border-border gap-1"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Criar tarefa</span>
            </Button>
          )}
        </div>

        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhuma tarefa vinculada a este cliente.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
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
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-muted/40 cursor-pointer text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground">{t.title}</span>
                      {getTaskStatusBadge(t)}
                    </div>
                    <p className="text-muted-foreground">
                      Prazo:{' '}
                      <span className={overdue ? 'text-attention font-normal dado' : 'dado'}>
                        {overdue && 'Atrasado: '}
                        {formatTaskDateTimeBahia(t.due_at)}
                      </span>
                      {assignee && <span> · Responsável: {assignee.name || assignee.email}</span>}
                    </p>
                  </div>
                  {t.status === 'aberta' && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs rounded-full px-3 border-border"
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
      </div>

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

      {/* MODAL M15b: EXCLUSÃO DE CLIENTE */}
      {client && isAdmin && (
        <DeleteRecordDialog
          type="cliente"
          recordId={client.id}
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onDelete={async () => {
            await deleteClient(client.id)
          }}
          onDeleted={() => {
            navigate('/clientes', { state: { successMessage: 'Cliente excluído.' } })
          }}
          onAnonymized={async () => {
            setSuccessBanner('Cliente anonimizado.')
            if (id) {
              const [c, cp] = await Promise.all([
                getClientById(id),
                getClientPrivate(id).catch(() => null),
              ])
              setClient(c)
              setClientPrivate(cp)
            }
          }}
        />
      )}

      {/* MODAL M15b: ANONIMIZAÇÃO DIRETA DE CLIENTE */}
      {client && isAdmin && (
        <AnonymizeClientDialog
          clientId={client.id}
          open={anonymizeDialogOpen}
          onOpenChange={setAnonymizeDialogOpen}
          onAnonymized={async () => {
            setSuccessBanner('Cliente anonimizado.')
            if (id) {
              const [c, cp] = await Promise.all([
                getClientById(id),
                getClientPrivate(id).catch(() => null),
              ])
              setClient(c)
              setClientPrivate(cp)
            }
          }}
        />
      )}
    </div>
  )
}
