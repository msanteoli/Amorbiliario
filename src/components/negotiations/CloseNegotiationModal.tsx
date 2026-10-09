import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  ArrowLeft,
  ShieldAlert,
  User,
  FileText,
} from 'lucide-react'
import {
  closeNegotiation,
  formatNegotiationErrorMessage,
  NegotiationPurpose,
  NegotiationChecklistResponse,
  CloseNegotiationError,
  CloseNegotiationMissingItem,
  NEGOTIATION_PERSON_ROLE_LABELS,
  NEGOTIATION_DOC_TYPE_LABELS,
  NegotiationDocType,
  NegotiationPersonRole,
} from '@/services/negotiations'

interface CloseNegotiationModalProps {
  negotiationId: string
  purpose: NegotiationPurpose
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  checklist?: NegotiationChecklistResponse | null
  isAdmin?: boolean
  onReturnToChecklist?: () => void
}

interface GroupedMissingPerson {
  personId: string
  name: string
  roleLabel: string
  docTypes: string[]
}

export function CloseNegotiationModal({
  negotiationId,
  purpose,
  open,
  onOpenChange,
  onSuccess,
  checklist,
  isAdmin = false,
  onReturnToChecklist,
}: CloseNegotiationModalProps) {
  const [closing, setClosing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Estado quando há conflito de documentos pendentes (409)
  const [pendingWarning, setPendingWarning] = useState<{
    message: string
    missing: CloseNegotiationMissingItem[]
  } | null>(null)

  // Estado para fluxo "Fechar mesmo assim" (só admin)
  const [showForceForm, setShowForceForm] = useState(false)
  const [forceReason, setForceReason] = useState('')
  const [forceReasonError, setForceReasonError] = useState<string | null>(null)

  const isVenda = purpose === 'venda'
  const novoStatusImovel = isVenda ? 'Vendido' : 'Alugado'

  // Agrupa os documentos faltantes por pessoa usando as pessoas em memória do checklist
  const groupedMissing = useMemo<GroupedMissingPerson[]>(() => {
    if (!pendingWarning) return []

    // Mapeamento de pessoas do checklist
    const peopleMap = new Map<string, { name: string; roleLabel: string }>()
    if (checklist?.people) {
      checklist.people.forEach((p) => {
        const roleLabel =
          NEGOTIATION_PERSON_ROLE_LABELS[p.role as NegotiationPersonRole] ||
          p.role ||
          'Participante'
        peopleMap.set(p.id, {
          name: p.name || 'Pessoa sem nome',
          roleLabel,
        })
      })
    }

    const mapByPerson = new Map<string, { name: string; roleLabel: string; docTypes: string[] }>()

    pendingWarning.missing.forEach((item) => {
      const pid = item.person_id || 'unknown'
      const existing = mapByPerson.get(pid)
      const personMeta = peopleMap.get(pid) || {
        name: 'Pessoa participante',
        roleLabel: 'Participante',
      }

      const docLabel =
        NEGOTIATION_DOC_TYPE_LABELS[item.doc_type as NegotiationDocType] || item.doc_type

      if (existing) {
        if (!existing.docTypes.includes(docLabel)) {
          existing.docTypes.push(docLabel)
        }
      } else {
        mapByPerson.set(pid, {
          name: personMeta.name,
          roleLabel: personMeta.roleLabel,
          docTypes: [docLabel],
        })
      }
    })

    return Array.from(mapByPerson.entries()).map(([personId, data]) => ({
      personId,
      name: data.name,
      roleLabel: data.roleLabel,
      docTypes: data.docTypes,
    }))
  }, [pendingWarning, checklist])

  const handleResetModalState = () => {
    setClosing(false)
    setErrorMessage(null)
    setPendingWarning(null)
    setShowForceForm(false)
    setForceReason('')
    setForceReasonError(null)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      handleResetModalState()
    }
    onOpenChange(newOpen)
  }

  // Tenta fechar normalmente
  const handleConfirmClose = async () => {
    setClosing(true)
    setErrorMessage(null)
    setPendingWarning(null)

    try {
      await closeNegotiation(negotiationId)
      handleOpenChange(false)
      onSuccess()
    } catch (err: unknown) {
      if (err instanceof CloseNegotiationError) {
        if (err.status === 409) {
          // Conflito: documentos pendentes
          // Se o servidor retornou a lista em `missing`, usamos. Se não retornou ou vazio mas há checklist em memória, montamos a partir do checklist.
          let missingItems: CloseNegotiationMissingItem[] = err.missing || []
          if (missingItems.length === 0 && checklist?.documents) {
            missingItems = checklist.documents
              .filter((d) => d.state === 'pendente')
              .map((d) => ({ person_id: d.person_id, doc_type: d.doc_type }))
          }
          setPendingWarning({
            message:
              err.message || 'Há documentos pendentes. Complete o checklist antes de fechar.',
            missing: missingItems,
          })
          return
        }

        if (err.status === 403) {
          // 403 sem force ou ao tentar fechar
          setErrorMessage(err.message || 'Você não tem permissão para fechar esta negociação.')
          return
        }

        if (err.status === 400) {
          // 400 com mensagem do servidor (ex: lead perdido ou imóvel indisponível)
          setErrorMessage(err.message)
          return
        }
      }

      setErrorMessage(formatNegotiationErrorMessage(err))
    } finally {
      setClosing(false)
    }
  }

  // Tenta fechar com force (só admin)
  const handleForceClose = async () => {
    const trimmedReason = forceReason.trim()
    if (!trimmedReason) {
      setForceReasonError('Informe o motivo para fechar com documentos pendentes.')
      return
    }

    setClosing(true)
    setErrorMessage(null)
    setForceReasonError(null)

    try {
      await closeNegotiation(negotiationId, {
        force: true,
        reason: trimmedReason,
      })
      handleOpenChange(false)
      onSuccess()
    } catch (err: unknown) {
      if (err instanceof CloseNegotiationError) {
        if (err.status === 403) {
          setErrorMessage(
            'Permissão negada: apenas administradores podem fechar com documentos pendentes.',
          )
          return
        }
        if (err.status === 400) {
          setErrorMessage(err.message)
          return
        }
      }
      setErrorMessage(formatNegotiationErrorMessage(err))
    } finally {
      setClosing(false)
    }
  }

  const handleReturnToTab = () => {
    handleOpenChange(false)
    if (onReturnToChecklist) {
      onReturnToChecklist()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        {/* CASO 1: AVISO DE DOCUMENTOS PENDENTES (409) */}
        {pendingWarning ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 text-attention">
                <FileWarning className="h-5 w-5 shrink-0" />
                <DialogTitle className="text-foreground">Documentos pendentes</DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground pt-1.5">
                {pendingWarning.message}
              </DialogDescription>
            </DialogHeader>

            {errorMessage && (
              <Alert variant="destructive" className="py-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
              </Alert>
            )}

            {/* Lista do que falta, agrupada por pessoa */}
            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {groupedMissing.length > 0 ? (
                groupedMissing.map((group) => (
                  <div
                    key={group.personId}
                    className="rounded-lg border border-border bg-card p-3 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-border pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-semibold text-foreground">{group.name}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {group.roleLabel}
                      </Badge>
                    </div>

                    <ul className="space-y-1.5 pl-1">
                      {group.docTypes.map((docName, idx) => (
                        <li
                          key={idx}
                          className="flex items-center gap-2 text-muted-foreground text-xs"
                        >
                          <FileText className="h-3 w-3 text-attention shrink-0" />
                          <span className="text-foreground">{docName}</span>
                          <span className="text-[10px] text-attention font-medium ml-auto">
                            Pendente
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground text-center">
                  Consulte o checklist para verificar os documentos restantes.
                </div>
              )}
            </div>

            {/* Bloco de "Fechar mesmo assim" exclusivo para Administrador */}
            {isAdmin && (
              <div className="pt-2 border-t border-border space-y-3">
                {!showForceForm ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      Administrador: deseja prosseguir mesmo com pendências?
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowForceForm(true)
                        setErrorMessage(null)
                        setForceReasonError(null)
                      }}
                      className="h-8 rounded-full px-3 text-xs border-attention/50 text-foreground hover:bg-attention/10 shrink-0"
                    >
                      <ShieldAlert className="h-3.5 w-3.5 mr-1 text-attention" />
                      Fechar mesmo assim
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-attention/40 bg-attention/5 p-3.5 space-y-3">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="h-4 w-4 text-attention shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-foreground">
                          Fechar mesmo assim (exclusivo admin)
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          O fechamento fica registrado com o motivo.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="force-reason-input" className="text-xs font-normal">
                        Motivo obrigatório
                      </Label>
                      <Input
                        id="force-reason-input"
                        placeholder="Ex.: Documentos entregues em papel"
                        value={forceReason}
                        onChange={(e) => {
                          setForceReason(e.target.value)
                          if (forceReasonError) setForceReasonError(null)
                        }}
                        disabled={closing}
                        className="h-9 text-xs rounded-lg border-border bg-background"
                      />
                      {forceReasonError && (
                        <p className="text-[11px] text-destructive">{forceReasonError}</p>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowForceForm(false)
                          setForceReason('')
                          setForceReasonError(null)
                        }}
                        disabled={closing}
                        className="h-8 rounded-full px-3 text-xs"
                      >
                        Cancelar motivo
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleForceClose}
                        disabled={closing || !forceReason.trim()}
                        className="h-8 rounded-full px-4 text-xs gap-1.5 bg-attention text-attention-foreground hover:bg-attention/90"
                      >
                        {closing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        <span>Confirmar e fechar</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleReturnToTab}
                disabled={closing}
                className="text-xs h-9 rounded-full px-4 gap-1.5 w-full sm:w-auto"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Voltar ao checklist</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={closing}
                className="text-xs h-9 rounded-full px-4"
              >
                Cancelar
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* CASO 2: CONFIRMAÇÃO PADRÃO DE FECHAMENTO */
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <DialogTitle>Fechar negócio</DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground pt-1.5">
                Confirme a conclusão bem-sucedida desta negociação.
              </DialogDescription>
            </DialogHeader>

            {errorMessage && (
              <Alert variant="destructive" className="py-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
              </Alert>
            )}

            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <p className="text-xs text-foreground leading-relaxed">
                O imóvel vira <strong>{novoStatusImovel}</strong>, sai do site e o lead vira{' '}
                <strong>Ganho</strong>.
              </p>
              <p className="text-xs font-semibold text-destructive">Não dá para desfazer.</p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={closing}
                className="text-xs h-9 rounded-full px-4"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleConfirmClose}
                disabled={closing}
                className="text-xs h-9 rounded-full px-4 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {closing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Confirmar fechamento</span>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
