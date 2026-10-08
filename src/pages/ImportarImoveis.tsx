import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { readSpreadsheetFile } from '@/lib/spreadsheet'
import {
  importPropertiesEndpoint,
  listImportBatches,
  undoImportBatch,
  PropertyImportSimulationResponse,
  PropertyImportItemResult,
  ImportBatchItem,
  PropertyComparisonSnapshot,
} from '@/services/admin'
import { formatErrorMessage, formatCurrencyBRL } from '@/services/properties'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  AlertCircle,
  FileText,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  RotateCcw,
  ExternalLink,
  Info,
  Building,
  RefreshCw,
  X,
} from 'lucide-react'

// Traduções oficiais solicitadas
const REASON_TRANSLATIONS: Record<string, string> = {
  status_nao_ativo: 'Não está ativo',
  codigo_existente: 'Código já cadastrado',
  endereco_existente: 'Endereço já cadastrado',
  codigo_repetido_no_arquivo: 'Código repetido no arquivo',
  endereco_vazio: 'Endereço vazio',
  codigo_vazio: 'Sem código',
}

const NOTE_TRANSLATIONS: Record<string, string> = {
  numero_sn: 'Sem número (S/N)',
  captador_nao_encontrado: 'Captador não encontrado: ficou com você',
  sem_preco: 'Sem preço',
}

function translateReason(reason: string): string {
  return REASON_TRANSLATIONS[reason] || reason
}

function translateNote(note: string): string {
  if (NOTE_TRANSLATIONS[note]) return NOTE_TRANSLATIONS[note]
  if (note.startsWith('tipo_mapeado:')) {
    const originalType = note.replace('tipo_mapeado:', '')
    return `Tipo mapeado de: ${originalType}`
  }
  return note
}

