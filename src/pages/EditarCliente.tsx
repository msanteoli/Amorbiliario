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
  PersonType,
  ConsentStatus,
  formatErrorMessage,
} from '@/services/clients'
import {
  maskPhoneInput,
  maskCpfInput,
  maskCnpjInput,
  isValidCpf,
  isValidCnpj,
  formatPhoneNumber,
  KIND_LABELS,
  CONSENT_CHANNEL_OPTIONS,
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
  const [personType, setPersonType] = useState<PersonType>('fisica')
  const [name, setName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [cpf, setCpf] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [rg, setRg] = useState('')
  const [address, setAddress] = useState('')
  const [bankDetails, setBankDetails] = useState('')
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
        setPersonType(clientData.person_type || 'fisica')
        setName(clientData.name || '')
        setCompanyName(clientData.company_name || '')
        setPhone(clientData.phone ? formatPhoneNumber(clientData.phone) : '')
        setEmail(clientData.email || '')
        setKinds(clientData.kind || ['comprador'])
        setResponsibleId(clientData.responsible_id || '')
        setConsentStatus(clientData.consent_status || 'unknown')
        setConsentChannel(clientData.consent_channel || '')

        if (privateData) {
          setCpf(privateData.cpf ? maskCpfInput(privateData.cpf) : '')
          setCnpj(privateData.cnpj ? maskCnpjInput(privateData.cnpj) : '')
          setRg(privateData.rg || '')
          setAddress(privateData.address || '')
          setBankDetails(privateData.bank_details || '')
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
    const rawCnpj = cnpj.replace(/\D/g, '')

    if (!trimmedName) {
      setErrorMessage('Nome é obrigatório.')
      return
    }

    if (personType === 'juridica' && !companyName.trim()) {
      setErrorMessage('Informe a Razão Social para pessoa jurídica.')
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

    if (consentStatus === 'opt_in' && !consentChannel.trim()) {
      setErrorMessage('Selecione o canal de consentimento.')
      return
    }

    if (canSeeCpf && rawCpf && !isValidCpf(rawCpf)) {
      setErrorMessage(personType === 'juridica' ? 'CPF do responsável inválido.' : 'CPF inválido.')
      return
    }

    if (canSeeCpf && personType === 'juridica' && rawCnpj && !isValidCnpj(rawCnpj)) {
      setErrorMessage('CNPJ inválido.')
      return
    }

    if (canSeeCpf && birthDate) {
      const bDate = new Date(birthDate.replace(' ', 'T'))
      if (isNaN(bDate.getTime()) || bDate.getTime() > Date.now()) {
        setErrorMessage('Data de nascimento inválida.')
        return
      }
    }

    if (canSeeCpf && bankDetails.length > 500) {
      setErrorMessage('Dados bancários não podem exceder 500 caracteres.')
      return
    }

    setSaving(true)
    try {
      await updateClient(
        id,
        {
          name: trimmedName,
          person_type: personType,
          company_name: personType === 'juridica' ? companyName.trim() : '',
          phone: trimmedPhone || undefined,
          email: trimmedEmail || undefined,
          kind: kinds,
          responsible_id: isCorretor ? undefined : responsibleId || undefined,
          consent_status: consentStatus,
          consent_channel: consentChannel || undefined,
          cpf: canSeeCpf ? rawCpf : undefined,
          cnpj: canSeeCpf && personType === 'juridica' ? rawCnpj : '',
          birth_date: canSeeCpf ? birthDate : undefined,
          rg: canSeeCpf ? rg.trim() : undefined,
          address: canSeeCpf ? address.trim() : undefined,
          bank_details: canSeeCpf ? bankDetails.trim() : undefined,
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
          <h2 className="text-[20px] font-normal text-foreground">Dados cadastrais</h2>

          {/* Tipo de Pessoa */}
          <div className="space-y-2">
            <label className="text-[13px] font-normal text-foreground block">Tipo de pessoa</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
                <input
                  type="radio"
                  name="personType"
                  value="fisica"
                  checked={personType === 'fisica'}
                  onChange={() => setPersonType('fisica')}
                  className="accent-primary"
                />
                <span>Pessoa física</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
                <input
                  type="radio"
                  name="personType"
                  value="juridica"
                  checked={personType === 'juridica'}
                  onChange={() => setPersonType('juridica')}
                  className="accent-primary"
                />
                <span>Pessoa jurídica</span>
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="edit-name" className="text-[13px] font-normal text-foreground block">
                {personType === 'juridica' ? 'Nome do contato / representante' : 'Nome completo'}{' '}
                <span className="text-destructive">*</span>
              </label>
              <input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {personType === 'juridica' && (
              <div className="space-y-1">
                <label
                  htmlFor="edit-company-name"
                  className="text-[13px] font-normal text-foreground block"
                >
                  Razão social <span className="text-destructive">*</span>
                </label>
                <input
                  id="edit-company-name"
                  placeholder="Ex.: Empresa Imobiliária LTDA"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  maxLength={160}
                  required
                  className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            )}

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

        {/* Tipos de Relação (sem opção de adicionar Proprietário solto; mantém badge se já for) */}
        <div className="space-y-3">
          <div>
            <label className="text-[13px] font-normal text-foreground block">
              Tipos de relação <span className="text-destructive">*</span>
            </label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Proprietários são vinculados pelo cadastro ou ficha do imóvel.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            {(['comprador', 'locatario', 'investidor'] as ClientKind[]).map((k) => (
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
          {kinds.includes('proprietario') && (
            <div className="p-2.5 rounded-lg border border-border bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
              <span>Este cliente é Proprietário vinculado a imóvel(is) (somente leitura).</span>
              <span className="eyebrow text-foreground">Proprietário</span>
            </div>
          )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
            {/* Checkbox "Autorizou o contato" */}
            <div className="space-y-2 pt-1">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="edit-consent-checkbox"
                  checked={consentStatus === 'opt_in'}
                  onCheckedChange={(checked) => {
                    const isChecked = Boolean(checked)
                    setConsentStatus(isChecked ? 'opt_in' : 'unknown')
                    if (!isChecked) {
                      setConsentChannel('')
                    }
                  }}
                  className="mt-1"
                />
                <div className="space-y-1 leading-none">
                  <label
                    htmlFor="edit-consent-checkbox"
                    className="text-sm font-medium text-foreground cursor-pointer"
                  >
                    Autorizou o contato
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Marque quando a pessoa deu o consentimento para ser contatada
                  </p>
                  {consentStatus === 'opt_out' && (
                    <p className="text-xs font-medium text-destructive pt-1">
                      Pediu para não ser contatado
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Select "Canal de consentimento" */}
            <div className="space-y-1">
              <label
                htmlFor="edit-consent-channel"
                className="text-[13px] font-normal text-foreground block"
              >
                Canal de consentimento{' '}
                {consentStatus === 'opt_in' && <span className="text-destructive">*</span>}
              </label>
              <Select
                value={consentChannel}
                onValueChange={(val) => setConsentChannel(val)}
                disabled={consentStatus !== 'opt_in'}
                required={consentStatus === 'opt_in'}
              >
                <SelectTrigger
                  id="edit-consent-channel"
                  className="h-12 rounded-lg border-border bg-background"
                >
                  <SelectValue placeholder="Selecione o canal" />
                </SelectTrigger>
                <SelectContent>
                  {consentChannel &&
                    !CONSENT_CHANNEL_OPTIONS.includes(
                      consentChannel as (typeof CONSENT_CHANNEL_OPTIONS)[number],
                    ) && (
                      <SelectItem value={consentChannel}>{consentChannel} (anterior)</SelectItem>
                    )}
                  {CONSENT_CHANNEL_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Dados Pessoais e Confidenciais (Apenas Admin e Corretor) */}
        {canSeeCpf && hasPrivateAccess && (
          <>
            <div className="border-t border-border" />
            <div className="space-y-4">
              <div>
                <h2 className="text-[20px] font-normal text-foreground">
                  Dados pessoais e confidenciais
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Visíveis apenas pelo corretor responsável e administradores (protegido).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {personType === 'juridica' && (
                  <div className="space-y-1">
                    <label
                      htmlFor="edit-cnpj"
                      className="text-[13px] font-normal text-foreground block"
                    >
                      CNPJ
                    </label>
                    <input
                      id="edit-cnpj"
                      placeholder="00.000.000/0000-00"
                      value={cnpj}
                      onChange={(e) => setCnpj(maskCnpjInput(e.target.value))}
                      maxLength={18}
                      className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring tabular"
                    />
                    {cnpj && !isValidCnpj(cnpj) && (
                      <span className="text-xs text-destructive">CNPJ inválido.</span>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <label
                    htmlFor="edit-cpf"
                    className="text-[13px] font-normal text-foreground block"
                  >
                    {personType === 'juridica' ? 'CPF do responsável' : 'CPF'}
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
                    htmlFor="edit-rg"
                    className="text-[13px] font-normal text-foreground block"
                  >
                    RG
                  </label>
                  <input
                    id="edit-rg"
                    placeholder="Número e órgão emissor"
                    value={rg}
                    onChange={(e) => setRg(e.target.value)}
                    maxLength={30}
                    className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
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

              <div className="space-y-1">
                <label
                  htmlFor="edit-address"
                  className="text-[13px] font-normal text-foreground block"
                >
                  Endereço
                </label>
                <input
                  id="edit-address"
                  placeholder="Logradouro, número, complemento, bairro, cidade/UF, CEP"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  maxLength={300}
                  className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="edit-bank-details"
                  className="text-[13px] font-normal text-foreground block"
                >
                  Dados bancários
                </label>
                <textarea
                  id="edit-bank-details"
                  placeholder="Banco, agência, conta, chave PIX, titular..."
                  value={bankDetails}
                  onChange={(e) => setBankDetails(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="w-full p-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <span className="text-[11px] text-muted-foreground tabular block text-right">
                  {bankDetails.length}/500
                </span>
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
