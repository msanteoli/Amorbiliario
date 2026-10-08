import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, UserCheck, UserPlus, AlertCircle, Search } from 'lucide-react'
import {
  linkExistingPropertyOwner,
  linkNewPropertyOwner,
  formatErrorMessage,
} from '@/services/properties'
import { listClients, ClientRecord } from '@/services/clients'
import { maskPhoneInput } from '@/lib/clientUtils'

interface LinkOwnerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  propertyCode: string
  onLinked: () => void
}

export function LinkOwnerModal({
  open,
  onOpenChange,
  propertyId,
  propertyCode,
  onLinked,
}: LinkOwnerModalProps) {
  const [tab, setTab] = useState<'existing' | 'new'>('existing')

  // Estado: Cliente existente
  const [searchTerm, setSearchTerm] = useState('')
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState('')

  // Estado: Novo cliente
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')

  // Estado: Conflito 409
  const [conflictClientId, setConflictClientId] = useState<string | null>(null)
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)

  // Status de envio
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Reseta ao abrir
  useEffect(() => {
    if (open) {
      setTab('existing')
      setSearchTerm('')
      setSelectedClientId('')
      setNewName('')
      setNewPhone('')
      setNewEmail('')
      setConflictClientId(null)
      setConflictMessage(null)
      setErrorMessage(null)
      loadClients()
    }
  }, [open])

  const loadClients = async (query = '') => {
    setLoadingClients(true)
    try {
      const res = await listClients({ search: query, perPage: 30 })
      setClients(res.items)
    } catch {
      setClients([])
    } finally {
      setLoadingClients(false)
    }
  }

  const handleSearchChange = (val: string) => {
    setSearchTerm(val)
    loadClients(val)
  }

  // Vincular existente
  const handleLinkExisting = async (clientIdToUse?: string) => {
    const idToLink = clientIdToUse || selectedClientId
    if (!idToLink) {
      setErrorMessage('Selecione um cliente para vincular.')
      return
    }

    setSaving(true)
    setErrorMessage(null)
    try {
      await linkExistingPropertyOwner(propertyId, idToLink)
      onLinked()
      onOpenChange(false)
    } catch (err) {
      setErrorMessage(formatErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  // Cadastrar novo e vincular
  const handleCreateAndLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setConflictClientId(null)
    setConflictMessage(null)

    const trimmedName = newName.trim()
    if (trimmedName.length < 2) {
      setErrorMessage('Informe o nome completo do proprietário.')
      return
    }

    setSaving(true)
    try {
      const result = await linkNewPropertyOwner(propertyId, {
        name: trimmedName,
        phone: newPhone.trim(),
        email: newEmail.trim(),
      })

      if (result.existing_client_id) {
        // Conflito 409
        setConflictClientId(result.existing_client_id)
        setConflictMessage(result.message || 'Já existe um cliente com este contato.')
      } else {
        onLinked()
        onOpenChange(false)
      }
    } catch (err) {
      setErrorMessage(formatErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-5">
        <DialogHeader>
          <DialogTitle className="text-lg font-normal text-foreground flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            <span>Vincular proprietário · {propertyCode}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Escolha um cliente da base ou cadastre um novo proprietário diretamente.
          </DialogDescription>
        </DialogHeader>

        {/* Alternador de abas: Existente vs Novo */}
        <div className="inline-flex p-1 rounded-full border border-border bg-muted/40 gap-1 w-full mt-2">
          <button
            type="button"
            onClick={() => {
              setTab('existing')
              setConflictClientId(null)
              setConflictMessage(null)
              setErrorMessage(null)
            }}
            className={`flex-1 h-9 px-3 rounded-full text-xs font-normal transition-colors flex items-center justify-center gap-1.5 ${
              tab === 'existing'
                ? 'bg-primary text-primary-foreground font-medium'
                : 'bg-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span>Escolher cliente existente</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('new')
              setConflictClientId(null)
              setConflictMessage(null)
              setErrorMessage(null)
            }}
            className={`flex-1 h-9 px-3 rounded-full text-xs font-normal transition-colors flex items-center justify-center gap-1.5 ${
              tab === 'new'
                ? 'bg-primary text-primary-foreground font-medium'
                : 'bg-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Cadastrar novo</span>
          </button>
        </div>

        {/* Mensagem de Erro Geral */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 font-normal">
            {errorMessage}
          </div>
        )}

        {/* Mensagem de Conflito 409 com botão Usar este cliente */}
        {conflictClientId && (
          <div className="p-3 rounded-lg bg-attention/15 border border-attention/30 text-xs text-foreground space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-attention shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <p className="font-medium text-attention-foreground">
                  Já existe um cliente com este contato
                </p>
                <p className="text-muted-foreground text-[11px]">{conflictMessage}</p>
              </div>
            </div>
            <div className="pt-1 flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={() => handleLinkExisting(conflictClientId)}
                disabled={saving}
                className="h-8 rounded-full px-4 text-xs font-normal bg-primary text-primary-foreground gap-1"
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                <span>Usar este cliente</span>
              </Button>
            </div>
          </div>
        )}

        {/* Conteúdo Aba Existente */}
        {tab === 'existing' && (
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label
                htmlFor="search-existing-client"
                className="text-[13px] font-normal text-foreground block"
              >
                Buscar por nome, telefone ou e-mail
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-existing-client"
                  placeholder="Digite para filtrar..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9 h-11 text-sm border-border"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="select-existing-client"
                className="text-[13px] font-normal text-foreground block"
              >
                Selecione o cliente
              </label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger id="select-existing-client" className="h-11 text-sm border-border">
                  <SelectValue placeholder="Selecione um cliente..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {loadingClients ? (
                    <div className="p-3 text-xs text-muted-foreground text-center">
                      Carregando clientes...
                    </div>
                  ) : clients.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground text-center">
                      Nenhum cliente encontrado.
                    </div>
                  ) : (
                    clients.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.name} {c.phone ? `(${c.phone})` : ''} {c.email ? `· ${c.email}` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
                className="h-9 rounded-full px-4 text-xs font-normal border-border"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => handleLinkExisting()}
                disabled={saving || !selectedClientId}
                className="h-9 rounded-full px-5 text-xs font-normal bg-primary text-primary-foreground gap-1.5"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Vincular proprietário</span>
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Conteúdo Aba Cadastrar Novo */}
        {tab === 'new' && (
          <form onSubmit={handleCreateAndLink} className="space-y-3.5 pt-1">
            <div className="space-y-1.5">
              <label
                htmlFor="owner-new-name"
                className="text-[13px] font-normal text-foreground block"
              >
                Nome completo <span className="text-destructive">*</span>
              </label>
              <Input
                id="owner-new-name"
                placeholder="Ex.: Carlos Drummond"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                maxLength={100}
                className="h-11 text-sm border-border"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="owner-new-phone"
                  className="text-[13px] font-normal text-foreground block"
                >
                  Telefone / WhatsApp
                </label>
                <Input
                  id="owner-new-phone"
                  placeholder="(71) 99999-9999"
                  value={newPhone}
                  onChange={(e) => setNewPhone(maskPhoneInput(e.target.value))}
                  maxLength={16}
                  className="h-11 text-sm border-border"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="owner-new-email"
                  className="text-[13px] font-normal text-foreground block"
                >
                  E-mail
                </label>
                <Input
                  id="owner-new-email"
                  type="email"
                  placeholder="carlos@exemplo.com.br"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  maxLength={100}
                  className="h-11 text-sm border-border"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
                className="h-9 rounded-full px-4 text-xs font-normal border-border"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="h-9 rounded-full px-5 text-xs font-normal bg-primary text-primary-foreground gap-1.5"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Salvar e vincular</span>
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
