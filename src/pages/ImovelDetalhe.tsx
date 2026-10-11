import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  getPropertyById,
  listPropertyPhotos,
  uploadPropertyPhoto,
  deactivatePropertyPhoto,
  getPropertyHistory,
  confirmPropertyData,
  getPropertyFicha,
  formatErrorMessage,
  formatCurrencyBRL,
  formatPropertyPrice,
  isPropertyPendingReview,
  getPhotoFileUrl,
  PropertyRecord,
  PropertyPhotoRecord,
  PropertyHistoryItem,
  PROPERTY_TYPE_LABELS,
  PROPERTY_PURPOSE_LABELS,
  PROPERTY_STATUS_LABELS,
  PropertyStatus,
  publishProperty,
  isPngPhoto,
  getPortalPendingReasons,
} from '@/services/properties'
import { LinkOwnerModal } from '@/components/properties/LinkOwnerModal'
import { getCondoPhotoUrl } from '@/services/condominiums'
import { formatPhoneNumber, formatDate } from '@/lib/clientUtils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { CreateTaskModal } from '@/components/agenda/CreateTaskModal'
import { TaskDetailModal, getTaskStatusBadge } from '@/components/agenda/TaskDetailModal'
import {
  listTasksByProperty,
  TaskRecord,
  formatTaskDateTimeBahia,
  isTaskOverdue,
  completeTask,
  extractTaskErrorMessage,
} from '@/services/tasks'
import {
  ArrowLeft,
  Edit,
  Building2,
  MapPin,
  Sparkles,
  DollarSign,
  FileText,
  UserCheck,
  UserPlus,
  CheckCircle2,
  Copy,
  UploadCloud,
  Trash2,
  Clock,
  Loader2,
  AlertCircle,
  AlertTriangle,
  ZoomIn,
  Bed,
  Bath,
  Car,
  Maximize,
  Share2,
  History,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
} from 'lucide-react'

// Mapa de campos para o histórico de alterações
const HISTORY_FIELD_LABELS: Record<string, string> = {
  code: 'Código',
  title: 'Título',
  purpose: 'Finalidade',
  property_type: 'Tipo',
  status: 'Situação',
  street: 'Rua',
  street_number: 'Número',
  complement: 'Complemento',
  neighborhood: 'Bairro',
  city: 'Cidade',
  bedrooms: 'Quartos',
  bathrooms: 'Banheiros',
  parking: 'Vagas',
  area: 'Área',
  sale_price: 'Preço de venda',
  rent_price: 'Preço de locação',
  price_on_request: 'Sob consulta',
  condo_fee: 'Condomínio',
  iptu: 'IPTU',
  description: 'Descrição',
  owner_id: 'Proprietário',
  captured_by: 'Captador',
}

// Mapa de variante de pílula para a situação do imóvel:
// Rascunho=default; Disponível=success; Reservado=attention; Vendido=default; Alugado=default; Inativo=destructive
const STATUS_BADGE_VARIANT_MAP: Record<
  PropertyStatus,
  'default' | 'success' | 'attention' | 'destructive'
> = {
  rascunho: 'default',
  disponivel: 'success',
  reservado: 'attention',
  vendido: 'default',
  alugado: 'default',
  inativo: 'destructive',
}

const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/webp']
const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024 // 3 MB

interface UploadProgressItem {
  name: string
  status: 'uploading' | 'done' | 'error'
  errorMessage?: string
}

