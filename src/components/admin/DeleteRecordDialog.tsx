import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, AlertTriangle, ShieldAlert } from 'lucide-react'
import {
  BloqueioItem,
  DeleteConflictError,
  ForbiddenDeleteError,
  NotFoundDeleteError,
  formatBloqueioItem,
  anonymizeClient,
} from '@/services/adminDeletion'

export type DeletableType = 'cliente' | 'imovel' | 'condominio' | 'lead'

interface DeleteRecordDialogProps {
  type: DeletableType
  recordId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: () => Promise<void>
  onDeleted: () => void
  onAnonymized?: () => void
}

const TYPE_CONFIG: Record<
  DeletableType,
  {
    title: string
    noun: string
    extraWarning: string
  }
> = {
  cliente: {
    title: 'Excluir cliente?',
    noun: 'Cliente',
    extraWarning: 'Os dados privados dele também serão apagados.',
  },
  imovel: {
    title: 'Excluir imóvel?',
    noun: 'Imóvel',
    extraWarning:
      'As fotos, os horários de visita e as tarefas já concluídas dele também serão apagados.',
  },
  condominio: {
    title: 'Excluir condomínio?',
    noun: 'Condomínio',
    extraWarning: 'As fotos do condomínio também serão apagadas.',
  },
  lead: {
    title: 'Excluir lead?',
    noun: 'Lead',
    extraWarning:
      'O histórico de eventos do lead e as tarefas já concluídas dele também serão apagados.',
  },
}

export function DeleteRecordDialog({
  type,
  recordId,
  open,
  onOpenChange,
  onDelete,
  onDeleted,
  onAnonymized,
}: DeleteRecordDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [bloqueios, setBloqueios] = useState<BloqueioItem[] | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [anonymizeDialogOpen, setAnonymizeDialogOpen] = useState(false)

  const config = TYPE_CONFIG[type]

  const handleOpenChangeInternal = (nextOpen: boolean) => {
    if (!nextOpen) {
      // Resetar estados ao fechar
      setBloqueios(null)
      setErrorMessage(null)
      setIsDeleting(false)
    }
    onOpenChange(nextOpen)
  }

  const handleConfirmDelete = async () => {
    setIsDeleting(true)
    setErrorMessage(null)
    setBloqueios(null)

    try {
      await onDelete()
      handleOpenChangeInternal(false)
      onDeleted()
    } catch (err: any) {
      if (err instanceof DeleteConflictError) {
        setBloqueios(err.bloqueios)
      } else if (err instanceof NotFoundDeleteError) {
        setErrorMessage(err.message)
        // Redireciona via onDeleted após aviso se o registro sumiu
        setTimeout(() => {
          handleOpenChangeInternal(false)
          onDeleted()
        }, 1500)
      } else if (err instanceof ForbiddenDeleteError) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage(err?.message || 'Erro ao excluir registro.')
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <AlertDialog open={open} onOpenChange={handleOpenChangeInternal}>
        <AlertDialogContent className="rounded-lg p-6 max-w-md">
          {bloqueios ? (
            /* Estado 409 - Conflito por vínculos */
            <>
              <AlertDialogHeader>
                <div className="flex items-center gap-2 text-attention">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <AlertDialogTitle className="text-base font-medium text-foreground">
                    Não dá para excluir ainda
                  </AlertDialogTitle>
                </div>
                <div className="pt-2 space-y-3 text-xs text-foreground">
                  <p className="text-muted-foreground font-normal">
                    Existem vínculos ativos que impedem a exclusão deste registro:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 font-medium text-foreground">
                    {bloqueios.map((b, idx) => (
                      <li key={idx}>{formatBloqueioItem(b)}</li>
                    ))}
                  </ul>
                  <p className="text-muted-foreground font-normal pt-1">
                    Resolva ou desvincule o que está acima e tente de novo. Nada foi apagado.
                  </p>
                </div>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 sm:gap-2 pt-4">
                <AlertDialogCancel asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-full px-4 text-xs font-normal border-border"
                  >
                    <span>Entendi</span>
                  </Button>
                </AlertDialogCancel>
                {type === 'cliente' && (
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => {
                      handleOpenChangeInternal(false)
                      setAnonymizeDialogOpen(true)
                    }}
                    className="h-9 rounded-full px-4 text-xs font-normal"
                  >
                    <span>Anonimizar cliente</span>
                  </Button>
                )}
              </AlertDialogFooter>
            </>
          ) : (
            /* Diálogo inicial de confirmação de exclusão */
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-base font-medium text-foreground">
                  {config.title}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-muted-foreground space-y-2 pt-1 font-normal">
                  <span className="block font-medium text-destructive">
                    Esta ação é definitiva e não pode ser desfeita.
                  </span>
                  <span className="block text-foreground">{config.extraWarning}</span>
                </AlertDialogDescription>
              </AlertDialogHeader>

              {errorMessage && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 font-normal">
                  {errorMessage}
                </div>
              )}

              <AlertDialogFooter className="gap-2 sm:gap-2 pt-4">
                <AlertDialogCancel asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isDeleting}
                    className="h-9 rounded-full px-4 text-xs font-normal border-border"
                  >
                    <span>Cancelar</span>
                  </Button>
                </AlertDialogCancel>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="h-9 rounded-full px-4 text-xs font-medium gap-1.5"
                >
                  {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isDeleting ? 'Excluindo...' : 'Excluir'}</span>
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de Anonimização (específico para cliente) */}
      {type === 'cliente' && (
        <AnonymizeClientDialog
          clientId={recordId}
          open={anonymizeDialogOpen}
          onOpenChange={setAnonymizeDialogOpen}
          onAnonymized={() => {
            if (onAnonymized) onAnonymized()
          }}
        />
      )}
    </>
  )
}

