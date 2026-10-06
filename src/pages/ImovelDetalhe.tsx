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
} from '@/services/properties'
import { formatPhoneNumber, formatDate } from '@/lib/clientUtils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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

// Estilos de badge para cada situação do imóvel
const STATUS_BADGE_VARIANTS: Record<PropertyStatus, { label: string; className: string }> = {
  rascunho: {
    label: PROPERTY_STATUS_LABELS.rascunho,
    className: 'bg-muted text-muted-foreground border-border',
  },
  disponivel: {
    label: PROPERTY_STATUS_LABELS.disponivel,
    className:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  },
  reservado: {
    label: PROPERTY_STATUS_LABELS.reservado,
    className:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
  vendido: {
    label: PROPERTY_STATUS_LABELS.vendido,
    className:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  },
  alugado: {
    label: PROPERTY_STATUS_LABELS.alugado,
    className:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
  },
  inativo: {
    label: PROPERTY_STATUS_LABELS.inativo,
    className:
      'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
  },
}

const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024 // 8 MB

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

    // Valida tipo e tamanho de cada arquivo antes de iniciar qualquer envio
    for (const f of fileList) {
      const ext = f.name.toLowerCase().split('.').pop() || ''
      const isValidExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext)
      const isValidMime = ACCEPTED_MIME_TYPES.includes(f.type)
      if (!isValidExt && !isValidMime) {
        toast({
          title: 'Tipo de arquivo não permitido',
          description: `O arquivo "${f.name}" não é suportado. Formatos aceitos: JPG, PNG ou WebP.`,
          variant: 'destructive',
        })
        return
      }

      if (f.size > MAX_FILE_SIZE_BYTES) {
        toast({
          title: 'Arquivo muito grande',
          description: `O arquivo "${f.name}" ultrapassa o limite de 8 MB.`,
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

  // Formata ação do histórico em português
  const formatHistoryEntry = (item: PropertyHistoryItem) => {
    let actionText = ''

    if (item.action === 'imovel_criado') {
      actionText = 'Imóvel cadastrado'
    } else if (item.action === 'imovel_alterado') {
      const fieldName = item.field ? HISTORY_FIELD_LABELS[item.field] || item.field : ''
      actionText = fieldName ? `Alterou ${fieldName}` : 'Alterou dados'
    } else if (item.action === 'dados_confirmados') {
      actionText = 'Confirmou os dados'
    } else {
      actionText = item.action
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
  const statusInfo = STATUS_BADGE_VARIANTS[property.status] || {
    label: property.status,
    className: 'bg-muted text-muted-foreground',
  }

  const captadorName =
    property.expand?.captured_by?.name || property.expand?.captured_by?.email || 'Não informado'

  // Proprietário: se o usuário tiver acesso (expand.owner_id), mostra nome e telefone formatado;
  // senão mostrar "Proprietário cadastrado"
  const ownerRecord = property.expand?.owner_id
  const hasOwner = Boolean(property.owner_id)

  const showSalePrice = property.purpose === 'venda' || property.purpose === 'ambos'
  const showRentPrice = property.purpose === 'locacao' || property.purpose === 'ambos'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Alerta de aviso (ex: voltou para Rascunho por falta de fotos) */}
      {warningMessage && (
        <div className="flex items-start gap-2 p-4 rounded-lg bg-amber-500/15 text-amber-900 dark:text-amber-200 text-sm border border-amber-500/30 font-medium">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <span>{warningMessage}</span>
        </div>
      )}

      {/* Barra de Navegação Superior e Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/imoveis')}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {property.code}
              </span>
              <Badge
                variant="outline"
                className={`text-xs font-medium border ${statusInfo.className}`}
              >
                {statusInfo.label}
              </Badge>
              {isOutdated && (
                <Badge
                  variant="outline"
                  className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700 gap-1 inline-flex items-center"
                >
                  <Clock className="h-3 w-3" />
                  <span>Desatualizado</span>
                </Badge>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-1">
              {property.title}
            </h1>
          </div>
        </div>

        {/* Botões de Ação do Cabeçalho */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Botão Criar tarefa */}
          <Button
            variant="outline"
            onClick={() => setCreateTaskModalOpen(true)}
            className="gap-1.5 text-xs h-9"
          >
            <Clock className="h-4 w-4" />
            <span>Criar tarefa</span>
          </Button>
          {/* Botão Copiar Ficha: Disponível para admin, sdr e corretor SÓ quando status = disponivel */}
          {property.status === 'disponivel' && (
            <Button
              variant="outline"
              onClick={handleOpenFicha}
              disabled={loadingFicha}
              className="gap-2 text-xs h-9"
            >
              {loadingFicha ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4 text-emerald-600" />
              )}
              <span>Copiar ficha</span>
            </Button>
          )}

          {/* Botão Confirmar dados: só admin e captador */}
          {canManage && (
            <Button
              variant="outline"
              onClick={handleConfirmData}
              disabled={confirming}
              className="gap-2 text-xs h-9"
            >
              {confirming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              )}
              <span>Confirmar dados</span>
            </Button>
          )}

          {/* Botão Editar: só admin e corretor captador */}
          {canManage && (
            <Button asChild className="gap-2 text-xs h-9">
              <Link to={`/imoveis/${property.id}/editar`}>
                <Edit className="h-4 w-4" />
                <span>Editar</span>
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* 1. SEÇÃO: GALERIA DE FOTOS */}
      <Card className="border-border overflow-hidden">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">Galeria de fotos</CardTitle>
                <Badge variant="secondary" className="text-xs font-mono">
                  {photos.length} de 20 fotos
                </Badge>
              </div>
              <CardDescription>A primeira foto é utilizada como capa do imóvel.</CardDescription>
            </div>

            {/* Botão Adicionar Fotos: só admin e captador */}
            {canManage && (
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={isUploading || photos.length >= 20}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || photos.length >= 20}
                  className="gap-2 text-xs"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UploadCloud className="h-4 w-4" />
                  )}
                  <span>Adicionar fotos</span>
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* Aviso quando houver menos de 5 fotos */}
          {photos.length < 5 && (
            <div className="flex items-start gap-2 p-3.5 rounded-lg bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs sm:text-sm border border-amber-500/20 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>Para ficar Disponível o imóvel precisa de pelo menos 5 fotos.</span>
            </div>
          )}

          {/* Progresso de upload quando em andamento */}
          {uploadList.length > 0 && (
            <div className="p-3 rounded-lg border bg-muted/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">Progresso do envio de fotos:</span>
                {isUploading && (
                  <span className="flex items-center gap-1 text-primary">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Enviando...</span>
                  </span>
                )}
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {uploadList.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs p-1.5 rounded bg-background border"
                  >
                    <span className="truncate max-w-[240px] text-foreground font-mono">
                      {item.name}
                    </span>
                    {item.status === 'uploading' && (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        <span>Enviando...</span>
                      </span>
                    )}
                    {item.status === 'done' && (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Concluído</span>
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span
                        className="text-destructive flex items-center gap-1 font-medium truncate max-w-[200px]"
                        title={item.errorMessage}
                      >
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{item.errorMessage || 'Falhou'}</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grade de Fotos */}
          {photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed rounded-lg">
              <UploadCloud className="h-10 w-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium text-foreground">Nenhuma foto cadastrada</p>
              <p className="text-xs text-muted-foreground max-w-xs mt-0.5">
                {canManage
                  ? 'Adicione fotos para apresentar o imóvel no catálogo e viabilizar a situação Disponível.'
                  : 'Nenhuma foto ativa foi adicionada a este imóvel.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {photos.map((photo, index) => {
                const isCover = index === 0
                return (
                  <div
                    key={photo.id}
                    className="group relative aspect-square rounded-lg overflow-hidden border bg-muted"
                  >
                    <img
                      src={getPhotoFileUrl(photo, '300x300')}
                      alt={`Foto ${index + 1} do imóvel`}
                      className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                      onClick={() => setViewingPhotoIndex(index)}
                      loading="lazy"
                    />

                    {/* Etiqueta de Capa na primeira foto */}
                    {isCover && (
                      <div className="absolute top-2 left-2 pointer-events-none">
                        <Badge className="text-[10px] px-1.5 py-0 bg-primary/95 text-primary-foreground shadow-sm font-semibold">
                          Capa
                        </Badge>
                      </div>
                    )}

                    {/* Botão de zoom */}
                    <button
                      type="button"
                      onClick={() => setViewingPhotoIndex(index)}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                      title="Ampliar foto"
                    >
                      <ZoomIn className="h-6 w-6" />
                    </button>

                    {/* Botão de Remover Foto: só admin e captador */}
                    {canManage && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPhotoToDelete(photo)
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground text-destructive shadow-sm transition-colors opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
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
        </CardContent>
      </Card>

      {/* 2. SEÇÃO: DADOS DO IMÓVEL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Identificação e Localização */}
        <Card className="border-border">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <span>Identificação e Localização</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Tipo de imóvel</span>
                <p className="text-sm font-semibold text-foreground">
                  {PROPERTY_TYPE_LABELS[property.property_type] || property.property_type}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Finalidade</span>
                <p className="text-sm font-semibold text-foreground">
                  {PROPERTY_PURPOSE_LABELS[property.purpose] || property.purpose}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t space-y-2">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span>Endereço (Ficha interna)</span>
              </span>

              {/* Endereço completo: rua, número e complemento aparecem SÓ aqui na ficha interna */}
              <div className="p-3 rounded-md bg-muted/40 border space-y-1 text-sm">
                <p className="font-medium text-foreground">
                  {[property.street, property.street_number].filter(Boolean).join(', ') ||
                    'Logradouro não informado'}
                </p>
                {property.complement && (
                  <p className="text-xs text-muted-foreground">
                    Complemento: {property.complement}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {[property.neighborhood, property.city].filter(Boolean).join(' • ') ||
                    'Bairro/Cidade não informados'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Características e Valores */}
        <Card className="border-border">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Características e Valores</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-4">
            {/* Características em badges/ícones */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 rounded-md border bg-muted/30 text-center">
                <div className="flex items-center justify-center text-muted-foreground mb-1">
                  <Bed className="h-4 w-4" />
                </div>
                <p className="text-xs text-muted-foreground">Quartos</p>
                <p className="text-sm font-bold text-foreground">
                  {property.bedrooms !== undefined &&
                  property.bedrooms !== null &&
                  property.bedrooms > 0
                    ? property.bedrooms
                    : '-'}
                </p>
              </div>

              <div className="p-2.5 rounded-md border bg-muted/30 text-center">
                <div className="flex items-center justify-center text-muted-foreground mb-1">
                  <Bath className="h-4 w-4" />
                </div>
                <p className="text-xs text-muted-foreground">Banheiros</p>
                <p className="text-sm font-bold text-foreground">
                  {property.bathrooms !== undefined &&
                  property.bathrooms !== null &&
                  property.bathrooms > 0
                    ? property.bathrooms
                    : '-'}
                </p>
              </div>

              <div className="p-2.5 rounded-md border bg-muted/30 text-center">
                <div className="flex items-center justify-center text-muted-foreground mb-1">
                  <Car className="h-4 w-4" />
                </div>
                <p className="text-xs text-muted-foreground">Vagas</p>
                <p className="text-sm font-bold text-foreground">
                  {property.parking !== undefined &&
                  property.parking !== null &&
                  property.parking > 0
                    ? property.parking
                    : '-'}
                </p>
              </div>

              <div className="p-2.5 rounded-md border bg-muted/30 text-center">
                <div className="flex items-center justify-center text-muted-foreground mb-1">
                  <Maximize className="h-4 w-4" />
                </div>
                <p className="text-xs text-muted-foreground">Área</p>
                <p className="text-sm font-bold text-foreground">
                  {property.area && property.area > 0 ? `${property.area} m²` : '-'}
                </p>
              </div>
            </div>

            {/* Valores financeiros */}
            <div className="pt-3 border-t space-y-2">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-primary" />
                <span>Valores</span>
              </span>

              {property.price_on_request ? (
                <div className="p-3 rounded-md bg-muted/40 border">
                  <Badge variant="outline" className="text-xs font-semibold bg-background">
                    Sob consulta
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    Preço sob consulta direta com a imobiliária.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-md bg-muted/40 border text-xs">
                  {showSalePrice && (
                    <div>
                      <span className="text-muted-foreground">Preço de venda:</span>
                      <p className="font-semibold text-foreground text-sm">
                        {property.sale_price && property.sale_price > 0
                          ? formatCurrencyBRL(property.sale_price)
                          : 'Não informado'}
                      </p>
                    </div>
                  )}

                  {showRentPrice && (
                    <div>
                      <span className="text-muted-foreground">Preço de locação:</span>
                      <p className="font-semibold text-foreground text-sm">
                        {property.rent_price && property.rent_price > 0
                          ? `${formatCurrencyBRL(property.rent_price)}/mês`
                          : 'Não informado'}
                      </p>
                    </div>
                  )}

                  <div>
                    <span className="text-muted-foreground">Condomínio:</span>
                    <p className="font-medium text-foreground">
                      {property.condo_fee && property.condo_fee > 0
                        ? formatCurrencyBRL(property.condo_fee)
                        : 'Não informado'}
                    </p>
                  </div>

                  <div>
                    <span className="text-muted-foreground">IPTU anual:</span>
                    <p className="font-medium text-foreground">
                      {property.iptu && property.iptu > 0
                        ? formatCurrencyBRL(property.iptu)
                        : 'Não informado'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. SEÇÃO: DESCRIÇÃO */}
      <Card className="border-border">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span>Descrição do imóvel</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {property.description ? (
            <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
              {property.description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Nenhuma descrição fornecida para este anúncio.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 4. SEÇÃO: PROPRIETÁRIO E CAPTADOR */}
      <Card className="border-border">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            <span>Proprietário e Captador</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Proprietário */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground">
                Proprietário do imóvel
              </span>
              {ownerRecord ? (
                <div className="p-3 rounded-lg border bg-muted/40 space-y-1">
                  <p className="text-sm font-bold text-foreground">
                    <Link
                      to={`/clientes/${ownerRecord.id}`}
                      className="hover:text-primary hover:underline"
                    >
                      {ownerRecord.name}
                    </Link>
                  </p>
                  {ownerRecord.phone && (
                    <p className="text-xs text-muted-foreground">
                      Telefone: {formatPhoneNumber(ownerRecord.phone)}
                    </p>
                  )}
                  {ownerRecord.email && (
                    <p className="text-xs text-muted-foreground">E-mail: {ownerRecord.email}</p>
                  )}
                </div>
              ) : hasOwner ? (
                <div className="p-3 rounded-lg border bg-muted/40">
                  <p className="text-sm font-semibold text-foreground">Proprietário cadastrado</p>
                  <p className="text-xs text-muted-foreground">
                    Os dados detalhados deste proprietário estão restritos ao responsável ou
                    administrador.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-lg border bg-muted/40 text-xs text-muted-foreground italic">
                  Nenhum cliente proprietário vinculado.
                </div>
              )}
            </div>

            {/* Captador */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Corretor captador</span>
              <div className="p-3 rounded-lg border bg-muted/40 space-y-1">
                <p className="text-sm font-bold text-foreground">{captadorName}</p>
                <p className="text-xs text-muted-foreground">
                  Responsável pelo anúncio e captação inicial.
                </p>
                {property.last_reviewed_at && (
                  <p className="text-[11px] text-muted-foreground pt-1 border-t mt-1">
                    Última revisão de dados: {formatDate(property.last_reviewed_at)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO TAREFAS DO IMÓVEL */}
      <Card className="border-border">
        <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span>Tarefas ({tasks.length})</span>
            </CardTitle>
            <CardDescription>Tarefas operacionais vinculadas a este imóvel</CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCreateTaskModalOpen(true)}
            className="text-xs h-8 gap-1"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Criar tarefa</span>
          </Button>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhuma tarefa vinculada a este imóvel.
            </p>
          ) : (
            <div className="divide-y rounded-md border">
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
                    className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-muted/40 cursor-pointer text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{t.title}</span>
                        {getTaskStatusBadge(t)}
                      </div>
                      <p className="text-muted-foreground">
                        Prazo:{' '}
                        <span className={overdue ? 'text-destructive font-bold' : ''}>
                          {formatTaskDateTimeBahia(t.due_at)}
                        </span>
                        {assignee && (
                          <span>
                            {' '}
                            · Responsável:{' '}
                            <strong className="text-foreground">
                              {assignee.name || assignee.email}
                            </strong>
                          </span>
                        )}
                      </p>
                    </div>
                    {t.status === 'aberta' && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
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
        </CardContent>
      </Card>

      {/* 5. SEÇÃO: HISTÓRICO DE ALTERAÇÕES */}
      <Card className="border-border">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-semibold">Histórico de alterações</CardTitle>
          </div>
          <CardDescription>
            Registros de criação, confirmações e alterações realizadas no imóvel (do mais novo ao
            mais antigo).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {historyItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma alteração registrada até o momento.
            </p>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
              {historyItems.map((item, idx) => {
                const actionLabel = formatHistoryEntry(item)
                return (
                  <div key={idx} className="relative group">
                    {/* Marcador na linha do tempo */}
                    <div className="absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-background bg-primary ring-2 ring-primary/20" />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-foreground">{actionLabel}</span>
                        {item.actor && (
                          <span className="text-[11px] text-muted-foreground">
                            por{' '}
                            <strong className="font-medium text-foreground">{item.actor}</strong>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {formatDate(item.occurred_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
              <Share2 className="h-5 w-5 text-emerald-600" />
              <span>Ficha para WhatsApp</span>
            </DialogTitle>
            <DialogDescription>
              Ficha formatada gerada pelo servidor com as informações públicas do imóvel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="p-3 rounded-md bg-muted/60 border font-sans text-xs whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed select-all">
              {fichaText}
            </div>
            {copiedFicha && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                <span>Ficha copiada. Cole no WhatsApp.</span>
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setFichaModalOpen(false)}>
              Fechar
            </Button>
            <Button onClick={handleCopyFichaAgain} className="gap-2">
              <Copy className="h-4 w-4" />
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
    </div>
  )
}