export default function ImovelDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()

  const [property, setProperty] = useState<PropertyRecord | null>(null)
  const [photos, setPhotos] = useState<PropertyPhotoRecord[]>([])
  const [historyItems, setHistoryItems] = useState<PropertyHistoryItem[]>([])

  // Tarefas vinculadas ao imóvel
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null)
  const [taskDetailModalOpen, setTaskDetailModalOpen] = useState(false)

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [warningMessage, setWarningMessage] = useState<string | null>(null)

  // Confirmar dados
  const [confirming, setConfirming] = useState(false)

  // Copiar ficha
  const [fichaModalOpen, setFichaModalOpen] = useState(false)
  const [fichaText, setFichaText] = useState('')
  const [loadingFicha, setLoadingFicha] = useState(false)
  const [copiedFicha, setCopiedFicha] = useState(false)

  // Visualização de foto ampliada
  const [viewingPhotoIndex, setViewingPhotoIndex] = useState<number | null>(null)

  // Modal de vincular proprietário
  const [linkOwnerModalOpen, setLinkOwnerModalOpen] = useState(false)

  // Ação de publicar imóvel (para imóveis rascunho/importados)
  const [publishing, setPublishing] = useState(false)
  const [publishErrors, setPublishErrors] = useState<string[]>([])

  // Diálogo de confirmação para remoção de foto
  const [photoToDelete, setPhotoToDelete] = useState<PropertyPhotoRecord | null>(null)
  const [deletingPhoto, setDeletingPhoto] = useState(false)

  // Envio de fotos
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadList, setUploadList] = useState<UploadProgressItem[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const role = user?.role || ''
  const isSdr = role === 'sdr'
  const isAdmin = role === 'admin'
  const isCaptador = Boolean(property && property.captured_by === user?.id)
  const canManage = !isSdr && (isAdmin || isCaptador)

  // Carrega imóvel, fotos, histórico e tarefas
  const loadData = async (imovelId: string) => {
    try {
      const [propData, photosData, histData, tasksData] = await Promise.all([
        getPropertyById(imovelId),
        listPropertyPhotos(imovelId),
        getPropertyHistory(imovelId).catch(() => [] as PropertyHistoryItem[]),
        listTasksByProperty(imovelId).catch(() => [] as TaskRecord[]),
      ])
      setProperty(propData)
      setPhotos(photosData)
      setHistoryItems(histData)
      setTasks(tasksData)
    } catch (err) {
      setErrorMessage(formatErrorMessage(err))
    }
  }

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    setErrorMessage(null)

    loadData(id).finally(() => {
      if (active) setLoading(false)
    })

    return () => {
      active = false
    }
  }, [id])

  // Ação: Confirmar dados
  const handleConfirmData = async () => {
    if (!id || !canManage) return
    setConfirming(true)
    try {
      await confirmPropertyData(id)
      toast({
        title: 'Dados confirmados.',
        description: 'A data de última revisão foi atualizada com sucesso.',
      })
      await loadData(id)
    } catch (err) {
      toast({
        title: 'Erro ao confirmar dados',
        description: formatErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setConfirming(false)
    }
  }

  // Ação: Abrir modal e Copiar ficha
  const handleOpenFicha = async () => {
    if (!id) return
    setLoadingFicha(true)
    setCopiedFicha(false)
    try {
      const data = await getPropertyFicha(id)
      setFichaText(data.text)
      setFichaModalOpen(true)
      // Copia automaticamente para o clipboard conforme a especificação
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(data.text)
          setCopiedFicha(true)
          toast({
            title: 'Ficha copiada. Cole no WhatsApp.',
          })
        } catch {
          // Fallback caso a permissão do clipboard seja negada
        }
      }
    } catch (err) {
      toast({
        title: 'Erro ao gerar ficha',
        description: formatErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoadingFicha(false)
    }
  }

  const handleCopyFichaAgain = async () => {
    if (!fichaText) return
    try {
      await navigator.clipboard.writeText(fichaText)
      setCopiedFicha(true)
      toast({
        title: 'Ficha copiada. Cole no WhatsApp.',
      })
    } catch {
      toast({
        title: 'Não foi possível copiar automaticamente.',
        description: 'Selecione e copie o texto manualmente na caixa abaixo.',
        variant: 'destructive',
      })
    }
  }

  // Ação: Seleção e envio de fotos
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !property || !user?.organization_id) return

    const fileList = Array.from(files)
    // Limpa o input para permitir selecionar o mesmo arquivo novamente
    e.target.value = ''

    // Validações antes de enviar
    const currentActiveCount = photos.length
    if (currentActiveCount >= 20) {
      toast({
        title: 'Limite atingido',
        description: 'Limite de 20 fotos por imóvel.',
        variant: 'destructive',
      })
      return
    }

    if (currentActiveCount + fileList.length > 20) {
      toast({
        title: 'Limite de 20 fotos por imóvel.',
        description: `Você já tem ${currentActiveCount} foto(s) e tentou adicionar ${fileList.length}. O total não pode passar de 20.`,
        variant: 'destructive',
      })
      return
    }

    // Valida tipo e tamanho de cada arquivo antes de iniciar qualquer envio (só JPEG e WebP até 3 MB)
    for (const f of fileList) {
      const ext = f.name.toLowerCase().split('.').pop() || ''
      const isValidExt = ['jpg', 'jpeg', 'webp'].includes(ext)
      const isValidMime = ACCEPTED_MIME_TYPES.includes(f.type)
      if (!isValidExt && !isValidMime) {
        toast({
          title: 'Tipo de arquivo não permitido',
          description: `O arquivo "${f.name}" não é suportado. Envie apenas JPEG ou WebP (PNG deixou de ser aceito).`,
          variant: 'destructive',
        })
        return
      }

      if (f.size > MAX_FILE_SIZE_BYTES) {
        toast({
          title: 'Arquivo muito grande',
          description: `O arquivo "${f.name}" ultrapassa o limite de 3 MB. Envie fotos de até 3 MB cada.`,
          variant: 'destructive',
        })
        return
      }
    }

    // Inicia envio UMA foto por requisição mostrando progresso
    setIsUploading(true)
    const initialProgress: UploadProgressItem[] = fileList.map((f) => ({
      name: f.name,
      status: 'uploading',
    }))
    setUploadList(initialProgress)

    let anySuccess = false
    let serverLimitReached = false

    for (let i = 0; i < fileList.length; i++) {
      const currentFile = fileList[i]
      if (serverLimitReached) {
        setUploadList((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? { ...item, status: 'error', errorMessage: 'Envio cancelado pelo limite de fotos.' }
              : item,
          ),
        )
        continue
      }

      try {
        await uploadPropertyPhoto(property.id, user.organization_id, currentFile)
        anySuccess = true
        setUploadList((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: 'done' } : item)),
        )
      } catch (err) {
        const errorMsg = formatErrorMessage(err)
        if (errorMsg.includes('Limite de 20 fotos')) {
          serverLimitReached = true
        }
        setUploadList((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'error', errorMessage: errorMsg } : item,
          ),
        )
      }
    }

    setIsUploading(false)

    if (anySuccess) {
      // Releia fotos e dados do imóvel
      await loadData(property.id)
      toast({
        title: 'Fotos enviadas com sucesso.',
      })
    }
  }

  // Ação: Remover foto (desativar)
  const handleConfirmDeletePhoto = async () => {
    if (!photoToDelete || !property) return
    setDeletingPhoto(true)
    setWarningMessage(null)

    const prevStatus = property.status
    const targetPhotoId = photoToDelete.id

    try {
      await deactivatePropertyPhoto(targetPhotoId)
      setPhotoToDelete(null)

      // Releia o imóvel e as fotos
      const updatedProp = await getPropertyById(property.id)
      const updatedPhotos = await listPropertyPhotos(property.id)
      const updatedHistory = await getPropertyHistory(property.id).catch(
        () => [] as PropertyHistoryItem[],
      )

      setProperty(updatedProp)
      setPhotos(updatedPhotos)
      setHistoryItems(updatedHistory)

      // "Se o imóvel for Disponível e sobrarem menos de 5 fotos, o servidor o devolve a Rascunho:
      // releia o imóvel e mostre 'Este imóvel voltou para Rascunho porque ficou com menos de 5 fotos.'"
      if (prevStatus === 'disponivel' && updatedProp.status === 'rascunho') {
        setWarningMessage('Este imóvel voltou para Rascunho porque ficou com menos de 5 fotos.')
        toast({
          title: 'Atenção',
          description: 'Este imóvel voltou para Rascunho porque ficou com menos de 5 fotos.',
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Foto removida da galeria.',
        })
      }
    } catch (err) {
      toast({
        title: 'Erro ao remover foto',
        description: formatErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setDeletingPhoto(false)
    }
  }

  // Ação: Publicar imóvel (PATCH status = "disponivel")
  const handlePublishProperty = async () => {
    if (!property) return
    setPublishing(true)
    setPublishErrors([])

    try {
      const updated = await publishProperty(property.id)
      setProperty(updated)
      toast({
        title: 'Imóvel publicado!',
        description: 'A situação do imóvel agora é Disponível.',
      })
      await loadData(property.id)
    } catch (err: unknown) {
      // Se o servidor listar o que falta, mostra a lista
      const anyErr = err as {
        data?: { data?: Record<string, { message?: string }> }
        response?: { data?: Record<string, { message?: string }>; message?: string }
      }
      const errorsObj = anyErr?.data?.data || anyErr?.response?.data
      if (errorsObj && typeof errorsObj === 'object') {
        const msgs = Object.entries(errorsObj).map(
          ([field, val]) =>
            `${field}: ${(val as { message?: string })?.message || 'campo inválido'}`,
        )
        if (msgs.length > 0) {
          setPublishErrors(msgs)
          return
        }
      }
      const genericMsg = formatErrorMessage(err)
      setPublishErrors([genericMsg])
    } finally {
      setPublishing(false)
    }
  }

  // Formata ação do histórico em português
  const formatHistoryEntry = (item: PropertyHistoryItem) => {
    let actionText = ''

    if (item.action === 'imovel_importado') {
      actionText = 'Importado da Kenlo'
    } else if (item.action === 'imovel_criado') {
      actionText = 'Imóvel criado'
    } else if (item.action === 'imovel_alterado') {
      const fieldName = item.field ? HISTORY_FIELD_LABELS[item.field] || item.field : ''
      actionText = fieldName ? `Alterado ${fieldName}` : 'Alterado'
    } else if (item.action === 'dados_confirmados') {
      actionText = 'Dados confirmados'
    } else if (item.action === 'importacao_desfeita') {
      actionText = 'Importação desfeita'
    } else {
      actionText = 'Alteração'
    }

    if (item.reason === 'auto_rascunho_incompleto' || item.reason === 'auto_rascunho_fotos') {
      actionText += ' (voltou para Rascunho automaticamente)'
    }

    return actionText
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-muted-foreground gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Carregando ficha do imóvel...</p>
      </div>
    )
  }

  if (errorMessage || !property) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Button variant="ghost" onClick={() => navigate('/imoveis')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar para Imóveis</span>
        </Button>
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20 font-medium">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMessage || 'Imóvel não encontrado.'}</span>
        </div>
      </div>
    )
  }

  const isOutdated = isPropertyPendingReview(property)
  const statusVariant = STATUS_BADGE_VARIANT_MAP[property.status] || 'default'
  const statusLabel = PROPERTY_STATUS_LABELS[property.status] || property.status

  const captadorName =
    property.expand?.captured_by?.name || property.expand?.captured_by?.email || 'Não informado'

  // Proprietário: se o usuário tiver acesso (expand.owner_id), mostra nome e telefone formatado;
  // senão mostrar "Proprietário cadastrado"
  const ownerRecord = property.expand?.owner_id
  const hasOwner = Boolean(property.owner_id)

  const showSalePrice = property.purpose === 'venda' || property.purpose === 'ambos'
  const showRentPrice = property.purpose === 'locacao' || property.purpose === 'ambos'

  // Pendências do imóvel importado
  const isImported = property.source === 'importacao'
  const importMissingItems: string[] = []
  if (!property.owner_id) importMissingItems.push('Sem proprietário')
  if (!property.title || !property.title.trim()) importMissingItems.push('Sem título')
  if (photos.length < 5) importMissingItems.push(`Faltam fotos (${photos.length} de 5)`)

  const hasImportMissing = importMissingItems.length > 0
  const canPublish = !hasImportMissing

  // Título de exibição de fallback
  const displayTitle =
    property.title && property.title.trim()
      ? property.title
      : `${PROPERTY_TYPE_LABELS[property.property_type] || property.property_type} · ${property.neighborhood || 'Sem bairro'} · ${property.code}`

  // Condomínio
  const condoRecord = property.expand?.condominium_id

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Alerta de aviso (ex: voltou para Rascunho por falta de fotos) */}
      {warningMessage && (
        <div className="p-4 rounded-lg border border-attention/40 bg-muted/20 text-xs text-foreground font-normal">
          {warningMessage}
        </div>
      )}

      {/* Caixa de pendências do imóvel importado */}
      {isImported && (
        <div className="p-4 rounded-lg border border-border bg-card space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-xs bg-muted/60 text-foreground border-border"
              >
                Importado
              </Badge>
              <h2 className="text-sm font-normal text-foreground">
                {hasImportMissing ? 'Pendências para ativação' : 'Imóvel pronto para publicação'}
              </h2>
            </div>

            {canManage && property.status !== 'disponivel' && (
              <Button
                type="button"
                onClick={handlePublishProperty}
                disabled={!canPublish || publishing}
                size="sm"
                className="h-8 rounded-full px-4 text-xs font-normal bg-primary text-primary-foreground gap-1.5 self-start sm:self-auto"
                title={
                  !canPublish
                    ? 'Resolva as pendências antes de publicar.'
                    : 'Publicar imóvel no catálogo'
                }
              >
                {publishing && <Loader2 className="h-3 w-3 animate-spin" />}
                <span>Publicar</span>
              </Button>
            )}
          </div>

          {hasImportMissing ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Complete os requisitos abaixo para poder publicar o imóvel como Disponível:
              </p>
              <ul className="space-y-1 text-xs">
                {importMissingItems.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-foreground font-normal">
                    <AlertCircle className="h-3.5 w-3.5 text-attention shrink-0" />
                    <span>{item}</span>
                    {item === 'Sem proprietário' && canManage && (
                      <button
                        type="button"
                        onClick={() => setLinkOwnerModalOpen(true)}
                        className="text-primary underline hover:opacity-80 text-xs ml-1"
                      >
                        Vincular agora
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Todas as informações obrigatórias foram preenchidas. O imóvel pode ser publicado.
            </p>
          )}

          {publishErrors.length > 0 && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 space-y-1">
              <p className="font-medium">O servidor indicou pendências para publicação:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {publishErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Barra de Navegação Superior e Ações (uma só ação preenchida: Editar) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/imoveis')}
            className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-full border border-border flex items-center justify-center hover:bg-muted shrink-0 text-foreground"
            aria-label="Voltar para lista de imóveis"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="eyebrow text-muted-foreground">{property.code}</span>
              {isImported && (
                <Badge
                  variant="outline"
                  className="text-xs bg-muted/60 text-foreground border-border"
                >
                  Importado
                </Badge>
              )}
              <Badge variant={statusVariant} className="text-xs">
                {statusLabel}
              </Badge>
              {(() => {
                const hl = (property as any).highlight_level || 'comum'
                const untilStr = (property as any).highlight_until
                if (hl === 'destaque' || hl === 'super_destaque') {
                  const isExpired =
                    untilStr &&
                    !isNaN(new Date(untilStr.replace(' ', 'T')).getTime()) &&
                    new Date(untilStr.replace(' ', 'T')).getTime() < Date.now()
                  if (isExpired) {
                    const d = new Date(untilStr.replace(' ', 'T'))
                    const dd = String(d.getUTCDate()).padStart(2, '0')
                    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
                    return (
                      <Badge
                        variant="outline"
                        className="text-xs text-muted-foreground border-border"
                      >
                        Comum (destaque vencido em {dd}/{mm})
                      </Badge>
                    )
                  }
                  return (
                    <Badge
                      variant={hl === 'super_destaque' ? 'default' : 'secondary'}
                      className={`text-xs ${
                        hl === 'super_destaque'
                          ? 'bg-primary text-primary-foreground border-primary font-medium'
                          : 'border-border text-foreground'
                      }`}
                    >
                      {hl === 'super_destaque' ? 'Super-destaque' : 'Destaque'}
                    </Badge>
                  )
                }
                return null
              })()}
              {isOutdated && (
                <Badge variant="attention" className="text-xs">
                  Desatualizado
                </Badge>
              )}
            </div>
            <h1 className="text-lg sm:text-2xl md:text-3xl font-light tracking-tight text-foreground mt-0.5 line-clamp-2">
              {displayTitle}
            </h1>
          </div>
        </div>

        {/* Botões de Ação do Cabeçalho em pílulas */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setCreateTaskModalOpen(true)}
            className="h-9 rounded-full px-4 text-xs font-normal border-border gap-1.5"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Criar tarefa</span>
          </Button>

          {property.status === 'disponivel' && (
            <Button
              variant="outline"
              onClick={handleOpenFicha}
              disabled={loadingFicha}
              className="h-9 rounded-full px-4 text-xs font-normal border-border gap-1.5"
            >
              {loadingFicha ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Share2 className="h-3.5 w-3.5" />
              )}
              <span>Copiar ficha</span>
            </Button>
          )}

          {canManage && (
            <Button
              variant="outline"
              onClick={handleConfirmData}
              disabled={confirming}
              className="h-9 rounded-full px-4 text-xs font-normal border-border gap-1.5"
            >
              {confirming ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              <span>Confirmar dados</span>
            </Button>
          )}

          {canManage && (
            <Button
              asChild
              className="h-9 rounded-full px-5 text-xs font-medium bg-primary text-primary-foreground gap-1.5"
            >
              <Link to={`/imoveis/${property.id}/editar`}>
                <Edit className="h-3.5 w-3.5" />
                <span>Editar</span>
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* 1. SEÇÃO: GALERIA DE FOTOS (fileira rolante de miniaturas de 8px, a primeira maior, contador "N de 20 fotos" em texto de apoio e aviso com borda attention) */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[20px] font-normal text-foreground">Galeria de fotos</h2>
              <span className="text-xs text-muted-foreground tabular font-normal">
                {photos.length} de 20 fotos
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              A primeira foto é utilizada como capa do imóvel.
            </p>
          </div>

          {canManage && (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                multiple
                accept=".jpg,.jpeg,.webp,image/jpeg,image/webp"
                className="hidden"
                disabled={isUploading || photos.length >= 20}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || photos.length >= 20}
                className="h-9 rounded-full px-4 text-xs font-normal border-border gap-1.5"
              >
                {isUploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="h-3.5 w-3.5" />
                )}
                <span>Adicionar fotos</span>
              </Button>
            </div>
          )}
        </div>

        {/* Aviso com borda attention */}
        {photos.length < 5 && (
          <div className="p-3.5 rounded-lg border border-attention/40 bg-muted/20 text-xs text-foreground font-normal">
            Para ficar Disponível o imóvel precisa de pelo menos 5 fotos.
          </div>
        )}

        {/* Fileira rolante de miniaturas */}
        {photos.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            Nenhuma foto cadastrada.
          </div>
        ) : (
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
            {photos.map((photo, index) => {
              const isCover = index === 0
              const isPng = isPngPhoto(photo.file)
              return (
                <div
                  key={photo.id}
                  className={`group relative rounded-lg overflow-hidden border border-border bg-muted shrink-0 cursor-pointer ${
                    isCover ? 'w-40 h-40 sm:w-48 sm:h-48' : 'w-24 h-24 sm:w-28 sm:h-28'
                  }`}
                  onClick={() => setViewingPhotoIndex(index)}
                >
                  <img
                    src={getPhotoFileUrl(photo, isCover ? '400x400' : '200x200')}
                    alt={`Foto ${index + 1}`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                  {isCover && (
                    <div className="absolute top-2 left-2">
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">
                        Capa
                      </Badge>
                    </div>
                  )}

                  {/* Selo para fotos PNG existentes */}
                  {isPng && (
                    <div className="absolute bottom-0 left-0 right-0 bg-amber-600/90 text-white p-1 text-[9px] font-normal text-center leading-tight">
                      não vai para o portal; substitua por JPEG ou WebP
                    </div>
                  )}

                  {canManage && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPhotoToDelete(photo)
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground text-destructive transition-colors opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
                      title="Remover foto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 2. SEÇÃO: DADOS DO IMÓVEL (linhas rótulo/valor com rótulo em .eyebrow) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Identificação e Localização */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="eyebrow text-muted-foreground flex items-center gap-2 border-b border-border pb-3">
            <Building2 className="h-3.5 w-3.5" />
            <span>Identificação e Localização</span>
          </div>

          {/* Seção Onde anunciar / Indicador Chaves na Mão na Ficha */}
          {(() => {
            const pubList = Array.isArray(property.publish_to) ? property.publish_to : []
            const hasSite = pubList.includes('site')
            const hasChaves = pubList.includes('chaves_na_mao')

            const portalReasons = hasChaves
              ? getPortalPendingReasons({
                  status: property.status,
                  property_type: property.property_type,
                  purpose: property.purpose,
                  sale_price: property.sale_price,
                  rent_price: property.rent_price,
                  price_on_request: property.price_on_request,
                  neighborhood: property.neighborhood,
                  city: property.city,
                  state: property.state,
                  zip_code: property.zip_code,
                  description: property.description,
                  photos: photos,
                })
              : []
            const isPortalReady = hasChaves && portalReasons.length === 0

            return (
              <div className="p-3.5 rounded-lg bg-muted/20 border border-border space-y-2.5 text-xs">
                <span className="eyebrow text-muted-foreground block text-[10px]">
                  Onde anunciar
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={hasSite ? 'default' : 'outline'}
                    className={`text-xs ${
                      hasSite
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'text-muted-foreground border-border'
                    }`}
                  >
                    {hasSite ? '✓ Site da imobiliária' : 'Site da imobiliária (não)'}
                  </Badge>
                  <Badge
                    variant={hasChaves ? 'default' : 'outline'}
                    className={`text-xs ${
                      hasChaves
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'text-muted-foreground border-border'
                    }`}
                  >
                    {hasChaves ? '✓ Chaves na Mão' : 'Chaves na Mão (não)'}
                  </Badge>
                </div>

                {/* Indicador Pronto para o portal na Ficha */}
                {hasChaves && (
                  <div
                    className={`p-3 rounded-lg border text-xs space-y-1.5 mt-2 ${
                      isPortalReady
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium">
                      {isPortalReady ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-600 text-white">
                          ● Pronto para o portal
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-600 text-white">
                          ▲ Pendências para o portal Chaves na Mão
                        </span>
                      )}
                    </div>
                    {!isPortalReady && (
                      <ul className="space-y-0.5 list-disc list-inside text-xs">
                        {portalReasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )
          })()}
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="eyebrow text-muted-foreground block">Tipo</span>
                <p className="text-sm font-normal text-foreground">
                  {PROPERTY_TYPE_LABELS[property.property_type] || property.property_type}
                </p>
              </div>
              <div className="space-y-1">
                <span className="eyebrow text-muted-foreground block">Finalidade</span>
                <p className="text-sm font-normal text-foreground">
                  {PROPERTY_PURPOSE_LABELS[property.purpose] || property.purpose}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-border space-y-2">
              <span className="eyebrow text-muted-foreground block">
                Endereço completo (Ficha interna)
              </span>
              <div className="p-3.5 rounded-lg bg-muted/20 border border-border space-y-1 text-xs">
                <p className="font-normal text-foreground">
                  {[property.street, property.street_number].filter(Boolean).join(', ') ||
                    'Logradouro não informado'}
                </p>
                {property.complement && (
                  <p className="text-muted-foreground">Complemento: {property.complement}</p>
                )}
                <p className="text-muted-foreground">
                  {[property.neighborhood, property.city, property.state]
                    .filter(Boolean)
                    .join(' • ') || 'Bairro/Cidade/UF não informados'}
                </p>
                {property.zip_code && (
                  <p className="text-muted-foreground tabular">
                    CEP: {property.zip_code.replace(/(\d{5})(\d{3})/, '$1-$2')}
                  </p>
                )}
              </div>
            </div>

            {/* Dados do Condomínio (abaixo do endereço) */}
            {property.in_condominium && condoRecord && (
              <div className="pt-3 border-t border-border space-y-2">
                <span className="eyebrow text-muted-foreground block">Dados do condomínio</span>
                <div className="p-3.5 rounded-lg bg-muted/20 border border-border space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="font-normal text-sm text-foreground">{condoRecord.name}</p>
                    <Badge variant="outline" className="text-[10px] border-border">
                      Condomínio
                    </Badge>
                  </div>

                  {condoRecord.amenities && (
                    <div className="space-y-0.5">
                      <span className="eyebrow text-muted-foreground block text-[10px]">
                        Lazer e Comodidades
                      </span>
                      <p className="text-foreground whitespace-pre-line leading-relaxed">
                        {condoRecord.amenities}
                      </p>
                    </div>
                  )}

                  {condoRecord.rules && (
                    <div className="space-y-0.5">
                      <span className="eyebrow text-muted-foreground block text-[10px]">
                        Regras do condomínio
                      </span>
                      <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                        {condoRecord.rules}
                      </p>
                    </div>
                  )}

                  {condoRecord.expand?.condominium_photos_via_condominium_id &&
                    condoRecord.expand.condominium_photos_via_condominium_id.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <span className="eyebrow text-muted-foreground block text-[10px]">
                          Fotos do condomínio
                        </span>
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                          {condoRecord.expand.condominium_photos_via_condominium_id.map(
                            (cPhoto) => (
                              <div
                                key={cPhoto.id}
                                className="w-16 h-16 rounded-lg overflow-hidden border border-border shrink-0 bg-muted"
                              >
                                <img
                                  src={getCondoPhotoUrl(cPhoto as any, '100x100')}
                                  alt="Condomínio"
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Características e Valores */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="eyebrow text-muted-foreground flex items-center gap-2 border-b border-border pb-3">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Características e Valores</span>
          </div>
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-4 gap-2">
              <div className="p-2 rounded-lg border border-border bg-muted/20 text-center">
                <p className="eyebrow text-muted-foreground text-[10px]">Quartos</p>
                <p className="tabular text-sm font-normal text-foreground mt-0.5">
                  {property.bedrooms && property.bedrooms > 0 ? property.bedrooms : '—'}
                </p>
              </div>
              <div className="p-2 rounded-lg border border-border bg-muted/20 text-center">
                <p className="eyebrow text-muted-foreground text-[10px]">Banheiros</p>
                <p className="tabular text-sm font-normal text-foreground mt-0.5">
                  {property.bathrooms && property.bathrooms > 0 ? property.bathrooms : '—'}
                </p>
              </div>
              <div className="p-2 rounded-lg border border-border bg-muted/20 text-center">
                <p className="eyebrow text-muted-foreground text-[10px]">Vagas</p>
                <p className="tabular text-sm font-normal text-foreground mt-0.5">
                  {property.parking && property.parking > 0 ? property.parking : '—'}
                </p>
              </div>
              <div className="p-2 rounded-lg border border-border bg-muted/20 text-center">
                <p className="eyebrow text-muted-foreground text-[10px]">Área</p>
                <p className="tabular text-sm font-normal text-foreground mt-0.5">
                  {property.area && property.area > 0 ? `${property.area} m²` : '—'}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-border space-y-2">
              <span className="eyebrow text-muted-foreground block">Valores</span>
              {property.price_on_request ? (
                <div className="p-3.5 rounded-lg bg-muted/20 border border-border text-xs">
                  <Badge variant="default" className="text-xs">
                    Sob consulta
                  </Badge>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-muted/20 border border-border text-xs tabular">
                  {showSalePrice && (
                    <div>
                      <span className="eyebrow text-muted-foreground block">Venda</span>
                      <p className="font-normal text-foreground">
                        {property.sale_price && property.sale_price > 0
                          ? formatCurrencyBRL(property.sale_price)
                          : '—'}
                      </p>
                    </div>
                  )}

                  {showRentPrice && (
                    <div>
                      <span className="eyebrow text-muted-foreground block">Locação</span>
                      <p className="font-normal text-foreground">
                        {property.rent_price && property.rent_price > 0
                          ? `${formatCurrencyBRL(property.rent_price)}/mês`
                          : '—'}
                      </p>
                    </div>
                  )}

                  <div>
                    <span className="eyebrow text-muted-foreground block">Condomínio</span>
                    <p className="text-foreground">
                      {property.condo_fee && property.condo_fee > 0
                        ? formatCurrencyBRL(property.condo_fee)
                        : '—'}
                    </p>
                  </div>

                  <div>
                    <span className="eyebrow text-muted-foreground block">IPTU</span>
                    <p className="text-foreground">
                      {property.iptu && property.iptu > 0 ? formatCurrencyBRL(property.iptu) : '—'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. SEÇÃO: DESCRIÇÃO */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div className="eyebrow text-muted-foreground flex items-center gap-2 border-b border-border pb-3">
          <FileText className="h-3.5 w-3.5" />
          <span>Descrição do imóvel</span>
        </div>
        {property.description ? (
          <p className="text-xs text-foreground whitespace-pre-line leading-relaxed">
            {property.description}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Nenhuma descrição fornecida para este anúncio.
          </p>
        )}
      </div>

      {/* 4. SEÇÃO: PROPRIETÁRIO E CAPTADOR */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="eyebrow text-muted-foreground flex items-center gap-2 border-b border-border pb-3">
          <UserCheck className="h-3.5 w-3.5" />
          <span>Proprietário e Captador</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Proprietário */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="eyebrow text-muted-foreground block">Proprietário</span>
            </div>
            {ownerRecord ? (
              <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-1">
                <p className="font-normal text-foreground">
                  <Link to={`/clientes/${ownerRecord.id}`} className="text-primary underline">
                    {ownerRecord.name}
                  </Link>
                </p>
                {ownerRecord.phone && (
                  <p className="text-muted-foreground tabular">
                    Telefone: {formatPhoneNumber(ownerRecord.phone)}
                  </p>
                )}
                {ownerRecord.email && (
                  <p className="text-muted-foreground">E-mail: {ownerRecord.email}</p>
                )}
              </div>
            ) : hasOwner ? (
              <div className="p-3.5 rounded-lg border border-border bg-muted/20">
                <p className="font-normal text-foreground">Proprietário cadastrado</p>
                <p className="text-muted-foreground">
                  Dados restritos ao responsável ou administrador.
                </p>
              </div>
            ) : (
              <div className="p-3.5 rounded-lg border border-border bg-muted/20 text-muted-foreground flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span>Nenhum cliente proprietário vinculado.</span>
                {canManage && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setLinkOwnerModalOpen(true)}
                    className="h-8 rounded-full px-3 text-xs font-normal border-border gap-1 self-start sm:self-auto"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Vincular proprietário</span>
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Captador */}
          <div className="space-y-1.5">
            <span className="eyebrow text-muted-foreground block">Corretor captador</span>
            <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-1">
              <p className="font-normal text-foreground">{captadorName}</p>
              <p className="text-muted-foreground">Responsável pelo anúncio e captação inicial.</p>
              {property.last_reviewed_at && (
                <p className="text-muted-foreground pt-1 border-t border-border mt-1 tabular">
                  Última revisão de dados: {formatDate(property.last_reviewed_at)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO TAREFAS DO IMÓVEL */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="eyebrow text-muted-foreground flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            <span>Tarefas ({tasks.length})</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCreateTaskModalOpen(true)}
            className="h-8 rounded-full px-3 text-xs font-normal border-border gap-1"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Criar tarefa</span>
          </Button>
        </div>

        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhuma tarefa vinculada a este imóvel.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            {tasks.map((t) => {
              const overdue = isTaskOverdue(t)
              const assignee = t.expand?.assigned_to
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelectedTask(t)
                    setTaskDetailModalOpen(true)
                  }}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-muted/40 cursor-pointer text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground">{t.title}</span>
                      {getTaskStatusBadge(t)}
                    </div>
                    <p className="text-muted-foreground tabular">
                      Prazo:{' '}
                      <span className={overdue ? 'text-attention font-medium' : ''}>
                        {overdue && 'Atrasado: '}
                        {formatTaskDateTimeBahia(t.due_at)}
                      </span>
                      {assignee && <span> · Responsável: {assignee.name || assignee.email}</span>}
                    </p>
                  </div>
                  {t.status === 'aberta' && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs rounded-full px-3 border-border"
                        onClick={async () => {
                          try {
                            await completeTask(t.id)
                            if (property) {
                              const freshTasks = await listTasksByProperty(property.id)
                              setTasks(freshTasks)
                            }
                          } catch (err) {
                            toast({
                              title: 'Erro ao concluir tarefa',
                              description: extractTaskErrorMessage(err),
                              variant: 'destructive',
                            })
                          }
                        }}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Concluir
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 5. SEÇÃO: HISTÓRICO DE ALTERAÇÕES (linha do tempo do lead com traço fino e horário em .eyebrow e .tabular) */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="eyebrow text-muted-foreground flex items-center gap-2 border-b border-border pb-3">
          <History className="h-3.5 w-3.5" />
          <span>Histórico de alterações</span>
        </div>
        {historyItems.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhuma alteração registrada até o momento.
          </p>
        ) : (
          <div className="relative pl-5 space-y-5 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-px before:bg-border">
            {historyItems.map((item, idx) => {
              const actionLabel = formatHistoryEntry(item)
              return (
                <div key={idx} className="relative group">
                  <div className="absolute -left-[18px] top-1.5 h-2 w-2 rounded-full bg-foreground ring-4 ring-background" />
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="eyebrow tabular text-muted-foreground">
                        {formatDate(item.occurred_at)}
                      </span>
                      {item.actor && (
                        <span className="text-muted-foreground">por {item.actor}</span>
                      )}
                    </div>
                    <div className="p-3 rounded-lg border border-border bg-muted/20 text-foreground">
                      {actionLabel}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* DIÁLOGO: Visualizador de Foto em Alta Resolução */}
      {viewingPhotoIndex !== null && photos[viewingPhotoIndex] && (
        <Dialog open={true} onOpenChange={() => setViewingPhotoIndex(null)}>
          <DialogContent className="max-w-4xl p-2 sm:p-4 bg-background/95 backdrop-blur">
            <div className="relative flex flex-col items-center">
              <div className="relative w-full max-h-[75vh] flex items-center justify-center bg-black/5 rounded-lg overflow-hidden">
                <img
                  src={getPhotoFileUrl(photos[viewingPhotoIndex])}
                  alt={`Foto ${viewingPhotoIndex + 1}`}
                  className="max-h-[75vh] w-auto max-w-full object-contain"
                />
              </div>

              {/* Controles de Navegação */}
              <div className="flex items-center justify-between w-full pt-3 px-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setViewingPhotoIndex((prev) =>
                      prev !== null && prev > 0 ? prev - 1 : photos.length - 1,
                    )
                  }
                  className="gap-1 text-xs"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Anterior</span>
                </Button>

                <span className="text-xs font-medium text-muted-foreground font-mono">
                  {viewingPhotoIndex + 1} de {photos.length}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setViewingPhotoIndex((prev) =>
                      prev !== null && prev < photos.length - 1 ? prev + 1 : 0,
                    )
                  }
                  className="gap-1 text-xs"
                >
                  <span>Próxima</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* DIÁLOGO: Confirmação de Remoção de Foto */}
      <Dialog
        open={Boolean(photoToDelete)}
        onOpenChange={(open) => !open && setPhotoToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover foto da galeria?</DialogTitle>
            <DialogDescription>
              A foto será desativada do anúncio. Se este imóvel estiver com situação Disponível e
              restarem menos de 5 fotos, ele retornará automaticamente para Rascunho.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setPhotoToDelete(null)}
              disabled={deletingPhoto}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeletePhoto}
              disabled={deletingPhoto}
              className="gap-2"
            >
              {deletingPhoto && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Remover foto</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO: Copiar Ficha para WhatsApp */}
      <Dialog open={fichaModalOpen} onOpenChange={setFichaModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-foreground" />
              <span>Ficha para WhatsApp</span>
            </DialogTitle>
            <DialogDescription>
              Ficha formatada gerada pelo servidor com as informações públicas do imóvel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="p-3.5 rounded-lg bg-muted/20 border border-border font-sans text-xs whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed select-all text-foreground">
              {fichaText}
            </div>
            {copiedFicha && (
              <p className="text-xs text-foreground font-normal flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Ficha copiada. Cole no WhatsApp.</span>
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setFichaModalOpen(false)}
              className="h-9 rounded-full px-4 text-xs font-normal border-border"
            >
              Fechar
            </Button>
            <Button
              onClick={handleCopyFichaAgain}
              className="h-9 rounded-full px-4 text-xs font-normal bg-primary text-primary-foreground gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Copiar novamente</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL CRIAR TAREFA */}
      {property && (
        <CreateTaskModal
          open={createTaskModalOpen}
          onOpenChange={setCreateTaskModalOpen}
          fixedBinding={{
            property: { id: property.id, code: property.code, title: property.title },
          }}
          onCreated={async () => {
            toast({ title: 'Tarefa criada com sucesso.' })
            const freshTasks = await listTasksByProperty(property.id)
            setTasks(freshTasks)
          }}
        />
      )}

      {/* MODAL DETALHE DA TAREFA */}
      <TaskDetailModal
        task={selectedTask}
        open={taskDetailModalOpen}
        onOpenChange={setTaskDetailModalOpen}
        onUpdated={async () => {
          if (property) {
            const freshTasks = await listTasksByProperty(property.id)
            setTasks(freshTasks)
          }
          setTaskDetailModalOpen(false)
        }}
      />

      {/* Modal de Vincular Proprietário */}
      {property && (
        <LinkOwnerModal
          open={linkOwnerModalOpen}
          onOpenChange={setLinkOwnerModalOpen}
          propertyId={property.id}
          propertyCode={property.code}
          onLinked={async () => {
            await loadData(property.id)
            toast({
              title: 'Proprietário vinculado com sucesso.',
            })
          }}
        />
      )}
    </div>
  )
}
