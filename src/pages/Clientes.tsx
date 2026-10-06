import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  const { user } = useAuth()

  const [clients, setClients] = useState<ClientRecord[]>([])
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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Clientes
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie sua carteira de compradores, locatários, proprietários e investidores.
          </p>
        </div>
        <Button onClick={() => navigate('/clientes/novo')} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          <span>Novo cliente</span>
        </Button>
      </div>

      {/* Filtros e Busca */}
      <Card className="border-border">
        <CardContent className="p-4 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou e-mail..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-2">
            <Select
              value={selectedKind || 'todos'}
              onValueChange={(val) => {
                setSelectedKind(val === 'todos' ? '' : (val as ClientKind))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-[160px]">
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
                <SelectTrigger className="w-[180px]">
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
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearFilters}
                title="Limpar filtros"
                className="shrink-0"
              >
                <FilterX className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Erro de carregamento */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Conteúdo: Desktop Tabela + Mobile Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Carregando clientes...</p>
        </div>
      ) : clients.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <User className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <h3 className="text-base font-semibold">Nenhum cliente encontrado</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
              {hasActiveFilters
                ? 'Nenhum resultado corresponde aos filtros aplicados. Tente ajustar os termos de busca.'
                : 'Você ainda não possui clientes cadastrados na sua carteira.'}
            </p>
            {hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                Limpar filtros
              </Button>
            ) : (
              <Button onClick={() => navigate('/clientes/novo')} size="sm">
                Cadastrar primeiro cliente
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Versão Desktop: Tabela */}
          <div className="hidden md:block rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Tipos</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => {
                  const respName =
                    client.expand?.responsible_id?.name ||
                    client.expand?.responsible_id?.email ||
                    'Não atribuído'

                  return (
                    <TableRow key={client.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium text-foreground">
                        <Link
                          to={`/clientes/${client.id}`}
                          className="hover:underline font-semibold text-primary"
                        >
                          {client.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatPhoneNumber(client.phone)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{client.email || '-'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {client.kind && client.kind.length > 0 ? (
                            client.kind.map((k) => (
                              <Badge key={k} variant="secondary" className="text-xs">
                                {KIND_LABELS[k] || k}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{respName}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild className="h-8 gap-1.5">
                          <Link to={`/clientes/${client.id}`}>
                            <Eye className="h-4 w-4" />
                            <span>Ver ficha</span>
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Versão Mobile: Cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {clients.map((client) => {
              const respName =
                client.expand?.responsible_id?.name ||
                client.expand?.responsible_id?.email ||
                'Não atribuído'

              return (
                <Card
                  key={client.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => navigate(`/clientes/${client.id}`)}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-semibold leading-tight text-primary">
                        {client.name}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/clientes/${client.id}`)
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-2.5">
                    <div className="flex flex-wrap gap-1">
                      {client.kind && client.kind.length > 0
                        ? client.kind.map((k) => (
                            <Badge key={k} variant="secondary" className="text-xs">
                              {KIND_LABELS[k] || k}
                            </Badge>
                          ))
                        : null}
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground">
                      {client.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground/70" />
                          <span>{formatPhoneNumber(client.phone)}</span>
                        </div>
                      )}
                      {client.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground/70" />
                          <span className="truncate">{client.email}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 pt-1 text-foreground/80 font-medium">
                        <User className="h-3.5 w-3.5 text-muted-foreground/70" />
                        <span>Responsável: {respName}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Paginação */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <span className="text-xs text-muted-foreground order-2 sm:order-1">
              Mostrando {clients.length} de {totalItems} cliente{totalItems === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2 order-1 sm:order-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || loading}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Anterior</span>
              </Button>
              <span className="text-xs font-medium px-2">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || loading}
                className="gap-1"
              >
                <span>Próxima</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
