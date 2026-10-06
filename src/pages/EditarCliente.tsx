import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  getClientById,
  getClientPrivate,
  updateClient,
  listEligibleResponsibleUsers,
  ResponsibleUser,
  ClientKind,
  ConsentStatus,
  formatErrorMessage,
} from '@/services/clients'
import {
  maskPhoneInput,
  maskCpfInput,
  isValidCpf,
  formatPhoneNumber,
  KIND_LABELS,
  CONSENT_STATUS_LABELS,
} from '@/lib/clientUtils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'

export default function EditarCliente() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const role = user?.role || ''
  const isCorretor = role === 'corretor'
  const canSeeCpf = role === 'admin' || role === 'corretor'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Formulário
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [cpf, setCpf] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [kinds, setKinds] = useState<ClientKind[]>(['comprador'])
  const [responsibleId, setResponsibleId] = useState<string>('')
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>('unknown')
  const [consentChannel, setConsentChannel] = useState('')

  // Lista de responsáveis
  const [responsibleUsers, setResponsibleUsers] = useState<ResponsibleUser[]>([])
  // Se o usuário tem permissão para dados pessoais (client_private existiu ou pode cadastrar)
  const [hasPrivateAccess, setHasPrivateAccess] = useState(false)

  useEffect(() => {
    listEligibleResponsibleUsers()
      .then(setResponsibleUsers)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    setErrorMessage(null)

    Promise.all([getClientById(id), getClientPrivate(id)])
      .then(([clientData, privateData]) => {
        if (!active) return
        setName(clientData.name || '')
        setPhone(clientData.phone ? formatPhoneNumber(clientData.phone) : '')
        setEmail(clientData.email || '')
        setKinds(clientData.kind || ['comprador'])
        setResponsibleId(clientData.responsible_id || '')
        setConsentStatus(clientData.consent_status || 'unknown')
        setConsentChannel(clientData.consent_channel || '')

        if (privateData) {
          setCpf(privateData.cpf ? maskCpfInput(privateData.cpf) : '')
          setBirthDate(
            privateData.birth_date ? privateData.birth_date.split(' ')[0].split('T')[0] : '',
          )
          setHasPrivateAccess(true)
        } else if (canSeeCpf) {
          setHasPrivateAccess(true)
        }
      })
      .catch((err) => {
        if (!active) return
        setErrorMessage(formatErrorMessage(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [id, canSeeCpf])

  const handleToggleKind = (kind: ClientKind) => {
    setKinds((prev) => {
      if (prev.includes(kind)) {
        if (prev.length === 1) return prev
        return prev.filter((k) => k !== kind)
      } else {
        return [...prev, kind]
      }
    })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !user) return
    setErrorMessage(null)

    const trimmedName = name.trim()
    const trimmedPhone = phone.trim()
    const trimmedEmail = email.trim()
    const rawCpf = cpf.replace(/\D/g, '')

    if (!trimmedName) {
      setErrorMessage('Nome é obrigatório.')
      return
    }

    if (!trimmedPhone && !trimmedEmail) {
      setErrorMessage('Informe ao menos telefone ou e-mail.')
      return
    }

    if (kinds.length === 0) {
      setErrorMessage('Selecione ao menos um tipo de relação.')
      return
    }

    if (canSeeCpf && rawCpf && !isValidCpf(rawCpf)) {
      setErrorMessage('CPF inválido.')
      return
    }

    if (canSeeCpf && birthDate) {
      const bDate = new Date(birthDate.replace(' ', 'T'))
      if (isNaN(bDate.getTime()) || bDate.getTime() > Date.now()) {
        setErrorMessage('Data de nascimento inválida.')
        return
      }
    }

    setSaving(true)
    try {
      await updateClient(
        id,
        {
          name: trimmedName,
          phone: trimmedPhone || undefined,
          email: trimmedEmail || undefined,
          kind: kinds,
          responsible_id: isCorretor ? undefined : responsibleId || undefined,
          consent_status: consentStatus,
          consent_channel: consentChannel || undefined,
          cpf: canSeeCpf ? rawCpf : undefined,
          birth_date: canSeeCpf ? birthDate : undefined,
        },
        user,
      )

      navigate(`/clientes/${id}`)
    } catch (err) {
      setErrorMessage(formatErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-muted-foreground gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Carregando dados para edição...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/clientes/${id}`)}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Editar cliente</h1>
          <p className="text-xs text-muted-foreground">
            Atualize as informações de contato, relação e dados pessoais.
          </p>
        </div>
      </div>

      {/* Alerta de erro */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">Formulário de edição</CardTitle>
          <CardDescription>Campos com * são obrigatórios.</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            {/* Dados Principais */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">
                  Nome completo <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Telefone celular</Label>
                  <Input
                    id="edit-phone"
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-email">E-mail</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    placeholder="cliente@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                * Informe ao menos telefone ou e-mail para contato.
              </p>
            </div>

            {/* Tipos de Relação */}
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-sm font-semibold">
                Tipos de relação <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                {(['comprador', 'locatario', 'proprietario', 'investidor'] as ClientKind[]).map(
                  (k) => (
                    <div
                      key={k}
                      className="flex items-center space-x-2 border rounded-md p-3 hover:bg-muted/40 transition-colors"
                    >
                      <Checkbox
                        id={`edit-kind-${k}`}
                        checked={kinds.includes(k)}
                        onCheckedChange={() => handleToggleKind(k)}
                      />
                      <Label
                        htmlFor={`edit-kind-${k}`}
                        className="text-sm font-normal cursor-pointer leading-none"
                      >
                        {KIND_LABELS[k]}
                      </Label>
                    </div>
                  ),
                )}
              </div>
            </div>

            {/* Responsável */}
            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor="edit-responsible">Responsável</Label>
              {isCorretor ? (
                <div className="p-2.5 rounded-md bg-muted text-sm text-foreground flex items-center justify-between border">
                  <span>{user?.name || user?.email || 'Você (Corretor)'}</span>
                  <span className="text-xs text-muted-foreground font-medium">Fixo (Corretor)</span>
                </div>
              ) : (
                <Select
                  value={responsibleId || 'nenhum'}
                  onValueChange={(val) => setResponsibleId(val === 'nenhum' ? '' : val)}
                >
                  <SelectTrigger id="edit-responsible">
                    <SelectValue placeholder="Selecione o corretor responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Nenhum responsável</SelectItem>
                    {responsibleUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Consentimento LGPD */}
            <div className="space-y-4 pt-2 border-t">
              <Label className="text-sm font-semibold">Consentimento LGPD</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-consent-status">Status de consentimento</Label>
                  <Select
                    value={consentStatus}
                    onValueChange={(val) => setConsentStatus(val as ConsentStatus)}
                  >
                    <SelectTrigger id="edit-consent-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unknown">{CONSENT_STATUS_LABELS['unknown']}</SelectItem>
                      <SelectItem value="opt_in">{CONSENT_STATUS_LABELS['opt_in']}</SelectItem>
                      <SelectItem value="opt_out">{CONSENT_STATUS_LABELS['opt_out']}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-consent-channel">Canal de consentimento</Label>
                  <Input
                    id="edit-consent-channel"
                    placeholder="Ex.: WhatsApp, Presencial"
                    value={consentChannel}
                    onChange={(e) => setConsentChannel(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Dados Pessoais (Apenas Admin e Corretor) */}
            {canSeeCpf && hasPrivateAccess && (
              <div className="space-y-4 pt-2 border-t">
                <div>
                  <Label className="text-sm font-semibold">Dados pessoais</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Armazenados em client_private com regras estritas de acesso.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-cpf">CPF</Label>
                    <Input
                      id="edit-cpf"
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={(e) => setCpf(maskCpfInput(e.target.value))}
                      maxLength={14}
                    />
                    {cpf && !isValidCpf(cpf) && (
                      <span className="text-xs text-destructive">Dígitos do CPF não conferem.</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-birthdate">Data de nascimento</Label>
                    <Input
                      id="edit-birthdate"
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Ações */}
            <div className="pt-4 border-t flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/clientes/${id}`)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <span>Salvar alterações</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
