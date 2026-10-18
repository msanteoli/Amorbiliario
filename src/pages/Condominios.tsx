import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Check } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  listCondominiumsWithPropertyCount,
  CondominiumWithCount,
  CondominiumRecord,
} from '@/services/condominiums'
import { formatErrorMessage } from '@/services/properties'
import { CreateCondominiumModal } from '@/components/condominiums/CreateCondominiumModal'
import { ImportCondominiumsModal } from '@/components/condominiums/ImportCondominiumsModal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  FileSpreadsheet,
  Building2,
  AlertCircle,
  Loader2,
  MapPin,
  Home,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react'

export default function Condominios() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const [successBanner, setSuccessBanner] = useState<string | null>(null)

  useEffect(() => {
    if (location.state?.successMessage) {
      setSuccessBanner(location.state.successMessage)
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  // Permissões:
  // admin: criar, editar, importar
  // corretor: criar, editar (sem importar)
  // sdr: só lê (sem botões de criar/editar/importar)
  const canCreate = user?.role === 'admin' || user?.role === 'corretor'
  const canImport = user?.role === 'admin'

  const [condos, setCondos] = useState<CondominiumWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Filtros
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  // Modais
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)

  // Debounce da busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchCondos = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const data = await listCondominiumsWithPropertyCount({
        search: debouncedSearch,
        showInactive,
      })
      setCondos(data)
    } catch (err) {
      setErrorMessage(formatErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, showInactive])

  useEffect(() => {
    fetchCondos()
  }, [fetchCondos])

  const handleCreatedCondo = (newCondo: CondominiumRecord) => {
    fetchCondos()
    navigate(`/condominios/${newCondo.id}`)
  }

  const handleImportSuccess = () => {
    fetchCondos()
  }

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

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="display-sm text-foreground">Condomínios</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gerencie os empreendimentos e condomínios cadastrados na sua organização.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {canImport && (
            <Button
              variant="outline"
              onClick={() => setImportModalOpen(true)}
              className="h-9 sm:h-10 rounded-full px-3.5 sm:px-4 text-xs font-normal border-border gap-2 flex-1 sm:flex-none"
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0" />
              <span className="truncate">Importar condomínios</span>
            </Button>
          )}

          {canCreate && (
            <Button
              onClick={() => setCreateModalOpen(true)}
              className="h-9 sm:h-10 rounded-full px-4 sm:px-5 text-xs font-normal bg-primary text-primary-foreground gap-2 flex-1 sm:flex-none"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="truncate">Novo condomínio</span>
            </Button>
          )}
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Campo de busca em pílula de 48px */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome ou bairro..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full h-12 pl-11 pr-4 rounded-full border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Filtro: Mostrar inativos */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowInactive(!showInactive)}
            className={`h-9 px-4 rounded-full text-xs font-normal border transition-colors ${
              showInactive
                ? 'bg-foreground text-background border-foreground'
                : 'bg-transparent text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            {showInactive ? 'Ocultar inativos' : 'Mostrar inativos'}
          </button>
        </div>
      </div>

      {/* Mensagem de Erro */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20 font-normal">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Conteúdo: Tabela e Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs">Carregando condomínios...</span>
        </div>
      ) : condos.length === 0 ? (
        <div className="border border-border rounded-[8px] p-12 text-center bg-card grade-planta">
          <div className="max-w-sm mx-auto bg-card/90 backdrop-blur-sm p-6 rounded-[8px] border border-border space-y-3">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
            <h3 className="text-sm font-semibold text-foreground">Nenhum condomínio encontrado</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {searchInput || showInactive
                ? 'Nenhum condomínio corresponde aos filtros selecionados. Tente ajustar a busca.'
                : 'Cadastre o primeiro condomínio da sua organização para associar aos imóveis.'}
            </p>
            {canCreate && !searchInput && !showInactive && (
              <Button
                onClick={() => setCreateModalOpen(true)}
                className="rounded-[4px] px-5 h-9 text-xs font-medium bg-primary text-primary-foreground gap-1.5 mt-2"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Cadastrar primeiro condomínio</span>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Visualização em Tabela para Desktop (768px+) */}
          <div className="hidden md:block border border-border rounded-lg overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Bairro</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead className="text-right">Imóveis vinculados</TableHead>
                  <TableHead className="w-24 text-center">Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {condos.map((condo, idx) => {
                  const isInactive = condo.is_active === false

                  return (
                    <TableRow
                      key={condo.id}
                      onClick={() => navigate(`/condominios/${condo.id}`)}
                      className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                        isInactive ? 'opacity-50' : ''
                      }`}
                    >
                      <TableCell className="text-center text-xs tabular text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground text-sm flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span>{condo.name}</span>
                        </div>
                        {condo.street && (
                          <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
                            {condo.street}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-foreground">
                        {condo.neighborhood || (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-foreground">
                        {condo.city || <span className="text-muted-foreground italic">—</span>}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular font-medium text-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Home className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{condo.propertiesCount}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {isInactive ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-normal border-zinc-300 dark:border-zinc-700 text-zinc-500"
                          >
                            Inativo
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-normal border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
                          >
                            Ativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <ChevronRight className="h-4 w-4 text-muted-foreground inline" />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Visualização em Cartões para Telas Menores (360px - 767px) */}
          <div className="md:hidden space-y-3">
            {condos.map((condo) => {
              const isInactive = condo.is_active === false

              return (
                <div
                  key={condo.id}
                  onClick={() => navigate(`/condominios/${condo.id}`)}
                  className={`border border-border rounded-lg p-4 bg-card active:bg-muted/40 transition-colors cursor-pointer space-y-3 ${
                    isInactive ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-medium text-foreground text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{condo.name}</span>
                      </div>
                      {condo.street && (
                        <p className="text-xs text-muted-foreground truncate">{condo.street}</p>
                      )}
                    </div>
                    {isInactive ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-normal border-zinc-300 dark:border-zinc-700 text-zinc-500 shrink-0"
                      >
                        Inativo
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-normal border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 shrink-0"
                      >
                        Ativo
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                    <div className="flex items-center gap-1 truncate max-w-[65%]">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {[condo.neighborhood, condo.city].filter(Boolean).join(', ') ||
                          'Sem localização'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-foreground tabular font-medium shrink-0">
                      <Home className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>
                        {condo.propertiesCount} {condo.propertiesCount === 1 ? 'imóvel' : 'imóveis'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal: Novo Condomínio */}
      {canCreate && user && (
        <CreateCondominiumModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          currentUser={user}
          onCreated={handleCreatedCondo}
        />
      )}

      {/* Modal: Importar Condomínios (somente admin) */}
      {canImport && (
        <ImportCondominiumsModal
          open={importModalOpen}
          onOpenChange={setImportModalOpen}
          onSuccess={handleImportSuccess}
        />
      )}
    </div>
  )
}
