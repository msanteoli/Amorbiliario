import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  getClientById,
  getClientPrivate,
  ClientRecord,
  ClientPrivateRecord,
  formatErrorMessage,
} from '@/services/clients'
import {
  formatPhoneNumber,
  formatDate,
  maskCpfInput,
  KIND_LABELS,
  CONSENT_STATUS_LABELS,
} from '@/lib/clientUtils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowLeft,
  Edit,
  User,
  Phone,
  Mail,
  Calendar,
  ShieldCheck,
  Lock,
  Loader2,
  AlertCircle,
  Building2,
} from 'lucide-react'

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [client, setClient] = useState<ClientRecord | null>(null)
  const [clientPrivate, setClientPrivate] = useState<ClientPrivateRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    setErrorMessage(null)

    Promise.all([getClientById(id), getClientPrivate(id)])
      .then(([clientData, privateData]) => {
        if (!active) return
        setClient(clientData)
        // A seção "Dados pessoais" (CPF e data de nascimento) SÓ aparece quando a consulta
        // a client_private daquele cliente devolve um registro; se devolver erro ou vazio,
        // não mostrar a seção nem mensagem de erro.
        setClientPrivate(privateData)
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
  }, [id])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-muted-foreground gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Carregando ficha do cliente...</p>
      </div>
    )
  }

  if (errorMessage || !client) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Button variant="ghost" onClick={() => navigate('/clientes')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar para Clientes</span>
        </Button>
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>
            {errorMessage || 'Cliente não encontrado ou você não tem permissão para visualizá-lo.'}
          </span>
        </div>
      </div>
    )
  }

  const respName =
    client.expand?.responsible_id?.name || client.expand?.responsible_id?.email || 'Não atribuído'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Barra de Navegação Superior */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/clientes')}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{client.name}</h1>
            </div>
            <p className="text-xs text-muted-foreground">Ficha do cliente</p>
          </div>
        </div>

        <Button asChild className="gap-2 shrink-0">
          <Link to={`/clientes/${client.id}/editar`}>
            <Edit className="h-4 w-4" />
            <span>Editar</span>
          </Link>
        </Button>
      </div>

      {/* Cartão de Informações Principais */}
      <Card className="border-border">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <span>Dados de contato e perfil</span>
            </CardTitle>
            <div className="flex flex-wrap gap-1.5">
              {client.kind && client.kind.length > 0 ? (
                client.kind.map((k) => (
                  <Badge key={k} variant="secondary" className="text-xs">
                    {KIND_LABELS[k] || k}
                  </Badge>
                ))
              ) : (
                <Badge variant="outline" className="text-xs">
                  Sem perfil definido
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Nome completo</span>
              <p className="text-sm font-semibold text-foreground">{client.name}</p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Responsável</span>
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{respName}</span>
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Telefone</span>
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{formatPhoneNumber(client.phone)}</span>
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">E-mail</span>
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{client.email || '-'}</span>
              </p>
            </div>
          </div>

          {/* Consentimento LGPD */}
          <div className="pt-6 border-t space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Consentimento LGPD</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/40 border">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Status</span>
                <p className="text-sm font-medium text-foreground">
                  {CONSENT_STATUS_LABELS[client.consent_status] ||
                    client.consent_status ||
                    'Sem informação'}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Data do consentimento</span>
                <p className="text-sm font-medium text-foreground">
                  {formatDate(client.consent_at)}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Canal de autorização</span>
                <p className="text-sm font-medium text-foreground">
                  {client.consent_channel || '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Seção Dados Pessoais (SÓ aparece se a consulta a client_private devolver um registro) */}
          {clientPrivate && (
            <div className="pt-6 border-t space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <Lock className="h-4 w-4 text-amber-500" />
                <span>Dados pessoais</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/40 border">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">CPF</span>
                  <p className="text-sm font-medium font-mono text-foreground">
                    {clientPrivate.cpf ? maskCpfInput(clientPrivate.cpf) : '-'}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Data de nascimento</span>
                  <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{formatDate(clientPrivate.birth_date)}</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
