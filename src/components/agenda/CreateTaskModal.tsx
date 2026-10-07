import React, { useState, useEffect } from 'react'
import {
  TaskRecord,
  CreateTaskInput,
  createTask,
  taskBahiaLocalToIsoUtc,
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
import { AlertTriangle, Loader2 } from 'lucide-react'

export interface TaskContextBinding {
  lead?: { id: string; name: string }
  client?: { id: string; name: string }
  property?: { id: string; code: string; title: string }
}

interface CreateTaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fixedBinding?: TaskContextBinding
  onCreated: (task: TaskRecord) => void
}

export function CreateTaskModal({
  open,
  onOpenChange,
  fixedBinding,
  onCreated,
}: CreateTaskModalProps) {
  const { user } = useAuth()
  const role = user?.role || ''
  const isCorretor = role === 'corretor'
  const isSdr = role === 'sdr'
  const isAdmin = role === 'admin'

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueLocal, setDueLocal] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [usersList, setUsersList] = useState<ActiveBroker[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setTitle('')
      setDescription('')
      setDueLocal('')
      setErrorMessage(null)
      setSubmitting(false)

      // Regras de responsável:
      // - Corretor: o próprio usuário e fixo
      // - SDR: o próprio ou um corretor
      // - Admin: qualquer usuário ativo
      if (isCorretor) {
        setAssignedTo(user?.id || '')
      } else {
        setAssignedTo(user?.id || '')
      }

      listActiveBrokers()
        .then((brokers) => {
          // Se for SDR, filtrar para o próprio SDR ou usuários com papel 'corretor'
          if (isSdr) {
            const filtered = brokers.filter((b) => b.id === user?.id || b.role === 'corretor')
            setUsersList(filtered)
          } else {
            setUsersList(brokers)
          }
        })
        .catch(() => {})
    }
  }, [open, isCorretor, isSdr, user?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.organization_id) {
      setErrorMessage('Organização não identificada.')
      return
    }
    if (title.trim().length < 2) {
      setErrorMessage('Informe o título da tarefa.')
      return
    }

    setSubmitting(true)
    setErrorMessage(null)

    try {
      const input: CreateTaskInput = {
        organization_id: user.organization_id,
        title: title.trim(),
        description: description.trim(),
        assigned_to: isCorretor ? user.id : assignedTo || user.id,
      }

      if (dueLocal) {
        input.due_at = taskBahiaLocalToIsoUtc(dueLocal)
      }

      if (fixedBinding?.lead) {
        input.lead_id = fixedBinding.lead.id
      }
      if (fixedBinding?.client) {
        input.client_id = fixedBinding.client.id
      }
      if (fixedBinding?.property) {
        input.property_id = fixedBinding.property.id
      }

      const created = await createTask(input)
      onOpenChange(false)
      onCreated(created)
    } catch (err: unknown) {
      setErrorMessage(extractTaskErrorMessage(err, 'Erro ao criar tarefa.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6 sm:rounded-lg rounded-t-2xl rounded-b-none border border-border bg-popover text-popover-foreground shadow-none fixed bottom-0 top-auto sm:top-[50%] sm:bottom-auto translate-y-0 sm:translate-y-[-50%]">
        <DialogHeader className="pb-3 border-b border-border">
          <DialogTitle className="text-lg font-normal text-foreground">Nova tarefa</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {fixedBinding?.lead && `Vinculada ao lead: ${fixedBinding.lead.name}`}
            {fixedBinding?.client && `Vinculada ao cliente: ${fixedBinding.client.name}`}
            {fixedBinding?.property &&
              `Vinculada ao imóvel: [${fixedBinding.property.code}] ${fixedBinding.property.title}`}
            {!fixedBinding && 'Crie uma tarefa para organizar sua rotina.'}
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="rounded-lg border border-destructive p-3 text-xs text-destructive flex items-center gap-2 my-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-sm">
          {/* Título */}
          <div className="space-y-1.5">
            <Label className="text-xs eyebrow text-muted-foreground">
              Título <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Ex.: Ligar para o cliente para confirmar visita..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-12 min-h-[48px] rounded-lg text-sm"
              required
            />
          </div>

          {/* Descrição curta */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label className="text-xs eyebrow text-muted-foreground">Descrição</Label>
              <span className="text-[10px] tabular text-muted-foreground">
                {description.length}/500
              </span>
            </div>
            <Textarea
              placeholder="Detalhes ou observações da tarefa..."
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              rows={3}
              className="text-sm rounded-lg"
            />
          </div>

          {/* Prazo */}
          <div className="space-y-1.5">
            <Label className="text-xs eyebrow text-muted-foreground">
              Prazo (data e hora, opcional)
            </Label>
            <Input
              type="datetime-local"
              value={dueLocal}
              onChange={(e) => setDueLocal(e.target.value)}
              className="h-12 min-h-[48px] rounded-lg text-sm"
            />
          </div>

          {/* Responsável */}
          <div className="space-y-1.5">
            <Label className="text-xs eyebrow text-muted-foreground">Responsável</Label>
            {isCorretor ? (
              <div className="p-3 rounded-lg border border-border text-xs">
                <span className="font-normal text-foreground">
                  {user?.name || user?.email || 'Você'}
                </span>
              </div>
            ) : (
              <Select value={assignedTo || user?.id} onValueChange={(val) => setAssignedTo(val)}>
                <SelectTrigger className="w-full h-12 min-h-[48px] rounded-lg text-sm">
                  <SelectValue placeholder="Selecione o responsável..." />
                </SelectTrigger>
                <SelectContent>
                  {usersList.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.role}) {u.id === user?.id ? ' - Você' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-border flex flex-col sm:flex-row gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="rounded-full font-normal"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting || title.trim().length < 2}
              className="rounded-full font-normal"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Salvar tarefa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
