import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import {
  getLeadById,
  updateLeadAssignment,
  updateLeadStage,
  updateLeadNextStep,
  listLeadEvents,
  createLeadEvent,
  listEligibleLeadAssignees,
  LeadRecord,
  LeadEventRecord,
  LeadStage,
  LostReason,
  LeadUserRecord,
  LEAD_STAGE_LABELS,
  LEAD_ORIGIN_LABELS,
  LOST_REASON_LABELS,
  LEAD_EVENT_TYPE_LABELS,
  formatLeadErrorMessage,
} from '@/services/leads'
import { formatDateTimeBR, isLeadNextStepOverdue } from '@/pages/Leads'
import { formatPhoneNumber, CONSENT_STATUS_LABELS } from '@/lib/clientUtils'
import { useAuth } from '@/contexts/AuthContext'
import { EditLeadModal } from '@/components/leads/EditLeadModal'
import { SendFichaModal } from '@/components/leads/SendFichaModal'
import { ConvertLeadModal } from '@/components/leads/ConvertLeadModal'
import { CorrectOriginModal } from '@/components/leads/CorrectOriginModal'
import { CreateVisitModal } from '@/components/agenda/CreateVisitModal'
import { VisitDetailModal, getVisitStatusBadge } from '@/components/agenda/VisitDetailModal'
import { listVisitsByLead, VisitRecord, formatDateTimeBahia } from '@/services/visits'
import { CreateTaskModal } from '@/components/agenda/CreateTaskModal'
import { TaskDetailModal, getTaskStatusBadge } from '@/components/agenda/TaskDetailModal'
import {
  listTasksByLead,
  TaskRecord,
  formatTaskDateTimeBahia,
  isTaskOverdue,
  completeTask,
  extractTaskErrorMessage,
} from '@/services/tasks'
import { LeadNegotiationTab } from '@/components/negotiations/LeadNegotiationTab'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  ArrowLeft,
  Phone,
  Mail,
  Copy,
  Check,
  ExternalLink,
  Edit,
  Send,
  UserCheck,
  User,
  Clock,
  AlertCircle,
  Loader2,
  Calendar,
  Building,
  FileText,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react'

