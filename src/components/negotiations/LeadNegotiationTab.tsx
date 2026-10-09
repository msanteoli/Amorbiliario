import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  NegotiationItem,
  NegotiationStatus,
  NegotiationChecklistResponse,
  ChecklistPerson,
  ChecklistDocument,
  NEGOTIATION_STATUS_LABELS,
  NEGOTIATION_PURPOSE_LABELS,
  NEGOTIATION_PERSON_ROLE_LABELS,
  NEGOTIATION_DOC_TYPE_LABELS,
  NEGOTIATION_DOC_STATE_LABELS,
  listLeadNegotiations,
  getNegotiationChecklist,
  updateNegotiation,
  removeNegotiationPerson,
  uploadNegotiationDocument,
  openNegotiationDocumentFile,
  checkNegotiationDocument,
  formatNegotiationErrorMessage,
} from '@/services/negotiations'
import { formatCurrencyInput, maskCurrencyInput, parseCurrencyInput } from '@/lib/currencyUtils'
import { OpenNegotiationModal } from './OpenNegotiationModal'
import { CloseNegotiationModal } from './CloseNegotiationModal'
import { AddPersonModal } from './AddPersonModal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Loader2,
  Building,
  ExternalLink,
  Plus,
  Trash2,
  Upload,
  Eye,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Sparkles,
  User,
  History,
} from 'lucide-react'

interface LeadNegotiationTabProps {
  leadId: string
  defaultPropertyId?: string
  currentUserRole?: string
  currentUserId?: string
  assignedToId?: string
}

