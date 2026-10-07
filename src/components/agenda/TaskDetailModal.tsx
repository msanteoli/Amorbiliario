import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  TaskRecord,
  TaskStatus,
  TASK_STATUS_LABELS,
  formatTaskDateTimeBahia,
  taskIsoUtcToBahiaInput,
  taskBahiaLocalToIsoUtc,
  isTaskOverdue,
  updateTask,
  completeTask,
  cancelTask,
  reopenTask,
  extractTaskErrorMessage,
} from '@/services/tasks'
import { useAuth } from '@/contexts/AuthContext'
import { listActiveBrokers, ActiveBroker } from '@/services/visits'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Building2,
  Calendar,
  User,
  Clock,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
  Edit2,
} from 'lucide-react'

export function getTaskStatusBadge(task: TaskRecord) {
  if (isTaskOverdue(task)) {
    return <Badge variant="attention">Atrasada</Badge>
  }

  switch (task.status) {
    case 'aberta':
      return <Badge variant="default">Aberta</Badge>
    case 'concluida':
      return <Badge variant="success">Concluída</Badge>
    case 'cancelada':
      return <Badge variant="destructive">Cancelada</Badge>
    default:
      return <Badge variant="default">{task.status}</Badge>
  }
}

interface TaskDetailModalProps {
  task: TaskRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
}

