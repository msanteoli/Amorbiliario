import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Loader2, Search, UserCheck, AlertCircle, UserPlus } from 'lucide-react'
import {
  NegotiationPurpose,
  NegotiationPersonRole,
  NEGOTIATION_PERSON_ROLE_LABELS,
  addNegotiationPerson,
  formatNegotiationErrorMessage,
} from '@/services/negotiations'
import { maskPhoneInput } from '@/lib/clientUtils'
import pb from '@/lib/pocketbase/client'
import { RecordModel } from 'pocketbase'

interface ClientOption {
  id: string
  name: string
  phone?: string
  email?: string
}

interface AddPersonModalProps {
  negotiationId: string
  purpose: NegotiationPurpose
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AddPersonModal({
  negotiationId,
  purpose,
  open,
  onOpenChange,
  onSuccess,
}: AddPersonModalProps) {
  const isVenda = purpose === 'venda'
  const allowedRoles: NegotiationPersonRole[] = isVenda
    ? ['cliente', 'conjuge_cliente']
    : ['cliente', 'fiador', 'conjuge_cliente', 'conjuge_fiador', 'morador']

  const [role, setRole] = useState<NegotiationPersonRole>('cliente')
  const [tab, setTab] = useState<'existente' | 'novo'>('existente')

  // Busca de cliente existente
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null)

  // Cadastro de novo cliente
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')

  // Tratamento de conflito de duplicidade (409 com existing_client_id)
  const [conflictClientId, setConflictClientId] = useState<string | null>(null)
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Reseta estado ao abrir
  useEffect(() => {
    if (open) {
      setRole('cliente')
      setTab('existente')
      setSearch('')
      setSelectedClient(null)
      setNewName('')
      setNewPhone('')
      setNewEmail('')
      setConflictClientId(null)
      setConflictMessage(null)
      setErrorMessage(null)
      searchClients('')
    }
  }, [open, purpose])

