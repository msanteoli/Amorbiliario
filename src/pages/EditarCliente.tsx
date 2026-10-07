import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
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
  const location = useLocation()
  const { user } = useAuth()

  const role = user?.role || ''
  const isCorretor = role === 'corretor'
  const canSeeCpf = role === 'admin' || role === 'corretor'

  const initialError = (location.state as { errorMessage?: string } | null)?.errorMessage || null

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError)

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
    setErrorMessage(initialError)

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
    <div className="max-w-2xl mx-auto space-y-6 pb-28 md:pb-12">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(`/clientes/${id}`)}
          className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted shrink-0 text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="display-sm text-foreground">Editar cliente</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Atualize as informações de contato, relação e dados pessoais.
          </p>
        </div>
      </div>

      {/* Alerta de erro */}
      {errorMessage && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20">
          {errorMessage}
        </div>
      )}

      {/* Formulário em seções sem cartões envolventes, divisores de 1px */}
      <form onSubmit={handleSave} className="space-y-8">
        {/* Dados Principais */}
        <div className="space-y-4">
          <h2 className="text-[20px] font-normal text-foreground">Dados de contato</h2>
          <div className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="edit-name" className="text-[13px] font-normal text-foreground block">
                Nome completo <span className="text-destructive">*</span>
              </label>
              <input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label
                  htmlFor="edit-phone"
                  className="text-[13px] font-normal text-foreground block"
                >
                  Telefone celular
                </label>
                <input
                  id="edit-phone"
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
                  className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring tabular"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="edit-email"
                  className="text-[13px] font-normal text-foreground block"
                >
                  E-mail
                </label>
                <input
                  id="edit-email"
                  type="email"
                  placeholder="cliente@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Tipos de Relação */}
        <div className="space-y-3">
          <label className="text-[13px] font-normal text-foreground block">
            Tipos de relação <span className="text-destructive">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {(['comprador', 'locatario', 'proprietario', 'investidor'] as ClientKind[]).map((k) => (
              <label
                key={k}
                className="flex items-center space-x-2 border border-border rounded-lg p-3 hover:bg-muted/30 cursor-pointer text-xs"
              >
                <Checkbox
                  id={`edit-kind-${k}`}
                  checked={kinds.includes(k)}
                  onCheckedChange={() => handleToggleKind(k)}
                />
                <span>{KIND_LABELS[k]}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Responsável */}
        <div className="space-y-2">
          <label
            htmlFor="edit-responsible"
            className="text-[13px] font-normal text-foreground block"
          >
            Responsável
          </label>
          {isCorretor ? (
            <div className="p-3 rounded-lg bg-muted/30 text-xs text-foreground flex items-center justify-between border border-border">
              <span>{user?.name || user?.email || 'Você (Corretor)'}</span>
              <span className="text-muted-foreground">Fixo</span>
            </div>
          ) : (
            <Select
              value={responsibleId || 'nenhum'}
              onValueChange={(val) => setResponsibleId(val === 'nenhum' ? '' : val)}
            >
              <SelectTrigger
                id="edit-responsible"
                className="h-12 rounded-lg border-border bg-background"
              >
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

        <div className="border-t border-border" />

        {/* Consentimento LGPD */}
        <div className="space-y-4">
          <h2 className="text-[20px] font-normal text-foreground">Consentimento LGPD</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label
                htmlFor="edit-consent-status"
                className="text-[13px] font-normal text-foreground block"
              >
                Status de consentimento
              </label>
              <Select
                value={consentStatus}
                onValueChange={(val) => setConsentStatus(val as ConsentStatus)}
              >
                <SelectTrigger
                  id="edit-consent-status"
                  className="h-12 rounded-lg border-border bg-background"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">{CONSENT_STATUS_LABELS['unknown']}</SelectItem>
                  <SelectItem value="opt_in">{CONSENT_STATUS_LABELS['opt_in']}</SelectItem>
                  <SelectItem value="opt_out">{CONSENT_STATUS_LABELS['opt_out']}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="edit-consent-channel"
                className="text-[13px] font-normal text-foreground block"
              >
                Canal de consentimento
              </label>
              <input
                id="edit-consent-channel"
                placeholder="Ex.: WhatsApp, Presencial"
                value={consentChannel}
                onChange={(e) => setConsentChannel(e.target.value)}
                className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* Dados Pessoais (Apenas Admin e Corretor) */}
        {canSeeCpf && hasPrivateAccess && (
          <>
            <div className="border-t border-border" />
            <div className="space-y-4">
              <h2 className="text-[20px] font-normal text-foreground">Dados pessoais</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label
                    htmlFor="edit-cpf"
                    className="text-[13px] font-normal text-foreground block"
                  >
                    CPF
                  </label>
                  <input
                    id="edit-cpf"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(maskCpfInput(e.target.value))}
                    maxLength={14}
                    className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring tabular"
                  />
                  {cpf && !isValidCpf(cpf) && (
                    <span className="text-xs text-destructive">Dígitos do CPF não conferem.</span>
                  )}
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="edit-birthdate"
                    className="text-[13px] font-normal text-foreground block"
                  >
                    Data de nascimento
                  </label>
                  <input
                    id="edit-birthdate"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring tabular"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Ações Desktop */}
        <div className="hidden md:flex justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/clientes/${id}`)}
            disabled={saving}
            className="h-10 rounded-full px-5 text-xs font-normal border-border"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="h-10 rounded-full px-5 text-xs font-normal bg-primary text-primary-foreground gap-2"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Salvar alterações</span>
          </Button>
        </div>

        {/* Barra fixa móvel */}
        <div className="md:hidden fixed bottom-16 left-0 right-0 z-30 p-3 bg-background/95 backdrop-blur border-t border-border flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/clientes/${id}`)}
            disabled={saving}
            className="flex-1 h-12 rounded-full text-xs font-normal border-border"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="flex-1 h-12 rounded-full text-xs font-normal bg-primary text-primary-foreground gap-2"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Salvar alterações</span>
          </Button>
        </div>
      </form>
    </div>
  )
}