export function TaskDetailModal({ task, open, onOpenChange, onUpdated }: TaskDetailModalProps) {
  const { user } = useAuth()
  const role = user?.role || ''
  const isAdmin = role === 'admin'
  const isSdr = role === 'sdr'
  const isCorretor = role === 'corretor'

  // Estados de edição
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueLocal, setDueLocal] = useState('')
  const [assignedTo, setAssignedTo] = useState('')

  // Lista de usuários para reatribuição (se admin ou criador SDR)
  const [usersList, setUsersList] = useState<ActiveBroker[]>([])

  // Confirmação para cancelar
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (open && task) {
      setIsEditing(false)
      setConfirmCancelOpen(false)
      setErrorMessage(null)
      setTitle(task.title || '')
      setDescription(task.description || '')
      setDueLocal(task.due_at ? taskIsoUtcToBahiaInput(task.due_at) : '')
      setAssignedTo(task.assigned_to || '')

      if (isAdmin || (isSdr && task.created_by === user?.id)) {
        listActiveBrokers()
          .then((brokers) => {
            if (isSdr) {
              setUsersList(brokers.filter((b) => b.id === user?.id || b.role === 'corretor'))
            } else {
              setUsersList(brokers)
            }
          })
          .catch(() => {})
      }
    }
  }, [open, task, isAdmin, isSdr, user?.id])

  if (!task) return null

  // Quem pode mudar responsável: só admin, ou o SDR que criou a tarefa
  const canReassign = isAdmin || (isSdr && task.created_by === user?.id)

  // Ações de status
  const handleComplete = async () => {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      await completeTask(task.id)
      onUpdated()
    } catch (err) {
      setErrorMessage(extractTaskErrorMessage(err, 'Erro ao concluir tarefa.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelConfirm = async () => {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      await cancelTask(task.id)
      setConfirmCancelOpen(false)
      onUpdated()
    } catch (err) {
      setErrorMessage(extractTaskErrorMessage(err, 'Erro ao cancelar tarefa.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleReopen = async () => {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      await reopenTask(task.id)
      onUpdated()
    } catch (err) {
      setErrorMessage(extractTaskErrorMessage(err, 'Erro ao reabrir tarefa.'))
    } finally {
      setSubmitting(false)
    }
  }

  // Salvar Edição
  const handleSaveEdit = async () => {
    if (title.trim().length < 2) {
      setErrorMessage('Informe o título da tarefa.')
      return
    }

    setSubmitting(true)
    setErrorMessage(null)

    try {
      const changes: Record<string, string | undefined> = {}

      if (title.trim() !== task.title) {
        changes.title = title.trim()
      }
      if ((description.trim() || '') !== (task.description || '')) {
        changes.description = description.trim()
      }

      const dueIso = dueLocal ? taskBahiaLocalToIsoUtc(dueLocal) : ''
      const origDueIso = task.due_at ? new Date(task.due_at).toISOString() : ''
      if (dueIso !== origDueIso) {
        changes.due_at = dueIso || ''
      }

      if (canReassign && assignedTo && assignedTo !== task.assigned_to) {
        changes.assigned_to = assignedTo
      }

      if (Object.keys(changes).length > 0) {
        await updateTask(task.id, changes)
      }

      setIsEditing(false)
      onUpdated()
    } catch (err) {
      setErrorMessage(extractTaskErrorMessage(err, 'Erro ao atualizar tarefa.'))
    } finally {
      setSubmitting(false)
    }
  }

  const lead = task.expand?.lead_id
  const client = task.expand?.client_id
  const property = task.expand?.property_id
  const assignee = task.expand?.assigned_to
  const createdBy = task.expand?.created_by
  const closedBy = task.expand?.closed_by

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6 sm:rounded-lg rounded-t-2xl rounded-b-none border border-border bg-popover text-popover-foreground shadow-none fixed bottom-0 top-auto sm:top-[50%] sm:bottom-auto translate-y-0 sm:translate-y-[-50%]">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle className="text-lg font-normal text-foreground">
              Detalhe da Tarefa
            </DialogTitle>
            {getTaskStatusBadge(task)}
          </div>
          <DialogDescription className="sr-only">
            Visualizar ou editar detalhes da tarefa
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="rounded-lg border border-destructive p-3 text-xs text-destructive flex items-center gap-2 my-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isEditing ? (
          /* Modo Edição */
          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <Label className="text-xs eyebrow text-muted-foreground">
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-12 min-h-[48px] rounded-lg text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="text-xs eyebrow text-muted-foreground">Descrição</Label>
                <span className="text-[10px] tabular text-muted-foreground">
                  {description.length}/500
                </span>
              </div>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                rows={3}
                className="text-sm rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs eyebrow text-muted-foreground">Prazo</Label>
              <Input
                type="datetime-local"
                value={dueLocal}
                onChange={(e) => setDueLocal(e.target.value)}
                className="h-12 min-h-[48px] rounded-lg text-sm"
              />
            </div>

            {/* Responsável (só admin, ou o SDR que criou a tarefa) */}
            {canReassign && (
              <div className="space-y-1.5">
                <Label className="text-xs eyebrow text-muted-foreground">Responsável</Label>
                <Select value={assignedTo} onValueChange={(val) => setAssignedTo(val)}>
                  <SelectTrigger className="w-full h-12 min-h-[48px] rounded-lg text-sm">
                    <SelectValue placeholder="Selecione o responsável..." />
                  </SelectTrigger>
                  <SelectContent>
                    {usersList.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(false)}
                disabled={submitting}
                className="rounded-full font-normal"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={submitting}
                className="rounded-full font-normal"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Salvar alterações
              </Button>
            </div>
          </div>
        ) : (
          /* Modo Visualização */
          <div className="space-y-4 py-2 text-sm">
            {/* Título e Descrição */}
            <div className="space-y-1">
              <h3 className="font-normal text-base text-foreground leading-snug">{task.title}</h3>
              {task.description && (
                <p className="text-sm text-foreground whitespace-pre-wrap p-3 rounded-lg border border-border bg-secondary/20">
                  {task.description}
                </p>
              )}
            </div>

            {/* Informações detalhadas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1">
                <span className="text-xs eyebrow text-muted-foreground">Prazo</span>
                <p
                  className={`text-sm tabular font-normal ${
                    isTaskOverdue(task) ? 'text-attention' : 'text-foreground'
                  }`}
                >
                  {isTaskOverdue(task) ? 'Atrasado: ' : ''}
                  {formatTaskDateTimeBahia(task.due_at)}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs eyebrow text-muted-foreground">Responsável</span>
                <p className="text-sm font-normal text-foreground">
                  {assignee?.name || assignee?.email || 'Não atribuído'}
                </p>
              </div>
            </div>

            {/* Vínculo (Lead, Cliente ou Imóvel) */}
            {(lead || client || property) && (
              <div className="space-y-1 pt-1">
                <span className="text-xs eyebrow text-muted-foreground">Vínculo</span>
                {lead && (
                  <div>
                    <Link
                      to={`/leads/${lead.id}`}
                      className="text-foreground hover:underline inline-flex items-center gap-1 font-normal"
                      onClick={() => onOpenChange(false)}
                    >
                      <span>Lead: {lead.name}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </Link>
                  </div>
                )}
                {client && (
                  <div>
                    <Link
                      to={`/clientes/${client.id}`}
                      className="text-foreground hover:underline inline-flex items-center gap-1 font-normal"
                      onClick={() => onOpenChange(false)}
                    >
                      <span>Cliente: {client.name}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </Link>
                  </div>
                )}
                {property && (
                  <div>
                    <Link
                      to={`/imoveis/${property.id}`}
                      className="text-foreground hover:underline inline-flex items-center gap-1 font-normal"
                      onClick={() => onOpenChange(false)}
                    >
                      <span>
                        Imóvel: [{property.code}] {property.title}
                      </span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Histórico: quem criou, quem encerrou */}
            <div className="text-xs text-muted-foreground space-y-0.5 pt-2 border-t border-border tabular">
              {createdBy && (
                <p>
                  Criada por: {createdBy.name || createdBy.email} em{' '}
                  {formatTaskDateTimeBahia(task.created)}
                </p>
              )}
              {closedBy && task.closed_at && (
                <p>
                  Encerrada por: {closedBy.name || closedBy.email} em{' '}
                  {formatTaskDateTimeBahia(task.closed_at)}
                </p>
              )}
            </div>

            {/* Confirmação de cancelamento */}
            {confirmCancelOpen ? (
              <div className="p-4 border border-destructive/40 rounded-lg bg-destructive/5 space-y-2">
                <p className="text-xs font-normal text-destructive">
                  Deseja realmente cancelar esta tarefa?
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmCancelOpen(false)}
                    disabled={submitting}
                    className="rounded-full text-xs font-normal"
                  >
                    Não
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleCancelConfirm}
                    disabled={submitting}
                    className="rounded-full text-xs font-normal"
                  >
                    Sim, cancelar tarefa
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Rodapé de Ações: pílulas com apenas uma preenchida */}
        {!isEditing && !confirmCancelOpen && (
          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between items-stretch sm:items-center pt-3 border-t border-border">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="gap-1 text-xs rounded-full font-normal"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>Editar</span>
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              {task.status === 'aberta' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive hover:bg-destructive/10 text-xs rounded-full font-normal"
                    onClick={() => setConfirmCancelOpen(true)}
                  >
                    Cancelar tarefa
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleComplete}
                    disabled={submitting}
                    className="gap-1 text-xs rounded-full font-normal"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Concluir</span>
                  </Button>
                </>
              )}

              {task.status !== 'aberta' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReopen}
                  disabled={submitting}
                  className="gap-1 text-xs rounded-full font-normal"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reabrir</span>
                </Button>
              )}
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
