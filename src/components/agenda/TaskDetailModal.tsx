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
    return (
      <Badge variant="destructive" className="bg-rose-100 text-rose-800 border-rose-300">
        Atrasada
      </Badge>
    )
  }

  switch (task.status) {
    case 'aberta':
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
          Aberta
        </Badge>
      )
    case 'concluida':
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
          Concluída
        </Badge>
      )
    case 'cancelada':
      return (
        <Badge variant="outline" className="bg-zinc-100 text-zinc-600 border-zinc-200">
          Cancelada
        </Badge>
      )
    default:
      return <Badge variant="outline">{task.status}</Badge>
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
      <DialogContent className="max-w-md w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-4">
            <DialogTitle className="text-lg font-bold">Detalhe da Tarefa</DialogTitle>
            {getTaskStatusBadge(task)}
          </div>
          <DialogDescription className="sr-only">
            Visualizar ou editar detalhes da tarefa
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive" className="my-1">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
          </Alert>
        )}

        {isEditing ? (
          /* Modo Edição */
          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Título <span className="text-destructive">*</span>
              </Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-sm" />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-semibold">Descrição</Label>
                <span className="text-[10px] text-muted-foreground">{description.length}/500</span>
              </div>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                rows={3}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Prazo</Label>
              <Input
                type="datetime-local"
                value={dueLocal}
                onChange={(e) => setDueLocal(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Responsável (só admin, ou o SDR que criou a tarefa) */}
            {canReassign && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Responsável</Label>
                <Select value={assignedTo} onValueChange={(val) => setAssignedTo(val)}>
                  <SelectTrigger className="w-full text-sm">
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

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={submitting}>
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
              <h3 className="font-semibold text-base text-foreground leading-snug">{task.title}</h3>
              {task.description && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {task.description}
                </p>
              )}
            </div>

            {/* Informações detalhadas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-2.5 rounded-md bg-muted/40 border">
                <span className="text-[11px] font-medium text-muted-foreground block mb-0.5">
                  Prazo
                </span>
                <p
                  className={`text-xs font-semibold ${
                    isTaskOverdue(task) ? 'text-destructive font-bold' : 'text-foreground'
                  }`}
                >
                  {formatTaskDateTimeBahia(task.due_at)}
                </p>
              </div>

              <div className="p-2.5 rounded-md bg-muted/40 border">
                <span className="text-[11px] font-medium text-muted-foreground block mb-0.5">
                  Responsável
                </span>
                <p className="text-xs font-medium text-foreground">
                  {assignee?.name || assignee?.email || 'Não atribuído'}
                </p>
              </div>
            </div>

            {/* Vínculo (Lead, Cliente ou Imóvel) */}
            {(lead || client || property) && (
              <div className="p-2.5 rounded-md bg-muted/40 border space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground block">Vínculo</span>
                {lead && (
                  <Link
                    to={`/leads/${lead.id}`}
                    className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                    onClick={() => onOpenChange(false)}
                  >
                    <span>Lead: {lead.name}</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
                {client && (
                  <Link
                    to={`/clientes/${client.id}`}
                    className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                    onClick={() => onOpenChange(false)}
                  >
                    <span>Cliente: {client.name}</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
                {property && (
                  <Link
                    to={`/imoveis/${property.id}`}
                    className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                    onClick={() => onOpenChange(false)}
                  >
                    <span>
                      Imóvel: [{property.code}] {property.title}
                    </span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )}

            {/* Histórico: quem criou, quem encerrou */}
            <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1 border-t">
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
              <div className="p-3 border rounded-md bg-destructive/10 space-y-2">
                <p className="text-xs font-semibold text-destructive">
                  Deseja realmente cancelar esta tarefa?
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmCancelOpen(false)}
                    disabled={submitting}
                    className="h-7 text-xs"
                  >
                    Não
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleCancelConfirm}
                    disabled={submitting}
                    className="h-7 text-xs"
                  >
                    Sim, cancelar tarefa
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Rodapé de Ações */}
        {!isEditing && !confirmCancelOpen && (
          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between items-stretch sm:items-center pt-2 border-t">
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="gap-1 text-xs"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>Editar</span>
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              {task.status === 'aberta' && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 text-xs"
                    onClick={() => setConfirmCancelOpen(true)}
                  >
                    Cancelar tarefa
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleComplete}
                    disabled={submitting}
                    className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
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
                  className="gap-1 text-xs"
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
