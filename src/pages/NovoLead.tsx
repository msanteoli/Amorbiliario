import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  intakeLead,
  searchAvailableProperties,
  LeadOrigin,
  LeadConsentStatus,
  formatLeadErrorMessage,
} from '@/services/leads'
import { maskPhoneInput } from '@/lib/clientUtils'
import { PROPERTY_TYPE_LABELS, PropertyType } from '@/services/properties'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2, Search, ExternalLink } from 'lucide-react'

export default function NovoLead() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Guard: corretor que abrir o endereço volta para /leads
  useEffect(() => {
    if (user && user.role === 'corretor') {
      navigate('/leads', { replace: true })
    }
  }, [user, navigate])

  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Feedback states
  interface IntakeResultState {
    status: 'created' | 'existing' | 'pending_review'
    leadId: string
    alreadyClient: boolean
    existingLeadId?: string
  }
  const [result, setResult] = useState<IntakeResultState | null>(null)

  // Form Fields
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [origin, setOrigin] = useState<LeadOrigin | ''>('')
  const [originDetail, setOriginDetail] = useState('')

  // Imóvel de interesse
  const [propertySearch, setPropertySearch] = useState('')
  const [propertySearchResults, setPropertySearchResults] = useState<
    Array<{ id: string; code: string; title: string }>
  >([])
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('')
  const [selectedPropertyLabel, setSelectedPropertyLabel] = useState<string>('')
  const [searchingProperty, setSearchingProperty] = useState(false)

  // Perfil de busca
  const [searchNeighborhood, setSearchNeighborhood] = useState('')
  const [searchType, setSearchType] = useState<string>('')
  const [searchBedrooms, setSearchBedrooms] = useState<string>('')
  const [searchMaxPrice, setSearchMaxPrice] = useState<string>('')

  // Consentimento
  const [consentStatus, setConsentStatus] = useState<LeadConsentStatus>('unknown')

  // Próximo passo e prazo
  const [nextStep, setNextStep] = useState('')
  const [nextStepDue, setNextStepDue] = useState('')

  // Busca de imóveis disponíveis com debounce
  useEffect(() => {
    if (!propertySearch.trim()) {
      setPropertySearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearchingProperty(true)
      try {
        const res = await searchAvailableProperties(propertySearch)
        setPropertySearchResults(
          res.items.map((p) => ({
            id: p.id,
            code: (p.code as string) || '',
            title: (p.title as string) || '',
          })),
        )
      } catch {
        setPropertySearchResults([])
      } finally {
        setSearchingProperty(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [propertySearch])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!name.trim()) {
      setErrorMessage('Informe o nome do lead.')
      return
    }

    if (!phone.trim() && !email.trim()) {
      setErrorMessage('Informe ao menos telefone ou e-mail.')
      return
    }

    if (!origin) {
      setErrorMessage('Origem é obrigatória.')
      return
    }

    setLoading(true)

    try {
      const response = await intakeLead({
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        origin,
        origin_detail: originDetail.trim() || undefined,
        property_id: selectedPropertyId || undefined,
        search_neighborhood: searchNeighborhood.trim() || undefined,
        search_type: searchType || undefined,
        search_bedrooms: searchBedrooms ? Number(searchBedrooms) : undefined,
        search_max_price: searchMaxPrice ? Number(searchMaxPrice) : undefined,
        consent_status: consentStatus,
        next_step: nextStep.trim() || undefined,
        next_step_due: nextStepDue ? new Date(nextStepDue).toISOString() : undefined,
      })

      if (response.status === 'created') {
        // created abre /leads/:id com aviso "Lead cadastrado."
        navigate(`/leads/${response.lead_id}?novo=1`, {
          replace: true,
          state: { message: 'Lead cadastrado.' },
        })
        return
      }

      setResult({
        status: response.status,
        leadId: response.lead_id,
        alreadyClient: response.already_client,
        existingLeadId: response.existing_lead_id,
      })
    } catch (err) {
      setErrorMessage(formatLeadErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-28 md:pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/leads')}
          className="w-11 h-11 rounded-full border border-border flex items-center justify-center hover:bg-muted shrink-0 text-foreground"
          title="Voltar para leads"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="display-sm text-foreground">Novo Lead</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cadastre um novo contato para atendimento e verificação de duplicidade.
          </p>
        </div>
      </div>

      {/* Alerta de feedback para casos existing ou pending_review */}
      {result && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          {result.status === 'existing' && (
            <div className="p-4 rounded-lg border border-border bg-muted/40 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="default">Já é lead</Badge>
                <span className="text-sm font-normal text-foreground">Este lead já existe.</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Um novo registro de contato foi adicionado à ficha do lead correspondente.
                {result.alreadyClient && (
                  <span className="block mt-1 font-medium text-foreground">
                    Esta pessoa já é cliente.
                  </span>
                )}
              </p>
            </div>
          )}

          {result.status === 'pending_review' && (
            <div className="p-4 rounded-lg border border-border bg-muted/40 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="attention">Pendência de duplicidade</Badge>
                <span className="text-sm font-normal text-foreground">
                  Possível duplicidade identificada
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Já existe um lead parecido. Este foi cadastrado como pendência para o SDR resolver.
                {result.alreadyClient && (
                  <span className="block mt-1 font-medium text-foreground">
                    Esta pessoa já é cliente.
                  </span>
                )}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button
              onClick={() => navigate(`/leads/${result.leadId}`)}
              className="h-10 rounded-full px-5 text-xs font-normal bg-primary text-primary-foreground gap-2"
            >
              <span>Abrir lead</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>

            {result.status === 'pending_review' && (
              <Button
                variant="outline"
                onClick={() => navigate('/leads')}
                className="h-10 rounded-full px-5 text-xs font-normal border-border"
              >
                <span>Ver pendências</span>
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => {
                setResult(null)
                setName('')
                setPhone('')
                setEmail('')
                setOrigin('')
                setOriginDetail('')
                setSelectedPropertyId('')
                setSelectedPropertyLabel('')
                setSearchNeighborhood('')
                setSearchType('')
                setSearchBedrooms('')
                setSearchMaxPrice('')
                setNextStep('')
                setNextStepDue('')
              }}
              className="h-10 rounded-full px-5 text-xs font-normal border-border"
            >
              Cadastrar outro lead
            </Button>
          </div>
        </div>
      )}

      {/* Formulário: seções com títulos peso 400 e divisores de 1px */}
      {!result && (
        <form onSubmit={handleSubmit} className="space-y-8">
          {errorMessage && (
            <div className="p-4 rounded-lg border border-destructive/20 text-destructive text-xs">
              {errorMessage}
            </div>
          )}

          {/* Dados Principais */}
          <div className="space-y-4">
            <div>
              <h2 className="text-[20px] font-normal text-foreground">Dados Principais</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Informe o nome e ao menos uma forma de contato (telefone ou e-mail).
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="name" className="text-[13px] font-normal text-foreground block">
                  Nome do lead <span className="text-destructive">*</span>
                </label>
                <input
                  id="name"
                  placeholder="Nome completo ou primeiro contato"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="phone" className="text-[13px] font-normal text-foreground block">
                    Telefone (com DDD)
                  </label>
                  <input
                    id="phone"
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
                    className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring tabular"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="email" className="text-[13px] font-normal text-foreground block">
                    E-mail
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="email@exemplo.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="origin" className="text-[13px] font-normal text-foreground block">
                    Origem <span className="text-destructive">*</span>
                  </label>
                  <Select
                    value={origin}
                    onValueChange={(val) => setOrigin(val as LeadOrigin)}
                    required
                  >
                    <SelectTrigger
                      id="origin"
                      className="h-12 rounded-lg border-border bg-background"
                    >
                      <SelectValue placeholder="Selecione a origem" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="portal">Portais imobiliários</SelectItem>
                      <SelectItem value="indicacao_balcao">Indicação ou balcão</SelectItem>
                      <SelectItem value="site_redes_outros">Instagram, site e outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="origin_detail"
                    className="text-[13px] font-normal text-foreground block"
                  >
                    Detalhe da origem
                  </label>
                  <input
                    id="origin_detail"
                    placeholder="Ex.: Zap Imóveis, VivaReal, indicação do João"
                    value={originDetail}
                    onChange={(e) => setOriginDetail(e.target.value)}
                    maxLength={80}
                    className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="consent" className="text-[13px] font-normal text-foreground block">
                  Consentimento de comunicação
                </label>
                <Select
                  value={consentStatus}
                  onValueChange={(val) => setConsentStatus(val as LeadConsentStatus)}
                >
                  <SelectTrigger
                    id="consent"
                    className="h-12 rounded-lg border-border bg-background"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">Sem informação</SelectItem>
                    <SelectItem value="opt_in">Autorizou</SelectItem>
                    <SelectItem value="opt_out">Não autorizou</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Imóvel de Interesse */}
          <div className="space-y-4">
            <div>
              <h2 className="text-[20px] font-normal text-foreground">Imóvel de Interesse</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Busque entre os imóveis com situação Disponível (opcional).
              </p>
            </div>

            {selectedPropertyId ? (
              <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-muted/20">
                <span className="text-xs font-normal text-foreground">{selectedPropertyLabel}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPropertyId('')
                    setSelectedPropertyLabel('')
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Remover
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar imóvel disponível por código ou título..."
                    value={propertySearch}
                    onChange={(e) => setPropertySearch(e.target.value)}
                    className="w-full h-12 pl-11 pr-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  {searchingProperty && (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>

                {propertySearchResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border bg-card">
                    {propertySearchResults.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 text-xs hover:bg-muted/40 cursor-pointer flex items-center justify-between gap-2"
                        onClick={() => {
                          setSelectedPropertyId(p.id)
                          setSelectedPropertyLabel(`${p.code} - ${p.title}`)
                          setPropertySearch('')
                          setPropertySearchResults([])
                        }}
                      >
                        <span className="eyebrow text-foreground">{p.code}</span>
                        <span className="truncate flex-1 text-muted-foreground">{p.title}</span>
                        <span className="text-xs text-primary underline">Selecionar</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border" />

          {/* Perfil de Busca */}
          <div className="space-y-4">
            <div>
              <h2 className="text-[20px] font-normal text-foreground">Perfil de Busca</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Preferências do cliente para busca ativa de opções (opcional).
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label
                    htmlFor="neighborhood"
                    className="text-[13px] font-normal text-foreground block"
                  >
                    Bairro de interesse
                  </label>
                  <input
                    id="neighborhood"
                    placeholder="Ex.: Centro, Jardins"
                    value={searchNeighborhood}
                    onChange={(e) => setSearchNeighborhood(e.target.value)}
                    maxLength={80}
                    className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="searchType"
                    className="text-[13px] font-normal text-foreground block"
                  >
                    Tipo de imóvel
                  </label>
                  <Select
                    value={searchType || 'nenhum'}
                    onValueChange={(val) => setSearchType(val === 'nenhum' ? '' : val)}
                  >
                    <SelectTrigger
                      id="searchType"
                      className="h-12 rounded-lg border-border bg-background"
                    >
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Não informado</SelectItem>
                      {Object.entries(PROPERTY_TYPE_LABELS).map(([k, label]) => (
                        <SelectItem key={k} value={k}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label
                    htmlFor="bedrooms"
                    className="text-[13px] font-normal text-foreground block"
                  >
                    Quartos mínimos
                  </label>
                  <input
                    id="bedrooms"
                    type="number"
                    min="0"
                    placeholder="Ex.: 2"
                    value={searchBedrooms}
                    onChange={(e) => setSearchBedrooms(e.target.value)}
                    className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring tabular"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="maxPrice"
                    className="text-[13px] font-normal text-foreground block"
                  >
                    Valor máximo (R$)
                  </label>
                  <input
                    id="maxPrice"
                    type="number"
                    min="0"
                    placeholder="Ex.: 500000"
                    value={searchMaxPrice}
                    onChange={(e) => setSearchMaxPrice(e.target.value)}
                    className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring tabular"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Próximo Passo */}
          <div className="space-y-4">
            <div>
              <h2 className="text-[20px] font-normal text-foreground">Próximo Passo e Prazo</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ação imediata prevista para o atendimento deste lead (opcional).
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="nextStep" className="text-[13px] font-normal text-foreground block">
                  Próximo passo
                </label>
                <input
                  id="nextStep"
                  placeholder="Ex.: Ligar no WhatsApp e entender perfil"
                  value={nextStep}
                  onChange={(e) => setNextStep(e.target.value)}
                  maxLength={200}
                  className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="nextStepDue"
                  className="text-[13px] font-normal text-foreground block"
                >
                  Prazo
                </label>
                <input
                  id="nextStepDue"
                  type="datetime-local"
                  value={nextStepDue}
                  onChange={(e) => setNextStepDue(e.target.value)}
                  className="w-full h-12 px-4 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring tabular"
                />
              </div>
            </div>
          </div>

          {/* Ações Desktop */}
          <div className="hidden md:flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/leads')}
              disabled={loading}
              className="h-10 rounded-full px-5 text-xs font-normal border-border"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="h-10 rounded-full px-5 text-xs font-normal bg-primary text-primary-foreground gap-2 min-w-[130px]"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Cadastrar lead</span>
            </Button>
          </div>

          {/* Barra fixa móvel */}
          <div className="md:hidden fixed bottom-16 left-0 right-0 z-30 p-3 bg-background/95 backdrop-blur border-t border-border flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/leads')}
              disabled={loading}
              className="flex-1 h-12 rounded-full text-xs font-normal border-border"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 h-12 rounded-full text-xs font-normal bg-primary text-primary-foreground gap-2"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Cadastrar lead</span>
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
