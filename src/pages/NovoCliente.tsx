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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
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

      if (res.status === 'none') {
        // Só marca como verificado quando não encontrou duplicidade
        setVerifiedCpf(rawCpf)
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
    // ou se ainda não foi verificado com sucesso ('none' ou confirmação explícita),
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

        if (res.status !== 'none') {
          // Bloqueia a criação e exibe as mesmas opções da etapa 1
          setMatchResult(res)
          setSaving(false)
          return
        }
        // Só marca como verificado quando o resultado for 'none'
        setVerifiedCpf(effectiveCpf)
      } catch (err) {
        setErrorMessage(formatErrorMessage(err))
        setSaving(false)
        return
      }
    }

    await executeCreateClient()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-28 md:pb-12">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (step === 2 && !matchResult) {
              setStep(1)
            } else {
              navigate('/clientes')
            }
          }}
          className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted shrink-0 text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="display-sm text-foreground">Novo cliente</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {step === 1
              ? 'Etapa 1 de 2: Verificação de duplicidade'
              : 'Etapa 2 de 2: Ficha completa'}
          </p>
        </div>
      </div>

      {/* Erro global */}
      {errorMessage && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20">
          {errorMessage}
        </div>
      )}

      {/* Se houver matchResult da Etapa 1 */}
      {matchResult && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant={matchResult.status === 'same_person' ? 'attention' : 'default'}>
                {matchResult.status === 'same_person'
                  ? 'Cliente já cadastrado'
                  : 'Verificação de duplicidade'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {matchResult.status === 'same_person'
                ? 'Localizamos um cadastro com os mesmos dados informados.'
                : 'Encontramos um registro com dados semelhantes.'}
            </p>
          </div>

          <div>
            {(() => {
              const hasVisibleMatch = matchResult.matches.some((m) => m.visible && m.client)
              const firstVisibleClient = matchResult.matches.find(
                (m) => m.visible && m.client,
              )?.client

              if (matchResult.status === 'same_person' && hasVisibleMatch && firstVisibleClient) {
                return (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-lg bg-muted/20 border border-border space-y-2 text-xs">
                      <p className="font-normal text-foreground">
                        Este cliente já está cadastrado.
                      </p>
                      <div className="space-y-1 text-muted-foreground tabular">
                        <div>Nome: {firstVisibleClient.name}</div>
                        {firstVisibleClient.phone && (
                          <div>Telefone: {formatPhoneNumber(firstVisibleClient.phone)}</div>
                        )}
                        {firstVisibleClient.email && <div>E-mail: {firstVisibleClient.email}</div>}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        onClick={() => navigate(`/clientes/${firstVisibleClient.id}/editar`)}
                        className="h-9 rounded-full px-4 text-xs font-normal bg-primary text-primary-foreground"
                      >
                        Completar cadastro
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setMatchResult(null)}
                        className="h-9 rounded-full px-4 text-xs font-normal border-border"
                      >
                        Voltar
                      </Button>
                    </div>
                  </div>
                )
              }

              if (matchResult.status === 'same_person' && !hasVisibleMatch) {
                return (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-lg border border-attention/40 bg-muted/20 text-xs">
                      Já existe um cliente com esses dados. Fale com o SDR ou o admin.
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setMatchResult(null)}
                      className="h-9 rounded-full px-4 text-xs font-normal border-border"
                    >
                      Voltar
                    </Button>
                  </div>
                )
              }

              if (matchResult.status === 'maybe_same' && hasVisibleMatch && firstVisibleClient) {
                return (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-lg bg-muted/20 border border-border space-y-2 text-xs">
                      <p className="font-normal text-foreground">É a mesma pessoa?</p>
                      <div className="space-y-1 text-muted-foreground tabular">
                        <div>Nome: {firstVisibleClient.name}</div>
                        {firstVisibleClient.phone && (
                          <div>Telefone: {formatPhoneNumber(firstVisibleClient.phone)}</div>
                        )}
                        {firstVisibleClient.email && <div>E-mail: {firstVisibleClient.email}</div>}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        onClick={() => navigate(`/clientes/${firstVisibleClient.id}/editar`)}
                        className="h-9 rounded-full px-4 text-xs font-normal bg-primary text-primary-foreground"
                      >
                        Sim, completar o cadastro dele
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const rawCpf = cpf.replace(/\D/g, '')
                          const effectiveCpf = canSeeCpf ? rawCpf : ''
                          setVerifiedCpf(effectiveCpf)
                          setMatchResult(null)
                          if (step === 2) {
                            executeCreateClient()
                          } else {
                            setStep(2)
                          }
                        }}
                        className="h-9 rounded-full px-4 text-xs font-normal border-border"
                      >
                        Não, criar outro cliente
                      </Button>
                    </div>
                  </div>
                )
              }

              return (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-lg border border-attention/40 bg-muted/20 text-xs">
                    Já existe um cliente com esses dados. Fale com o SDR ou o admin.
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      onClick={() => {
                        const rawCpf = cpf.replace(/\D/g, '')
                        const effectiveCpf = canSeeCpf ? rawCpf : ''
                        setVerifiedCpf(effectiveCpf)
                        setMatchResult(null)
                        if (step === 2) {
                          executeCreateClient()
                        } else {
                          setStep(2)
                        }
                      }}
                      className="h-9 rounded-full px-4 text-xs font-normal bg-primary text-primary-foreground"
                    >
                      É outra pessoa, criar novo cliente
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setMatchResult(null)}
                      className="h-9 rounded-full px-4 text-xs font-normal border-border"
                    >
                      Voltar
                    </Button>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ETAPA 1: Formulário de pré-cadastro e verificação */}
      {step === 1 && !matchResult && (
        <form onSubmit={handleCheckMatch} className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-[20px] font-normal text-foreground">Identificação do cliente</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Informe os dados básicos para verificarmos se o cliente já existe na imobiliária.
            </p>

            <div className="space-y-4">
              <div className="space-y-1">
                <label
                  htmlFor="step1-name"
                  className="text-[13px] font-normal text-foreground block"
                >
                  Nome do cliente <span className="text-destructive">*</span>
                </label>
                <input
                  id="step1-name"
                  placeholder="Nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label
                    htmlFor="step1-phone"
                    className="text-[13px] font-normal text-foreground block"
                  >
                    Telefone celular
                  </label>
                  <input
                    id="step1-phone"
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
                    className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring tabular"
                  />
                  <span className="text-[11px] text-muted-foreground">Com DDD</span>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="step1-email"
                    className="text-[13px] font-normal text-foreground block"
                  >
                    E-mail
                  </label>
                  <input
                    id="step1-email"
                    type="email"
                    placeholder="cliente@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              {canSeeCpf && (
                <div className="space-y-1">
                  <label
                    htmlFor="step1-cpf"
                    className="text-[13px] font-normal text-foreground block"
                  >
                    CPF
                  </label>
                  <input
                    id="step1-cpf"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(maskCpfInput(e.target.value))}
                    maxLength={14}
                    className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring tabular"
                  />
                  <span className="text-[11px] text-muted-foreground block">
                    Opcional nesta etapa. Usado para busca precisa de duplicidade.
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="hidden md:flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/clientes')}
              className="h-10 rounded-full px-5 text-xs font-normal border-border"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={checking}
              className="h-10 rounded-full px-5 text-xs font-normal bg-primary text-primary-foreground gap-2"
            >
              {checking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Continuar</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="md:hidden fixed bottom-16 left-0 right-0 z-30 p-3 bg-background/95 backdrop-blur border-t border-border flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/clientes')}
              className="flex-1 h-12 rounded-full text-xs font-normal border-border"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={checking}
              className="flex-1 h-12 rounded-full text-xs font-normal bg-primary text-primary-foreground gap-2"
            >
              {checking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Continuar</span>
            </Button>
          </div>
        </form>
      )}

      {/* ETAPA 2: Formulário completo */}
      {step === 2 && !matchResult && (
        <form onSubmit={handleSaveClient} className="space-y-8">
          {/* Dados Principais */}
          <div className="space-y-4">
            <h2 className="text-[20px] font-normal text-foreground">Dados cadastrais completos</h2>
            <div className="space-y-4">
              <div className="space-y-1">
                <label
                  htmlFor="step2-name"
                  className="text-[13px] font-normal text-foreground block"
                >
                  Nome completo <span className="text-destructive">*</span>
                </label>
                <input
                  id="step2-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label
                    htmlFor="step2-phone"
                    className="text-[13px] font-normal text-foreground block"
                  >
                    Telefone celular
                  </label>
                  <input
                    id="step2-phone"
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
                    className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring tabular"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="step2-email"
                    className="text-[13px] font-normal text-foreground block"
                  >
                    E-mail
                  </label>
                  <input
                    id="step2-email"
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
              {(['comprador', 'locatario', 'proprietario', 'investidor'] as ClientKind[]).map(
                (k) => (
                  <label
                    key={k}
                    className="flex items-center space-x-2 border border-border rounded-lg p-3 hover:bg-muted/30 cursor-pointer text-xs"
                  >
                    <Checkbox
                      id={`kind-${k}`}
                      checked={kinds.includes(k)}
                      onCheckedChange={() => handleToggleKind(k)}
                    />
                    <span>{KIND_LABELS[k]}</span>
                  </label>
                ),
              )}
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Responsável */}
          <div className="space-y-2">
            <label
              htmlFor="step2-responsible"
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
                  id="step2-responsible"
                  className="h-12 rounded-lg border-border bg-background"
                >
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
          </div>

          <div className="border-t border-border" />

          {/* Consentimento LGPD */}
          <div className="space-y-4">
            <h2 className="text-[20px] font-normal text-foreground">Consentimento LGPD</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label
                  htmlFor="step2-consent-status"
                  className="text-[13px] font-normal text-foreground block"
                >
                  Status de consentimento
                </label>
                <Select
                  value={consentStatus}
                  onValueChange={(val) => setConsentStatus(val as ConsentStatus)}
                >
                  <SelectTrigger
                    id="step2-consent-status"
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
                  htmlFor="step2-consent-channel"
                  className="text-[13px] font-normal text-foreground block"
                >
                  Canal de consentimento
                </label>
                <input
                  id="step2-consent-channel"
                  placeholder="Ex.: WhatsApp, Formulário web, Presencial"
                  value={consentChannel}
                  onChange={(e) => setConsentChannel(e.target.value)}
                  className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          </div>

          {/* Dados Pessoais (apenas Admin e Corretor) */}
          {canSeeCpf && (
            <>
              <div className="border-t border-border" />
              <div className="space-y-4">
                <h2 className="text-[20px] font-normal text-foreground">Dados pessoais</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label
                      htmlFor="step2-cpf"
                      className="text-[13px] font-normal text-foreground block"
                    >
                      CPF
                    </label>
                    <input
                      id="step2-cpf"
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
                      htmlFor="step2-birthdate"
                      className="text-[13px] font-normal text-foreground block"
                    >
                      Data de nascimento
                    </label>
                    <input
                      id="step2-birthdate"
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

          {/* Botões de Ação Desktop */}
          <div className="hidden md:flex justify-between items-center pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(1)}
              disabled={saving}
              className="h-10 rounded-full px-5 text-xs font-normal border-border"
            >
              Voltar à etapa 1
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/clientes')}
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
                <span>Salvar cliente</span>
              </Button>
            </div>
          </div>

          {/* Barra fixa móvel */}
          <div className="md:hidden fixed bottom-16 left-0 right-0 z-30 p-3 bg-background/95 backdrop-blur border-t border-border flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(1)}
              disabled={saving}
              className="flex-1 h-12 rounded-full text-xs font-normal border-border"
            >
              Voltar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="flex-1 h-12 rounded-full text-xs font-normal bg-primary text-primary-foreground gap-2"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Salvar cliente</span>
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
