import { useState, useEffect } from 'react'
import {
  LeadRecord,
  LeadUserRecord,
  convertLead,
  listEligibleLeadAssignees,
  formatLeadErrorMessage,
  ConvertMatchItem,
} from '@/services/leads'
import { formatPhoneNumber } from '@/lib/clientUtils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, Loader2, UserCheck, AlertTriangle } from 'lucide-react'

interface ConvertLeadModalProps {
  lead: LeadRecord
  currentUserRole?: string
  currentUserId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (clientId: string) => void
}

const CLIENT_KINDS = [
  { id: 'comprador', label: 'Comprador' },
  { id: 'locatario', label: 'Locatário' },
  { id: 'proprietario', label: 'Proprietário' },
  { id: 'investidor', label: 'Investidor' },
]

export function ConvertLeadModal({
  lead,
  currentUserRole,
  currentUserId,
  open,
  onOpenChange,
  onSuccess,
}: ConvertLeadModalProps) {
  const isCorretor = currentUserRole === 'corretor'

  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Tipos de relação (ao menos um, padrão comprador)
  const [selectedKinds, setSelectedKinds] = useState<string[]>(['comprador'])

  // Responsável: admin e SDR escolhem; padrão dono do lead quando houver
  const [responsibleId, setResponsibleId] = useState<string>(
    lead.assigned_to || currentUserId || '',
  )
  const [eligibleUsers, setEligibleUsers] = useState<LeadUserRecord[]>([])

  // Estado de conflito 409
  interface ConflictState {
    status: 'same_person' | 'maybe_same' | 'already_linked'
    matches: ConvertMatchItem[]
  }
  const [conflict, setConflict] = useState<ConflictState | null>(null)
  const [alreadyLinkedMsg, setAlreadyLinkedMsg] = useState<string | null>(null)
  const [hiddenDuplicateMsg, setHiddenDuplicateMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!isCorretor && open) {
      listEligibleLeadAssignees()
        .then((users) => {
          setEligibleUsers(users)
          if (!responsibleId && users.length > 0) {
            setResponsibleId(lead.assigned_to || users[0].id)
          }
        })
        .catch(() => {
          // ignore
        })
    }
  }, [isCorretor, open, lead.assigned_to, responsibleId])

  const toggleKind = (kindId: string) => {
    if (selectedKinds.includes(kindId)) {
      if (selectedKinds.length === 1) {
        return // ao menos um
      }
      setSelectedKinds(selectedKinds.filter((k) => k !== kindId))
    } else {
      setSelectedKinds([...selectedKinds, kindId])
    }
  }

  const handleConvertCreate = async () => {
    setErrorMessage(null)
    setConflict(null)
    setAlreadyLinkedMsg(null)
    setHiddenDuplicateMsg(null)

    if (selectedKinds.length === 0) {
      setErrorMessage('Selecione ao menos um tipo de relação.')
      return
    }

    if (!isCorretor && !responsibleId) {
      setErrorMessage('Escolha o responsável.')
      return
    }

    setLoading(true)

    try {
      const res = await convertLead(lead.id, {
        mode: 'create',
        kind: selectedKinds,
        responsible_id: isCorretor ? undefined : responsibleId,
      })

      if (res.ok === true) {
        onSuccess(res.data.client_id)
        onOpenChange(false)
        return
      }

      // Trata 409
      const conflictData = res.conflict
      if (conflictData.status === 'already_linked') {
        setAlreadyLinkedMsg('Este lead já está ligado a um cliente.')
        return
      }

      const matches = conflictData.matches || []
      const visibleMatches = matches.filter((m) => m.visible && m.client)

      if (visibleMatches.length > 0) {
        setConflict({
          status: conflictData.status,
          matches: visibleMatches,
        })
      } else {
        // visible falso: mostre apenas "Já existe um cliente com esses dados. Fale com o SDR ou o admin."
        setHiddenDuplicateMsg('Já existe um cliente com esses dados. Fale com o SDR ou o admin.')
      }
    } catch (err) {
      setErrorMessage(formatLeadErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleLinkToClient = async (targetClientId: string) => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const res = await convertLead(lead.id, {
        mode: 'link',
        client_id: targetClientId,
      })
      if (res.ok === true) {
        onSuccess(res.data.client_id)
        onOpenChange(false)
      } else {
        setErrorMessage(res.conflict.message || 'Não foi possível ligar o lead a este cliente.')
      }
    } catch (err) {
      setErrorMessage(formatLeadErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setErrorMessage(null)
      setConflict(null)
      setAlreadyLinkedMsg(null)
      setHiddenDuplicateMsg(null)
      setSelectedKinds(['comprador'])
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            <span>Converter lead em cliente</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {alreadyLinkedMsg && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 text-blue-800 text-sm border border-blue-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{alreadyLinkedMsg}</span>
            </div>
          )}

          {hiddenDuplicateMsg && (
            <div className="p-4 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-sm space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>Cliente já cadastrado</span>
              </div>
              <p>{hiddenDuplicateMsg}</p>
            </div>
          )}

          {/* Se houver conflito com cliente visível (409) */}
          {conflict && (
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 space-y-3">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {conflict.status === 'same_person'
                    ? 'Este cliente já está cadastrado. Ligar o lead a ele?'
                    : 'Parece o mesmo cliente? Ligar o lead a ele?'}
                </span>
              </div>

              <div className="space-y-2">
                {conflict.matches.map((item, idx) => {
                  if (!item.client) return null
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-md bg-card border flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-foreground text-sm">
                          {item.client.name}
                        </div>
                        <div className="text-muted-foreground">
                          {formatPhoneNumber(item.client.phone)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleLinkToClient(item.client!.id)}
                        disabled={loading}
                        className="text-xs h-8"
                      >
                        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                        Ligar a este cliente
                      </Button>
                    </div>
                  )
                })}
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleClose(false)}
                  disabled={loading}
                  className="text-xs"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Formulário inicial de conversão */}
          {!conflict && !hiddenDuplicateMsg && !alreadyLinkedMsg && (
            <div className="space-y-4">
              <div className="p-3 rounded-md bg-muted/40 border text-xs text-muted-foreground space-y-1">
                <div>
                  Lead: <strong className="text-foreground">{lead.name}</strong>
                </div>
                <div>Telefone: {formatPhoneNumber(lead.phone)}</div>
                {lead.email && <div>E-mail: {lead.email}</div>}
              </div>

              {/* Tipos de relação */}
              <div className="space-y-2">
                <Label>Tipos de relação (ao menos um)</Label>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {CLIENT_KINDS.map((k) => (
                    <label
                      key={k.id}
                      className="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-muted/50 text-xs"
                    >
                      <Checkbox
                        checked={selectedKinds.includes(k.id)}
                        onCheckedChange={() => toggleKind(k.id)}
                      />
                      <span>{k.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Responsável (só admin e SDR) */}
              {!isCorretor && (
                <div className="space-y-2">
                  <Label htmlFor="convert-responsible">Responsável pelo cliente</Label>
                  <Select value={responsibleId} onValueChange={setResponsibleId}>
                    <SelectTrigger id="convert-responsible">
                      <SelectValue placeholder="Selecione o responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name || u.email || 'Usuário'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-3">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={loading}>
            Cancelar
          </Button>
          {!conflict && !hiddenDuplicateMsg && !alreadyLinkedMsg && (
            <Button onClick={handleConvertCreate} disabled={loading} className="gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Converter em cliente</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