interface AnonymizeClientDialogProps {
  clientId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onAnonymized: () => void
}

export function AnonymizeClientDialog({
  clientId,
  open,
  onOpenChange,
  onAnonymized,
}: AnonymizeClientDialogProps) {
  const [confirmationWord, setConfirmationWord] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isConfirmed = confirmationWord.trim() === 'ANONIMIZAR'

  const handleOpenChangeInternal = (nextOpen: boolean) => {
    if (!nextOpen) {
      setConfirmationWord('')
      setErrorMessage(null)
      setIsSubmitting(false)
    }
    onOpenChange(nextOpen)
  }

  const handleConfirm = async () => {
    if (!isConfirmed) return
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await anonymizeClient(clientId)
      handleOpenChangeInternal(false)
      onAnonymized()
    } catch (err: any) {
      if (err instanceof ForbiddenDeleteError || err instanceof NotFoundDeleteError) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage(err?.message || 'Erro ao anonimizar cliente.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChangeInternal}>
      <AlertDialogContent className="rounded-lg p-6 max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-attention shrink-0" />
            <AlertDialogTitle className="text-base font-medium text-foreground">
              Anonimizar este cliente?
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-xs text-muted-foreground space-y-2.5 pt-1 font-normal text-left">
            <span className="block text-foreground">
              O nome, o telefone, o e-mail, o CPF e os demais dados pessoais serão apagados, e os
              leads dele também perdem nome, telefone e e-mail.
            </span>
            <span className="block text-muted-foreground">
              O cliente fica na lista como &ldquo;Cliente anonimizado&rdquo;, com negociações,
              visitas e imóveis mantidos.
            </span>
            <span className="block font-medium text-destructive">Não pode ser desfeito.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2 text-left">
          <Label htmlFor="anonymize-confirm-input" className="text-xs text-foreground font-normal">
            Para confirmar, digite <span className="font-mono font-bold">ANONIMIZAR</span> abaixo:
          </Label>
          <Input
            id="anonymize-confirm-input"
            value={confirmationWord}
            onChange={(e) => setConfirmationWord(e.target.value)}
            placeholder="ANONIMIZAR"
            disabled={isSubmitting}
            className="h-10 text-xs font-mono uppercase"
            autoComplete="off"
          />
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 font-normal text-left">
            {errorMessage}
          </div>
        )}

        <AlertDialogFooter className="gap-2 sm:gap-2 pt-2">
          <AlertDialogCancel asChild>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              className="h-9 rounded-full px-4 text-xs font-normal border-border"
            >
              <span>Cancelar</span>
            </Button>
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmed || isSubmitting}
            className="h-9 rounded-full px-4 text-xs font-medium gap-1.5"
          >
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{isSubmitting ? 'Anonimizando...' : 'Anonimizar'}</span>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