  const searchClients = async (term: string) => {
    setSearching(true)
    try {
      const filterParts: string[] = []
      if (term.trim()) {
        const clean = term.trim().replace(/['"\\]/g, '')
        const digits = term.replace(/\D/g, '')
        const conds = [`name ~ "${clean}"`, `email ~ "${clean}"`]
        if (digits) conds.push(`phone ~ "${digits}"`)
        filterParts.push(`(${conds.join(' || ')})`)
      }

      const res = await pb.collection('clients').getList<RecordModel>(1, 10, {
        filter: filterParts.length ? filterParts.join(' && ') : undefined,
        sort: 'name',
      })

      setClients(
        res.items.map((c) => ({
          id: c.id,
          name: (c.name as string) || '',
          phone: (c.phone as string) || '',
          email: (c.email as string) || '',
        })),
      )
    } catch {
      // ignore
    } finally {
      setSearching(false)
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearch(val)
    searchClients(val)
  }

  // Se der conflito 409, usa o cliente retornado pelo backend
  const handleUseExistingClient = async (existingId: string) => {
    setSaving(true)
    setErrorMessage(null)
    try {
      await addNegotiationPerson(negotiationId, {
        role,
        client_id: existingId,
      })
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      setErrorMessage(formatNegotiationErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setConflictClientId(null)
    setConflictMessage(null)

    if (tab === 'existente') {
      if (!selectedClient) {
        setErrorMessage('Selecione um cliente cadastrado.')
        return
      }

      setSaving(true)
      try {
        await addNegotiationPerson(negotiationId, {
          role,
          client_id: selectedClient.id,
        })
        onOpenChange(false)
        onSuccess()
      } catch (err: unknown) {
        setErrorMessage(formatNegotiationErrorMessage(err))
      } finally {
        setSaving(false)
      }
    } else {
      // Novo cliente
      if (!newName.trim()) {
        setErrorMessage('Informe o nome da pessoa.')
        return
      }
      if (!newPhone.trim() && !newEmail.trim()) {
        setErrorMessage('Informe telefone ou e-mail.')
        return
      }

      setSaving(true)
      try {
        await addNegotiationPerson(negotiationId, {
          role,
          new: {
            name: newName.trim(),
            phone: newPhone.trim() || undefined,
            email: newEmail.trim() || undefined,
          },
        })
        onOpenChange(false)
        onSuccess()
      } catch (err: unknown) {
        // Verifica se é 409 com existing_client_id
        if (typeof err === 'object' && err !== null) {
          const errObj = err as {
            status?: number
            response?: { existing_client_id?: string; message?: string }
            data?: { existing_client_id?: string; message?: string }
          }
          const resp = errObj.response || errObj.data
          if (resp?.existing_client_id) {
            setConflictClientId(resp.existing_client_id)
            setConflictMessage(
              resp.message || 'Já existe um cliente cadastrado com este telefone ou e-mail.',
            )
            return
          }
        }
        setErrorMessage(formatNegotiationErrorMessage(err))
      } finally {
        setSaving(false)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar pessoa à negociação</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Escolha o papel da pessoa no processo e vincule um cliente da base ou cadastre um novo.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive" className="py-2.5">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Conflito com cliente existente */}
        {conflictClientId && conflictMessage && (
          <Alert className="border-attention/40 bg-attention/10 text-foreground py-3">
            <AlertCircle className="h-4 w-4 text-attention" />
            <div className="space-y-2">
              <AlertDescription className="text-xs font-medium">{conflictMessage}</AlertDescription>
              <Button
                type="button"
                size="sm"
                onClick={() => handleUseExistingClient(conflictClientId)}
                disabled={saving}
                className="h-8 text-xs rounded-full px-3 gap-1"
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                <span>Usar cliente existente</span>
              </Button>
            </div>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Escolha do papel */}
          <div className="space-y-1.5">
            <Label className="text-xs font-normal">
              Papel na negociação <span className="text-destructive">*</span>
            </Label>
            <Select value={role} onValueChange={(val) => setRole(val as NegotiationPersonRole)}>
              <SelectTrigger className="h-10 text-xs rounded-lg border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {NEGOTIATION_PERSON_ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Abas: Buscar existente vs Cadastrar novo */}
          <Tabs
            value={tab}
            onValueChange={(val) => setTab(val as 'existente' | 'novo')}
            className="w-full space-y-3"
          >
            <TabsList className="grid grid-cols-2 h-9 p-0.5 rounded-full bg-muted/60 border border-border">
              <TabsTrigger
                value="existente"
                className="rounded-full text-xs font-normal data-[state=active]:bg-card"
              >
                <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                Cliente existente
              </TabsTrigger>
              <TabsTrigger
                value="novo"
                className="rounded-full text-xs font-normal data-[state=active]:bg-card"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                Cadastrar novo
              </TabsTrigger>
            </TabsList>

            {/* Aba 1: Existente */}
            <TabsContent value="existente" className="space-y-3 pt-1">
              {selectedClient ? (
                <div className="p-3 rounded-lg border border-border bg-muted/30 flex items-center justify-between gap-2">
                  <div className="text-xs truncate">
                    <p className="font-semibold text-foreground">{selectedClient.name}</p>
                    <p className="text-muted-foreground text-[11px]">
                      {selectedClient.phone || selectedClient.email || 'Sem contato'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedClient(null)}
                    className="h-7 text-xs px-2 shrink-0"
                  >
                    Trocar
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar cliente por nome, telefone ou e-mail..."
                      value={search}
                      onChange={handleSearchChange}
                      className="pl-9 h-10 text-xs rounded-lg"
                    />
                    {searching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  <div className="max-h-40 overflow-y-auto divide-y divide-border border border-border rounded-lg">
                    {clients.length === 0 ? (
                      <div className="p-3 text-center text-xs text-muted-foreground">
                        {searching ? 'Buscando clientes...' : 'Nenhum cliente encontrado.'}
                      </div>
                    ) : (
                      clients.map((c) => (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => setSelectedClient(c)}
                          className="w-full text-left p-2.5 hover:bg-muted/50 transition-colors flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="font-medium text-foreground truncate">{c.name}</span>
                          <span className="text-[11px] text-muted-foreground truncate">
                            {c.phone || c.email}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Aba 2: Novo cliente */}
            <TabsContent value="novo" className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="person-name" className="text-xs font-normal">
                  Nome completo <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="person-name"
                  placeholder="Nome do cliente"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-10 text-xs rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="person-phone" className="text-xs font-normal">
                    Telefone (com DDD)
                  </Label>
                  <Input
                    id="person-phone"
                    placeholder="(00) 00000-0000"
                    value={newPhone}
                    onChange={(e) => setNewPhone(maskPhoneInput(e.target.value))}
                    className="h-10 text-xs rounded-lg tabular"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="person-email" className="text-xs font-normal">
                    E-mail
                  </Label>
                  <Input
                    id="person-email"
                    type="email"
                    placeholder="email@exemplo.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="h-10 text-xs rounded-lg"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="text-xs h-9 rounded-full px-4"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="text-xs h-9 rounded-full px-4 gap-1.5"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Adicionar pessoa</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
