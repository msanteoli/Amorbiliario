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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Search,
  ExternalLink,
} from 'lucide-react'

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
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/leads')}
          title="Voltar para leads"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Novo Lead
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadastre um novo contato para atendimento e verificação de duplicidade.
          </p>
        </div>
      </div>

      {/* Alerta de feedback para casos existing ou pending_review */}
      {result && (
        <Card className="border-border">
          <CardContent className="p-6 space-y-4">
            {result.status === 'existing' && (
              <Alert className="border-blue-300 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-900">
                <AlertCircle className="h-5 w-5 text-blue-600" />
                <AlertTitle className="text-blue-900 dark:text-blue-200 font-semibold">
                  Este lead já existe.
                </AlertTitle>
                <AlertDescription className="text-blue-800 dark:text-blue-300 text-sm mt-1">
                  Um novo registro de contato foi adicionado à ficha do lead correspondente.
                  {result.alreadyClient && (
                    <span className="block mt-1 font-medium">Esta pessoa já é cliente.</span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {result.status === 'pending_review' && (
              <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <AlertTitle className="text-amber-900 dark:text-amber-200 font-semibold">
                  Possível duplicidade identificada
                </AlertTitle>
                <AlertDescription className="text-amber-800 dark:text-amber-300 text-sm mt-1">
                  Já existe um lead parecido. Este foi cadastrado como pendência para o SDR
                  resolver.
                  {result.alreadyClient && (
                    <span className="block mt-1 font-medium">Esta pessoa já é cliente.</span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button onClick={() => navigate(`/leads/${result.leadId}`)} className="gap-2">
                <span>Abrir lead</span>
                <ExternalLink className="h-4 w-4" />
              </Button>

              {result.status === 'pending_review' && (
                <Button variant="outline" onClick={() => navigate('/leads')} className="gap-2">
                  <span>Ver pendências</span>
                </Button>
              )}

              <Button
                variant="ghost"
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
              >
                Cadastrar outro lead
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formulário */}
      {!result && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {errorMessage && (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Dados Principais */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dados Principais</CardTitle>
              <CardDescription>
                Informe o nome e ao menos uma forma de contato (telefone ou e-mail).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Nome do lead <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Nome completo ou primeiro contato"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone (com DDD)</Label>
                  <Input
                    id="phone"
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@exemplo.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="origin">
                    Origem <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={origin}
                    onValueChange={(val) => setOrigin(val as LeadOrigin)}
                    required
                  >
                    <SelectTrigger id="origin">
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

                <div className="space-y-2">
                  <Label htmlFor="origin_detail">Detalhe da origem</Label>
                  <Input
                    id="origin_detail"
                    placeholder="Ex.: Zap Imóveis, VivaReal, indicação do João"
                    value={originDetail}
                    onChange={(e) => setOriginDetail(e.target.value)}
                    maxLength={80}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="consent">Consentimento de comunicação</Label>
                <Select
                  value={consentStatus}
                  onValueChange={(val) => setConsentStatus(val as LeadConsentStatus)}
                >
                  <SelectTrigger id="consent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">Sem informação</SelectItem>
                    <SelectItem value="opt_in">Autorizou</SelectItem>
                    <SelectItem value="opt_out">Não autorizou</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Imóvel de Interesse */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Imóvel de Interesse</CardTitle>
              <CardDescription>
                Busque entre os imóveis com situação Disponível (opcional).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedPropertyId ? (
                <div className="flex items-center justify-between p-3 rounded-md border bg-muted/40">
                  <span className="text-sm font-medium">{selectedPropertyLabel}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedPropertyId('')
                      setSelectedPropertyLabel('')
                    }}
                  >
                    Remover
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar imóvel disponível por código ou título..."
                      value={propertySearch}
                      onChange={(e) => setPropertySearch(e.target.value)}
                      className="pl-9"
                    />
                    {searchingProperty && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {propertySearchResults.length > 0 && (
                    <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border bg-card">
                      {propertySearchResults.map((p) => (
                        <div
                          key={p.id}
                          className="p-2.5 text-xs hover:bg-muted cursor-pointer flex items-center justify-between gap-2"
                          onClick={() => {
                            setSelectedPropertyId(p.id)
                            setSelectedPropertyLabel(`${p.code} - ${p.title}`)
                            setPropertySearch('')
                            setPropertySearchResults([])
                          }}
                        >
                          <span className="font-semibold text-primary">{p.code}</span>
                          <span className="truncate flex-1 text-muted-foreground">{p.title}</span>
                          <span className="text-primary font-medium">Selecionar</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Perfil de Busca */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Perfil de Busca</CardTitle>
              <CardDescription>
                Preferências do cliente para busca ativa de opções (opcional).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="neighborhood">Bairro de interesse</Label>
                  <Input
                    id="neighborhood"
                    placeholder="Ex.: Centro, Jardins"
                    value={searchNeighborhood}
                    onChange={(e) => setSearchNeighborhood(e.target.value)}
                    maxLength={80}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="searchType">Tipo de imóvel</Label>
                  <Select
                    value={searchType || 'nenhum'}
                    onValueChange={(val) => setSearchType(val === 'nenhum' ? '' : val)}
                  >
                    <SelectTrigger id="searchType">
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
                <div className="space-y-2">
                  <Label htmlFor="bedrooms">Quartos mínimos</Label>
                  <Input
                    id="bedrooms"
                    type="number"
                    min="0"
                    placeholder="Ex.: 2"
                    value={searchBedrooms}
                    onChange={(e) => setSearchBedrooms(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxPrice">Valor máximo (R$)</Label>
                  <Input
                    id="maxPrice"
                    type="number"
                    min="0"
                    placeholder="Ex.: 500000"
                    value={searchMaxPrice}
                    onChange={(e) => setSearchMaxPrice(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Próximo Passo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Próximo Passo e Prazo</CardTitle>
              <CardDescription>
                Ação imediata prevista para o atendimento deste lead (opcional).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nextStep">Próximo passo</Label>
                <Input
                  id="nextStep"
                  placeholder="Ex.: Ligar no WhatsApp e entender perfil"
                  value={nextStep}
                  onChange={(e) => setNextStep(e.target.value)}
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nextStepDue">Prazo</Label>
                <Input
                  id="nextStepDue"
                  type="datetime-local"
                  value={nextStepDue}
                  onChange={(e) => setNextStepDue(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Ações */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/leads')}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Cadastrar lead</span>
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
