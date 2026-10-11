import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  getChavesNaMaoSummary,
  getChavesNaMaoPending,
  updateChavesNaMaoProperties,
  rotateChavesNaMaoFeed,
  searchAvailableProperties,
  translatePortalReason,
  formatPortalErrorMessage,
  PortalSummaryResponse,
  PortalPendingItem,
  AvailablePropertyForPortal,
} from '@/services/portals'
import { formatDateTimeBahia } from '@/services/visits'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Copy,
  Check,
  RefreshCw,
  Search,
  ExternalLink,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  KeyRound,
  Layers,
  ListFilter,
  Loader2,
  ShieldAlert,
} from 'lucide-react'

export default function Portais() {
  // 1. Resumo
  const [summary, setSummary] = useState<PortalSummaryResponse | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [copiedFeed, setCopiedFeed] = useState(false)

  // 2. Pendências
  const [pendingItems, setPendingItems] = useState<PortalPendingItem[]>([])
  const [loadingPending, setLoadingPending] = useState(true)
  const [pendingError, setPendingError] = useState<string | null>(null)

  // 3. Lote
  const [searchTerm, setSearchTerm] = useState('')
  const [availableProps, setAvailableProps] = useState<AvailablePropertyForPortal[]>([])
  const [loadingProps, setLoadingProps] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchActionRunning, setBatchActionRunning] = useState(false)
  const [batchResult, setBatchResult] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [confirmEnableOpen, setConfirmEnableOpen] = useState(false)

  // 4. Trocar código do endereço
  const [confirmRotateOpen, setConfirmRotateOpen] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [rotateSuccessUrl, setRotateSuccessUrl] = useState<string | null>(null)
  const [copiedRotatedUrl, setCopiedRotatedUrl] = useState(false)

  // Carregar dados de resumo
  const loadSummary = useCallback(async () => {
    setLoadingSummary(true)
    setSummaryError(null)
    try {
      const data = await getChavesNaMaoSummary()
      setSummary(data)
    } catch (err) {
      setSummaryError(formatPortalErrorMessage(err, 'Erro ao carregar resumo do portal.'))
    } finally {
      setLoadingSummary(false)
    }
  }, [])

  // Carregar lista de pendências
  const loadPending = useCallback(async () => {
    setLoadingPending(true)
    setPendingError(null)
    try {
      const items = await getChavesNaMaoPending()
      setPendingItems(items)
    } catch (err) {
      setPendingError(formatPortalErrorMessage(err, 'Erro ao carregar pendências.'))
    } finally {
      setLoadingPending(false)
    }
  }, [])

  // Carregar imóveis disponíveis
  const loadAvailableProps = useCallback(async (search: string) => {
    setLoadingProps(true)
    try {
      const list = await searchAvailableProperties(search, 200)
      setAvailableProps(list)
    } catch {
      // Falha silenciosa
    } finally {
      setLoadingProps(false)
    }
  }, [])

  // Recarregar tudo
  const refreshAll = useCallback(async () => {
    await Promise.all([loadSummary(), loadPending(), loadAvailableProps(searchTerm)])
  }, [loadSummary, loadPending, loadAvailableProps, searchTerm])

  useEffect(() => {
    loadSummary()
    loadPending()
    loadAvailableProps('')
  }, [loadSummary, loadPending, loadAvailableProps])

  // Debounce da busca
  useEffect(() => {
    const handler = setTimeout(() => {
      loadAvailableProps(searchTerm)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchTerm, loadAvailableProps])

  // Copiar feed_url
  const handleCopyUrl = async (url: string, isRotated = false) => {
    if (!url) return
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = url
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      if (isRotated) {
        setCopiedRotatedUrl(true)
        setTimeout(() => setCopiedRotatedUrl(false), 2500)
      } else {
        setCopiedFeed(true)
        setTimeout(() => setCopiedFeed(false), 2500)
      }
    } catch {
      // Fallback sem log da URL
    }
  }

  // Seleção de itens em lote
  const toggleSelectProperty = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size >= 200) return next
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAllVisible = () => {
    const visibleIds = availableProps.map((p) => p.id)
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))

    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        visibleIds.forEach((id) => next.delete(id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const id of visibleIds) {
          if (next.size >= 200) break
          next.add(id)
        }
        return next
      })
    }
  }

  const handleClearSelection = () => {
    setSelectedIds(new Set())
  }

  // Executar lote (ligar ou desligar)
  const handleExecuteBatch = async (enabled: boolean) => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    setBatchActionRunning(true)
    setBatchResult(null)

    try {
      const res = await updateChavesNaMaoProperties({
        property_ids: ids,
        enabled,
      })
      setBatchResult({
        type: 'success',
        message: `${res.changed} alterados, ${res.ignored} ignorados.`,
      })
      setSelectedIds(new Set())
      // Atualiza resumo, pendências e listagem
      await Promise.all([loadSummary(), loadPending(), loadAvailableProps(searchTerm)])
    } catch (err) {
      const errMsg = formatPortalErrorMessage(
        err,
        'Erro ao alterar imóveis. Tente novamente mais tarde.',
      )
      setBatchResult({
        type: 'error',
        message: errMsg,
      })
    } finally {
      setBatchActionRunning(false)
      setConfirmEnableOpen(false)
    }
  }

  // Executar rotação do token
  const handleConfirmRotate = async () => {
    setRotating(true)
    try {
      const res = await rotateChavesNaMaoFeed()
      setRotateSuccessUrl(res.feed_url)
      setConfirmRotateOpen(false)
      // Atualiza o resumo
      await loadSummary()
    } catch (err) {
      const errMsg = formatPortalErrorMessage(
        err,
        'Erro ao trocar o código do endereço. Tente novamente mais tarde.',
      )
      setSummaryError(errMsg)
      setConfirmRotateOpen(false)
    } finally {
      setRotating(false)
    }
  }

  const allVisibleSelected = useMemo(() => {
    if (availableProps.length === 0) return false
    return availableProps.every((p) => selectedIds.has(p.id))
  }, [availableProps, selectedIds])

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="eyebrow text-muted-foreground">Integrações</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">Chaves na Mão</span>
          </div>
          <h1 className="display-sm text-foreground mt-0.5">Portais</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gerencie o feed XML e a publicação de imóveis no portal Chaves na Mão.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={loadingSummary || loadingPending || loadingProps}
            className="h-10 rounded-full px-4 text-xs font-normal border-border gap-1.5"
            title="Recarregar dados"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                loadingSummary || loadingPending ? 'animate-spin text-muted-foreground' : ''
              }`}
            />
            <span>Atualizar</span>
          </Button>

          <Link
            to="/admin"
            className="inline-flex items-center justify-center h-10 px-4 rounded-full text-xs font-normal border border-border bg-background hover:bg-muted text-foreground transition-colors shrink-0"
          >
            Voltar para Administração
          </Link>
        </div>
      </div>

      {/* Erro global de resumo se houver */}
      {summaryError && (
        <div className="p-3.5 rounded-lg border border-destructive/20 bg-destructive/10 text-xs text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{summaryError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSummaryError(null)}
            className="text-xs text-destructive hover:underline ml-3"
          >
            Fechar
          </button>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* 1. RESUMO */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-[20px] font-normal text-foreground">Resumo da integração</h2>
            {summary && (
              <Badge
                variant={summary.active ? 'success' : 'outline'}
                className="text-[11px] font-normal"
              >
                {summary.active ? 'Ativo' : 'Inativo'}
              </Badge>
            )}
          </div>
        </div>

        {/* Cartão principal do resumo: 8px de arredondamento, variáveis semânticas */}
        <div className="rounded-lg border border-border bg-card p-4 sm:p-5 space-y-5">
          {/* Campo de leitura com o feed_url e botão Copiar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="feed-url-input"
                className="text-xs font-normal text-foreground flex items-center gap-1.5"
              >
                <span>Endereço do XML</span>
                <span className="text-[10px] text-muted-foreground">(feed Chaves na Mão)</span>
              </label>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmRotateOpen(true)}
                className="h-8 rounded-full px-3 text-xs font-normal border-border gap-1 text-muted-foreground hover:text-foreground"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>Trocar código do endereço</span>
              </Button>
            </div>

            {loadingSummary ? (
              <Skeleton className="h-11 w-full rounded-lg" />
            ) : (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    id="feed-url-input"
                    readOnly
                    value={summary?.feed_url || ''}
                    onFocus={(e) => e.target.select()}
                    className="h-11 text-xs font-mono border-border bg-muted/40 pr-3 tabular truncate cursor-text"
                    placeholder="Carregando endereço do feed..."
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => summary && handleCopyUrl(summary.feed_url)}
                  disabled={!summary?.feed_url}
                  className="h-11 rounded-full px-5 text-xs font-normal bg-primary text-primary-foreground gap-2 shrink-0 min-h-[44px]"
                >
                  {copiedFeed ? (
                    <>
                      <Check className="h-4 w-4 text-primary-foreground" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copiar</span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Feedback de troca de código recém-realizada com botão Copiar dedicado */}
          {rotateSuccessUrl && (
            <div className="p-3.5 rounded-lg border border-success/40 bg-success/10 text-xs text-foreground space-y-2">
              <div className="flex items-center gap-2 text-success font-medium">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Código trocado com sucesso! Envie o novo endereço para o portal:</span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                <Input
                  readOnly
                  value={rotateSuccessUrl}
                  onFocus={(e) => e.target.select()}
                  className="h-10 text-xs font-mono border-border bg-background truncate flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopyUrl(rotateSuccessUrl, true)}
                  className="h-10 rounded-full px-4 text-xs font-normal border-border gap-1.5 shrink-0"
                >
                  {copiedRotatedUrl ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-success" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Métricas do Portal: 3 contadores em pílulas/cartões */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="rounded-lg border border-border bg-background/50 p-3.5 space-y-1">
              <span className="eyebrow text-muted-foreground block">Saindo no portal</span>
              {loadingSummary ? (
                <Skeleton className="h-7 w-16 rounded" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-normal tabular text-foreground">
                    {summary?.published_count ?? 0}
                  </span>
                  <span className="text-xs text-muted-foreground">imóveis saindo no portal</span>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-background/50 p-3.5 space-y-1">
              <span className="eyebrow text-muted-foreground block">Pendentes</span>
              {loadingSummary ? (
                <Skeleton className="h-7 w-16 rounded" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-2xl font-normal tabular ${
                      (summary?.pending_count ?? 0) > 0 ? 'text-attention' : 'text-foreground'
                    }`}
                  >
                    {summary?.pending_count ?? 0}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    marcados e ainda não prontos
                  </span>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-background/50 p-3.5 space-y-1">
              <span className="eyebrow text-muted-foreground block">Marcados no total</span>
              {loadingSummary ? (
                <Skeleton className="h-7 w-16 rounded" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-normal tabular text-foreground">
                    {summary?.marked_count ?? 0}
                  </span>
                  <span className="text-xs text-muted-foreground">marcados em Chaves na Mão</span>
                </div>
              )}
            </div>
          </div>

          {/* Leitura do portal */}
          <div className="pt-2 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="font-normal text-foreground">Última leitura pelo portal:</span>
              {loadingSummary ? (
                <Skeleton className="h-4 w-40 rounded" />
              ) : summary?.last_fetched_at ? (
                <span className="tabular text-foreground">
                  {formatDateTimeBahia(summary.last_fetched_at)} •{' '}
                  <span className="font-medium">{summary.last_count} imóveis lidos</span>
                </span>
              ) : (
                <span className="text-muted-foreground italic">
                  O portal ainda não leu o arquivo
                </span>
              )}
            </div>
          </div>

          {/* Aviso fixo (atenção, não erro) */}
          <div className="rounded-lg border border-attention/40 bg-attention/5 p-4 flex items-start gap-3 text-xs leading-relaxed text-foreground">
            <AlertTriangle className="h-4 w-4 text-attention shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-normal text-foreground">
                Para ativar, envie o endereço do XML, o nome e o CNPJ ou CPF do responsável para{' '}
                <a
                  href="mailto:atendimento@chavesnamao.com.br"
                  className="font-medium text-foreground underline hover:text-attention transition-colors"
                >
                  atendimento@chavesnamao.com.br
                </a>
                .
              </p>
              <p className="text-muted-foreground">
                O portal lê o arquivo uma vez por dia; alterações podem levar até 24 horas úteis
                para aparecer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* 2. PENDÊNCIAS */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-[20px] font-normal text-foreground">Pendências</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Imóveis marcados para o portal mas que ainda não atendem a todos os requisitos
              obrigatórios
            </p>
          </div>
          {pendingItems.length > 0 && (
            <Badge variant="attention" className="self-start sm:self-auto text-xs font-normal">
              {pendingItems.length}{' '}
              {pendingItems.length === 1 ? 'imóvel pendente' : 'imóveis pendentes'}
            </Badge>
          )}
        </div>

        {pendingError && (
          <div className="p-3.5 rounded-lg border border-destructive/20 bg-destructive/10 text-xs text-destructive flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{pendingError}</span>
            </div>
            <button
              type="button"
              onClick={() => setPendingError(null)}
              className="text-xs text-destructive hover:underline ml-3"
            >
              Fechar
            </button>
          </div>
        )}

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {loadingPending ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : pendingItems.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-success mx-auto" />
              <p className="text-sm font-normal text-foreground">Nenhuma pendência</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Todos os imóveis marcados para o portal estão prontos e sendo incluídos no arquivo
                XML.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {pendingItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-normal text-foreground">
                        {item.code || 'Sem código'}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-xs text-foreground font-normal truncate max-w-sm sm:max-w-md">
                        {item.title || 'Sem título'}
                      </span>
                    </div>

                    {/* Motivos traduzidos como pílulas */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.reasons.map((r, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-normal border border-attention/40 bg-attention/10 text-foreground leading-tight"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-attention" />
                          <span>{translatePortalReason(r)}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Link para a ficha do imóvel */}
                  <div className="shrink-0 self-end sm:self-auto">
                    <Link
                      to={`/imoveis/${item.id}`}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-normal border border-border bg-background hover:bg-muted text-foreground transition-colors"
                    >
                      <span>Abrir ficha</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* 3. LIGAR OU DESLIGAR EM LOTE */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-[20px] font-normal text-foreground">Ligar ou desligar em lote</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Busque imóveis disponíveis por código ou título, selecione até 200 e marque ou
              desmarque a publicação na Chaves na Mão
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs text-muted-foreground tabular">
              {selectedIds.size} de 200 selecionados
            </span>
          </div>
        </div>

        {/* Feedback da operação em lote */}
        {batchResult && (
          <div
            className={`p-3.5 rounded-lg border text-xs flex items-center justify-between ${
              batchResult.type === 'success'
                ? 'border-success/30 bg-success/10 text-foreground'
                : 'border-destructive/20 bg-destructive/10 text-destructive'
            }`}
          >
            <div className="flex items-center gap-2">
              {batchResult.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive shrink-0" />
              )}
              <span>{batchResult.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setBatchResult(null)}
              className="text-xs opacity-75 hover:opacity-100 ml-3"
            >
              Fechar
            </button>
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          {/* Barra de busca e ações de seleção */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por código ou título (apenas Disponíveis)..."
                className="pl-9 h-11 text-xs border-border"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAllVisible}
                disabled={availableProps.length === 0}
                className="h-11 rounded-full px-4 text-xs font-normal border-border min-h-[44px]"
              >
                {allVisibleSelected ? 'Desmarcar lista' : 'Selecionar da lista'}
              </Button>

              {selectedIds.size > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSelection}
                  className="h-11 rounded-full px-3 text-xs font-normal text-muted-foreground hover:text-foreground min-h-[44px]"
                >
                  Limpar seleção
                </Button>
              )}
            </div>
          </div>

          {/* Botões de Ação em Lote */}
          <div className="p-3 rounded-lg bg-muted/40 border border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {selectedIds.size === 0 ? (
                <span>Selecione ao menos um imóvel para ligar ou desligar.</span>
              ) : (
                <span className="text-foreground">
                  <span className="font-medium tabular">{selectedIds.size}</span> imóveis prontos
                  para alteração.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleExecuteBatch(false)}
                disabled={selectedIds.size === 0 || batchActionRunning}
                className="h-10 rounded-full px-4 text-xs font-normal border-border text-foreground min-h-[44px] flex-1 sm:flex-initial"
              >
                {batchActionRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                <span>Desligar</span>
              </Button>

              <Button
                type="button"
                onClick={() => setConfirmEnableOpen(true)}
                disabled={selectedIds.size === 0 || batchActionRunning}
                className="h-10 rounded-full px-5 text-xs font-normal bg-primary text-primary-foreground min-h-[44px] flex-1 sm:flex-initial"
              >
                {batchActionRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                <span>Ligar na Chaves na Mão</span>
              </Button>
            </div>
          </div>

          {/* Lista de Imóveis Disponíveis com Checkboxes */}
          <div className="border border-border rounded-lg overflow-hidden divide-y divide-border max-h-96 overflow-y-auto">
            {loadingProps ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded" />
                ))}
              </div>
            ) : availableProps.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                {searchTerm
                  ? 'Nenhum imóvel disponível encontrado com este termo.'
                  : 'Nenhum imóvel disponível encontrado.'}
              </div>
            ) : (
              availableProps.map((p) => {
                const isSelected = selectedIds.has(p.id)
                return (
                  <label
                    key={p.id}
                    className={`flex items-center justify-between p-3 sm:px-4 cursor-pointer text-xs transition-colors select-none ${
                      isSelected ? 'bg-muted/60' : 'hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectProperty(p.id)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary shrink-0"
                      />
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-medium text-foreground">
                            {p.code || 'Sem código'}
                          </span>
                          <span className="text-muted-foreground truncate">{p.title}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {p.neighborhood && p.city
                            ? `${p.neighborhood}, ${p.city}`
                            : p.neighborhood || p.city || 'Localização não informada'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {p.isPublishedToPortal ? (
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-normal px-2 py-0.5 border-border"
                        >
                          Ligado no portal
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-normal px-2 py-0.5 text-muted-foreground"
                        >
                          Desligado
                        </Badge>
                      )}
                    </div>
                  </label>
                )
              })
            )}
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* DIÁLOGOS DE CONFIRMAÇÃO */}
      {/* ═════════════════════════════════════════════════════════════════ */}

      {/* Confirmação ao LIGAR na Chaves na Mão */}
      <AlertDialog open={confirmEnableOpen} onOpenChange={setConfirmEnableOpen}>
        <AlertDialogContent className="rounded-lg p-6 max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-attention mb-1">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <AlertDialogTitle className="text-base font-normal text-foreground">
                Confirmar ativação de imóveis
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs sm:text-sm text-foreground/90 leading-relaxed space-y-2">
              <span className="block font-medium text-foreground">
                Só ligue na data combinada da troca com a Kenlo.
              </span>
              <span className="block text-muted-foreground">
                Imóvel ligado aqui passa a sair no XML e, depois da ativação, no portal.
              </span>
              <span className="block text-xs text-muted-foreground pt-1">
                Total a ativar:{' '}
                <strong className="text-foreground tabular">{selectedIds.size}</strong>{' '}
                {selectedIds.size === 1 ? 'imóvel' : 'imóveis'}.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 pt-2">
            <AlertDialogCancel
              disabled={batchActionRunning}
              className="rounded-full font-normal min-h-[44px] h-11 text-xs"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleExecuteBatch(true)
              }}
              disabled={batchActionRunning}
              className="rounded-full font-normal min-h-[44px] h-11 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {batchActionRunning ? 'Ligando...' : 'Confirmar e ligar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de Troca de Código do Endereço */}
      <AlertDialog open={confirmRotateOpen} onOpenChange={setConfirmRotateOpen}>
        <AlertDialogContent className="rounded-lg p-6 max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-destructive mb-1">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <AlertDialogTitle className="text-base font-normal text-foreground">
                Trocar código do endereço do XML
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
              O endereço atual deixa de funcionar e a Chaves na Mão precisará receber o novo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 pt-2">
            <AlertDialogCancel
              disabled={rotating}
              className="rounded-full font-normal min-h-[44px] h-11 text-xs"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmRotate()
              }}
              disabled={rotating}
              className="rounded-full font-normal min-h-[44px] h-11 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rotating ? 'Trocando...' : 'Trocar código'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
