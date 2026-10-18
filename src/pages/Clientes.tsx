import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Check } from 'lucide-react'
import {
  listClients,
  listEligibleResponsibleUsers,
  ClientRecord,
  ClientKind,
  ResponsibleUser,
  formatErrorMessage,
} from '@/services/clients'
import { formatPhoneNumber, KIND_LABELS } from '@/lib/clientUtils'
import { useAuth } from '@/contexts/AuthContext'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Search,
  Plus,
  User,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Eye,
  FilterX,
} from 'lucide-react'

export default function Clientes() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const [clients, setClients] = useState<ClientRecord[]>([])
  const [successBanner, setSuccessBanner] = useState<string | null>(null)

  useEffect(() => {
    if (location.state?.successMessage) {
      setSuccessBanner(location.state.successMessage)
      window.history.replaceState({}, document.title)
    }
  }, [location.state])
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Filtros
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedKind, setSelectedKind] = useState<ClientKind | ''>('')
  const [selectedResponsible, setSelectedResponsible] = useState<string>('')
  const [responsibleUsers, setResponsibleUsers] = useState<ResponsibleUser[]>([])

  const canFilterResponsible = user?.role === 'admin' || user?.role === 'sdr'

  // Debounce de 300ms para a busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Carrega lista de responsáveis elegíveis
  useEffect(() => {
    listEligibleResponsibleUsers()
      .then(setResponsibleUsers)
      .catch(() => {
        // Ignora falha de listagem de usuários responsáveis
      })
  }, [])

  // Carrega clientes da API
  useEffect(() => {
    let active = true
    setLoading(true)
    setErrorMessage(null)

    listClients({
      page: currentPage,
      perPage: 10,
      search: debouncedSearch,
      kind: selectedKind || undefined,
      responsible_id: selectedResponsible || undefined,
      sort: '-created',
    })
      .then((res) => {
        if (!active) return
        setClients(res.items)
        setTotalItems(res.totalItems)
        setTotalPages(res.totalPages || 1)
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
  }, [currentPage, debouncedSearch, selectedKind, selectedResponsible])

  const handleClearFilters = () => {
    setSearchInput('')
    setSelectedKind('')
    setSelectedResponsible('')
    setCurrentPage(1)
  }

  const hasActiveFilters = searchInput || selectedKind || selectedResponsible

  return (
    <div className="space-y-6">
      {/* Banner de sucesso */}
      {successBanner && (
        <Alert className="border-success/30 bg-success/10 text-success">
          <Check className="h-4 w-4 text-success" />
          <AlertDescription className="text-sm font-medium flex items-center justify-between text-foreground">
            <span>{successBanner}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSuccessBanner(null)}
              className="h-6 text-xs"
            >
              Fechar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="display-sm text-foreground">Clientes</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gerencie sua carteira de compradores, locatários, proprietários e investidores.
          </p>
        </div>
        <Button
          onClick={() => navigate('/clientes/novo')}
          className="hidden sm:inline-flex rounded-full px-5 h-10 gap-2 font-medium"
        >
          <Plus className="h-4 w-4" />
          <span>Novo cliente</span>
        </Button>
      </div>

      {/* Botão flutuante no celular (FAB 56px) */}
      <button
        type="button"
        onClick={() => navigate('/clientes/novo')}
        aria-label="Novo cliente"
        className="sm:hidden fixed right-4 bottom-20 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-none border border-border flex items-center justify-center active:scale-95 transition-transform"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Filtros e Busca */}
      <div className="space-y-2.5">
        {/* Campo em pílula de 48px */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou e-mail..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full h-12 pl-11 pr-4 rounded-full border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Pílulas de seleção em fileira com rolagem lateral no celular */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <Select
            value={selectedKind || 'todos'}
            onValueChange={(val) => {
              setSelectedKind(val === 'todos' ? '' : (val as ClientKind))
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="h-9 rounded-full px-3.5 text-xs border-border bg-background shrink-0 w-auto min-w-[130px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="comprador">Comprador</SelectItem>
              <SelectItem value="locatario">Locatário</SelectItem>
              <SelectItem value="proprietario">Proprietário</SelectItem>
              <SelectItem value="investidor">Investidor</SelectItem>
            </SelectContent>
          </Select>

          {canFilterResponsible && (
            <Select
              value={selectedResponsible || 'todos'}
              onValueChange={(val) => {
                setSelectedResponsible(val === 'todos' ? '' : val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-9 rounded-full px-3.5 text-xs border-border bg-background shrink-0 w-auto min-w-[140px]">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os responsáveis</SelectItem>
                {responsibleUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs text-muted-foreground hover:text-foreground shrink-0 px-2 py-1 underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Erro de carregamento */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Conteúdo: Desktop Lista de Linhas + Mobile Linhas Empilhadas de 72px */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-16 rounded-lg border border-border animate-pulse bg-muted/40"
            />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="p-12 text-center rounded-[8px] border border-border bg-card grade-planta">
          <div className="max-w-sm mx-auto bg-card/90 backdrop-blur-sm p-6 rounded-[8px] border border-border shadow-none">
            <p className="text-sm text-muted-foreground mb-4">
              {hasActiveFilters
                ? 'Nenhum resultado corresponde aos filtros aplicados.'
                : 'Nenhum cliente por aqui. Cadastre o primeiro.'}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs text-primary underline"
              >
                Limpar filtros
              </button>
            ) : (
              <Button
                onClick={() => navigate('/clientes/novo')}
                className="rounded-[4px] px-5 h-10 gap-2 font-medium"
              >
                <Plus className="h-4 w-4" />
                <span>Novo cliente</span>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Versão Desktop: Lista de linhas com divisores e cabeçalho em .eyebrow */}
          <div className="hidden md:block rounded-lg border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-border text-left eyebrow text-muted-foreground">
              <div className="col-span-4">Nome</div>
              <div className="col-span-2">Telefone</div>
              <div className="col-span-2">E-mail</div>
              <div className="col-span-2">Tipo de relação</div>
              <div className="col-span-2 text-right">Responsável</div>
            </div>
            <div className="divide-y divide-border">
              {clients.map((client) => {
                const respName =
                  client.expand?.responsible_id?.name ||
                  client.expand?.responsible_id?.email ||
                  'Não atribuído'

                return (
                  <div
                    key={client.id}
                    onClick={() => navigate(`/clientes/${client.id}`)}
                    className="grid grid-cols-12 gap-3 px-4 py-3.5 items-center hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <div className="col-span-4 font-normal text-sm text-foreground truncate">
                      {client.name}
                    </div>
                    <div className="col-span-2 dado text-muted-foreground whitespace-nowrap">
                      {formatPhoneNumber(client.phone)}
                    </div>
                    <div className="col-span-2 text-xs text-muted-foreground truncate">
                      {client.email || '—'}
                    </div>
                    <div className="col-span-2 flex flex-wrap gap-1">
                      {client.kind && client.kind.length > 0 ? (
                        client.kind.map((k) => (
                          <Badge key={k} variant="default" className="text-[10px]">
                            {KIND_LABELS[k] || k}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="col-span-2 text-right text-xs text-muted-foreground truncate">
                      {respName}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Versão Mobile: Linhas empilhadas de 72px com divisores de 1px */}
          <div className="md:hidden rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
            {clients.map((client) => {
              const respName =
                client.expand?.responsible_id?.name ||
                client.expand?.responsible_id?.email ||
                'Não atribuído'

              return (
                <div
                  key={client.id}
                  onClick={() => navigate(`/clientes/${client.id}`)}
                  className="p-3.5 flex flex-col justify-between min-h-[72px] hover:bg-muted/40 cursor-pointer active:bg-muted/60 transition-colors gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-normal text-sm text-foreground truncate">
                      {client.name}
                    </span>
                    <div className="flex gap-1 shrink-0">
                      {client.kind && client.kind.length > 0 && (
                        <Badge variant="default" className="text-[10px]">
                          {KIND_LABELS[client.kind[0]] || client.kind[0]}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
                    <span className="dado">{formatPhoneNumber(client.phone)}</span>
                    <span className="truncate">{respName}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Paginação em pílulas com a página atual em texto de apoio */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground tabular">
              Página {currentPage} de {totalPages} ({totalItems} clientes)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || loading}
                className="h-9 rounded-full px-4 text-xs font-normal border-border gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Anterior</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || loading}
                className="h-9 rounded-full px-4 text-xs font-normal border-border gap-1"
              >
                <span>Próxima</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