export function LeadNegotiationTab({
  leadId,
  defaultPropertyId,
  currentUserRole,
  currentUserId,
  assignedToId,
}: LeadNegotiationTabProps) {
  const isAdmin = currentUserRole === 'admin'
  const isSdr = currentUserRole === 'sdr'
  const isAssignedCorretor =
    currentUserRole === 'corretor' && Boolean(currentUserId && currentUserId === assignedToId)

  // O corretor responsável e o admin podem editar, fechar e conferir. SDR pode acompanhar, abrir negociação, adicionar pessoa, enviar e abrir arquivos.
  const canEditAndCheck = isAdmin || isAssignedCorretor
  const canOperate = isAdmin || isSdr || isAssignedCorretor

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)

  // Negociações carregadas
  const [negotiations, setNegotiations] = useState<NegotiationItem[]>([])
  const [activeNegotiation, setActiveNegotiation] = useState<NegotiationItem | null>(null)
  const [historyNegotiations, setHistoryNegotiations] = useState<NegotiationItem[]>([])

  // Checklist da negociação ativa
  const [checklist, setChecklist] = useState<NegotiationChecklistResponse | null>(null)
  const [loadingChecklist, setLoadingChecklist] = useState(false)

  // Modais
  const [openModalVisible, setOpenModalVisible] = useState(false)
  const [closeModalVisible, setCloseModalVisible] = useState(false)
  const [addPersonModalVisible, setAddPersonModalVisible] = useState(false)

  // Edição inline da negociação aberta
  const [editingCard, setEditingCard] = useState(false)
  const [editStatus, setEditStatus] = useState<NegotiationStatus>('em_analise')
  const [editValueStr, setEditValueStr] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Estados de upload e conferência de documentos
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null)
  const [checkingDocId, setCheckingDocId] = useState<string | null>(null)
  const [openingDocKey, setOpeningDocKey] = useState<string | null>(null)
  const [removingPersonId, setRemovingPersonId] = useState<string | null>(null)

  // Ref invisível para upload de arquivo
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [targetUploadDocId, setTargetUploadDocId] = useState<string | null>(null)

  // Carrega lista de negociações do lead
  const loadNegotiations = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const items = await listLeadNegotiations(leadId)
      setNegotiations(items)

      // Identifica aberta (em_analise ou aprovada)
      const openNeg =
        items.find((n) => n.status === 'em_analise' || n.status === 'aprovada') || null
      setActiveNegotiation(openNeg)

      // Histórico (fechada ou desistiu)
      const hist = items.filter((n) => n.status === 'fechada' || n.status === 'desistiu')
      setHistoryNegotiations(hist)

      if (openNeg) {
        setEditStatus(openNeg.status)
        setEditValueStr(openNeg.agreed_value ? formatCurrencyInput(openNeg.agreed_value) : '')
        setEditNotes(openNeg.notes || '')
      }
    } catch (err) {
      setErrorMessage(formatNegotiationErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [leadId])

  // Carrega checklist da negociação ativa
  const loadChecklist = useCallback(async (negotiationId: string) => {
    setLoadingChecklist(true)
    try {
      const data = await getNegotiationChecklist(negotiationId)
      setChecklist(data)
    } catch (err) {
      setErrorMessage(formatNegotiationErrorMessage(err))
    } finally {
      setLoadingChecklist(false)
    }
  }, [])

  useEffect(() => {
    loadNegotiations()
  }, [loadNegotiations])

  useEffect(() => {
    if (activeNegotiation) {
      loadChecklist(activeNegotiation.id)
    } else {
      setChecklist(null)
    }
  }, [activeNegotiation, loadChecklist])

  // Salva edições no cartão da negociação aberta (PATCH /backend/v1/negotiations/{id})
  const handleSaveCard = async () => {
    if (!activeNegotiation) return
    setSavingEdit(true)
    setErrorMessage(null)

    const parsedVal = editValueStr ? parseCurrencyInput(editValueStr) : undefined

    try {
      await updateNegotiation(activeNegotiation.id, {
        status: editStatus,
        agreed_value: parsedVal || null,
        notes: editNotes.trim(),
      })
      setEditingCard(false)
      setSuccessBanner('Negociação atualizada com sucesso.')
      await loadNegotiations()
    } catch (err) {
      setErrorMessage(formatNegotiationErrorMessage(err))
    } finally {
      setSavingEdit(false)
    }
  }

  // Remove pessoa da negociação
  const handleRemovePerson = async (personId: string, personName: string) => {
    if (!activeNegotiation) return
    const confirmed = window.confirm(
      `Deseja remover ${personName || 'esta pessoa'} da negociação? O cadastro de cliente não será apagado.`,
    )
    if (!confirmed) return

    setRemovingPersonId(personId)
    setErrorMessage(null)
    try {
      await removeNegotiationPerson(activeNegotiation.id, personId)
      setSuccessBanner('Pessoa removida da negociação.')
      await loadChecklist(activeNegotiation.id)
    } catch (err) {
      setErrorMessage(formatNegotiationErrorMessage(err))
    } finally {
      setRemovingPersonId(null)
    }
  }

  // Aciona seletor de arquivo para documento
  const handleTriggerUpload = (docId: string) => {
    setTargetUploadDocId(docId)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  // Executa upload do arquivo
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !targetUploadDocId || !activeNegotiation) return

    // Valida tamanho de até 10 MB
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('O arquivo excede o limite de 10 MB. Escolha um arquivo menor.')
      return
    }

    setUploadingDocId(targetUploadDocId)
    setErrorMessage(null)
    try {
      await uploadNegotiationDocument(activeNegotiation.id, targetUploadDocId, file)
      setSuccessBanner('Arquivo enviado com sucesso.')
      await loadChecklist(activeNegotiation.id)
    } catch (err) {
      setErrorMessage(formatNegotiationErrorMessage(err))
    } finally {
      setUploadingDocId(null)
      setTargetUploadDocId(null)
    }
  }

  // Abre arquivo autenticado
  const handleOpenFile = async (docId: string, fileName: string) => {
    if (!activeNegotiation) return
    const key = `${docId}-${fileName}`
    setOpeningDocKey(key)
    setErrorMessage(null)
    try {
      await openNegotiationDocumentFile(activeNegotiation.id, docId, fileName)
    } catch (err) {
      setErrorMessage(formatNegotiationErrorMessage(err))
    } finally {
      setOpeningDocKey(null)
    }
  }

  // Marca documento como conferido
  const handleCheckDocument = async (docId: string) => {
    if (!activeNegotiation) return
    setCheckingDocId(docId)
    setErrorMessage(null)
    try {
      await checkNegotiationDocument(activeNegotiation.id, docId)
      setSuccessBanner('Documento marcado como conferido.')
      await loadChecklist(activeNegotiation.id)
    } catch (err) {
      setErrorMessage(formatNegotiationErrorMessage(err))
    } finally {
      setCheckingDocId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <p className="text-xs">Carregando negociações do lead...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Input de arquivo invisível para uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Mensagens de feedback */}
      {errorMessage && (
        <Alert variant="destructive" className="py-2.5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
        </Alert>
      )}

      {successBanner && (
        <Alert className="border-border bg-muted/40 text-foreground py-2.5">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <AlertDescription className="text-xs font-medium">{successBanner}</AlertDescription>
        </Alert>
      )}

      {/* SEÇÃO 1 & 3: NEGOCIAÇÃO ABERTA OU BOTÃO ABRIR */}
      {activeNegotiation ? (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="eyebrow text-muted-foreground">Negociação aberta</span>
                <Badge
                  variant={activeNegotiation.status === 'aprovada' ? 'success' : 'default'}
                  className="text-xs"
                >
                  {NEGOTIATION_STATUS_LABELS[activeNegotiation.status] || activeNegotiation.status}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {NEGOTIATION_PURPOSE_LABELS[activeNegotiation.purpose] ||
                    activeNegotiation.purpose}
                </Badge>
              </div>
              <div className="flex items-center gap-2 pt-1 text-sm font-medium text-foreground">
                <Building className="h-4 w-4 text-muted-foreground" />
                <Link
                  to={`/imoveis/${activeNegotiation.property_id}`}
                  className="text-primary hover:underline inline-flex items-center gap-1.5"
                >
                  <span>
                    Imóvel [{activeNegotiation.property_code || activeNegotiation.property_id}]
                  </span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Ações principais do cartão: Editar / Fechar negócio */}
            <div className="flex flex-wrap items-center gap-2">
              {canEditAndCheck && !editingCard && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingCard(true)}
                  className="h-8 rounded-full px-3 text-xs font-normal border-border"
                >
                  Editar negociação
                </Button>
              )}
              {canEditAndCheck && (
                <div className="flex items-center gap-2">
                  {checklist && checklist.missing > 0 && (
                    <Badge
                      variant="attention"
                      className="text-[11px] px-2.5 py-1 font-medium gap-1.5"
                    >
                      <AlertCircle className="h-3 w-3" />
                      <span>
                        {checklist.missing}{' '}
                        {checklist.missing === 1 ? 'documento pendente' : 'documentos pendentes'}
                      </span>
                    </Badge>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setCloseModalVisible(true)}
                    className="h-8 rounded-full px-3 text-xs font-normal gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Fechar negócio</span>
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Dados e Edição da Negociação Aberta */}
          {editingCard ? (
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-normal">Situação</Label>
                  <Select
                    value={editStatus}
                    onValueChange={(val) => setEditStatus(val as NegotiationStatus)}
                  >
                    <SelectTrigger className="h-10 text-xs rounded-lg border-border bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="em_analise">Em análise</SelectItem>
                      <SelectItem value="aprovada">Aprovada</SelectItem>
                      <SelectItem value="desistiu">Desistiu</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Para concluir com sucesso use o botão &quot;Fechar negócio&quot;.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-normal">Valor combinado (R$)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      R$
                    </span>
                    <Input
                      placeholder="0,00"
                      value={editValueStr}
                      onChange={(e) => setEditValueStr(maskCurrencyInput(e.target.value))}
                      className="pl-9 h-10 text-xs rounded-lg tabular bg-background"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-normal">Observações</Label>
                <Textarea
                  placeholder="Informações contratuais, condições especiais, prazos acordados..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className="text-xs rounded-lg border-border bg-background"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingCard(false)
                    setEditStatus(activeNegotiation.status)
                    setEditValueStr(
                      activeNegotiation.agreed_value
                        ? formatCurrencyInput(activeNegotiation.agreed_value)
                        : '',
                    )
                    setEditNotes(activeNegotiation.notes || '')
                  }}
                  disabled={savingEdit}
                  className="h-8 rounded-full px-3 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveCard}
                  disabled={savingEdit}
                  className="h-8 rounded-full px-4 text-xs gap-1.5"
                >
                  {savingEdit && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>Salvar alterações</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1">
                <span className="eyebrow text-muted-foreground block">Valor combinado</span>
                <span className="text-foreground tabular font-normal text-sm">
                  {activeNegotiation.agreed_value && activeNegotiation.agreed_value > 0
                    ? new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(activeNegotiation.agreed_value)
                    : 'Não informado'}
                </span>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <span className="eyebrow text-muted-foreground block">Observações</span>
                <p className="text-foreground text-xs leading-relaxed whitespace-pre-wrap">
                  {activeNegotiation.notes || 'Nenhuma observação registrada.'}
                </p>
              </div>
            </div>
          )}

          {/* SEÇÕES 4 & 5: PESSOAS E CHECKLIST DE DOCUMENTOS */}
          <div id="checklist-section" className="pt-4 border-t border-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-medium text-foreground">
                  Pessoas e Documentos da Negociação
                </h3>
                <p className="text-xs text-muted-foreground">
                  Gerencie participantes e confira o checklist documental exigido.
                </p>
              </div>

              {canOperate && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddPersonModalVisible(true)}
                  className="h-8 rounded-full px-3 text-xs font-normal border-border gap-1.5 shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Adicionar pessoa</span>
                </Button>
              )}
            </div>

            {/* Barra de progresso de documentos */}
            {checklist && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-foreground font-medium">
                    {checklist.received} de {checklist.total} recebidos · {checklist.checked}{' '}
                    conferidos
                  </span>
                  <span className="text-muted-foreground text-[11px] tabular">
                    {checklist.missing > 0
                      ? `${checklist.missing} pendente(s)`
                      : 'Todos os documentos foram recebidos'}
                  </span>
                </div>
                {/* Linha de progresso visual */}
                <div className="w-full h-2 rounded-full bg-border overflow-hidden flex">
                  <div
                    className="bg-primary transition-all duration-300"
                    style={{
                      width: `${checklist.total ? (checklist.checked / checklist.total) * 100 : 0}%`,
                    }}
                    title={`${checklist.checked} conferidos`}
                  />
                  <div
                    className="bg-attention transition-all duration-300"
                    style={{
                      width: `${
                        checklist.total
                          ? ((checklist.received - checklist.checked) / checklist.total) * 100
                          : 0
                      }%`,
                    }}
                    title={`${checklist.received - checklist.checked} recebidos (aguardando conferência)`}
                  />
                </div>
              </div>
            )}

            {loadingChecklist ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs">Carregando pessoas e documentos...</span>
              </div>
            ) : !checklist || checklist.people.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center space-y-2">
                <User className="h-6 w-6 text-muted-foreground mx-auto" />
                <p className="text-xs font-medium text-foreground">
                  Nenhuma pessoa adicionada a esta negociação
                </p>
                <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                  Clique em &quot;Adicionar pessoa&quot; para incluir o cliente comprador/locatário,
                  fiadores ou cônjuges e gerar a lista de documentos necessários.
                </p>
                {canOperate && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAddPersonModalVisible(true)}
                    className="h-8 rounded-full px-3 text-xs mt-2"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Adicionar pessoa
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {checklist.people.map((person) => {
                  const personDocs = checklist.documents.filter((d) => d.person_id === person.id)

                  return (
                    <div
                      key={person.id}
                      className="rounded-lg border border-border bg-card overflow-hidden"
                    >
                      {/* Cabeçalho da pessoa */}
                      <div className="p-3.5 bg-muted/40 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="text-xs">
                            <span className="font-semibold text-foreground">
                              {person.name || 'Cliente'}
                            </span>{' '}
                            <Link
                              to={`/clientes/${person.client_id}`}
                              className="text-primary hover:underline text-[11px] inline-flex items-center gap-0.5"
                            >
                              (ver cadastro)
                              <ExternalLink className="h-2.5 w-2.5" />
                            </Link>
                          </div>
                          <Badge variant="outline" className="text-[11px] ml-1">
                            {NEGOTIATION_PERSON_ROLE_LABELS[person.role] || person.role}
                          </Badge>
                        </div>

                        {canOperate && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemovePerson(person.id, person.name)}
                            disabled={removingPersonId === person.id}
                            className="h-7 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10 self-end sm:self-auto gap-1"
                          >
                            {removingPersonId === person.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                            <span>Remover</span>
                          </Button>
                        )}
                      </div>

                      {/* Lista de documentos da pessoa */}
                      <div className="divide-y divide-border">
                        {personDocs.length === 0 ? (
                          <div className="p-3 text-xs text-muted-foreground text-center">
                            Nenhum documento exigido para este papel.
                          </div>
                        ) : (
                          personDocs.map((doc) => {
                            const isPendente = doc.state === 'pendente'
                            const isRecebido = doc.state === 'recebido'
                            const isConferido = doc.state === 'conferido'

                            return (
                              <div
                                key={doc.id}
                                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-muted/20 transition-colors"
                              >
                                <div className="space-y-1 max-w-md">
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="font-medium text-foreground">
                                      {NEGOTIATION_DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
                                    </span>
                                    {/* Estado: Pendente (cinza), Recebido (amarelo/attention), Conferido (verde/success) */}
                                    <Badge
                                      variant={
                                        isConferido
                                          ? 'success'
                                          : isRecebido
                                            ? 'attention'
                                            : 'default'
                                      }
                                      className="text-[10px] px-1.5 py-0"
                                    >
                                      {NEGOTIATION_DOC_STATE_LABELS[doc.state] || doc.state}
                                    </Badge>
                                  </div>

                                  {/* Arquivos enviados */}
                                  {doc.files && doc.files.length > 0 ? (
                                    <div className="space-y-1 pt-0.5">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-[11px] text-muted-foreground">
                                          Arquivos ({doc.files.length}/5):
                                        </span>
                                        {doc.files.map((fileName, idx) => {
                                          const key = `${doc.id}-${fileName}`
                                          const isOpening = openingDocKey === key

                                          return (
                                            <button
                                              key={idx}
                                              type="button"
                                              onClick={() => handleOpenFile(doc.id, fileName)}
                                              disabled={isOpening}
                                              className="h-6 px-2 rounded-full border border-border bg-background hover:bg-muted text-[11px] text-foreground inline-flex items-center gap-1 transition-colors"
                                              title={`Abrir ${fileName}`}
                                            >
                                              {isOpening ? (
                                                <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" />
                                              ) : (
                                                <Eye className="h-2.5 w-2.5 text-muted-foreground" />
                                              )}
                                              <span className="max-w-[120px] truncate">
                                                {fileName}
                                              </span>
                                            </button>
                                          )
                                        })}
                                      </div>
                                      <p className="text-[10px] text-muted-foreground">
                                        A abertura fica registrada.
                                      </p>
                                    </div>
                                  ) : (
                                    <p className="text-[11px] text-muted-foreground">
                                      Nenhum arquivo enviado até o momento.
                                    </p>
                                  )}
                                </div>

                                {/* Ações do documento: Enviar e Conferir */}
                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                  {/* Enviar arquivo (JPG, PNG, WebP, PDF até 10 MB, máx 5) */}
                                  {canOperate && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleTriggerUpload(doc.id)}
                                      disabled={
                                        uploadingDocId === doc.id ||
                                        (doc.files && doc.files.length >= 5)
                                      }
                                      className="h-8 rounded-full px-3 text-xs border-border gap-1"
                                      title={
                                        doc.files && doc.files.length >= 5
                                          ? 'Limite máximo de 5 arquivos atingido'
                                          : 'Enviar arquivo (JPG, PNG, WebP ou PDF de até 10 MB)'
                                      }
                                    >
                                      {uploadingDocId === doc.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Upload className="h-3 w-3" />
                                      )}
                                      <span>
                                        {doc.files && doc.files.length > 0
                                          ? 'Enviar outro'
                                          : 'Enviar arquivo'}
                                      </span>
                                    </Button>
                                  )}

                                  {/* Conferir documento: só admin e corretor responsável */}
                                  {canEditAndCheck && !isConferido && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleCheckDocument(doc.id)}
                                      disabled={
                                        checkingDocId === doc.id ||
                                        !doc.files ||
                                        doc.files.length === 0
                                      }
                                      className="h-8 rounded-full px-3 text-xs border-border gap-1 text-success hover:text-success"
                                      title={
                                        !doc.files || doc.files.length === 0
                                          ? 'Envie ao menos um arquivo antes de conferir'
                                          : 'Marcar como conferido'
                                      }
                                    >
                                      {checkingDocId === doc.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <CheckCircle2 className="h-3 w-3" />
                                      )}
                                      <span>Marcar como conferido</span>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Sem negociação aberta: banner com botão "Abrir negociação" */
        <div className="rounded-lg border border-border bg-card p-6 text-center space-y-3">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              Nenhuma negociação aberta para este lead
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Abra uma negociação para definir o imóvel, valores, participantes e controlar o
              checklist de documentos exigidos até o fechamento.
            </p>
          </div>

          {canOperate && (
            <div className="pt-2">
              <Button
                type="button"
                onClick={() => setOpenModalVisible(true)}
                className="h-9 rounded-full px-5 text-xs gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Abrir negociação</span>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* SEÇÃO HISTÓRICO: Negociações anteriores encerradas (fechada, desistiu) */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">
            Histórico de Negociações ({historyNegotiations.length})
          </h3>
        </div>

        {historyNegotiations.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhuma negociação anterior encerrada neste lead.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            {historyNegotiations.map((item) => (
              <div
                key={item.id}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs hover:bg-muted/30"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      Imóvel [{item.property_code || item.property_id}]
                    </span>
                    <Badge
                      variant={item.status === 'fechada' ? 'success' : 'destructive'}
                      className="text-[10px]"
                    >
                      {NEGOTIATION_STATUS_LABELS[item.status] || item.status}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {NEGOTIATION_PURPOSE_LABELS[item.purpose] || item.purpose}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    Valor acordado:{' '}
                    <span className="tabular font-normal text-foreground">
                      {item.agreed_value && item.agreed_value > 0
                        ? new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(item.agreed_value)
                        : 'Não informado'}
                    </span>
                    {item.closed_at && (
                      <span className="tabular">
                        {' '}
                        · Encerrada em {new Date(item.closed_at).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </p>
                  {item.notes && (
                    <p className="text-muted-foreground text-[11px] italic">
                      &quot;{item.notes}&quot;
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <Link
                    to={`/imoveis/${item.property_id}`}
                    className="h-7 px-3 rounded-full border border-border text-[11px] text-foreground hover:bg-muted inline-flex items-center gap-1"
                  >
                    <span>Ficha do imóvel</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL 1: ABRIR NEGOCIAÇÃO */}
      <OpenNegotiationModal
        leadId={leadId}
        defaultPropertyId={defaultPropertyId}
        open={openModalVisible}
        onOpenChange={setOpenModalVisible}
        onSuccess={async () => {
          setSuccessBanner('Negociação aberta com sucesso.')
          await loadNegotiations()
        }}
        onConflict={async () => {
          await loadNegotiations()
        }}
      />

      {/* MODAL 2: FECHAR NEGÓCIO */}
      {activeNegotiation && (
        <CloseNegotiationModal
          negotiationId={activeNegotiation.id}
          purpose={activeNegotiation.purpose}
          open={closeModalVisible}
          onOpenChange={setCloseModalVisible}
          checklist={checklist}
          isAdmin={isAdmin}
          onReturnToChecklist={() => {
            const el = document.getElementById('checklist-section')
            if (el) {
              el.scrollIntoView({ behavior: 'smooth' })
            }
          }}
          onSuccess={async () => {
            setSuccessBanner('Negócio fechado com sucesso! Imóvel atualizado e lead Ganho.')
            await loadNegotiations()
          }}
        />
      )}

      {/* MODAL 3: ADICIONAR PESSOA */}
      {activeNegotiation && (
        <AddPersonModal
          negotiationId={activeNegotiation.id}
          purpose={activeNegotiation.purpose}
          open={addPersonModalVisible}
          onOpenChange={setAddPersonModalVisible}
          onSuccess={async () => {
            setSuccessBanner('Pessoa adicionada à negociação.')
            await loadChecklist(activeNegotiation.id)
          }}
        />
      )}
    </div>
  )
}
