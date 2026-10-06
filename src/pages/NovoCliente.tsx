import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  checkClientMatch,
  createClient,
  listEligibleResponsibleUsers,
  ResponsibleUser,
  MatchResponse,
  ClientKind,
  ConsentStatus,
  formatErrorMessage,
  ClientPrivateSaveError,
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
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Loader2,
  User,
  Phone,
  Mail,
  ShieldAlert,
} from 'lucide-react'

export default function NovoCliente() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Papéis
  const role = user?.role || ''
  const isSdr = role === 'sdr'
  const isCorretor = role === 'corretor'
  const canSeeCpf = role === 'admin' || role === 'corretor'

  // Etapa atual: 1 (verificação) ou 2 (formulário completo)
  const [step, setStep] = useState<1 | 2>(1)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Dados do formulário
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [cpf, setCpf] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [kinds, setKinds] = useState<ClientKind[]>(['comprador'])
  const [responsibleId, setResponsibleId] = useState<string>(isCorretor && user?.id ? user.id : '')
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>('unknown')
  const [consentChannel, setConsentChannel] = useState('')

  // Guarda o CPF verificado na etapa 1 (apenas dígitos) para detectar mudanças na etapa 2
  const [verifiedCpf, setVerifiedCpf] = useState<string>('')

  // Lista de corretores e admins para responsável
  const [responsibleUsers, setResponsibleUsers] = useState<ResponsibleUser[]>([])

  // Resultado da verificação (match)
  const [matchResult, setMatchResult] = useState<MatchResponse | null>(null)

  useEffect(() => {
    listEligibleResponsibleUsers()
      .then(setResponsibleUsers)
      .catch(() => {})
  }, [])

  // Atualiza responsibleId se for corretor
  useEffect(() => {
    if (isCorretor && user?.id) {
      setResponsibleId(user.id)
    }
  }, [isCorretor, user?.id])

  // Submissão da ETAPA 1
  const handleCheckMatch = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const trimmedName = name.trim()
    const trimmedPhone = phone.trim()
    const trimmedEmail = email.trim()
    const rawCpf = cpf.replace(/\D/g, '')

    if (!trimmedName) {
      setErrorMessage('Informe o nome do cliente.')
      return
    }

    if (!trimmedPhone && !trimmedEmail && !rawCpf) {
      setErrorMessage('Informe telefone, e-mail ou CPF para verificação.')
      return
    }

    if (rawCpf && !isValidCpf(rawCpf)) {
      setErrorMessage('CPF inválido.')
      return
    }

    setChecking(true)
    try {
      const res = await checkClientMatch({
        name: trimmedName,
        phone: trimmedPhone || undefined,
        email: trimmedEmail || undefined,
        cpf: canSeeCpf && rawCpf ? rawCpf : undefined,
      })

      setVerifiedCpf(rawCpf)
      if (res.status === 'none') {
        // Segue direto para a etapa 2
        setMatchResult(null)
        setStep(2)
      } else {
        // Exibe tela com as opções de deduplicação da especificação
        setMatchResult(res)
      }
    } catch (err) {
      setErrorMessage(formatErrorMessage(err))
    } finally {
      setChecking(false)
    }
  }

  // Alterna tipo de relação no checkbox
  const handleToggleKind = (kind: ClientKind) => {
    setKinds((prev) => {
      if (prev.includes(kind)) {
        if (prev.length === 1) return prev // mantém pelo menos um
        return prev.filter((k) => k !== kind)
      } else {
        return [...prev, kind]
      }
    })
  }

  // Executa a criação efetiva do cliente
  const executeCreateClient = async () => {
    if (!user) {
      setErrorMessage('Sessão expirada. Faça login novamente.')
      return
    }

    const trimmedName = name.trim()
    const trimmedPhone = phone.trim()
    const trimmedEmail = email.trim()
    const rawCpf = cpf.replace(/\D/g, '')

    setSaving(true)
    try {
      const created = await createClient(
        {
          name: trimmedName,
          phone: trimmedPhone || undefined,
          email: trimmedEmail || undefined,
          kind: kinds,
          responsible_id: isCorretor ? user.id : responsibleId || undefined,
          consent_status: consentStatus,
          consent_channel: consentChannel || undefined,
          cpf: canSeeCpf && rawCpf ? rawCpf : undefined,
          birth_date: canSeeCpf && birthDate ? birthDate : undefined,
        },
        user,
      )

      navigate(`/clientes/${created.id}`)
    } catch (err) {
      if (err instanceof ClientPrivateSaveError) {
        navigate(`/clientes/${err.clientId}/editar`, {
          state: { errorMessage: err.message },
        })
        return
      }
      setErrorMessage(formatErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  // Submissão da ETAPA 2 (Salvar cliente)
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!user) {
      setErrorMessage('Sessão expirada. Faça login novamente.')
      return
    }

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

    // Se o CPF mudou em relação ao verificado na etapa 1 (inclusive se etapa 1 foi sem CPF),
    // roda a verificação de duplicidade antes de criar qualquer coisa.
    const effectiveCpf = canSeeCpf ? rawCpf : ''
    if (effectiveCpf !== verifiedCpf) {
      setSaving(true)
      try {
        const res = await checkClientMatch({
          name: trimmedName,
          phone: trimmedPhone || undefined,
          email: trimmedEmail || undefined,
          cpf: effectiveCpf || undefined,
        })
        setVerifiedCpf(effectiveCpf)

        if (res.status !== 'none') {
          // Bloqueia a criação e exibe as mesmas opções da etapa 1
          setMatchResult(res)
          setSaving(false)
          return
        }
      } catch (err) {
        setErrorMessage(formatErrorMessage(err))
        setSaving(false)
        return
      }
    }

    await executeCreateClient()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (step === 2 && !matchResult) {
              setStep(1)
            } else {
              navigate('/clientes')
            }
          }}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Novo cliente</h1>
          <p className="text-xs text-muted-foreground">
            {step === 1
              ? 'Etapa 1 de 2: Verificação de duplicidade'
              : 'Etapa 2 de 2: Ficha completa'}
          </p>
        </div>
      </div>

      {/* Erro global */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Se houver matchResult da Etapa 1 */}
      {matchResult && (
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              {matchResult.status === 'same_person' ? (
                <ShieldAlert className="h-5 w-5 text-amber-500" />
              ) : (
                <HelpCircle className="h-5 w-5 text-blue-500" />
              )}
              <CardTitle className="text-lg">
                {matchResult.status === 'same_person'
                  ? 'Cliente já cadastrado'
                  : 'Verificação de duplicidade'}
              </CardTitle>
            </div>
            <CardDescription>
              {matchResult.status === 'same_person'
                ? 'Localizamos um cadastro com os mesmos dados informados.'
                : 'Encontramos um registro com dados semelhantes.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Casos conforme especificação */}
            {(() => {
              const hasVisibleMatch = matchResult.matches.some((m) => m.visible && m.client)
              const firstVisibleClient = matchResult.matches.find(
                (m) => m.visible && m.client,
              )?.client

              // Caso 1: same_person com visible verdadeiro
              if (matchResult.status === 'same_person' && hasVisibleMatch && firstVisibleClient) {
                return (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted/60 border space-y-2">
                      <p className="font-semibold text-foreground">
                        Este cliente já está cadastrado.
                      </p>
                      <div className="text-sm space-y-1 text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-primary" />
                          <span className="font-medium text-foreground">
                            {firstVisibleClient.name}
                          </span>
                        </div>
                        {firstVisibleClient.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            <span>{formatPhoneNumber(firstVisibleClient.phone)}</span>
                          </div>
                        )}
                        {firstVisibleClient.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            <span>{firstVisibleClient.email}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <Button
                        onClick={() => navigate(`/clientes/${firstVisibleClient.id}/editar`)}
                        className="w-full sm:w-auto"
                      >
                        Completar cadastro
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setMatchResult(null)
                        }}
                        className="w-full sm:w-auto"
                      >
                        Voltar
                      </Button>
                    </div>
                  </div>
                )
              }

              // Caso 2: same_person com visible falso
              if (matchResult.status === 'same_person' && !hasVisibleMatch) {
                return (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-sm">
                      Já existe um cliente com esses dados. Fale com o SDR ou o admin.
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setMatchResult(null)
                        }}
                      >
                        Voltar
                      </Button>
                    </div>
                  </div>
                )
              }

              // Caso 3: maybe_same com visible verdadeiro
              if (matchResult.status === 'maybe_same' && hasVisibleMatch && firstVisibleClient) {
                return (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted/60 border space-y-2">
                      <p className="font-semibold text-foreground">É a mesma pessoa?</p>
                      <div className="text-sm space-y-1 text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-primary" />
                          <span className="font-medium text-foreground">
                            {firstVisibleClient.name}
                          </span>
                        </div>
                        {firstVisibleClient.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            <span>{formatPhoneNumber(firstVisibleClient.phone)}</span>
                          </div>
                        )}
                        {firstVisibleClient.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            <span>{firstVisibleClient.email}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <Button
                        onClick={() => navigate(`/clientes/${firstVisibleClient.id}/editar`)}
                        className="w-full sm:w-auto"
                      >
                        Sim, completar o cadastro dele
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setMatchResult(null)
                          if (step === 2) {
                            executeCreateClient()
                          } else {
                            setStep(2)
                          }
                        }}
                        className="w-full sm:w-auto"
                      >
                        Não, criar outro cliente
                      </Button>
                    </div>
                  </div>
                )
              }

              // Caso 4: maybe_same com visible falso
              return (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-sm">
                    Já existe um cliente com esses dados. Fale com o SDR ou o admin.
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button
                      onClick={() => {
                        setMatchResult(null)
                        if (step === 2) {
                          executeCreateClient()
                        } else {
                          setStep(2)
                        }
                      }}
                      className="w-full sm:w-auto"
                    >
                      É outra pessoa, criar novo cliente
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setMatchResult(null)
                        // Permanece na etapa atual
                      }}
                      className="w-full sm:w-auto"
                    >
                      Voltar
                    </Button>
                  </div>
                </div>
              )
            })()}
          </CardContent>
        </Card>
      )}

      {/* ETAPA 1: Formulário de pré-cadastro e verificação */}
      {step === 1 && !matchResult && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">Identificação do cliente</CardTitle>
            <CardDescription>
              Informe os dados básicos para verificarmos se o cliente já existe na imobiliária.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCheckMatch} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="step1-name">
                  Nome do cliente <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="step1-name"
                  placeholder="Nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="step1-phone">Telefone celular</Label>
                  <Input
                    id="step1-phone"
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
                  />
                  <span className="text-xs text-muted-foreground">Com DDD</span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="step1-email">E-mail</Label>
                  <Input
                    id="step1-email"
                    type="email"
                    placeholder="cliente@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* CPF só para admin e corretor. O SDR NÃO vê o campo CPF. */}
              {canSeeCpf && (
                <div className="space-y-2">
                  <Label htmlFor="step1-cpf">CPF</Label>
                  <Input
                    id="step1-cpf"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(maskCpfInput(e.target.value))}
                    maxLength={14}
                  />
                  <span className="text-xs text-muted-foreground">
                    Opcional nesta etapa. Usado para busca precisa de duplicidade.
                  </span>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => navigate('/clientes')}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={checking} className="gap-2">
                  {checking && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>Continuar</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ETAPA 2: Formulário completo */}
      {step === 2 && !matchResult && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">Dados cadastrais completos</CardTitle>
            <CardDescription>
              Preencha o perfil completo do cliente e atribua o corretor responsável.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveClient} className="space-y-6">
              {/* Dados Principais */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="step2-name">
                    Nome completo <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="step2-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="step2-phone">Telefone celular</Label>
                    <Input
                      id="step2-phone"
                      placeholder="(00) 00000-0000"
                      value={phone}
                      onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="step2-email">E-mail</Label>
                    <Input
                      id="step2-email"
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
                <p className="text-xs text-muted-foreground">
                  Selecione uma ou mais relações do cliente com a imobiliária.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  {(['comprador', 'locatario', 'proprietario', 'investidor'] as ClientKind[]).map(
                    (k) => (
                      <div
                        key={k}
                        className="flex items-center space-x-2 border rounded-md p-3 hover:bg-muted/40 transition-colors"
                      >
                        <Checkbox
                          id={`kind-${k}`}
                          checked={kinds.includes(k)}
                          onCheckedChange={() => handleToggleKind(k)}
                        />
                        <Label
                          htmlFor={`kind-${k}`}
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
                <Label htmlFor="step2-responsible">Responsável</Label>
                {isCorretor ? (
                  <div className="p-2.5 rounded-md bg-muted text-sm text-foreground flex items-center justify-between border">
                    <span>{user?.name || user?.email || 'Você (Corretor)'}</span>
                    <span className="text-xs text-muted-foreground font-medium">
                      Fixo (Corretor)
                    </span>
                  </div>
                ) : (
                  <Select
                    value={responsibleId || 'nenhum'}
                    onValueChange={(val) => setResponsibleId(val === 'nenhum' ? '' : val)}
                  >
                    <SelectTrigger id="step2-responsible">
                      <SelectValue placeholder="Selecione o corretor responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Nenhum responsável no momento</SelectItem>
                      {responsibleUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} ({u.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <span className="text-xs text-muted-foreground">
                  {isCorretor
                    ? 'Como corretor, novos clientes ficam automaticamente atribuídos a você.'
                    : 'Atribua um corretor ou administrador para gerenciar o cliente.'}
                </span>
              </div>

              {/* Consentimento LGPD */}
              <div className="space-y-4 pt-2 border-t">
                <Label className="text-sm font-semibold">Consentimento LGPD</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="step2-consent-status">Status de consentimento</Label>
                    <Select
                      value={consentStatus}
                      onValueChange={(val) => setConsentStatus(val as ConsentStatus)}
                    >
                      <SelectTrigger id="step2-consent-status">
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
                    <Label htmlFor="step2-consent-channel">Canal de consentimento</Label>
                    <Input
                      id="step2-consent-channel"
                      placeholder="Ex.: WhatsApp, Formulário web, Presencial"
                      value={consentChannel}
                      onChange={(e) => setConsentChannel(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Dados Pessoais (apenas Admin e Corretor) */}
              {canSeeCpf && (
                <div className="space-y-4 pt-2 border-t">
                  <div>
                    <Label className="text-sm font-semibold">Dados pessoais</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Gravados com segurança em armazenamento protegido.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="step2-cpf">CPF</Label>
                      <Input
                        id="step2-cpf"
                        placeholder="000.000.000-00"
                        value={cpf}
                        onChange={(e) => setCpf(maskCpfInput(e.target.value))}
                        maxLength={14}
                      />
                      {cpf && !isValidCpf(cpf) && (
                        <span className="text-xs text-destructive">
                          Dígitos do CPF não conferem.
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="step2-birthdate">Data de nascimento</Label>
                      <Input
                        id="step2-birthdate"
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="pt-4 border-t flex flex-col sm:flex-row justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={saving}
                >
                  Voltar à etapa 1
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => navigate('/clientes')}
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
                    <span>Salvar cliente</span>
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