export default function LeadDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const [lead, setLead] = useState<LeadRecord | null>(null)
  const [events, setEvents] = useState<LeadEventRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)

  // Acesso negado específico (404 para corretor ou sem permissão)
  const [accessDenied, setAccessDenied] = useState(false)

  // Usuários elegíveis para atribuição
  const [assignees, setAssignees] = useState<LeadUserRecord[]>([])

  // Modais
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [sendFichaModalOpen, setSendFichaModalOpen] = useState(false)
  const [convertModalOpen, setConvertModalOpen] = useState(false)
  const [correctOriginModalOpen, setCorrectOriginModalOpen] = useState(false)
  const [createVisitModalOpen, setCreateVisitModalOpen] = useState(false)
  const [selectedVisit, setSelectedVisit] = useState<VisitRecord | null>(null)
  const [visitDetailModalOpen, setVisitDetailModalOpen] = useState(false)
  const [visits, setVisits] = useState<VisitRecord[]>([])
  const [loadingVisits, setLoadingVisits] = useState(false)

  // Tarefas vinculadas ao lead
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null)
  const [taskDetailModalOpen, setTaskDetailModalOpen] = useState(false)
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)

  // Próximo passo local state
  const [nextStepText, setNextStepText] = useState('')
  const [nextStepDueDate, setNextStepDueDate] = useState('')
  const [savingNextStep, setSavingNextStep] = useState(false)

  // Registro de notas e contatos
  const [noteContactText, setNoteContactText] = useState('')
  const [submittingNote, setSubmittingNote] = useState(false)
  const [submittingContact, setSubmittingContact] = useState(false)

  // Mudança de etapa: diálogo de motivo para perdido
  const [lostReasonDialogOpen, setLostReasonDialogOpen] = useState(false)
  const [selectedLostReason, setSelectedLostReason] = useState<LostReason | ''>('')
  const [savingStage, setSavingStage] = useState(false)

  // Copiar telefone
  const [copiedPhone, setCopiedPhone] = useState(false)

  // Controle de abas da página (Geral vs Negociação)
  const [activeTab, setActiveTab] = useState<'geral' | 'negociacao'>('geral')

  const isCorretor = user?.role === 'corretor'
  const isAdmin = user?.role === 'admin'
  const isSdr = user?.role === 'sdr'
  const canManageLeads = isAdmin || isSdr
  // Permissão geral de negociação e visualização da aba: admin, SDR e o corretor responsável pelo lead
  const isAssignedCorretor = isCorretor && lead?.assigned_to === user?.id
  const canSeeNegotiationTab = isAdmin || isSdr || isAssignedCorretor
  // Permissão geral de edição de estágio, próximo passo e eventos: admin, SDR e o corretor do lead
  const canOperateLead = canManageLeads || isAssignedCorretor

  // Verifica mensagem vinda do state de navegação (ex.: "Lead cadastrado.")
  useEffect(() => {
    if (location.state && (location.state as { message?: string }).message) {
      setSuccessBanner((location.state as { message: string }).message)
    }
  }, [location.state])

  // Carrega lead e linha do tempo
  const loadData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setErrorMessage(null)
    setAccessDenied(false)

    try {
      const leadData = await getLeadById(id)
      setLead(leadData)
      setNextStepText(leadData.next_step || '')
      setNextStepDueDate(leadData.next_step_due ? leadData.next_step_due.substring(0, 16) : '')

      // Carrega eventos
      const eventsData = await listLeadEvents(id)
      setEvents(eventsData)

      // Carrega visitas do lead
      listVisitsByLead(id)
        .then(setVisits)
        .catch(() => {})

      // Carrega tarefas do lead
      listTasksByLead(id)
        .then(setTasks)
        .catch(() => {})
    } catch (err: unknown) {
      // Se a leitura do lead voltar 404 para o corretor logado:
      // mostre "Você não tem acesso a este lead." e leve para /leads
      setAccessDenied(true)
      setErrorMessage(formatLeadErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Carrega usuários elegíveis para atribuição (só admin e SDR)
  useEffect(() => {
    if (canManageLeads) {
      listEligibleLeadAssignees()
        .then(setAssignees)
        .catch(() => {
          // ignore
        })
    }
  }, [canManageLeads])

  const handleCopyPhone = async () => {
    if (!lead?.phone) return
    try {
      await navigator.clipboard.writeText(lead.phone)
      setCopiedPhone(true)
      setTimeout(() => setCopiedPhone(false), 2000)
    } catch {
      // ignore
    }
  }

  // Atribuição (só admin e SDR)
  const handleAssignChange = async (newAssignee: string) => {
    if (!lead) return
    const target = newAssignee === 'unassigned' ? null : newAssignee
    try {
      setErrorMessage(null)
      const updated = await updateLeadAssignment(lead.id, target)
      setLead(updated)
      const evs = await listLeadEvents(lead.id)
      setEvents(evs)
    } catch (err) {
      setErrorMessage(formatLeadErrorMessage(err))
      // Se deu 404 para corretor anterior que perdeu o acesso:
      if (isCorretor) {
        setAccessDenied(true)
      }
    }
  }

  // Mudança de etapa
  const handleStageSelect = async (newStage: LeadStage) => {
    if (!lead) return
    if (newStage === lead.stage) return

    if (newStage === 'perdido') {
      setSelectedLostReason('')
      setLostReasonDialogOpen(true)
      return
    }

    setSavingStage(true)
    setErrorMessage(null)
    try {
      const updated = await updateLeadStage(lead.id, newStage)
      setLead(updated)
      const evs = await listLeadEvents(lead.id)
      setEvents(evs)
    } catch (err) {
      setErrorMessage(formatLeadErrorMessage(err))
    } finally {
      setSavingStage(false)
    }
  }

  // Confirmar perda com motivo
  const handleConfirmLost = async () => {
    if (!lead || !selectedLostReason) {
      setErrorMessage('Informe o motivo da perda.')
      return
    }

    setSavingStage(true)
    setErrorMessage(null)
    try {
      const updated = await updateLeadStage(lead.id, 'perdido', selectedLostReason)
      setLead(updated)
      setLostReasonDialogOpen(false)
      const evs = await listLeadEvents(lead.id)
      setEvents(evs)
    } catch (err) {
      setErrorMessage(formatLeadErrorMessage(err))
    } finally {
      setSavingStage(false)
    }
  }

  // Salvar Próximo Passo
  const handleSaveNextStep = async () => {
    if (!lead) return
    setSavingNextStep(true)
    setErrorMessage(null)
    try {
      const dueIso = nextStepDueDate ? new Date(nextStepDueDate).toISOString() : ''
      const updated = await updateLeadNextStep(lead.id, nextStepText, dueIso)
      setLead(updated)
      const evs = await listLeadEvents(lead.id)
      setEvents(evs)
    } catch (err) {
      setErrorMessage(formatLeadErrorMessage(err))
    } finally {
      setSavingNextStep(false)
    }
  }

  // Registrar Nota ou Contato
  const handleCreateEvent = async (type: 'nota' | 'contato') => {
    if (!lead || !user?.organization_id) return
    if (!noteContactText.trim()) {
      setErrorMessage('Escreva o texto do registro.')
      return
    }

    if (type === 'nota') setSubmittingNote(true)
    else setSubmittingContact(true)

    setErrorMessage(null)
    try {
      await createLeadEvent(lead.id, type, noteContactText.trim(), user.organization_id)
      setNoteContactText('')

      // Depois de registrar, atualize a linha do tempo e o cabeçalho
      const freshLead = await getLeadById(lead.id)
      setLead(freshLead)
      const evs = await listLeadEvents(lead.id)
      setEvents(evs)
    } catch (err) {
      setErrorMessage(formatLeadErrorMessage(err))
    } finally {
      setSubmittingNote(false)
      setSubmittingContact(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-muted-foreground gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Carregando dados do lead...</p>
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div className="max-w-md mx-auto my-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Você não tem acesso a este lead.</h2>
        <p className="text-sm text-muted-foreground">
          Este lead pode ter sido reatribuído ou não pertence à sua carteira.
        </p>
        <Button onClick={() => navigate('/leads')} className="mt-2">
          Voltar para Leads
        </Button>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="max-w-md mx-auto my-12 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
        <h2 className="text-lg font-semibold">Lead não encontrado</h2>
        <Button onClick={() => navigate('/leads')}>Voltar para Leads</Button>
      </div>
    )
  }

  const isOverdue = isLeadNextStepOverdue(lead)
  const assigneeName =
    lead.expand?.assigned_to?.name || lead.expand?.assigned_to?.email || 'Sem dono'
  const interestProperty = lead.expand?.property_id
  const clientLinked = lead.expand?.client_id

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Botão voltar e breadcrumb */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/leads')}
            className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted shrink-0 text-foreground"
            title="Voltar para lista de leads"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground truncate">Leads / {lead.name}</span>
        </div>

        {/* Botões de Ação Superiores no Desktop */}
        <div className="hidden md:flex flex-wrap items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCorrectOriginModalOpen(true)}
              className="h-9 rounded-full px-4 text-xs font-normal border-border gap-1.5"
            >
              <Edit className="h-3.5 w-3.5" />
              <span>Corrigir origem</span>
            </Button>
          )}

          {canManageLeads && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditModalOpen(true)}
              className="h-9 rounded-full px-4 text-xs font-normal border-border gap-1.5"
            >
              <Edit className="h-3.5 w-3.5" />
              <span>Editar dados</span>
            </Button>
          )}

          {canOperateLead && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSendFichaModalOpen(true)}
              className="h-9 rounded-full px-4 text-xs font-normal border-border gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Enviar ficha de imóvel</span>
            </Button>
          )}

          {canOperateLead && !lead.client_id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConvertModalOpen(true)}
              className="h-9 rounded-full px-4 text-xs font-normal border-border gap-1.5"
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>Converter em cliente</span>
            </Button>
          )}

          {canManageLeads && (
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

          {canOperateLead && (
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
        </div>
      </div>

      {/* No celular: fileira rolante de ações logo abaixo do cabeçalho */}
      <div className="md:hidden flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCorrectOriginModalOpen(true)}
            className="h-9 rounded-full px-3.5 text-xs font-normal border-border shrink-0"
          >
            <span>Corrigir origem</span>
          </Button>
        )}
        {canManageLeads && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditModalOpen(true)}
            className="h-9 rounded-full px-3.5 text-xs font-normal border-border shrink-0"
          >
            <span>Editar</span>
          </Button>
        )}
        {canOperateLead && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSendFichaModalOpen(true)}
            className="h-9 rounded-full px-3.5 text-xs font-normal border-border shrink-0"
          >
            <span>Enviar ficha de imóvel</span>
          </Button>
        )}
        {canOperateLead && !lead.client_id && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConvertModalOpen(true)}
            className="h-9 rounded-full px-3.5 text-xs font-normal border-border shrink-0"
          >
            <span>Converter em cliente</span>
          </Button>
        )}
        {canManageLeads && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateVisitModalOpen(true)}
            className="h-9 rounded-full px-3.5 text-xs font-normal border-border shrink-0"
          >
            <span>Agendar visita</span>
          </Button>
        )}
        {canOperateLead && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateTaskModalOpen(true)}
            className="h-9 rounded-full px-3.5 text-xs font-normal border-border shrink-0"
          >
            <span>Criar tarefa</span>
          </Button>
        )}
      </div>

      {/* Banner de sucesso */}
      {successBanner && (
        <Alert className="border border-border bg-muted/40 text-foreground">
          <Check className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm font-medium">{successBanner}</AlertDescription>
        </Alert>
      )}

      {/* Erros operacionais */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* CABEÇALHO DO LEAD: nome em .display-sm, etapa em pílula, badges de duplicidade e cliente */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="display-sm text-foreground">{lead.name}</h1>
              <Badge
                variant={
                  lead.stage === 'ganho'
                    ? 'success'
                    : lead.stage === 'perdido'
                      ? 'destructive'
                      : lead.stage === 'visita_marcada' || lead.stage === 'novo'
                        ? 'info'
                        : 'default'
                }
                className="text-xs"
              >
                {LEAD_STAGE_LABELS[lead.stage] || lead.stage}
              </Badge>
              {lead.client_id && (
                <Badge variant="default" className="text-xs">
                  Já é cliente
                </Badge>
              )}
              {lead.dedupe_status === 'pendente' && (
                <Badge variant="attention" className="text-xs">
                  Pendência de duplicidade
                </Badge>
              )}
            </div>

            {/* Telefone com ações Copiar e WhatsApp em pílulas */}
            {lead.phone && (
              <div className="flex items-center gap-2 pt-1 text-xs">
                <span className="tabular text-foreground">{formatPhoneNumber(lead.phone)}</span>
                <button
                  type="button"
                  onClick={handleCopyPhone}
                  className="h-7 px-3 rounded-full border border-border text-[11px] text-foreground hover:bg-muted inline-flex items-center gap-1"
                >
                  {copiedPhone ? (
                    <Check className="h-3 w-3 text-success" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{copiedPhone ? 'Copiado' : 'Copiar'}</span>
                </button>
                <a
                  href={`https://wa.me/${lead.phone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-7 px-3 rounded-full border border-border text-[11px] text-foreground hover:bg-muted inline-flex items-center gap-1"
                >
                  <Phone className="h-3 w-3" />
                  <span>WhatsApp</span>
                </a>
              </div>
            )}

            {/* Informação do cliente já ligado */}
            {lead.client_id && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                <span>Cliente:</span>
                <Link
                  to={`/clientes/${lead.client_id}`}
                  className="text-primary underline inline-flex items-center gap-1"
                >
                  <span>{clientLinked?.name || 'Ver cliente'}</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}

            {/* Se estiver Perdido, mostra o motivo */}
            {lead.stage === 'perdido' && lead.lost_reason && (
              <div className="text-xs text-destructive font-normal flex items-center gap-1 pt-0.5">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>
                  Motivo da perda: {LOST_REASON_LABELS[lead.lost_reason] || lead.lost_reason}
                </span>
              </div>
            )}
          </div>

          {/* Atribuição e etapa em campos de 48px */}
          <div className="flex flex-wrap items-center gap-2">
            {canOperateLead && (
              <div className="space-y-1">
                <span className="eyebrow text-muted-foreground block">Etapa</span>
                <Select
                  value={lead.stage}
                  onValueChange={(val) => handleStageSelect(val as LeadStage)}
                  disabled={savingStage}
                >
                  <SelectTrigger className="w-[170px] h-12 rounded-lg border-border bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="novo">Novo</SelectItem>
                    <SelectItem value="em_atendimento">Em atendimento</SelectItem>
                    <SelectItem value="visita_marcada">Visita marcada</SelectItem>
                    <SelectItem value="proposta">Proposta</SelectItem>
                    <SelectItem value="ganho">Ganho</SelectItem>
                    <SelectItem value="perdido">Perdido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {canManageLeads && (
              <div className="space-y-1">
                <span className="eyebrow text-muted-foreground block">Atribuído</span>
                <Select value={lead.assigned_to || 'unassigned'} onValueChange={handleAssignChange}>
                  <SelectTrigger className="w-[180px] h-12 rounded-lg border-border bg-background">
                    <SelectValue placeholder="Selecione o responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Sem dono</SelectItem>
                    {assignees.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email || 'Usuário'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* Metadados: dados e imóvel de interesse */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="space-y-1">
            <span className="eyebrow text-muted-foreground block">E-mail</span>
            <span className="text-foreground truncate block">{lead.email || '—'}</span>
          </div>

          <div className="space-y-1">
            <span className="eyebrow text-muted-foreground block">Origem</span>
            <span className="text-foreground">
              {LEAD_ORIGIN_LABELS[lead.origin] || lead.origin}
              {lead.origin_detail ? ` (${lead.origin_detail})` : ''}
            </span>
          </div>

          <div className="space-y-1">
            <span className="eyebrow text-muted-foreground block">Consentimento</span>
            <span className="text-foreground">
              {CONSENT_STATUS_LABELS[lead.consent_status] || 'Sem informação'}
            </span>
          </div>

          <div className="space-y-1">
            <span className="eyebrow text-muted-foreground block">Último contato</span>
            <span className="text-muted-foreground tabular">
              {lead.last_contact_at ? formatDateTimeBR(lead.last_contact_at) : 'Nenhum contato'}
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="space-y-1 sm:col-span-2">
            <span className="eyebrow text-muted-foreground block">Imóvel de interesse</span>
            {interestProperty ? (
              <Link
                to={`/imoveis/${interestProperty.id}`}
                className="text-primary underline inline-flex items-center gap-1.5"
              >
                <Building className="h-3.5 w-3.5" />
                <span>
                  [{interestProperty.code}] {interestProperty.title}
                </span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            ) : (
              <span className="text-muted-foreground">Nenhum imóvel vinculado</span>
            )}
          </div>

          <div className="space-y-1">
            <span className="eyebrow text-muted-foreground block">Atribuído a</span>
            <span className="text-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              {assigneeName}
            </span>
          </div>
        </div>
      </div>

      {/* ABAS DO CARTÃO DO LEAD: GERAL E NEGOCIAÇÃO */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'geral' | 'negociacao')}
        className="w-full space-y-6"
      >
        <div className="flex items-center justify-between border-b border-border pb-2">
          <TabsList className="h-auto p-1 bg-muted/40 border border-border rounded-full inline-flex gap-1 flex-wrap">
            <TabsTrigger
              value="geral"
              className="rounded-full px-4 py-1.5 text-xs font-normal data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Visão geral
            </TabsTrigger>
            {canSeeNegotiationTab && (
              <TabsTrigger
                value="negociacao"
                className="rounded-full px-4 py-1.5 text-xs font-normal data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Negociação
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* ABA 1: VISÃO GERAL */}
        <TabsContent value="geral" className="space-y-6 m-0">
          {/* PERFIL DE BUSCA (quando preenchido) */}
          {(lead.search_neighborhood ||
            lead.search_neighborhoods ||
            lead.search_type ||
            (lead.search_bedrooms && lead.search_bedrooms > 0) ||
            (lead.search_min_price && lead.search_min_price > 0) ||
            (lead.search_max_price && lead.search_max_price > 0)) && (
            <div className="rounded-lg border border-border bg-card p-5 space-y-3">
              <div className="eyebrow text-muted-foreground flex items-center gap-2">
                <Building className="h-3.5 w-3.5" />
                <span>Perfil de Busca</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                {(lead.search_neighborhoods || lead.search_neighborhood) && (
                  <div>
                    <span className="eyebrow text-muted-foreground block">
                      Bairros de interesse
                    </span>
                    {lead.search_neighborhoods ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {lead.search_neighborhoods
                          .split(';')
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .map((b, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-0.5 rounded-full border border-border bg-muted/40 text-[11px] text-foreground"
                            >
                              {b}
                            </span>
                          ))}
                      </div>
                    ) : (
                      <span className="text-foreground">{lead.search_neighborhood}</span>
                    )}
                  </div>
                )}
                {lead.search_type && (
                  <div>
                    <span className="eyebrow text-muted-foreground block">Tipo</span>
                    <span className="text-foreground capitalize">{lead.search_type}</span>
                  </div>
                )}
                {typeof lead.search_bedrooms === 'number' && lead.search_bedrooms > 0 && (
                  <div>
                    <span className="eyebrow text-muted-foreground block">Quartos mínimos</span>
                    <span className="text-foreground tabular">{lead.search_bedrooms}</span>
                  </div>
                )}
                {((typeof lead.search_min_price === 'number' && lead.search_min_price > 0) ||
                  (typeof lead.search_max_price === 'number' && lead.search_max_price > 0)) && (
                  <div>
                    <span className="eyebrow text-muted-foreground block">
                      Faixa de valor: de ... até ...
                    </span>
                    <span className="text-foreground tabular font-normal">
                      {lead.search_min_price && lead.search_min_price > 0
                        ? new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(lead.search_min_price)
                        : 'R$ 0,00'}{' '}
                      até{' '}
                      {lead.search_max_price && lead.search_max_price > 0
                        ? new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(lead.search_max_price)
                        : 'sem limite'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* OBSERVAÇÕES DO LEAD (quando preenchido) */}
          {lead.notes && (
            <div className="rounded-lg border border-border bg-card p-5 space-y-2">
              <div className="eyebrow text-muted-foreground flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" />
                <span>Observações do Lead</span>
              </div>
              <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                {lead.notes}
              </p>
            </div>
          )}

          {/* PRÓXIMO PASSO E PRAZO */}
          {canOperateLead && (
            <div className="rounded-lg border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="eyebrow text-muted-foreground flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Próximo Passo e Prazo</span>
                </div>
                {lead.next_step_due && (
                  <div
                    className={`text-xs tabular ${
                      isOverdue ? 'text-attention font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    {isOverdue && 'Atrasado: '}
                    {formatDateTimeBR(lead.next_step_due)}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label
                    htmlFor="next-step-input"
                    className="text-[13px] font-normal text-foreground block"
                  >
                    Ação a ser executada
                  </label>
                  <input
                    id="next-step-input"
                    placeholder="Ex.: Ligar para agendar visita"
                    value={nextStepText}
                    onChange={(e) => setNextStepText(e.target.value)}
                    maxLength={200}
                    className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="next-step-due-input"
                    className="text-[13px] font-normal text-foreground block"
                  >
                    Prazo (data e hora)
                  </label>
                  <input
                    id="next-step-due-input"
                    type="datetime-local"
                    value={nextStepDueDate}
                    onChange={(e) => setNextStepDueDate(e.target.value)}
                    className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring tabular"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  onClick={handleSaveNextStep}
                  disabled={savingNextStep}
                  className="h-9 rounded-full px-4 text-xs font-normal border-border"
                  variant="outline"
                >
                  {savingNextStep && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  <span>Salvar próximo passo</span>
                </Button>
              </div>
            </div>
          )}

          {/* NOTAS E CONTATOS COM CAMPO GRANDE E DUAS PÍLULAS */}
          {canOperateLead && (
            <div className="rounded-lg border border-border bg-card p-5 space-y-3">
              <div className="eyebrow text-muted-foreground flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Notas e Contatos</span>
              </div>
              <Textarea
                placeholder="Digite sua nota ou detalhes do contato realizado..."
                value={noteContactText}
                onChange={(e) => setNoteContactText(e.target.value)}
                rows={4}
                className="text-xs rounded-lg border-border bg-background"
              />
              <div className="flex justify-end items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCreateEvent('nota')}
                  disabled={submittingNote || submittingContact || !noteContactText.trim()}
                  className="h-9 rounded-full px-4 text-xs font-normal border-border gap-1.5"
                >
                  {submittingNote && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  <FileText className="h-3.5 w-3.5" />
                  <span>Registrar nota</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCreateEvent('contato')}
                  disabled={submittingNote || submittingContact || !noteContactText.trim()}
                  className="h-9 rounded-full px-4 text-xs font-normal border-border gap-1.5"
                >
                  {submittingContact && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  <Phone className="h-3.5 w-3.5" />
                  <span>Registrar contato</span>
                </Button>
              </div>
            </div>
          )}

          {/* SEÇÃO VISITAS DO LEAD */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="eyebrow text-muted-foreground flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                <span>Visitas ({visits.length})</span>
              </div>
              {canManageLeads && (
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
                Nenhuma visita registrada para este lead.
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
                          <span className="tabular text-foreground">
                            {formatDateTimeBahia(v.start_at)}
                          </span>
                          {getVisitStatusBadge(v.status)}
                        </div>
                        <p className="text-muted-foreground">
                          Imóvel: [{prop?.code || '-'}] {prop?.title || ''}
                          {broker && <span> · Corretor: {broker.name || broker.email}</span>}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* SEÇÃO TAREFAS DO LEAD */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="eyebrow text-muted-foreground flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                <span>Tarefas ({tasks.length})</span>
              </div>
              {canOperateLead && (
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
                Nenhuma tarefa vinculada a este lead.
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
                        <p className="text-muted-foreground tabular">
                          Prazo:{' '}
                          <span className={overdue ? 'text-attention font-medium' : ''}>
                            {overdue && 'Atrasado: '}
                            {formatTaskDateTimeBahia(t.due_at)}
                          </span>
                          {assignee && (
                            <span> · Responsável: {assignee.name || assignee.email}</span>
                          )}
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
                                if (lead) {
                                  const freshTasks = await listTasksByLead(lead.id)
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

          {/* LINHA DO TEMPO: lista vertical com traço fino à esquerda, horário em .eyebrow e .tabular (dd/mm hh:mm) e o texto ao lado, do mais novo ao mais antigo */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-[20px] font-normal text-foreground">Linha do Tempo</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Histórico de eventos, alterações e contatos, do mais recente ao mais antigo.
              </p>
            </div>

            {events.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                Nenhum evento registrado nesta linha do tempo.
              </div>
            ) : (
              <div className="relative pl-5 space-y-5 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-px before:bg-border">
                {events.map((ev) => {
                  const authorName =
                    ev.expand?.author_id?.name || ev.expand?.author_id?.email || 'Sistema'
                  const typeLabel = LEAD_EVENT_TYPE_LABELS[ev.type] || ev.type

                  return (
                    <div key={ev.id} className="relative group">
                      <div className="absolute -left-[18px] top-1.5 h-2 w-2 rounded-full bg-foreground ring-4 ring-background" />
                      <div className="space-y-1 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="eyebrow tabular text-muted-foreground">
                            {formatDateTimeBR(ev.occurred_at || ev.created)}
                          </span>
                          <Badge variant="default" className="text-[10px] px-1.5 py-0">
                            {typeLabel}
                          </Badge>
                          <span className="text-muted-foreground">por {authorName}</span>
                        </div>
                        <div className="text-foreground p-3 rounded-lg border border-border bg-muted/20">
                          {ev.text}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ABA 2: NEGOCIAÇÃO */}
        {canSeeNegotiationTab && (
          <TabsContent value="negociacao" className="m-0">
            <LeadNegotiationTab
              leadId={lead.id}
              defaultPropertyId={lead.property_id || undefined}
              currentUserRole={user?.role}
              currentUserId={user?.id}
              assignedToId={lead.assigned_to || undefined}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* DIÁLOGO: Motivo de perda (ao mudar etapa para perdido) */}
      <Dialog open={lostReasonDialogOpen} onOpenChange={setLostReasonDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar lead como perdido</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <span className="text-xs text-muted-foreground">
              Selecione o motivo do encerramento desta oportunidade:
            </span>

            <div className="space-y-2">
              <Label htmlFor="lost-reason-select">Motivo da perda</Label>
              <Select
                value={selectedLostReason}
                onValueChange={(val) => setSelectedLostReason(val as LostReason)}
              >
                <SelectTrigger id="lost-reason-select">
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sem_retorno">Sem retorno</SelectItem>
                  <SelectItem value="desistencia">Desistência</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button
              variant="outline"
              onClick={() => setLostReasonDialogOpen(false)}
              disabled={savingStage}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmLost}
              disabled={savingStage || !selectedLostReason}
              className="gap-1.5"
            >
              {savingStage && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Confirmar perda</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 1: Editar dados */}
      {lead && (
        <EditLeadModal
          lead={lead}
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          onSaved={(updated) => {
            setLead(updated)
            listLeadEvents(updated.id).then(setEvents)
          }}
        />
      )}

      {/* MODAL 2: Enviar ficha de imóvel */}
      {lead && (
        <SendFichaModal
          leadId={lead.id}
          open={sendFichaModalOpen}
          onOpenChange={setSendFichaModalOpen}
          onSent={() => {
            listLeadEvents(lead.id).then(setEvents)
          }}
        />
      )}

      {/* MODAL 3: Converter em cliente */}
      {lead && (
        <ConvertLeadModal
          lead={lead}
          currentUserRole={user?.role}
          currentUserId={user?.id}
          open={convertModalOpen}
          onOpenChange={setConvertModalOpen}
          onSuccess={(newClientId) => {
            navigate(`/clientes/${newClientId}`, {
              state: { message: 'Lead convertido em cliente.' },
            })
          }}
        />
      )}

      {/* MODAL 4: Corrigir Origem (só admin) */}
      {lead && isAdmin && (
        <CorrectOriginModal
          lead={lead}
          open={correctOriginModalOpen}
          onOpenChange={setCorrectOriginModalOpen}
          onSuccess={async (newOrigin) => {
            setLead((prev) => (prev ? { ...prev, origin: newOrigin } : prev))
            const evs = await listLeadEvents(lead.id)
            setEvents(evs)
            setSuccessBanner('Origem corrigida.')
          }}
        />
      )}

      {/* MODAL AGENDAR VISITA */}
      {lead && (
        <CreateVisitModal
          open={createVisitModalOpen}
          onOpenChange={setCreateVisitModalOpen}
          fixedTarget={{ lead: { id: lead.id, name: lead.name } }}
          onSuccess={async (status) => {
            setSuccessBanner(
              status === 'agendada' ? 'Visita agendada.' : 'Pedido de visita registrado.',
            )
            // Atualiza linha do tempo, etapa e lista de visitas
            await loadData()
            const vs = await listVisitsByLead(lead.id)
            setVisits(vs)
          }}
        />
      )}

      {/* MODAL DETALHE DA VISITA */}
      <VisitDetailModal
        visit={selectedVisit}
        open={visitDetailModalOpen}
        onOpenChange={setVisitDetailModalOpen}
        onUpdated={async () => {
          if (lead) {
            await loadData()
            const vs = await listVisitsByLead(lead.id)
            setVisits(vs)
          }
          setVisitDetailModalOpen(false)
        }}
      />

      {/* MODAL CRIAR TAREFA */}
      {lead && (
        <CreateTaskModal
          open={createTaskModalOpen}
          onOpenChange={setCreateTaskModalOpen}
          fixedBinding={{ lead: { id: lead.id, name: lead.name } }}
          onCreated={async () => {
            setSuccessBanner('Tarefa criada com sucesso.')
            const freshTasks = await listTasksByLead(lead.id)
            setTasks(freshTasks)
          }}
        />
      )}

      {/* MODAL DETALHE DA TAREFA */}
      <TaskDetailModal
        task={selectedTask}
        open={taskDetailModalOpen}
        onOpenChange={setTaskDetailModalOpen}
        onUpdated={async () => {
          if (lead) {
            const freshTasks = await listTasksByLead(lead.id)
            setTasks(freshTasks)
          }
          setTaskDetailModalOpen(false)
        }}
      />
    </div>
  )
}
