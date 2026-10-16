import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ConfigSidebar } from '@/components/ConfigSidebar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getChavesNaMaoSummary,
  getChavesNaMaoPending,
  updateChavesNaMaoProperties,
  rotateChavesNaMaoFeed,
  rotateChavesNaMaoLeads,
  searchAvailableProperties,
  translatePortalReason,
  formatPortalErrorMessage,
  type PortalSummaryResponse,
  type PortalPendingItem,
  type AvailablePropertyForPortal,
} from '@/services/portals'
import {
  getMcpAdminStatus,
  enableMcp,
  disableMcp,
  createMcpKey,
  revokeMcpKey,
  listAdminUsers,
  formatAdminErrorMessage,
  type McpKeyItem,
  type AdminUserItem,
} from '@/services/admin'
import { formatDateTimeBahia } from '@/services/visits'
import { getRoleLabel } from '@/lib/roles'
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
  Key,
  Plus,
} from 'lucide-react'

export default function Integracoes() {
  const [searchParams, setSearchParams] = useSearchParams()

  const rawTab = searchParams.get('aba') || searchParams.get('tab')
  const initialTab = rawTab === 'mcp' ? 'mcp' : 'portais'
  const [activeTab, setActiveTab] = useState<'portais' | 'mcp'>(initialTab)

  useEffect(() => {
    const currentParam = searchParams.get('aba') || searchParams.get('tab')
    if (currentParam === 'mcp' && activeTab !== 'mcp') {
      setActiveTab('mcp')
    } else if (currentParam === 'portais' && activeTab !== 'portais') {
      setActiveTab('portais')
    }
  }, [searchParams, activeTab])

  const handleTabChange = (val: string) => {
    const next = val === 'mcp' ? 'mcp' : 'portais'
    setActiveTab(next)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('tab')
    nextParams.set('aba', next)
    setSearchParams(nextParams, { replace: true })
  }

  // ═════════════════════════════════════════════════════════════════════
  // CONTEÚDO PORTAIS
  // ═════════════════════════════════════════════════════════════════════
  const [summary, setSummary] = useState<PortalSummaryResponse | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [copiedFeed, setCopiedFeed] = useState(false)
  const [copiedLeads, setCopiedLeads] = useState(false)

  const [pendingItems, setPendingItems] = useState<PortalPendingItem[]>([])
  const [loadingPending, setLoadingPending] = useState(true)
  const [pendingError, setPendingError] = useState<string | null>(null)

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

  const [confirmRotateOpen, setConfirmRotateOpen] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [rotateSuccessUrl, setRotateSuccessUrl] = useState<string | null>(null)
  const [copiedRotatedUrl, setCopiedRotatedUrl] = useState(false)

  const [confirmRotateLeadsOpen, setConfirmRotateLeadsOpen] = useState(false)
  const [rotatingLeads, setRotatingLeads] = useState(false)
  const [rotateLeadsSuccessUrl, setRotateLeadsSuccessUrl] = useState<string | null>(null)
  const [copiedRotatedLeadsUrl, setCopiedRotatedLeadsUrl] = useState(false)

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

  const loadAvailableProps = useCallback(async (search: string) => {
    setLoadingProps(true)
    try {
      const list = await searchAvailableProperties(search, 200)
      setAvailableProps(list)
    } catch {
      // silencioso
    } finally {
      setLoadingProps(false)
    }
  }, [])

  const refreshAllPortais = useCallback(async () => {
    await Promise.all([loadSummary(), loadPending(), loadAvailableProps(searchTerm)])
  }, [loadSummary, loadPending, loadAvailableProps, searchTerm])

  useEffect(() => {
    loadSummary()
    loadPending()
    loadAvailableProps('')
  }, [loadSummary, loadPending, loadAvailableProps])

  useEffect(() => {
    const handler = setTimeout(() => {
      loadAvailableProps(searchTerm)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchTerm, loadAvailableProps])

  const copyToClipboard = async (text: string) => {
    if (!text) return
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
  }

  const handleCopyUrl = async (url: string, isRotated = false) => {
    if (!url) return
    try {
      await copyToClipboard(url)
      if (isRotated) {
        setCopiedRotatedUrl(true)
        setTimeout(() => setCopiedRotatedUrl(false), 2500)
      } else {
        setCopiedFeed(true)
        setTimeout(() => setCopiedFeed(false), 2500)
      }
    } catch {
      // Fallback silencioso
    }
  }

  const handleCopyLeadsUrl = async (url: string, isRotated = false) => {
    if (!url) return
    try {
      await copyToClipboard(url)
      if (isRotated) {
        setCopiedRotatedLeadsUrl(true)
        setTimeout(() => setCopiedRotatedLeadsUrl(false), 2500)
      } else {
        setCopiedLeads(true)
        setTimeout(() => setCopiedLeads(false), 2500)
      }
    } catch {
      // Fallback silencioso
    }
  }

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

  const handleConfirmRotate = async () => {
    setRotating(true)
    try {
      const res = await rotateChavesNaMaoFeed()
      setRotateSuccessUrl(res.feed_url)
      setConfirmRotateOpen(false)
      await loadSummary()
    } catch (err) {
      const errMsg = formatPortalErrorMessage(
        err,
        'Erro ao trocar o código do endereço do XML. Tente novamente mais tarde.',
      )
      setSummaryError(errMsg)
      setConfirmRotateOpen(false)
    } finally {
      setRotating(false)
    }
  }

  const handleConfirmRotateLeads = async () => {
    setRotatingLeads(true)
    try {
      const res = await rotateChavesNaMaoLeads()
      setRotateLeadsSuccessUrl(res.leads_url)
      setConfirmRotateLeadsOpen(false)
      await loadSummary()
    } catch (err) {
      const errMsg = formatPortalErrorMessage(
        err,
        'Erro ao trocar o código dos contatos. Tente novamente mais tarde.',
      )
      setSummaryError(errMsg)
      setConfirmRotateLeadsOpen(false)
    } finally {
      setRotatingLeads(false)
    }
  }

  const allVisibleSelected = useMemo(() => {
    if (availableProps.length === 0) return false
    return availableProps.every((p) => selectedIds.has(p.id))
  }, [availableProps, selectedIds])

  // ═════════════════════════════════════════════════════════════════════
  // CONTEÚDO ACESSO MCP
  // ═════════════════════════════════════════════════════════════════════
  const [mcpEnabled, setMcpEnabled] = useState(false)
  const [mcpKeys, setMcpKeys] = useState<McpKeyItem[]>([])
  const [mcpUsers, setMcpUsers] = useState<AdminUserItem[]>([])
  const [loadingMcp, setLoadingMcp] = useState(false)
  const [togglingMcp, setTogglingMcp] = useState(false)
  const [confirmDisableMcpOpen, setConfirmDisableMcpOpen] = useState(false)
  const [mcpGlobalError, setMcpGlobalError] = useState<string | null>(null)
  const [mcpGlobalSuccess, setMcpGlobalSuccess] = useState<string | null>(null)

  const [createKeyModalOpen, setCreateKeyModalOpen] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [keyUserId, setKeyUserId] = useState('')
  const [keyScope, setKeyScope] = useState<'leitura' | 'leitura_escrita'>('leitura')
  const [submittingKey, setSubmittingKey] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)

  const [revealedToken, setRevealedToken] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState(false)

  const [revokingKey, setRevokingKey] = useState<McpKeyItem | null>(null)
  const [submittingRevoke, setSubmittingRevoke] = useState(false)

  const loadMcpUsers = useCallback(async () => {
    try {
      const list = await listAdminUsers()
      setMcpUsers(list)
    } catch {
      // silencioso
    }
  }, [])

  const loadMcp = useCallback(async () => {
    setLoadingMcp(true)
    try {
      const res = await getMcpAdminStatus()
      setMcpEnabled(res.enabled)
      setMcpKeys(res.keys || [])
    } catch (err) {
      setMcpGlobalError(formatAdminErrorMessage(err, 'Erro ao carregar configurações de acesso.'))
    } finally {
      setLoadingMcp(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'mcp') {
      if (mcpUsers.length === 0) {
        loadMcpUsers()
      }
      loadMcp()
    }
  }, [activeTab, loadMcp, loadMcpUsers, mcpUsers.length])

  const eligibleMcpUsers = useMemo(() => {
    return mcpUsers.filter((u) => u.active && (u.role === 'admin' || u.role === 'corretor'))
  }, [mcpUsers])

  const handleToggleMcp = () => {
    if (mcpEnabled) {
      setConfirmDisableMcpOpen(true)
    } else {
      executeEnableMcp()
    }
  }

  const executeEnableMcp = async () => {
    setTogglingMcp(true)
    setMcpGlobalError(null)
    setMcpGlobalSuccess(null)
    try {
      const res = await enableMcp()
      setMcpEnabled(res.enabled)
      setMcpGlobalSuccess('Acesso ativado com sucesso.')
      await loadMcp()
    } catch (err) {
      setMcpGlobalError(formatAdminErrorMessage(err, 'Falha ao ativar acesso.'))
    } finally {
      setTogglingMcp(false)
    }
  }

  const executeDisableMcp = async () => {
    setTogglingMcp(true)
    setMcpGlobalError(null)
    setMcpGlobalSuccess(null)
    try {
      const res = await disableMcp()
      setMcpEnabled(res.enabled)
      setConfirmDisableMcpOpen(false)
      setMcpGlobalSuccess('Acesso desativado. Todas as chaves foram desligadas.')
      await loadMcp()
    } catch (err) {
      setMcpGlobalError(formatAdminErrorMessage(err, 'Falha ao desativar acesso.'))
    } finally {
      setTogglingMcp(false)
    }
  }

  const handleCreateKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setKeyError(null)
    const trimmed = keyName.trim()
    if (trimmed.length < 2) {
      setKeyError('Informe um nome com pelo menos 2 caracteres.')
      return
    }
    if (!keyUserId) {
      setKeyError('Selecione um usuário responsável.')
      return
    }

    setSubmittingKey(true)
    try {
      const res = await createMcpKey({
        name: trimmed,
        user_id: keyUserId,
        scope: keyScope,
      })
      setRevealedToken(res.token)
      setCopiedToken(false)
      setKeyName('')
      setKeyUserId('')
      setKeyScope('leitura')
      await loadMcp()
    } catch (err) {
      setKeyError(formatAdminErrorMessage(err, 'Falha ao criar chave de acesso.'))
    } finally {
      setSubmittingKey(false)
    }
  }

  const handleCopyToken = async () => {
    if (!revealedToken) return
    try {
      await copyToClipboard(revealedToken)
      setCopiedToken(true)
      setTimeout(() => setCopiedToken(false), 3000)
    } catch (_) {
      // fallback
    }
  }

  const handleConfirmRevoke = async () => {
    if (!revokingKey) return
    setSubmittingRevoke(true)
    try {
      await revokeMcpKey(revokingKey.id)
      setRevokingKey(null)
      setMcpGlobalSuccess(`Chave "${revokingKey.name}" revogada com sucesso.`)
      await loadMcp()
    } catch (err) {
      setMcpGlobalError(formatAdminErrorMessage(err, 'Falha ao revogar chave.'))
    } finally {
      setSubmittingRevoke(false)
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Integrações</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie o feed de portais imobiliários e os acessos de assistentes e ferramentas
            externas.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {activeTab === 'portais' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={refreshAllPortais}
              disabled={loadingSummary || loadingPending || loadingProps}
              className="h-9 rounded-md px-3 text-xs border-border gap-1.5"
              title="Recarregar dados"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  loadingSummary || loadingPending ? 'animate-spin text-muted-foreground' : ''
                }`}
              />
              <span>Atualizar</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadMcp}
              disabled={loadingMcp}
              className="h-9 rounded-md px-3 text-xs border-border gap-1.5"
              title="Recarregar dados"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loadingMcp ? 'animate-spin text-muted-foreground' : ''}`}
              />
              <span>Atualizar</span>
            </Button>
          )}

          <Link
            to="/admin"
            className="inline-flex items-center justify-center h-9 px-4 rounded-md text-xs border border-border bg-background hover:bg-muted text-foreground transition-colors shrink-0"
          >
            Administração
          </Link>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Barra lateral de Configurações */}
        <ConfigSidebar currentSection="integracoes" />

        <div className="flex-1 min-w-0 w-full space-y-6">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-6">
            <TabsList className="h-auto p-1 bg-muted/50 border border-border rounded-lg inline-flex gap-1">
              <TabsTrigger
                value="portais"
                className="rounded-md px-4 py-2 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                Portais
              </TabsTrigger>
              <TabsTrigger
                value="mcp"
                className="rounded-md px-4 py-2 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                Acesso MCP
              </TabsTrigger>
            </TabsList>

            {/* ═════════════════════════════════════════════════════════════ */}
            {/* ABA 1: PORTAIS */}
            {/* ═════════════════════════════════════════════════════════════ */}
            <TabsContent value="portais" className="space-y-6">
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

              {/* 1. RESUMO */}
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-foreground">Resumo da integração</h2>
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

                {loadingSummary ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-lg" />
                    ))}
                  </div>
                ) : summary ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-lg border border-border bg-card p-4 space-y-1">
                        <span className="text-xs text-muted-foreground block">
                          Saindo no portal
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-medium tabular text-foreground">
                            {summary.published_count ?? 0}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            imóveis saindo no portal
                          </span>
                        </div>
                      </div>

                      <div className="rounded-lg border border-border bg-card p-4 space-y-1">
                        <span className="text-xs text-muted-foreground block">Pendentes</span>
                        <div className="flex items-baseline gap-2">
                          <span
                            className={`text-2xl font-medium tabular ${
                              (summary.pending_count ?? 0) > 0
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-foreground'
                            }`}
                          >
                            {summary.pending_count ?? 0}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            marcados e ainda não prontos
                          </span>
                        </div>
                      </div>

                      <div className="rounded-lg border border-border bg-card p-4 space-y-1">
                        <span className="text-xs text-muted-foreground block">
                          Marcados no total
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-medium tabular text-foreground">
                            {summary.marked_count ?? 0}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            marcados em Chaves na Mão
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-card p-4 sm:p-5 space-y-4">
                      {/* URL do Feed XML */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-foreground">
                            Endereço do feed XML (Chaves na Mão)
                          </label>
                          <button
                            type="button"
                            onClick={() => setConfirmRotateOpen(true)}
                            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                          >
                            <KeyRound className="h-3 w-3" />
                            <span>Trocar código do endereço</span>
                          </button>
                        </div>
                        <div className="relative flex items-center">
                          <Input
                            readOnly
                            value={summary.feed_url || 'URL não disponível'}
                            className="h-10 text-xs font-mono pr-24 border-border bg-muted/30 selection:bg-primary selection:text-primary-foreground"
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleCopyUrl(summary.feed_url)}
                            className="absolute right-1 top-1 h-8 rounded px-3 text-xs gap-1 bg-primary text-primary-foreground"
                          >
                            {copiedFeed ? (
                              <>
                                <Check className="h-3.5 w-3.5" />
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
                        <p className="text-[11px] text-muted-foreground">
                          Cole este endereço no painel do Chaves na Mão para sincronização
                          automática dos seus imóveis.
                        </p>
                      </div>

                      {/* URL do Webhook de Leads */}
                      {summary.leads_url && (
                        <div className="space-y-1.5 pt-3 border-t border-border">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-foreground">
                              Endereço para recebimento de contatos
                            </label>
                            <button
                              type="button"
                              onClick={() => setConfirmRotateLeadsOpen(true)}
                              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                            >
                              <KeyRound className="h-3 w-3" />
                              <span>Trocar código dos contatos</span>
                            </button>
                          </div>
                          <div className="relative flex items-center">
                            <Input
                              readOnly
                              value={summary.leads_url}
                              className="h-10 text-xs font-mono pr-24 border-border bg-muted/30 selection:bg-primary selection:text-primary-foreground"
                              onClick={(e) => (e.target as HTMLInputElement).select()}
                            />
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleCopyLeadsUrl(summary.leads_url || '')}
                              className="absolute right-1 top-1 h-8 rounded px-3 text-xs gap-1 bg-primary text-primary-foreground"
                            >
                              {copiedLeads ? (
                                <>
                                  <Check className="h-3.5 w-3.5" />
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
                          <p className="text-[11px] text-muted-foreground">
                            Configure esta URL no painel do portal para que os interessados entrem
                            automaticamente na sua lista de Leads.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </section>

              {/* 2. PENDÊNCIAS */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">
                    Imóveis com pendências para publicação
                  </h2>
                  <span className="text-xs text-muted-foreground tabular">
                    {pendingItems.length} encontrado(s)
                  </span>
                </div>

                {loadingPending ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                ) : pendingItems.length === 0 ? (
                  <div className="rounded-lg border border-border bg-card p-6 text-center text-xs text-muted-foreground">
                    Nenhum imóvel pendente de ajuste. Todos os imóveis selecionados estão válidos
                    para o feed.
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
                    {pendingItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-foreground">
                              {item.code ? `Cód. ${item.code}` : 'Sem código'}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              {item.title || 'Sem título'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {item.reasons.map((r) => (
                              <Badge
                                key={r}
                                variant="outline"
                                className="text-[11px] text-amber-600 dark:text-amber-400 border-amber-500/30"
                              >
                                {translatePortalReason(r)}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <Link
                          to={`/imoveis/${item.id}/editar`}
                          className="self-start sm:self-center inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                        >
                          <span>Ajustar cadastro</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* 3. AÇÕES EM LOTE */}
              <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Publicação de imóveis no portal
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Selecione quais imóveis devem ser incluídos no feed XML do portal.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleExecuteBatch(false)}
                      disabled={selectedIds.size === 0 || batchActionRunning}
                      className="h-8 rounded-md px-3 text-xs border-border"
                    >
                      Remover do portal ({selectedIds.size})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setConfirmEnableOpen(true)}
                      disabled={selectedIds.size === 0 || batchActionRunning}
                      className="h-8 rounded-md px-3 text-xs bg-primary text-primary-foreground"
                    >
                      Publicar no portal ({selectedIds.size})
                    </Button>
                  </div>
                </div>

                {batchResult && (
                  <div
                    className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                      batchResult.type === 'success'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'border-destructive/30 bg-destructive/10 text-destructive'
                    }`}
                  >
                    <span>{batchResult.message}</span>
                    <button
                      type="button"
                      onClick={() => setBatchResult(null)}
                      className="text-xs hover:underline ml-3"
                    >
                      Fechar
                    </button>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-2.5" />
                    <Input
                      type="text"
                      placeholder="Buscar por código, título ou endereço..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-9 pl-9 text-xs border-border"
                    />
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAllVisible}
                      className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {allVisibleSelected ? 'Desmarcar visíveis' : 'Marcar visíveis'}
                    </Button>
                    {selectedIds.size > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearSelection}
                        className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Limpar seleção
                      </Button>
                    )}
                  </div>
                </div>

                {loadingProps ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-lg" />
                    ))}
                  </div>
                ) : availableProps.length === 0 ? (
                  <div className="rounded-lg border border-border bg-card p-8 text-center text-xs text-muted-foreground">
                    Nenhum imóvel ativo encontrado para o filtro.
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
                    {availableProps.map((p) => {
                      const isSelected = selectedIds.has(p.id)
                      return (
                        <div
                          key={p.id}
                          onClick={() => toggleSelectProperty(p.id)}
                          className={`p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/40 transition-colors ${
                            isSelected ? 'bg-muted/20' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelectProperty(p.id)}
                              aria-label={`Selecionar imóvel ${p.code || p.title}`}
                            />
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-foreground">
                                  {p.code ? `Cód. ${p.code}` : 'Sem código'}
                                </span>
                                <span className="text-xs text-foreground truncate">{p.title}</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {p.neighborhood || 'Bairro não informado'}
                                {p.city ? ` · ${p.city}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              variant={p.isPublishedToPortal ? 'success' : 'secondary'}
                              className="text-[10px] font-normal"
                            >
                              {p.isPublishedToPortal ? 'Publicado' : 'Não publicado'}
                            </Badge>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            </TabsContent>

            {/* ═════════════════════════════════════════════════════════════ */}
            {/* ABA 2: ACESSO MCP */}
            {/* ═════════════════════════════════════════════════════════════ */}
            <TabsContent value="mcp" className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Acesso MCP</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Conexão segura para assistentes e integrações externas autorizadas.
                  </p>
                </div>
                {mcpEnabled && (
                  <Button
                    onClick={() => {
                      setKeyError(null)
                      setKeyName('')
                      setKeyUserId('')
                      setKeyScope('leitura')
                      setRevealedToken(null)
                      setCopiedToken(false)
                      setCreateKeyModalOpen(true)
                    }}
                    className="h-9 rounded-md px-4 text-xs font-normal bg-primary text-primary-foreground gap-1.5 shrink-0 self-start sm:self-auto"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Nova chave</span>
                  </Button>
                )}
              </div>

              {mcpGlobalSuccess && (
                <div className="p-3.5 rounded-lg border border-border bg-card text-xs text-foreground flex items-center justify-between">
                  <span>{mcpGlobalSuccess}</span>
                  <button
                    type="button"
                    onClick={() => setMcpGlobalSuccess(null)}
                    className="text-xs text-muted-foreground hover:text-foreground ml-3"
                  >
                    Fechar
                  </button>
                </div>
              )}

              {mcpGlobalError && (
                <div className="p-3.5 rounded-lg border border-destructive/20 bg-destructive/10 text-xs text-destructive flex items-center justify-between">
                  <span>{mcpGlobalError}</span>
                  <button
                    type="button"
                    onClick={() => setMcpGlobalError(null)}
                    className="text-xs text-destructive hover:underline ml-3"
                  >
                    Fechar
                  </button>
                </div>
              )}

              {/* Bloco de Estado Geral Ligado/Desligado */}
              <div className="rounded-lg border border-border bg-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      Situação do servidor
                    </span>
                    <Badge
                      variant={mcpEnabled ? 'success' : 'secondary'}
                      className="text-[11px] font-normal"
                    >
                      {mcpEnabled ? 'Ligado' : 'Desligado'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-xl">
                    {mcpEnabled
                      ? 'O servidor está ativo e aceita conexões de chaves válidas vinculadas a usuários da organização.'
                      : 'O servidor está inativo. Nenhuma chave consegue consultar dados enquanto estiver desligado.'}
                  </p>
                </div>

                <div className="shrink-0">
                  <Button
                    type="button"
                    variant={mcpEnabled ? 'outline' : 'default'}
                    onClick={handleToggleMcp}
                    disabled={loadingMcp || togglingMcp}
                    className={`h-9 rounded-md px-4 text-xs font-normal gap-1.5 ${
                      mcpEnabled
                        ? 'border-border text-destructive hover:bg-destructive/10'
                        : 'bg-primary text-primary-foreground'
                    }`}
                  >
                    {togglingMcp && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>{mcpEnabled ? 'Desligar acesso' : 'Ligar acesso'}</span>
                  </Button>
                </div>
              </div>

              {/* Lista de Chaves */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-foreground">Chaves autorizadas</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={loadMcp}
                    disabled={loadingMcp}
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {loadingMcp ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Atualizar'}
                  </Button>
                </div>

                {loadingMcp ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                ) : mcpKeys.length === 0 ? (
                  <div className="rounded-lg border border-border bg-card p-10 text-center space-y-2">
                    <Key className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                    <p className="text-xs text-muted-foreground">
                      Nenhuma chave cadastrada até o momento.
                    </p>
                    {mcpEnabled && (
                      <p className="text-xs text-muted-foreground">
                        Clique em &quot;Nova chave&quot; acima para autorizar um novo assistente.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
                    {mcpKeys.map((k) => {
                      const user = mcpUsers.find((u) => u.id === k.user_id)
                      const userName = user ? user.name || user.email : 'Usuário não localizado'
                      const userRoleLabel = user ? getRoleLabel(user.role) : ''
                      const isRevoked = !k.active || Boolean(k.revoked_at)
                      const scopeLabel =
                        k.scope === 'leitura_escrita' ? 'Leitura e escrita' : 'Somente leitura'

                      return (
                        <div
                          key={k.id}
                          className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors ${
                            isRevoked ? 'opacity-60 bg-muted/10' : ''
                          }`}
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-normal text-foreground">{k.name}</span>
                              <Badge
                                variant={isRevoked ? 'destructive' : 'success'}
                                className="text-[10px] px-1.5 py-0 font-normal"
                              >
                                {isRevoked ? 'Revogada' : 'Ativa'}
                              </Badge>
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 font-normal"
                              >
                                {scopeLabel}
                              </Badge>
                              <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {k.token_prefix}...
                              </code>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              <span>
                                Usuário:{' '}
                                <span className="text-foreground font-normal">{userName}</span>
                                {userRoleLabel && (
                                  <span className="text-muted-foreground ml-1">
                                    ({userRoleLabel})
                                  </span>
                                )}
                              </span>
                              <span>•</span>
                              <span>
                                Último uso:{' '}
                                <span className="text-foreground tabular">
                                  {k.last_used_at
                                    ? formatDateTimeBahia(k.last_used_at)
                                    : 'Nunca utilizada'}
                                </span>
                              </span>
                              {isRevoked && k.revoked_at && (
                                <>
                                  <span>•</span>
                                  <span>
                                    Revogada em:{' '}
                                    <span className="text-foreground tabular">
                                      {formatDateTimeBahia(k.revoked_at)}
                                    </span>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {!isRevoked && (
                            <div className="shrink-0 self-start sm:self-center">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setRevokingKey(k)}
                                className="h-8 rounded-md px-3 text-xs font-normal border-border text-destructive hover:bg-destructive/10"
                              >
                                Revogar
                              </Button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* MODAIS DE PORTAIS */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {/* Confirmação Lote Publicar */}
      <AlertDialog open={confirmEnableOpen} onOpenChange={setConfirmEnableOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-medium text-lg">Publicar no portal</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Deseja incluir os {selectedIds.size} imóveis selecionados no feed do portal? Os que
              tiverem pendências de cadastro serão sinalizados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={batchActionRunning}
              className="h-9 rounded-md px-4 text-xs font-normal border-border"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleExecuteBatch(true)
              }}
              disabled={batchActionRunning}
              className="h-9 rounded-md px-5 text-xs font-normal bg-primary text-primary-foreground"
            >
              {batchActionRunning && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação Trocar Código do Feed */}
      <AlertDialog open={confirmRotateOpen} onOpenChange={setConfirmRotateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-medium text-lg">
              Trocar código do endereço do XML
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground space-y-2">
              <span className="block">
                Ao trocar o código, o endereço anterior deixará de funcionar imediatamente.
              </span>
              <span className="block text-foreground font-medium">
                Você precisará atualizar o novo endereço no painel do Chaves na Mão.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={rotating}
              className="h-9 rounded-md px-4 text-xs font-normal border-border"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmRotate()
              }}
              disabled={rotating}
              className="h-9 rounded-md px-5 text-xs font-normal bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rotating && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Trocar código
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sucesso Troca Código Feed */}
      <Dialog
        open={Boolean(rotateSuccessUrl)}
        onOpenChange={(open) => {
          if (!open) {
            setRotateSuccessUrl(null)
            setCopiedRotatedUrl(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-medium text-lg">Novo endereço gerado</DialogTitle>
            <DialogDescription className="text-xs">
              Atualize o endereço abaixo no painel do Chaves na Mão.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="relative">
              <Input
                readOnly
                value={rotateSuccessUrl || ''}
                className="h-10 text-xs font-mono pr-24 border-border bg-muted/30 selection:bg-primary selection:text-primary-foreground"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                type="button"
                size="sm"
                onClick={() => handleCopyUrl(rotateSuccessUrl || '', true)}
                className="absolute right-1 top-1 h-8 rounded px-3 text-xs gap-1 bg-primary text-primary-foreground"
              >
                {copiedRotatedUrl ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
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

          <DialogFooter className="pt-2">
            <Button
              type="button"
              onClick={() => {
                setRotateSuccessUrl(null)
                setCopiedRotatedUrl(false)
              }}
              className="h-9 rounded-md px-5 text-xs font-normal bg-primary text-primary-foreground"
            >
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação Trocar Código Leads */}
      <AlertDialog open={confirmRotateLeadsOpen} onOpenChange={setConfirmRotateLeadsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-medium text-lg">
              Trocar código dos contatos
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground space-y-2">
              <span className="block">
                Ao trocar o código, o endereço anterior deixará de funcionar imediatamente.
              </span>
              <span className="block text-foreground font-medium">
                Você precisará atualizar o novo endereço no painel do portal.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={rotatingLeads}
              className="h-9 rounded-md px-4 text-xs font-normal border-border"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmRotateLeads()
              }}
              disabled={rotatingLeads}
              className="h-9 rounded-md px-5 text-xs font-normal bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rotatingLeads && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Trocar código
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sucesso Troca Código Leads */}
      <Dialog
        open={Boolean(rotateLeadsSuccessUrl)}
        onOpenChange={(open) => {
          if (!open) {
            setRotateLeadsSuccessUrl(null)
            setCopiedRotatedLeadsUrl(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-medium text-lg">Novo endereço gerado</DialogTitle>
            <DialogDescription className="text-xs">
              Atualize o endereço de contatos no painel do portal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="relative">
              <Input
                readOnly
                value={rotateLeadsSuccessUrl || ''}
                className="h-10 text-xs font-mono pr-24 border-border bg-muted/30 selection:bg-primary selection:text-primary-foreground"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                type="button"
                size="sm"
                onClick={() => handleCopyLeadsUrl(rotateLeadsSuccessUrl || '', true)}
                className="absolute right-1 top-1 h-8 rounded px-3 text-xs gap-1 bg-primary text-primary-foreground"
              >
                {copiedRotatedLeadsUrl ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
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

          <DialogFooter className="pt-2">
            <Button
              type="button"
              onClick={() => {
                setRotateLeadsSuccessUrl(null)
                setCopiedRotatedLeadsUrl(false)
              }}
              className="h-9 rounded-md px-5 text-xs font-normal bg-primary text-primary-foreground"
            >
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* MODAIS DE MCP */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {/* Desligar MCP */}
      <AlertDialog open={confirmDisableMcpOpen} onOpenChange={setConfirmDisableMcpOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-medium text-lg">Desligar acesso MCP</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Ao desligar, todas as chaves param de funcionar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={togglingMcp}
              className="h-9 rounded-md px-4 text-xs font-normal border-border"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                executeDisableMcp()
              }}
              disabled={togglingMcp}
              className="h-9 rounded-md px-5 text-xs font-normal bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {togglingMcp && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Desligar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Nova Chave MCP */}
      <Dialog
        open={createKeyModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateKeyModalOpen(false)
            setRevealedToken(null)
            setKeyError(null)
          } else {
            setCreateKeyModalOpen(true)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-medium text-lg">
              {revealedToken ? 'Chave de acesso gerada' : 'Nova chave de acesso'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {revealedToken
                ? 'Guarde agora: ela não aparece de novo.'
                : 'Defina a identificação, o usuário responsável e o nível de permissão.'}
            </DialogDescription>
          </DialogHeader>

          {revealedToken ? (
            <div className="space-y-4 py-2">
              <div className="p-3.5 rounded-lg border border-amber-500/40 bg-amber-500/10 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Atenção</span>
                </div>
                <p className="text-xs text-foreground font-normal">
                  Guarde agora: ela não aparece de novo
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="revealed-token-mcp" className="text-xs text-muted-foreground block">
                  Chave de acesso
                </Label>
                <div className="relative">
                  <Input
                    id="revealed-token-mcp"
                    readOnly
                    value={revealedToken}
                    className="h-10 font-mono text-xs pr-24 border-border bg-muted/40 selection:bg-primary selection:text-primary-foreground"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCopyToken}
                    className="absolute right-1 top-1 h-8 rounded px-3 text-xs gap-1 bg-primary text-primary-foreground"
                  >
                    {copiedToken ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
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

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  onClick={() => {
                    setCreateKeyModalOpen(false)
                    setRevealedToken(null)
                  }}
                  className="h-9 rounded-md px-5 text-xs font-normal bg-primary text-primary-foreground"
                >
                  Concluir
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleCreateKeySubmit} className="space-y-4">
              {keyError && (
                <p className="text-xs text-destructive font-normal" role="alert">
                  {keyError}
                </p>
              )}

              <div className="space-y-1.5">
                <Label
                  htmlFor="key-name-input"
                  className="text-xs font-medium text-foreground block"
                >
                  Nome da chave <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="key-name-input"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="Ex: Claude Desktop, Assistente Corretor"
                  required
                  disabled={submittingKey}
                  className="h-10 text-xs border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="key-user-select"
                  className="text-xs font-medium text-foreground block"
                >
                  Usuário responsável <span className="text-destructive">*</span>
                </Label>
                <Select value={keyUserId} onValueChange={setKeyUserId} disabled={submittingKey}>
                  <SelectTrigger id="key-user-select" className="h-10 text-xs border-border">
                    <SelectValue placeholder="Selecione um administrador ou corretor" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleMcpUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email} ({getRoleLabel(u.role)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  A chave atuará com as permissões e a visão deste usuário.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="key-scope-select"
                  className="text-xs font-medium text-foreground block"
                >
                  Escopo de permissão <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={keyScope}
                  onValueChange={(val) => setKeyScope(val as 'leitura' | 'leitura_escrita')}
                  disabled={submittingKey}
                >
                  <SelectTrigger id="key-scope-select" className="h-10 text-xs border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leitura">
                      Somente leitura (consulta de imóveis, clientes e tarefas)
                    </SelectItem>
                    <SelectItem value="leitura_escrita">
                      Leitura e escrita (permite também criar tarefas)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-3 gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateKeyModalOpen(false)}
                  disabled={submittingKey}
                  className="h-9 rounded-md px-4 text-xs font-normal border-border"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submittingKey || !keyUserId || keyName.trim().length < 2}
                  className="h-9 rounded-md px-5 text-xs font-normal bg-primary text-primary-foreground gap-2"
                >
                  {submittingKey && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Criar chave</span>
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Revogar Chave MCP */}
      <AlertDialog
        open={Boolean(revokingKey)}
        onOpenChange={(open) => {
          if (!open) setRevokingKey(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-medium text-lg">
              Revogar chave de acesso
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-xs text-muted-foreground">
              <span>
                Tem certeza de que deseja revogar a chave{' '}
                <strong className="text-foreground">{revokingKey?.name}</strong>?
              </span>
              <span className="block text-foreground">
                Qualquer assistente conectado utilizando esta chave deixará de autenticar
                imediatamente. Esta ação não pode ser desfeita.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={submittingRevoke}
              className="h-9 rounded-md px-4 text-xs font-normal border-border"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmRevoke()
              }}
              disabled={submittingRevoke}
              className="h-9 rounded-md px-5 text-xs font-normal bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submittingRevoke && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Revogar chave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