function formatBatchDate(isoString: string): string {
  if (!isoString) return '—'
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return isoString
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, '0')
  const mins = String(d.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} ${hours}:${mins}`
}

function formatPriceDisplay(sale?: number, rent?: number): string {
  const s = Number(sale) || 0
  const r = Number(rent) || 0
  if (s <= 0 && r <= 0) return 'Não informado'
  const parts: string[] = []
  if (s > 0) parts.push(`Venda: ${formatCurrencyBRL(s)}`)
  if (r > 0) parts.push(`Locação: ${formatCurrencyBRL(r)}/mês`)
  return parts.join(' | ')
}

export default function ImportarImoveis() {
  const navigate = useNavigate()

  // Passo ativo: 1 (Arquivo), 2 (Simulação), 3 (Confirmar / Relatório)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)

  // Arquivo & Linhas
  const [file, setFile] = useState<File | null>(null)
  const [readingFile, setReadingFile] = useState(false)
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Simulação
  const [simulationLoading, setSimulationLoading] = useState(false)
  const [simulationResult, setSimulationResult] = useState<PropertyImportSimulationResponse | null>(
    null,
  )
  const [activeFilter, setActiveFilter] = useState<'todos' | 'aceito' | 'pendente' | 'recusado'>(
    'todos',
  )
  const [tableSearch, setTableSearch] = useState('')

  // Item selecionado para comparação lado a lado (modal / drawer)
  const [comparisonItem, setComparisonItem] = useState<PropertyImportItemResult | null>(null)

  // Confirmação / Gravação
  const [confirmingLoading, setConfirmingLoading] = useState(false)
  const [finalReport, setFinalReport] = useState<PropertyImportSimulationResponse | null>(null)

  // Histórico
  const [batches, setBatches] = useState<ImportBatchItem[]>([])
  const [loadingBatches, setLoadingBatches] = useState(false)

  // Desfazer
  const [batchToUndo, setBatchToUndo] = useState<ImportBatchItem | null>(null)
  const [undoingLoading, setUndoingLoading] = useState(false)
  const [undoFeedback, setUndoFeedback] = useState<{
    open: boolean
    message: string
  }>({ open: false, message: '' })

  // Erros gerais
  const [generalError, setGeneralError] = useState<string | null>(null)

  // Carregar histórico
  const loadBatches = useCallback(async () => {
    setLoadingBatches(true)
    try {
      const list = await listImportBatches()
      setBatches(list)
    } catch (err) {
      // Ignora erro silenciosamente ou guarda mensagem
    } finally {
      setLoadingBatches(false)
    }
  }, [])

  useEffect(() => {
    loadBatches()
  }, [loadBatches])

  // Reset do fluxo de importação
  const handleResetFlow = () => {
    setFile(null)
    setParsedRows([])
    setSimulationResult(null)
    setFinalReport(null)
    setCurrentStep(1)
    setGeneralError(null)
    setComparisonItem(null)
    setActiveFilter('todos')
    setTableSearch('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Passo 1: Leitura do Arquivo
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    setGeneralError(null)
    setFile(selected)
    setReadingFile(true)

    try {
      // Lê planilha usando o leitor unificado (xlsx / csv com ;)
      // Não limitamos a 500 no leitor pois dividiremos em lotes de até 500 no envio
      const rows = await readSpreadsheetFile<Record<string, unknown>>(selected)

      if (rows.length === 0) {
        throw new Error('Nenhuma linha de dados encontrada no arquivo.')
      }

      setParsedRows(rows)

      // Executa simulação automaticamente
      await runSimulation(rows, selected.name)
    } catch (err) {
      setGeneralError(formatErrorMessage(err))
      setFile(null)
      setParsedRows([])
      setSimulationResult(null)
    } finally {
      setReadingFile(false)
    }
  }

  // Executar simulação em lotes de até 500 linhas
  const runSimulation = async (rows: Record<string, unknown>[], filename: string) => {
    setSimulationLoading(true)
    setGeneralError(null)

    try {
      const BATCH_SIZE = 500
      const totalBatches = Math.ceil(rows.length / BATCH_SIZE)

      let aggregatedCounts = { aceito: 0, pendente: 0, recusado: 0 }
      let aggregatedItems: PropertyImportItemResult[] = []
      let aggregatedCondos = {
        criados: 0,
        reaproveitados: 0,
        parecidos: [] as Array<{ novo: string; existente: string }>,
      }

      for (let i = 0; i < totalBatches; i++) {
        const slice = rows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
        const res = await importPropertiesEndpoint({
          rows: slice,
          dry_run: true,
          filename: filename,
        })

        aggregatedCounts.aceito += res.counts.aceito
        aggregatedCounts.pendente += res.counts.pendente
        aggregatedCounts.recusado += res.counts.recusado

        // Ajusta número da linha global
        const offset = i * BATCH_SIZE
        const adjustedItems = res.items.map((it) => ({
          ...it,
          row: it.row + offset,
        }))
        aggregatedItems = aggregatedItems.concat(adjustedItems)

        if (res.condominios) {
          aggregatedCondos.criados += res.condominios.criados || 0
          aggregatedCondos.reaproveitados += res.condominios.reaproveitados || 0
          if (res.condominios.parecidos && res.condominios.parecidos.length > 0) {
            aggregatedCondos.parecidos.push(...res.condominios.parecidos)
          }
        }
      }

      // Deduplica condomínios parecidos caso apareçam mais de uma vez
      const seenSimilar = new Set<string>()
      const uniqueSimilar = aggregatedCondos.parecidos.filter((s) => {
        const k = `${s.novo}|${s.existente}`
        if (seenSimilar.has(k)) return false
        seenSimilar.add(k)
        return true
      })
      aggregatedCondos.parecidos = uniqueSimilar

      const aggregatedResult: PropertyImportSimulationResponse = {
        dry_run: true,
        batch_id: null,
        counts: aggregatedCounts,
        items: aggregatedItems,
        condominios: aggregatedCondos,
      }

      setSimulationResult(aggregatedResult)
      setCurrentStep(2)
    } catch (err) {
      setGeneralError(formatErrorMessage(err))
    } finally {
      setSimulationLoading(false)
    }
  }

  // Passo 3: Confirmar e Gravar
  const handleConfirmImport = async () => {
    if (!file || parsedRows.length === 0 || !simulationResult) return

    setConfirmingLoading(true)
    setGeneralError(null)

    try {
      const BATCH_SIZE = 500
      const totalBatches = Math.ceil(parsedRows.length / BATCH_SIZE)

      let lastBatchId: string | null = null
      let aggregatedCounts = { aceito: 0, pendente: 0, recusado: 0 }
      let aggregatedItems: PropertyImportItemResult[] = []

      for (let i = 0; i < totalBatches; i++) {
        const slice = parsedRows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
        const res = await importPropertiesEndpoint({
          rows: slice,
          dry_run: false,
          filename: file.name,
        })

        if (res.batch_id) {
          lastBatchId = res.batch_id
        }
        aggregatedCounts.aceito += res.counts.aceito
        aggregatedCounts.pendente += res.counts.pendente
        aggregatedCounts.recusado += res.counts.recusado

        const offset = i * BATCH_SIZE
        const adjustedItems = res.items.map((it) => ({
          ...it,
          row: it.row + offset,
        }))
        aggregatedItems = aggregatedItems.concat(adjustedItems)
      }

      const finalRes: PropertyImportSimulationResponse = {
        dry_run: false,
        batch_id: lastBatchId,
        counts: aggregatedCounts,
        items: aggregatedItems,
        condominios: simulationResult.condominios,
      }

      setFinalReport(finalRes)
      setCurrentStep(3)
      await loadBatches()
    } catch (err) {
      setGeneralError(formatErrorMessage(err))
    } finally {
      setConfirmingLoading(false)
    }
  }

  // Ação Desfazer
  const handleConfirmUndo = async () => {
    if (!batchToUndo) return
    setUndoingLoading(true)
    try {
      const res = await undoImportBatch(batchToUndo.id)
      setBatchToUndo(null)
      setUndoFeedback({
        open: true,
        message: `Importação desfeita com sucesso! ${res.undone} imóvel(is) inativado(s) e ${res.skipped} ignorado(s)${
          res.condominiums_deactivated
            ? ` (${res.condominiums_deactivated} condomínio(s) inativado(s))`
            : ''
        }.`,
      })
      await loadBatches()
    } catch (err) {
      setGeneralError(formatErrorMessage(err))
      setBatchToUndo(null)
    } finally {
      setUndoingLoading(false)
    }
  }

  // Itens filtrados na tabela de simulação
  const filteredSimulationItems = useMemo(() => {
    if (!simulationResult) return []
    return simulationResult.items.filter((item) => {
      if (activeFilter !== 'todos' && item.outcome !== activeFilter) {
        return false
      }
      if (tableSearch.trim()) {
        const query = tableSearch.trim().toLowerCase()
        const codeMatch = item.code.toLowerCase().includes(query)
        const rowMatch = String(item.row).includes(query)
        const reasonMatch = item.reasons.some((r) =>
          translateReason(r).toLowerCase().includes(query),
        )
        const noteMatch = item.notas.some((n) => translateNote(n).toLowerCase().includes(query))
        return codeMatch || rowMatch || reasonMatch || noteMatch
      }
      return true
    })
  }, [simulationResult, activeFilter, tableSearch])

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Administração</span>
            </Link>
          </div>
          <h1 className="display-sm text-foreground mt-1">Importar imóveis</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Importe seu catálogo da Kenlo através de planilha (.xlsx ou .csv com separador
            ponto-e-vírgula).
          </p>
        </div>

        {currentStep > 1 && (
          <Button
            type="button"
            variant="outline"
            onClick={handleResetFlow}
            disabled={confirmingLoading}
            className="h-9 rounded-full px-4 text-xs font-normal border-border gap-1.5 self-start sm:self-auto"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Trocar arquivo</span>
          </Button>
        )}
      </div>

      {/* Indicador de Passos (1. Arquivo → 2. Simulação → 3. Confirmar) */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid grid-cols-3 gap-2">
          {/* Passo 1 */}
          <div
            className={`flex items-center gap-2 p-2 rounded-md transition-colors ${
              currentStep === 1
                ? 'bg-muted/80 text-foreground font-medium'
                : currentStep > 1
                  ? 'text-muted-foreground'
                  : 'opacity-50 text-muted-foreground'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono shrink-0 ${
                currentStep > 1
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                  : currentStep === 1
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {currentStep > 1 ? '✓' : '1'}
            </div>
            <div className="min-w-0">
              <span className="text-xs block truncate">1. Arquivo</span>
            </div>
          </div>

          {/* Passo 2 */}
          <div
            className={`flex items-center gap-2 p-2 rounded-md transition-colors ${
              currentStep === 2
                ? 'bg-muted/80 text-foreground font-medium'
                : currentStep > 2
                  ? 'text-muted-foreground'
                  : 'opacity-50 text-muted-foreground'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono shrink-0 ${
                currentStep > 2
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                  : currentStep === 2
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {currentStep > 2 ? '✓' : '2'}
            </div>
            <div className="min-w-0">
              <span className="text-xs block truncate">2. Simulação</span>
            </div>
          </div>

          {/* Passo 3 */}
          <div
            className={`flex items-center gap-2 p-2 rounded-md transition-colors ${
              currentStep === 3
                ? 'bg-muted/80 text-foreground font-medium'
                : 'opacity-50 text-muted-foreground'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono shrink-0 ${
                currentStep === 3
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              3
            </div>
            <div className="min-w-0">
              <span className="text-xs block truncate">3. Confirmar</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerta de Erro Geral com botão "Tentar novamente" */}
      {generalError && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{generalError}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setGeneralError(null)
              if (file && parsedRows.length > 0) {
                runSimulation(parsedRows, file.name)
              }
            }}
            className="rounded-full px-4 h-8 text-xs font-normal border-destructive/30 text-destructive hover:bg-destructive/10 self-start sm:self-auto shrink-0"
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PASSO 1: ESCOLHA DE ARQUIVO */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="border border-dashed border-border rounded-lg p-8 sm:p-12 text-center bg-card space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileSelect}
              className="hidden"
              id="property-import-file-main"
              disabled={readingFile || simulationLoading}
            />

            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground mx-auto">
              {readingFile || simulationLoading ? (
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              ) : (
                <FileSpreadsheet className="h-7 w-7" />
              )}
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-medium text-foreground">
                Selecione o arquivo exportado da Kenlo
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Formatos suportados: <strong className="text-foreground">.xlsx</strong> ou{' '}
                <strong className="text-foreground">.csv</strong> (separador ponto-e-vírgula). A
                leitura é feita 100% no seu navegador com segurança.
              </p>
            </div>

            <div className="pt-2">
              <label
                htmlFor="property-import-file-main"
                className={`inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full text-xs font-normal cursor-pointer transition-colors ${
                  readingFile || simulationLoading
                    ? 'bg-muted text-muted-foreground pointer-events-none'
                    : 'bg-primary text-primary-foreground hover:opacity-90'
                }`}
              >
                <Upload className="h-4 w-4" />
                <span>
                  {readingFile
                    ? 'Lendo planilha...'
                    : simulationLoading
                      ? 'Simulando importação...'
                      : 'Escolher arquivo'}
                </span>
              </label>
            </div>

            <div className="pt-4 border-t border-border/60 max-w-lg mx-auto text-left">
              <span className="text-[11px] eyebrow text-muted-foreground block mb-1">
                Orientações do arquivo Kenlo:
              </span>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>A primeira planilha/aba do arquivo será utilizada.</li>
                <li>
                  Os cabeçalhos originais (Referência, Status, Endereço, Bairro, etc.) são
                  preservados sem renomeação.
                </li>
                <li>Apenas imóveis com Status &quot;Ativo&quot; serão aceitos para importação.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PASSO 2: SIMULAÇÃO */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {currentStep === 2 && simulationResult && (
        <div className="space-y-6">
          {/* Informações do arquivo selecionado */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border bg-card gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-medium text-foreground block truncate">
                  {file?.name || 'Arquivo'}
                </span>
                <span className="text-xs text-muted-foreground tabular block">
                  {parsedRows.length} linhas lidas da planilha
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={handleConfirmImport}
                disabled={confirmingLoading || simulationResult.counts.aceito === 0}
                className="h-10 rounded-full px-5 text-xs font-normal bg-primary text-primary-foreground gap-2 shrink-0"
              >
                {confirmingLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Importando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Importar {simulationResult.counts.aceito} imóveis</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Aviso de Condomínios Parecidos (se houver) */}
          {simulationResult.condominios &&
            simulationResult.condominios.parecidos &&
            simulationResult.condominios.parecidos.length > 0 && (
              <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 text-foreground space-y-2">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-xs">
                  <Building className="h-4 w-4 shrink-0" />
                  <span>
                    Atenção: Foram identificados condomínios parecidos já existentes no sistema
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Os seguintes condomínios possuem nomes muito próximos a registros já existentes.
                  Eles serão criados como novos condomínios se você confirmar a importação:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {simulationResult.condominios.parecidos.map((sim, i) => (
                    <div
                      key={i}
                      className="px-2.5 py-1 rounded-md border border-border bg-card text-xs flex items-center gap-1.5"
                    >
                      <span className="font-normal text-foreground">{sim.novo}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Existente: {sim.existente}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Contadores da Simulação */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Aceitos */}
            <div className="p-4 rounded-lg border border-border bg-card space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Aceitos (novos)</span>
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-normal border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                >
                  Prontos
                </Badge>
              </div>
              <div className="text-2xl font-normal tabular text-foreground pt-1">
                {simulationResult.counts.aceito}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Serão criados como Rascunho com a situação &quot;rascunho&quot;.
              </p>
            </div>

            {/* Pendentes */}
            <div className="p-4 rounded-lg border border-border bg-card space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span>Pendentes</span>
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-normal border-amber-500/30 text-amber-700 dark:text-amber-400"
                >
                  Requer atenção
                </Badge>
              </div>
              <div className="text-2xl font-normal tabular text-foreground pt-1">
                {simulationResult.counts.pendente}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Código ou endereço já cadastrado. Clique na linha para comparar.
              </p>
            </div>

            {/* Recusados */}
            <div className="p-4 rounded-lg border border-border bg-card space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span>Recusados</span>
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-normal border-destructive/30 text-destructive"
                >
                  Inválidos
                </Badge>
              </div>
              <div className="text-2xl font-normal tabular text-foreground pt-1">
                {simulationResult.counts.recusado}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Inativos, sem código, endereço vazio ou repetidos no arquivo.
              </p>
            </div>
          </div>

          {/* Filtros e Busca da Tabela de Simulação */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            {/* Pílulas de filtro de resultado */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              <button
                type="button"
                onClick={() => setActiveFilter('todos')}
                className={`h-9 px-4 rounded-full text-xs font-normal border transition-colors shrink-0 ${
                  activeFilter === 'todos'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-foreground border-border hover:bg-muted'
                }`}
              >
                Todos ({simulationResult.items.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('aceito')}
                className={`h-9 px-4 rounded-full text-xs font-normal border transition-colors inline-flex items-center gap-1.5 shrink-0 ${
                  activeFilter === 'aceito'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-foreground border-border hover:bg-muted'
                }`}
              >
                <span>Aceitos</span>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1 py-0 border-current font-normal tabular"
                >
                  {simulationResult.counts.aceito}
                </Badge>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('pendente')}
                className={`h-9 px-4 rounded-full text-xs font-normal border transition-colors inline-flex items-center gap-1.5 shrink-0 ${
                  activeFilter === 'pendente'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-foreground border-border hover:bg-muted'
                }`}
              >
                <span>Pendentes</span>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1 py-0 border-current font-normal tabular"
                >
                  {simulationResult.counts.pendente}
                </Badge>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('recusado')}
                className={`h-9 px-4 rounded-full text-xs font-normal border transition-colors inline-flex items-center gap-1.5 shrink-0 ${
                  activeFilter === 'recusado'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-foreground border-border hover:bg-muted'
                }`}
              >
                <span>Recusados</span>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1 py-0 border-current font-normal tabular"
                >
                  {simulationResult.counts.recusado}
                </Badge>
              </button>
            </div>

            {/* Busca rápida */}
            <div className="relative w-full sm:w-64 shrink-0">
              <input
                type="text"
                placeholder="Filtrar por código, motivo..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-full border border-border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {tableSearch && (
                <button
                  type="button"
                  onClick={() => setTableSearch('')}
                  aria-label="Limpar busca"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Tabela de Linhas da Simulação com rolagem horizontal interna se necessário */}
          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
              <Table className="text-xs min-w-[640px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-16 tabular">Linha</TableHead>
                    <TableHead className="w-28">Código</TableHead>
                    <TableHead className="w-28">Resultado</TableHead>
                    <TableHead>Motivos</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead className="w-20 text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSimulationItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        Nenhuma linha encontrada para o filtro selecionado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSimulationItems.map((item) => {
                      const isPending = item.outcome === 'pendente'

                      return (
                        <TableRow
                          key={item.row}
                          onClick={() => {
                            if (isPending) setComparisonItem(item)
                          }}
                          className={`${
                            isPending ? 'cursor-pointer hover:bg-amber-500/10' : 'hover:bg-muted/40'
                          }`}
                        >
                          <TableCell className="tabular text-muted-foreground">
                            {item.row}
                          </TableCell>

                          <TableCell className="font-mono text-foreground font-normal">
                            {item.code || <span className="text-muted-foreground italic">—</span>}
                          </TableCell>

                          <TableCell>
                            {item.outcome === 'aceito' && (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-normal border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
                              >
                                Aceito
                              </Badge>
                            )}
                            {item.outcome === 'pendente' && (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-normal border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20"
                              >
                                Pendente
                              </Badge>
                            )}
                            {item.outcome === 'recusado' && (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-normal border-destructive/30 text-destructive bg-destructive/10"
                              >
                                Recusado
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="text-muted-foreground max-w-xs">
                            {item.reasons.length > 0 ? (
                              <span className="text-foreground">
                                {item.reasons.map(translateReason).join(', ')}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic">—</span>
                            )}
                          </TableCell>

                          <TableCell className="text-muted-foreground max-w-xs">
                            {item.notas.length > 0 ? (
                              <span>{item.notas.map(translateNote).join(', ')}</span>
                            ) : (
                              <span className="text-muted-foreground italic">—</span>
                            )}
                          </TableCell>

                          <TableCell className="text-right">
                            {isPending ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setComparisonItem(item)
                                }}
                                className="h-7 rounded-full px-2.5 text-[11px] font-normal border-border gap-1"
                              >
                                <span>Ver</span>
                                <ChevronRight className="h-3 w-3" />
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PASSO 3: RELATÓRIO FINAL */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {currentStep === 3 && finalReport && (
        <div className="space-y-6">
          <div className="border border-border rounded-lg bg-card p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-foreground">
                  Importação de imóveis concluída!
                </h2>
                <p className="text-xs text-muted-foreground">
                  Os imóveis foram cadastrados em modo Rascunho na sua organização.
                </p>
              </div>
            </div>

            {/* Resumo do lote */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-lg border border-border bg-background space-y-1">
                <span className="text-xs text-muted-foreground">Imóveis importados</span>
                <div className="text-2xl font-normal tabular text-foreground">
                  {finalReport.counts.aceito}
                </div>
              </div>

              <div className="p-4 rounded-lg border border-border bg-background space-y-1">
                <span className="text-xs text-muted-foreground">Ignorados (pendentes)</span>
                <div className="text-2xl font-normal tabular text-muted-foreground">
                  {finalReport.counts.pendente}
                </div>
              </div>

              <div className="p-4 rounded-lg border border-border bg-background space-y-1">
                <span className="text-xs text-muted-foreground">Recusados</span>
                <div className="text-2xl font-normal tabular text-muted-foreground">
                  {finalReport.counts.recusado}
                </div>
              </div>
            </div>

            {/* Identificador do Lote */}
            {finalReport.batch_id && (
              <div className="p-4 rounded-lg border border-border bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="eyebrow text-muted-foreground block">Identificador do Lote</span>
                  <p className="text-xs font-mono text-foreground font-medium">
                    {finalReport.batch_id}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => navigate(`/imoveis?import_batch_id=${finalReport.batch_id}`)}
                    className="h-9 rounded-full px-5 text-xs font-normal bg-primary text-primary-foreground gap-1.5"
                  >
                    <span>Ver imóveis importados</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={handleResetFlow}
                className="w-full sm:w-auto h-9 rounded-full px-5 text-xs font-normal border-border gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Importar outra planilha</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/imoveis')}
                className="w-full sm:w-auto h-9 rounded-full px-5 text-xs font-normal border-border"
              >
                Ir para o catálogo de imóveis
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* HISTÓRICO DE IMPORTAÇÕES */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4 pt-6 border-t border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-medium text-foreground">Histórico de importações</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Consulte os lotes importados anteriormente e reverta se necessário.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadBatches}
            disabled={loadingBatches}
            className="h-8 rounded-full px-3 text-xs font-normal border-border gap-1.5 self-start sm:self-auto"
          >
            {loadingBatches ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            <span>Atualizar histórico</span>
          </Button>
        </div>

        {loadingBatches ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : batches.length === 0 ? (
          <div className="p-8 text-center rounded-lg border border-border bg-card space-y-2">
            <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground opacity-40" />
            <p className="text-xs text-muted-foreground">
              Nenhuma importação registrada até o momento.
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="text-xs min-w-[640px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Arquivo</TableHead>
                    <TableHead className="w-36 tabular">Data</TableHead>
                    <TableHead className="w-28">Tipo</TableHead>
                    <TableHead className="w-24">Situação</TableHead>
                    <TableHead className="w-44">Contadores</TableHead>
                    <TableHead className="w-36 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => {
                    const isUndone = batch.state === 'desfeita'

                    return (
                      <TableRow key={batch.id} className="hover:bg-muted/40">
                        <TableCell>
                          <div className="font-normal text-foreground truncate max-w-xs">
                            {batch.filename || 'Sem nome de arquivo'}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground">
                            ID: {batch.id}
                          </div>
                        </TableCell>

                        <TableCell className="tabular text-muted-foreground">
                          {formatBatchDate(batch.created)}
                        </TableCell>

                        <TableCell className="capitalize">
                          {batch.kind === 'imoveis'
                            ? 'Imóveis'
                            : batch.kind === 'condominios'
                              ? 'Condomínios'
                              : batch.kind}
                        </TableCell>

                        <TableCell>
                          {isUndone ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-normal border-zinc-300 dark:border-zinc-700 text-zinc-500"
                            >
                              Desfeita
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-normal border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
                            >
                              Aplicada
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="tabular">
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {batch.counts.aceito} aceito(s)
                          </span>{' '}
                          ·{' '}
                          <span className="text-muted-foreground">
                            {batch.counts.pendente} pend.
                          </span>{' '}
                          ·{' '}
                          <span className="text-muted-foreground">
                            {batch.counts.recusado} rec.
                          </span>
                        </TableCell>

                        <TableCell className="text-right">
                          {!isUndone && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setBatchToUndo(batch)}
                              className="h-8 rounded-full px-3 text-xs font-normal border-border text-destructive hover:bg-destructive/10"
                            >
                              Desfazer importação
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL / PAINEL: COMPARAÇÃO LADO A LADO (PENDENTE) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={Boolean(comparisonItem)}
        onOpenChange={(open) => {
          if (!open) setComparisonItem(null)
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-6">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-base font-medium text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>Comparação de dados — Linha {comparisonItem?.row}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Este imóvel foi marcado como <strong>Pendente</strong> porque coincide com um registro
              já existente. Veja a comparação detalhada:
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {comparisonItem && (
              <>
                <div className="p-3 rounded-md bg-muted/40 border border-border text-xs space-y-1">
                  <div className="font-medium text-foreground">
                    Motivo(s): {comparisonItem.reasons.map(translateReason).join(', ')}
                  </div>
                  {comparisonItem.notas.length > 0 && (
                    <div className="text-muted-foreground">
                      Notas: {comparisonItem.notas.map(translateNote).join(', ')}
                    </div>
                  )}
                </div>

                {/* Grid lado a lado no desktop (2 colunas) e empilhado no celular (1 coluna) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Existente no sistema */}
                  <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                      <span className="eyebrow text-muted-foreground">Já no sistema</span>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        Existente
                      </Badge>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Código</span>
                        <span className="font-mono text-foreground font-medium">
                          {comparisonItem.comparison?.existing?.code || '—'}
                        </span>
                      </div>

                      <div>
                        <span className="text-muted-foreground block text-[11px]">Situação</span>
                        <span className="text-foreground capitalize">
                          {comparisonItem.comparison?.existing?.status || '—'}
                        </span>
                      </div>

                      <div>
                        <span className="text-muted-foreground block text-[11px]">Endereço</span>
                        <span className="text-foreground">
                          {[
                            comparisonItem.comparison?.existing?.street,
                            comparisonItem.comparison?.existing?.street_number,
                            comparisonItem.comparison?.existing?.complement,
                          ]
                            .filter(Boolean)
                            .join(', ') || '—'}
                        </span>
                      </div>

                      <div>
                        <span className="text-muted-foreground block text-[11px]">Bairro</span>
                        <span className="text-foreground">
                          {comparisonItem.comparison?.existing?.neighborhood || '—'}
                        </span>
                      </div>

                      <div>
                        <span className="text-muted-foreground block text-[11px]">Preço</span>
                        <span className="text-foreground tabular">
                          {formatPriceDisplay(
                            comparisonItem.comparison?.existing?.sale_price,
                            comparisonItem.comparison?.existing?.rent_price,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Vindo da planilha */}
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-primary/20">
                      <span className="eyebrow text-primary">Na planilha</span>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-normal border-primary/30 text-primary"
                      >
                        Nova linha
                      </Badge>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Código</span>
                        <span className="font-mono text-foreground font-medium">
                          {comparisonItem.comparison?.incoming?.code || comparisonItem.code || '—'}
                        </span>
                      </div>

                      <div>
                        <span className="text-muted-foreground block text-[11px]">Situação</span>
                        <span className="text-foreground">Seria Rascunho</span>
                      </div>

                      <div>
                        <span className="text-muted-foreground block text-[11px]">Endereço</span>
                        <span className="text-foreground">
                          {[
                            comparisonItem.comparison?.incoming?.street,
                            comparisonItem.comparison?.incoming?.street_number,
                            comparisonItem.comparison?.incoming?.complement,
                          ]
                            .filter(Boolean)
                            .join(', ') || '—'}
                        </span>
                      </div>

                      <div>
                        <span className="text-muted-foreground block text-[11px]">Bairro</span>
                        <span className="text-foreground">
                          {comparisonItem.comparison?.incoming?.neighborhood || '—'}
                        </span>
                      </div>

                      <div>
                        <span className="text-muted-foreground block text-[11px]">Preço</span>
                        <span className="text-foreground tabular">
                          {formatPriceDisplay(
                            comparisonItem.comparison?.incoming?.sale_price,
                            comparisonItem.comparison?.incoming?.rent_price,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-border shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setComparisonItem(null)}
              className="h-9 rounded-full px-4 text-xs font-normal border-border w-full sm:w-auto"
            >
              Fechar comparação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: CONFIRMAR DESFAZER IMPORTAÇÃO */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AlertDialog
        open={Boolean(batchToUndo)}
        onOpenChange={(open) => {
          if (!open) setBatchToUndo(null)
        }}
      >
        <AlertDialogContent className="rounded-lg p-6 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-medium text-foreground">
              Desfazer esta importação?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Os imóveis deste lote que ainda estão em <strong>Rascunho</strong> serão marcados como{' '}
              <strong>Inativos</strong>. Imóveis que já foram publicados ou alterados não serão
              afetados. Condomínios criados sem imóveis ativos também serão desativados.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {batchToUndo && (
            <div className="p-3 rounded-md bg-muted/40 border border-border text-xs space-y-1">
              <div>
                <strong>Arquivo:</strong> {batchToUndo.filename || 'Sem nome'}
              </div>
              <div className="tabular text-muted-foreground">
                <strong>Data:</strong> {formatBatchDate(batchToUndo.created)}
              </div>
            </div>
          )}

          <AlertDialogFooter className="gap-2 sm:gap-0 pt-2">
            <AlertDialogCancel
              disabled={undoingLoading}
              className="h-9 rounded-full px-4 text-xs font-normal border-border"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUndo}
              disabled={undoingLoading}
              className="h-9 rounded-full px-4 text-xs font-normal bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
            >
              {undoingLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Desfazendo...</span>
                </>
              ) : (
                <span>Confirmar e desfazer</span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: FEEDBACK DE DESFAZER */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={undoFeedback.open}
        onOpenChange={(open) => setUndoFeedback((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-md rounded-lg p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-medium text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span>Importação desfeita</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              {undoFeedback.message}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              onClick={() => setUndoFeedback({ open: false, message: '' })}
              className="h-9 rounded-full px-5 text-xs font-normal bg-primary text-primary-foreground"
            >
              OK, entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
