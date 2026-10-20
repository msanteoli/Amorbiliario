import React, { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { readSpreadsheetFile } from '@/lib/spreadsheet'
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
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  AlertCircle,
  FileText,
  Download,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import {
  importCondominiumsEndpoint,
  ImportCondominiumRow,
  ImportCondominiumsResponse,
} from '@/services/condominiums'
import { formatErrorMessage } from '@/services/properties'

interface ImportCondominiumsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ImportCondominiumsModal({
  open,
  onOpenChange,
  onSuccess,
}: ImportCondominiumsModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [readingFile, setReadingFile] = useState(false)
  const [parsedRows, setParsedRows] = useState<ImportCondominiumRow[]>([])
  const [previewResult, setPreviewResult] = useState<ImportCondominiumsResponse | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [confirmingLoading, setConfirmingLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const resetState = () => {
    setFile(null)
    setReadingFile(false)
    setParsedRows([])
    setPreviewResult(null)
    setPreviewLoading(false)
    setConfirmingLoading(false)
    setErrorMessage(null)
    setSuccessMessage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    setErrorMessage(null)
    setSuccessMessage(null)
    setPreviewResult(null)
    setFile(selected)
    setReadingFile(true)

    try {
      const rows = await readSpreadsheetFile<ImportCondominiumRow>(selected, { maxRows: 500 })
      // Converte valores para string conforme interface ImportCondominiumRow (Nome, Endereço, etc)
      const sanitizedRows: ImportCondominiumRow[] = rows.map((r) => ({
        Nome: String(r.Nome || (r as Record<string, unknown>).name || ''),
        Endereço: String(r.Endereço || (r as Record<string, unknown>).street || ''),
        Bairro: String(r.Bairro || (r as Record<string, unknown>).neighborhood || ''),
        Cidade: String(r.Cidade || (r as Record<string, unknown>).city || ''),
        Lazer: String(r.Lazer || (r as Record<string, unknown>).amenities || ''),
        Infraestrutura: String(
          r.Infraestrutura || (r as Record<string, unknown>).infrastructure || '',
        ),
        Regras: String(r.Regras || (r as Record<string, unknown>).rules || ''),
      }))

      setParsedRows(sanitizedRows)

      // Executa automaticamente a simulação (dry_run: true) para mostrar a prévia
      setPreviewLoading(true)
      const res = await importCondominiumsEndpoint({
        filename: selected.name,
        dry_run: true,
        rows: sanitizedRows,
      })
      setPreviewResult(res)
    } catch (err) {
      setErrorMessage(formatErrorMessage(err))
      setParsedRows([])
      setPreviewResult(null)
    } finally {
      setReadingFile(false)
      setPreviewLoading(false)
    }
  }

  const handleConfirmImport = async () => {
    if (!file || parsedRows.length === 0) return

    setErrorMessage(null)
    setConfirmingLoading(true)
    try {
      const res = await importCondominiumsEndpoint({
        filename: file.name,
        dry_run: false,
        rows: parsedRows,
      })
      setSuccessMessage(
        `Importação concluída! ${res.counts.aceito} condomínio(s) criado(s), ${res.counts.pendente} já existente(s) e ${res.counts.recusado} recusado(s).`,
      )
      onSuccess()
    } catch (err) {
      setErrorMessage(formatErrorMessage(err))
    } finally {
      setConfirmingLoading(false)
    }
  }

  const handleDownloadTemplate = () => {
    // Modelo com apenas "Nome" obrigatório e instrução clara nas observações
    const templateData = [
      {
        Nome: 'Residencial Exemplo (Obrigatório)',
        Endereço: 'Rua das Flores, 123 (opcional)',
        Bairro: 'Centro (opcional)',
        Cidade: 'Salvador (opcional)',
        Lazer: 'Piscina\nAcademia (opcional)',
        Infraestrutura: 'Portaria 24h\nGerador\nElevador (opcional)',
        Regras: 'Pets permitidos (opcional)',
      },
      {
        Nome: 'Lançamento Vista Mar',
        Endereço: '',
        Bairro: 'Ondina',
        Cidade: 'Salvador',
        Lazer: 'Piscina infinity',
        Infraestrutura: 'Portaria inteligente\n2 Elevadores',
        Regras: '',
      },
    ]

    const worksheet = XLSX.utils.json_to_sheet(templateData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Condomínios')
    XLSX.writeFile(workbook, 'modelo_importacao_condominios.xlsx')
  }

  const translateReason = (reason: string) => {
    switch (reason) {
      case 'sem_nome':
        return 'Sem nome válido'
      case 'repetido_no_arquivo':
        return 'Repetido no arquivo'
      case 'ja_existe':
        return 'Já existe no sistema'
      default:
        return reason
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetState()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-lg font-normal text-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            <span>Importar condomínios</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Selecione uma planilha (.xlsx ou .csv) contendo as colunas:{' '}
            <span className="font-mono text-[11px] text-foreground">
              Nome, Endereço, Bairro, Cidade, Lazer, Infraestrutura, Regras
            </span>
            . Somente <strong className="text-foreground">Nome</strong> é obrigatório; as demais
            podem ficar vazias (inclusive o endereço).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs border border-emerald-500/20 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Botão para baixar modelo da planilha */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-foreground">Planilha modelo</span>
              <p className="text-[11px] text-muted-foreground">
                Baixe o modelo com as colunas reconhecidas: Nome (obrigatória), Endereço, Bairro,
                Cidade, Lazer, Infraestrutura e Regras.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="h-8 gap-1.5 text-xs border-border shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Baixar modelo</span>
            </Button>
          </div>

          {/* Área de Seleção de Arquivo */}
          {!successMessage && (
            <div className="border border-dashed border-border rounded-lg p-5 text-center bg-card">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
                id="condo-import-file"
                disabled={readingFile || previewLoading || confirmingLoading}
              />
              <label
                htmlFor="condo-import-file"
                className="flex flex-col items-center justify-center cursor-pointer space-y-2"
              >
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="text-xs">
                  <span className="font-medium text-foreground hover:underline">
                    Clique para selecionar
                  </span>{' '}
                  ou arraste o arquivo aqui
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Suporta arquivos .xlsx e .csv (até 500 linhas)
                </div>
              </label>

              {file && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-xs text-foreground">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate max-w-[260px] sm:max-w-md">{file.name}</span>
                  <span className="text-[10px] tabular text-muted-foreground">
                    ({parsedRows.length} linhas lidas)
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Loading do processamento */}
          {(readingFile || previewLoading) && (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs">Processando e simulando importação...</span>
            </div>
          )}

          {/* Painel de Resultados da Prévia */}
          {previewResult && !previewLoading && (
            <div className="space-y-4 pt-1">
              {/* Contadores da simulação */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Aceitos (novos)</span>
                  </div>
                  <div className="text-xl font-normal tabular text-foreground mt-1">
                    {previewResult.counts.aceito}
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Já existentes</span>
                  </div>
                  <div className="text-xl font-normal tabular text-foreground mt-1">
                    {previewResult.counts.pendente}
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                    <span>Recusados</span>
                  </div>
                  <div className="text-xl font-normal tabular text-foreground mt-1">
                    {previewResult.counts.recusado}
                  </div>
                </div>
              </div>

              {/* Tabela de linhas analisadas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs eyebrow text-muted-foreground">
                    Linhas analisadas ({previewResult.items.length})
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Simulação prévia — nada foi gravado ainda
                  </span>
                </div>

                <div className="border border-border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-16 tabular">Linha</TableHead>
                        <TableHead className="min-w-[120px]">Nome</TableHead>
                        <TableHead className="w-28">Status</TableHead>
                        <TableHead className="min-w-[130px]">Infraestrutura</TableHead>
                        <TableHead>Motivo / Observação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewResult.items.map((item) => {
                        let statusBadge = (
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {item.outcome}
                          </Badge>
                        )

                        if (item.outcome === 'aceito') {
                          statusBadge = (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-normal border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30"
                            >
                              Aceito
                            </Badge>
                          )
                        } else if (item.outcome === 'pendente') {
                          statusBadge = (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-normal border-amber-500/30 text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/30"
                            >
                              Já existe
                            </Badge>
                          )
                        } else if (item.outcome === 'recusado') {
                          statusBadge = (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-normal border-destructive/30 text-destructive bg-destructive/10"
                            >
                              Recusado
                            </Badge>
                          )
                        }

                        // Localiza na parsedRows correspondente para exibir infraestrutura na pré-visualização
                        const parsedRow = parsedRows[item.row - 2] // cabeçalho é linha 1

                        return (
                          <TableRow key={item.row}>
                            <TableCell className="tabular text-muted-foreground">
                              {item.row}
                            </TableCell>
                            <TableCell className="font-normal text-foreground">
                              {item.name || <span className="text-muted-foreground italic">—</span>}
                            </TableCell>
                            <TableCell>{statusBadge}</TableCell>
                            <TableCell className="text-muted-foreground max-w-[150px] truncate">
                              {parsedRow?.Infraestrutura || (
                                <span className="text-muted-foreground/50 italic">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.reasons.length > 0
                                ? item.reasons.map(translateReason).join(', ')
                                : 'Pronto para importação'}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={confirmingLoading}
            className="h-9 rounded-full px-4 text-xs font-normal border-border"
          >
            {successMessage ? 'Fechar' : 'Cancelar'}
          </Button>

          {!successMessage && previewResult && (
            <Button
              type="button"
              onClick={handleConfirmImport}
              disabled={confirmingLoading || previewResult.counts.aceito === 0}
              className="h-9 rounded-full px-5 text-xs font-normal bg-primary text-primary-foreground gap-1.5"
            >
              {confirmingLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Gravando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>
                    Confirmar importação ({previewResult.counts.aceito}{' '}
                    {previewResult.counts.aceito === 1 ? 'novo' : 'novos'})
                  </span>
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
