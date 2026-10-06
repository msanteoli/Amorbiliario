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
import { getStageBadgeColor, formatDateTimeBR, isLeadNextStepOverdue } from '@/pages/Leads'
import { formatPhoneNumber, CONSENT_STATUS_LABELS } from '@/lib/clientUtils'
import { useAuth } from '@/contexts/AuthContext'
import { EditLeadModal } from '@/components/leads/EditLeadModal'
import { SendFichaModal } from '@/components/leads/SendFichaModal'
import { ConvertLeadModal } from '@/components/leads/ConvertLeadModal'
import { CorrectOriginModal } from '@/components/leads/CorrectOriginModal'

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
  AlertTriangle,
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

  const isCorretor = user?.role === 'corretor'
  const isAdmin = user?.role === 'admin'
  const isSdr = user?.role === 'sdr'
  const canManageLeads = isAdmin || isSdr
  // Permissão geral de edição de estágio, próximo passo e eventos: admin, SDR e o corretor do lead
  const isAssignedCorretor = isCorretor && lead?.assigned_to === user?.id
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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Botão voltar e breadcrumb */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/leads')}
            title="Voltar para lista de leads"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="text-sm text-muted-foreground">Leads / {lead.name}</span>
        </div>

        {/* Botões de Ação Superiores */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Corrigir Origem (só admin) */}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCorrectOriginModalOpen(true)}
              className="gap-1.5 text-xs"
            >
              <Edit className="h-3.5 w-3.5" />
              <span>Corrigir origem</span>
            </Button>
          )}

          {/* Editar dados (só admin e SDR) */}
          {canManageLeads && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditModalOpen(true)}
              className="gap-1.5 text-xs"
            >
              <Edit className="h-3.5 w-3.5" />
              <span>Editar dados</span>
            </Button>
          )}

          {/* Enviar ficha de imóvel (admin, SDR e o corretor do lead) */}
          {canOperateLead && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSendFichaModalOpen(true)}
              className="gap-1.5 text-xs"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Enviar ficha de imóvel</span>
            </Button>
          )}

          {/* Converter em cliente (admin, SDR e o corretor do lead, escondido se já tiver client_id) */}
          {canOperateLead && !lead.client_id && (
            <Button size="sm" onClick={() => setConvertModalOpen(true)} className="gap-1.5 text-xs">
              <UserCheck className="h-3.5 w-3.5" />
              <span>Converter em cliente</span>
            </Button>
          )}
        </div>
      </div>

      {/* Banner de sucesso */}
      {successBanner && (
        <Alert className="border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
          <Check className="h-4 w-4 text-emerald-600" />
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

      {/* CABEÇALHO DO LEAD */}
      <Card className="border-border">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{lead.name}</h1>
                <Badge
                  variant="outline"
                  className={`text-xs font-semibold ${getStageBadgeColor(lead.stage)}`}
                >
                  {LEAD_STAGE_LABELS[lead.stage] || lead.stage}
                </Badge>
                {lead.client_id && (
                  <Badge
                    variant="outline"
                    className="text-xs border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50"
                  >
                    Já é cliente
                  </Badge>
                )}
                {lead.dedupe_status === 'pendente' && (
                  <Badge
                    variant="outline"
                    className="text-xs border-amber-300 text-amber-800 bg-amber-50 dark:bg-amber-950/50"
                  >
                    Pendência de duplicidade
                  </Badge>
                )}
              </div>

              {/* Informação do cliente já ligado */}
              {lead.client_id && (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                  <span>Cliente:</span>
                  <Link
                    to={`/clientes/${lead.client_id}`}
                    className="text-primary font-medium hover:underline inline-flex items-center gap-1"
                  >
                    <span>{clientLinked?.name || 'Ver cliente'}</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              )}

              {/* Se estiver Perdido, mostra o motivo */}
              {lead.stage === 'perdido' && lead.lost_reason && (
                <div className="text-xs text-destructive font-medium flex items-center gap-1 pt-0.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>
                    Motivo da perda: {LOST_REASON_LABELS[lead.lost_reason] || lead.lost_reason}
                  </span>
                </div>
              )}
            </div>

            {/* Controles de Etapa e Atribuição */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Etapa (admin, SDR e corretor do lead) */}
              {canOperateLead && (
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground block">Mudar etapa</span>
                  <Select
                    value={lead.stage}
                    onValueChange={(val) => handleStageSelect(val as LeadStage)}
                    disabled={savingStage}
                  >
                    <SelectTrigger className="w-[170px] h-9">
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

              {/* Atribuição (só admin e SDR) */}
              {canManageLeads && (
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground block">Atribuído</span>
                  <Select
                    value={lead.assigned_to || 'unassigned'}
                    onValueChange={handleAssignChange}
                  >
                    <SelectTrigger className="w-[180px] h-9">
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

          {/* Grid de Metadados do Lead */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            {/* Telefone */}
            <div className="space-y-1">
              <span className="text-muted-foreground block">Telefone</span>
              {lead.phone ? (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {formatPhoneNumber(lead.phone)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground"
                    onClick={handleCopyPhone}
                    title="Copiar telefone"
                  >
                    {copiedPhone ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  <a
                    href={`https://wa.me/${lead.phone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center"
                    title="Abrir no WhatsApp"
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                </div>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </div>

            {/* E-mail */}
            <div className="space-y-1">
              <span className="text-muted-foreground block">E-mail</span>
              {lead.email ? (
                <span className="font-semibold text-foreground truncate block">{lead.email}</span>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </div>

            {/* Origem e Detalhe */}
            <div className="space-y-1">
              <span className="text-muted-foreground block">Origem</span>
              <span className="font-semibold text-foreground">
                {LEAD_ORIGIN_LABELS[lead.origin] || lead.origin}
                {lead.origin_detail ? ` (${lead.origin_detail})` : ''}
              </span>
            </div>

            {/* Consentimento */}
            <div className="space-y-1">
              <span className="text-muted-foreground block">Consentimento</span>
              <span className="font-medium text-foreground">
                {CONSENT_STATUS_LABELS[lead.consent_status] || 'Sem informação'}
              </span>
            </div>
          </div>

          {/* Linha 2 de metadados */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-2 border-t">
            {/* Atribuído */}
            <div className="space-y-1">
              <span className="text-muted-foreground block">Atribuído a</span>
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                {assigneeName}
              </span>
            </div>

            {/* Imóvel de interesse */}
            <div className="space-y-1 sm:col-span-2">
              <span className="text-muted-foreground block">Imóvel de interesse</span>
              {interestProperty ? (
                <Link
                  to={`/imoveis/${interestProperty.id}`}
                  className="font-semibold text-primary hover:underline inline-flex items-center gap-1.5"
                >
                  <Building className="h-3.5 w-3.5" />
                  <span>
                    {interestProperty.code} - {interestProperty.title}
                  </span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                <span className="text-muted-foreground">Nenhum imóvel vinculado</span>
              )}
            </div>

            {/* Contato inicial e último */}
            <div className="space-y-1">
              <span className="text-muted-foreground block">Último contato</span>
              <span className="text-muted-foreground">
                {lead.last_contact_at ? formatDateTimeBR(lead.last_contact_at) : 'Nenhum contato'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PERFIL DE BUSCA (quando preenchido) */}
      {(lead.search_neighborhood ||
        lead.search_type ||
        (lead.search_bedrooms && lead.search_bedrooms > 0) ||
        (lead.search_max_price && lead.search_max_price > 0)) && (
        <Card>
          <CardHeader className="py-3 px-6">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building className="h-4 w-4 text-primary" />
              <span>Perfil de Busca</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4 pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              {lead.search_neighborhood && (
                <div>
                  <span className="text-muted-foreground block">Bairro</span>
                  <span className="font-medium">{lead.search_neighborhood}</span>
                </div>
              )}
              {lead.search_type && (
                <div>
                  <span className="text-muted-foreground block">Tipo</span>
                  <span className="font-medium capitalize">{lead.search_type}</span>
                </div>
              )}
              {typeof lead.search_bedrooms === 'number' && lead.search_bedrooms > 0 && (
                <div>
                  <span className="text-muted-foreground block">Quartos mínimos</span>
                  <span className="font-medium">{lead.search_bedrooms}</span>
                </div>
              )}
              {typeof lead.search_max_price === 'number' && lead.search_max_price > 0 && (
                <div>
                  <span className="text-muted-foreground block">Valor máximo</span>
                  <span className="font-medium">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(lead.search_max_price)}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* PRÓXIMO PASSO (admin, SDR e corretor do lead) */}
      {canOperateLead && (
        <Card className={isOverdue ? 'border-destructive/40' : ''}>
          <CardHeader className="py-3 px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className={`h-4 w-4 ${isOverdue ? 'text-destructive' : 'text-primary'}`} />
                <span>Próximo Passo</span>
              </CardTitle>
              {lead.next_step_due && (
                <div
                  className={`text-xs font-medium ${
                    isOverdue ? 'text-destructive font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  Prazo: {formatDateTimeBR(lead.next_step_due)}
                  {isOverdue && ' (Vencido)'}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-4 pt-0 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="next-step-input" className="text-xs">
                  Ação a ser executada
                </Label>
                <Input
                  id="next-step-input"
                  placeholder="Ex.: Ligar para agendar visita"
                  value={nextStepText}
                  onChange={(e) => setNextStepText(e.target.value)}
                  maxLength={200}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="next-step-due-input" className="text-xs">
                  Prazo (data e hora)
                </Label>
                <Input
                  id="next-step-due-input"
                  type="datetime-local"
                  value={nextStepDueDate}
                  onChange={(e) => setNextStepDueDate(e.target.value)}
                  className={`text-xs ${isOverdue ? 'border-destructive text-destructive' : ''}`}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSaveNextStep}
                disabled={savingNextStep}
                className="text-xs gap-1.5"
              >
                {savingNextStep && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Salvar próximo passo</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* REGISTRO DE NOTAS E CONTATOS (admin, SDR e corretor do lead) */}
      {canOperateLead && (
        <Card>
          <CardHeader className="py-3 px-6">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span>Registrar Nota ou Contato</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Adicione registros à linha do tempo do lead. O registro de contato atualiza a data de
              atendimento.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-4 pt-0 space-y-3">
            <Textarea
              placeholder="Digite sua nota ou detalhes do contato realizado..."
              value={noteContactText}
              onChange={(e) => setNoteContactText(e.target.value)}
              rows={3}
              className="text-xs"
            />
            <div className="flex justify-end items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleCreateEvent('nota')}
                disabled={submittingNote || submittingContact || !noteContactText.trim()}
                className="text-xs gap-1.5"
              >
                {submittingNote && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <FileText className="h-3.5 w-3.5" />
                <span>Registrar nota</span>
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => handleCreateEvent('contato')}
                disabled={submittingNote || submittingContact || !noteContactText.trim()}
                className="text-xs gap-1.5"
              >
                {submittingContact && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <Phone className="h-3.5 w-3.5" />
                <span>Registrar contato</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* LINHA DO TEMPO */}
      <Card>
        <CardHeader className="py-4 px-6 border-b">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span>Linha do Tempo</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Histórico completo de eventos, alterações e contatos, do mais recente ao mais antigo.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {events.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              Nenhum evento registrado nesta linha do tempo.
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
              {events.map((ev) => {
                const authorName =
                  ev.expand?.author_id?.name || ev.expand?.author_id?.email || 'Sistema'
                const typeLabel = LEAD_EVENT_TYPE_LABELS[ev.type] || ev.type

                return (
                  <div key={ev.id} className="relative group">
                    {/* Marcador */}
                    <div className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-2 border-background bg-primary ring-4 ring-background" />

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="outline" className="font-semibold text-[11px]">
                          {typeLabel}
                        </Badge>
                        <span className="text-muted-foreground">
                          {formatDateTimeBR(ev.occurred_at || ev.created)}
                        </span>
                        <span>·</span>
                        <span className="font-medium text-foreground">{authorName}</span>
                      </div>

                      <div className="text-xs text-foreground/90 bg-muted/30 p-2.5 rounded-md border mt-1">
                        {ev.text}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
    </div>
  )
}
