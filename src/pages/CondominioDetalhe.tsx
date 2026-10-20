import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  getCondominiumById,
  updateCondominium,
  listCondominiumPhotos,
  uploadCondominiumPhoto,
  setCondominiumPhotoActive,
  listPropertiesByCondominium,
  updateCondominiumPhotosOrder,
  setCondominiumCoverPhoto,
  getCondoPhotoUrl,
  CondominiumRecord,
  CondominiumPhotoRecord,
} from '@/services/condominiums'
import {
  PropertyRecord,
  PROPERTY_TYPE_LABELS,
  PROPERTY_PURPOSE_LABELS,
  formatPropertyPrice,
  formatErrorMessage,
} from '@/services/properties'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Building2,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Upload,
  ImageIcon,
  Home,
  Check,
  PowerOff,
  Power,
  ExternalLink,
  MapPin,
  Sparkles,
  ShieldAlert,
  Trash2,
  Star,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react'
import { deleteCondominium } from '@/services/adminDeletion'
import { DeleteRecordDialog } from '@/components/admin/DeleteRecordDialog'

export default function CondominioDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  // Permissões
  // admin e corretor podem editar e gerenciar fotos
  // sdr só lê
  const canEdit = user?.role === 'admin' || user?.role === 'corretor'

  const [condo, setCondo] = useState<CondominiumRecord | null>(null)
  const [photos, setPhotos] = useState<CondominiumPhotoRecord[]>([])
  const [properties, setProperties] = useState<PropertyRecord[]>([])

  // Modal M15b: Exclusão de condomínio (só admin)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  // Estados do formulário de edição
  const [name, setName] = useState('')
  const [street, setStreet] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [amenities, setAmenities] = useState('')
  const [rules, setRules] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [savingForm, setSavingForm] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  // Upload de fotos
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Reordenação e Capa de Fotos (M28)
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null)
  const [dragOverPhotoId, setDragOverPhotoId] = useState<string | null>(null)
  const [isSavingPhotoAction, setIsSavingPhotoAction] = useState(false)

  const loadAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setPageError(null)
    try {
      const [condoData, photosData, propertiesData] = await Promise.all([
        getCondominiumById(id),
        listCondominiumPhotos(id, false),
        listPropertiesByCondominium(id),
      ])

      setCondo(condoData)
      setPhotos(photosData)
      setProperties(propertiesData)

      // Inicializa os campos do formulário
      setName(condoData.name || '')
      setStreet(condoData.street || '')
      setNeighborhood(condoData.neighborhood || '')
      setCity(condoData.city || '')
      setAmenities(condoData.amenities || '')
      setRules(condoData.rules || '')
      setIsActive(condoData.is_active !== false)
    } catch (err) {
      setPageError(formatErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !canEdit) return

    setNameError(null)
    setFormError(null)
    setFormSuccess(null)

    const trimmedName = name.trim()
    if (trimmedName.length < 2) {
      setNameError('Informe o nome do condomínio.')
      return
    }

    setSavingForm(true)
    try {
      const updated = await updateCondominium(id, {
        name: trimmedName,
        street: street.trim(),
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        amenities: amenities.trim(),
        rules: rules.trim(),
        is_active: isActive,
      })

      setCondo(updated)
      setFormSuccess('Dados do condomínio atualizados com sucesso.')
      setTimeout(() => setFormSuccess(null), 4000)
    } catch (err) {
      const msg = formatErrorMessage(err)
      if (
        msg.toLowerCase().includes('já existe um condomínio com este nome') ||
        msg.toLowerCase().includes('ja existe um condominio com este nome') ||
        msg.toLowerCase().includes('já existe um condomínio')
      ) {
        setNameError('Já existe um condomínio com este nome.')
      } else {
        setFormError(msg)
      }
    } finally {
      setSavingForm(false)
    }
  }

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id || !user) return

    setPhotoError(null)
    const activeCount = photos.filter((p) => p.is_active).length
    if (activeCount >= 10) {
      setPhotoError('Limite de 10 fotos ativas por condomínio atingido.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploadingPhoto(true)
    try {
      await uploadCondominiumPhoto(id, file, user)
      const refreshed = await listCondominiumPhotos(id, false)
      setPhotos(refreshed)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setPhotoError(formatErrorMessage(err))
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleTogglePhotoActive = async (photo: CondominiumPhotoRecord) => {
    if (!canEdit || !id || isSavingPhotoAction) return
    setPhotoError(null)

    const newStatus = !photo.is_active

    // Se estiver reativando, verificar se já tem 10 ativas
    if (newStatus) {
      const activeCount = photos.filter((p) => p.is_active).length
      if (activeCount >= 10) {
        setPhotoError('Limite de 10 fotos ativas por condomínio atingido.')
        return
      }
    }

    try {
      await setCondominiumPhotoActive(photo.id, newStatus)
      const refreshed = await listCondominiumPhotos(id, false)
      setPhotos(refreshed)
      // Se era a capa e foi desativada, recarrega dados do condomínio
      if (condo?.cover_photo_id === photo.id && !newStatus) {
        const freshCondo = await getCondominiumById(id)
        setCondo(freshCondo)
      }
    } catch (err) {
      setPhotoError(formatErrorMessage(err))
    }
  }

  // Ações de Ordem e Capa do Condomínio (M28)
  const handleMovePhoto = async (activePhotoIndex: number, direction: 'up' | 'down') => {
    if (!condo || isSavingPhotoAction || !canEdit) return
    const activePhotosList = photos.filter((p) => p.is_active)
    const targetIndex = direction === 'up' ? activePhotoIndex - 1 : activePhotoIndex + 1
    if (targetIndex < 0 || targetIndex >= activePhotosList.length) return

    const previousPhotos = [...photos]
    const reorderedActive = [...activePhotosList]
    const [moved] = reorderedActive.splice(activePhotoIndex, 1)
    reorderedActive.splice(targetIndex, 0, moved)

    // Recompõe a lista completa mantendo ativas na nova ordem seguidas das inativas
    const inactiveList = photos.filter((p) => !p.is_active)
    const newPhotos = [...reorderedActive, ...inactiveList]

    setPhotos(newPhotos)
    setIsSavingPhotoAction(true)
    setPhotoError(null)

    try {
      await updateCondominiumPhotosOrder(
        condo.id,
        reorderedActive.map((p) => p.id),
      )
    } catch (err: unknown) {
      setPhotos(previousPhotos)
      const msg = err instanceof Error ? err.message : 'Erro ao reordenar fotos.'
      setPhotoError(msg)
    } finally {
      setIsSavingPhotoAction(false)
    }
  }

  const handleDragStart = (e: React.DragEvent, photoId: string) => {
    if (!canEdit || isSavingPhotoAction) return
    setDraggedPhotoId(photoId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', photoId)
  }

  const handleDragOver = (e: React.DragEvent, photoId: string) => {
    if (!canEdit || isSavingPhotoAction) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverPhotoId !== photoId) {
      setDragOverPhotoId(photoId)
    }
  }

  const handleDrop = async (e: React.DragEvent, targetPhotoId: string) => {
    e.preventDefault()
    if (!condo || isSavingPhotoAction || !canEdit) {
      setDraggedPhotoId(null)
      setDragOverPhotoId(null)
      return
    }

    const sourcePhotoId = draggedPhotoId || e.dataTransfer.getData('text/plain')
    setDraggedPhotoId(null)
    setDragOverPhotoId(null)

    if (!sourcePhotoId || sourcePhotoId === targetPhotoId) return

    const activePhotosList = photos.filter((p) => p.is_active)
    const fromIndex = activePhotosList.findIndex((p) => p.id === sourcePhotoId)
    const toIndex = activePhotosList.findIndex((p) => p.id === targetPhotoId)
    if (fromIndex < 0 || toIndex < 0) return

    const previousPhotos = [...photos]
    const reorderedActive = [...activePhotosList]
    const [moved] = reorderedActive.splice(fromIndex, 1)
    reorderedActive.splice(toIndex, 0, moved)

    const inactiveList = photos.filter((p) => !p.is_active)
    const newPhotos = [...reorderedActive, ...inactiveList]

    setPhotos(newPhotos)
    setIsSavingPhotoAction(true)
    setPhotoError(null)

    try {
      await updateCondominiumPhotosOrder(
        condo.id,
        reorderedActive.map((p) => p.id),
      )
    } catch (err: unknown) {
      setPhotos(previousPhotos)
      const msg = err instanceof Error ? err.message : 'Erro ao reordenar fotos.'
      setPhotoError(msg)
    } finally {
      setIsSavingPhotoAction(false)
    }
  }

  const handleSetCover = async (photoId: string) => {
    if (!condo || isSavingPhotoAction || !canEdit) return
    const prevCondo = { ...condo }

    setCondo({ ...condo, cover_photo_id: photoId })
    setIsSavingPhotoAction(true)
    setPhotoError(null)

    try {
      await setCondominiumCoverPhoto(condo.id, photoId)
    } catch (err: unknown) {
      setCondo(prevCondo)
      const msg = err instanceof Error ? err.message : 'Erro ao definir capa.'
      setPhotoError(msg)
    } finally {
      setIsSavingPhotoAction(false)
    }
  }

  const activePhotos = photos.filter((p) => p.is_active)
  const inactivePhotos = photos.filter((p) => !p.is_active)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-xs">Carregando ficha do condomínio...</span>
      </div>
    )
  }

  if (pageError || !condo) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/condominios')}
          className="rounded-full gap-2 border-border text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Voltar para lista</span>
        </Button>
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20 font-normal">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{pageError || 'Condomínio não encontrado.'}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Barra superior de navegação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/condominios')}
            className="h-9 w-9 rounded-full p-0 border-border shrink-0"
            title="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-normal text-foreground tracking-tight">
                {condo.name}
              </h1>
              {condo.is_active === false ? (
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
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>
                {[condo.street, condo.neighborhood, condo.city].filter(Boolean).join(', ') ||
                  'Endereço não cadastrado'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-muted-foreground tabular">
            <span className="font-medium text-foreground">{properties.length}</span>{' '}
            {properties.length === 1 ? 'imóvel vinculado' : 'imóveis vinculados'}
          </div>

          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              className="h-9 rounded-full px-4 text-xs font-normal border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Excluir</span>
            </Button>
          )}
        </div>
      </div>

      {/* SEÇÃO 1: Dados Cadastrais Editáveis */}
      <div className="border border-border rounded-lg p-5 sm:p-6 bg-card space-y-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground">Dados cadastrais</h2>
          </div>
          {!canEdit && (
            <span className="text-[11px] eyebrow text-muted-foreground">Somente leitura</span>
          )}
        </div>

        <form onSubmit={handleSaveForm} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 font-normal">
              {formError}
            </div>
          )}

          {formSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs border border-emerald-500/20 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="condo-edit-name" className="text-xs eyebrow text-muted-foreground">
                Nome do condomínio <span className="text-destructive">*</span>
              </Label>
              <Input
                id="condo-edit-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (nameError) setNameError(null)
                }}
                disabled={!canEdit || savingForm}
                required
                maxLength={120}
                className={`h-11 text-sm border-border ${
                  nameError ? 'border-destructive focus-visible:ring-destructive' : ''
                }`}
              />
              {nameError && (
                <p className="text-xs text-destructive font-normal mt-1">{nameError}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="condo-edit-street" className="text-xs eyebrow text-muted-foreground">
                Endereço / Logradouro
              </Label>
              <Input
                id="condo-edit-street"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                disabled={!canEdit || savingForm}
                placeholder="Rua, Av., etc."
                maxLength={160}
                className="h-11 text-sm border-border"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="condo-edit-neighborhood"
                  className="text-xs eyebrow text-muted-foreground"
                >
                  Bairro
                </Label>
                <Input
                  id="condo-edit-neighborhood"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  disabled={!canEdit || savingForm}
                  maxLength={80}
                  className="h-11 text-sm border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="condo-edit-city" className="text-xs eyebrow text-muted-foreground">
                  Cidade
                </Label>
                <Input
                  id="condo-edit-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={!canEdit || savingForm}
                  maxLength={80}
                  className="h-11 text-sm border-border"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="condo-edit-amenities"
                  className="text-xs eyebrow text-muted-foreground"
                >
                  Itens de lazer
                </Label>
                <span className="text-[11px] text-muted-foreground">um por linha</span>
              </div>
              <Textarea
                id="condo-edit-amenities"
                value={amenities}
                onChange={(e) => setAmenities(e.target.value)}
                disabled={!canEdit || savingForm}
                rows={4}
                maxLength={2000}
                className="text-sm border-border resize-y font-normal"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="condo-edit-rules" className="text-xs eyebrow text-muted-foreground">
                Regras e observações
              </Label>
              <Textarea
                id="condo-edit-rules"
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                disabled={!canEdit || savingForm}
                rows={4}
                maxLength={2000}
                className="text-sm border-border resize-y font-normal"
              />
            </div>
          </div>

          {canEdit && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-border">
              <div className="flex items-center gap-3">
                <Switch
                  id="condo-is-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  disabled={savingForm}
                />
                <Label
                  htmlFor="condo-is-active"
                  className="text-xs font-normal text-foreground cursor-pointer"
                >
                  Condomínio ativo no sistema
                </Label>
              </div>

              <Button
                type="submit"
                disabled={savingForm}
                className="h-9 rounded-full px-5 text-xs font-normal bg-primary text-primary-foreground gap-1.5 self-end sm:self-auto"
              >
                {savingForm ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Salvar alterações</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </form>
      </div>

      {/* SEÇÃO 2: Galeria de Fotos com Upload, Reordenação e Capa (M28) */}
      <div className="border border-border rounded-lg p-5 sm:p-6 bg-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium text-foreground">Galeria de fotos</h2>
              <span className="text-xs tabular text-muted-foreground">
                ({activePhotos.length}/10 ativas)
              </span>
              {isSavingPhotoAction && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Salvando...</span>
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Arraste para mudar a ordem, ou use as setas. A capa é a foto marcada; sem escolha, é a
              primeira.
            </p>
            {condo.cover_photo_id && canEdit && (
              <button
                type="button"
                onClick={() => handleSetCover('')}
                disabled={isSavingPhotoAction}
                className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 mt-1 disabled:opacity-50"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Voltar ao padrão (primeira foto)</span>
              </button>
            )}
          </div>

          {canEdit && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadPhoto}
                className="hidden"
                id="condo-photo-upload"
                disabled={uploadingPhoto || isSavingPhotoAction || activePhotos.length >= 10}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto || isSavingPhotoAction || activePhotos.length >= 10}
                className="h-9 rounded-full px-4 text-xs font-normal border-border gap-1.5"
              >
                {uploadingPhoto ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Enviando foto...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    <span>Adicionar foto</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {photoError && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 font-normal">
            {photoError}
          </div>
        )}

        {photos.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-border rounded-lg space-y-2">
            <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground opacity-40" />
            <p className="text-xs text-muted-foreground">
              Nenhuma foto enviada para este condomínio ainda.
            </p>
            {canEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full text-xs font-normal mt-1 border-border"
              >
                Selecionar primeira foto
              </Button>
            )}
          </div>
        ) : (
          (() => {
            const effectiveCoverId =
              condo.cover_photo_id && activePhotos.some((p) => p.id === condo.cover_photo_id)
                ? condo.cover_photo_id
                : activePhotos[0]?.id

            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {photos.map((photo) => {
                  const url = getCondoPhotoUrl(photo, '300x200')
                  const fullUrl = getCondoPhotoUrl(photo)
                  const isCover = photo.is_active && photo.id === effectiveCoverId
                  const activeIndex = photo.is_active
                    ? activePhotos.findIndex((p) => p.id === photo.id)
                    : -1
                  const isBeingDragged = draggedPhotoId === photo.id
                  const isDropTarget = dragOverPhotoId === photo.id && draggedPhotoId !== photo.id

                  return (
                    <div
                      key={photo.id}
                      draggable={canEdit && photo.is_active && !isSavingPhotoAction}
                      onDragStart={(e) => handleDragStart(e, photo.id)}
                      onDragOver={(e) => {
                        if (photo.is_active) handleDragOver(e, photo.id)
                      }}
                      onDragLeave={() => {
                        if (dragOverPhotoId === photo.id) setDragOverPhotoId(null)
                      }}
                      onDrop={(e) => {
                        if (photo.is_active) handleDrop(e, photo.id)
                      }}
                      className={`group relative rounded-lg border overflow-hidden bg-muted flex flex-col transition-all ${
                        !photo.is_active ? 'opacity-50 grayscale border-border' : ''
                      } ${
                        isDropTarget
                          ? 'border-primary ring-2 ring-primary/50 scale-[1.02]'
                          : 'border-border'
                      } ${isBeingDragged ? 'opacity-30 scale-95' : ''}`}
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden">
                        <a
                          href={fullUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block w-full h-full"
                        >
                          <img
                            src={url}
                            alt="Foto do condomínio"
                            className="w-full h-full object-cover transition-transform group-hover:scale-105 pointer-events-none"
                            loading="lazy"
                          />
                        </a>

                        {/* Selo Capa */}
                        {isCover && (
                          <div className="absolute top-2 left-2 z-10 pointer-events-none">
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-foreground bg-background/95 rounded-[4px] px-1.5 py-0.5 border border-border shadow-xs">
                              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                              <span>Capa</span>
                            </span>
                          </div>
                        )}

                        {/* Posição discreta para foto ativa */}
                        {photo.is_active && activeIndex >= 0 && (
                          <div className="absolute bottom-1.5 left-1.5 z-10 pointer-events-none">
                            <span className="text-[10px] tabular px-1.5 py-0.2 rounded bg-black/60 text-white font-mono">
                              #{activeIndex + 1}
                            </span>
                          </div>
                        )}

                        {/* Controles para foto ativa */}
                        {canEdit && photo.is_active && (
                          <>
                            {/* Botão Tornar Capa */}
                            {!isCover && (
                              <div className="absolute top-2 left-2 z-20 opacity-95 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    handleSetCover(photo.id)
                                  }}
                                  disabled={isSavingPhotoAction}
                                  className="p-1 rounded-md bg-background/90 hover:bg-background text-foreground border border-border text-[10px] shadow-xs flex items-center gap-1 disabled:opacity-40"
                                  title="Tornar capa"
                                  aria-label="Tornar capa"
                                >
                                  <Star className="h-3 w-3 text-amber-500" />
                                  <span className="hidden sm:inline">Capa</span>
                                </button>
                              </div>
                            )}

                            {/* Setas Subir e Descer */}
                            <div className="absolute bottom-1.5 right-1.5 z-20 flex items-center gap-0.5 opacity-95 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              {activeIndex > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    handleMovePhoto(activeIndex, 'up')
                                  }}
                                  disabled={isSavingPhotoAction}
                                  className="p-1 rounded bg-background/90 hover:bg-background text-foreground border border-border shadow-xs disabled:opacity-40"
                                  title="Subir posição"
                                  aria-label="Subir posição"
                                >
                                  <ChevronLeft className="h-3 w-3" />
                                </button>
                              )}
                              {activeIndex < activePhotos.length - 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    handleMovePhoto(activeIndex, 'down')
                                  }}
                                  disabled={isSavingPhotoAction}
                                  className="p-1 rounded bg-background/90 hover:bg-background text-foreground border border-border shadow-xs disabled:opacity-40"
                                  title="Descer posição"
                                  aria-label="Descer posição"
                                >
                                  <ChevronRight className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="p-2 bg-card border-t border-border flex items-center justify-between gap-1">
                        <span className="text-[10px] tabular text-muted-foreground truncate">
                          {photo.is_active ? (
                            <span className="text-emerald-700 dark:text-emerald-400">Ativa</span>
                          ) : (
                            <span className="text-zinc-500">Desativada</span>
                          )}
                        </span>

                        {canEdit && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTogglePhotoActive(photo)}
                            disabled={isSavingPhotoAction}
                            className="h-7 px-2 text-[11px] font-normal hover:bg-muted"
                            title={photo.is_active ? 'Desativar foto' : 'Reativar foto'}
                          >
                            {photo.is_active ? (
                              <span className="text-destructive flex items-center gap-1">
                                <PowerOff className="h-3 w-3" />
                                <span>Desativar</span>
                              </span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <Power className="h-3 w-3" />
                                <span>Reativar</span>
                              </span>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()
        )}
      </div>

      {/* SEÇÃO 3: Imóveis do Condomínio com Links */}
      <div className="border border-border rounded-lg p-5 sm:p-6 bg-card space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Home className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground">Imóveis neste condomínio</h2>
            <Badge variant="outline" className="text-[10px] font-normal tabular">
              {properties.length}
            </Badge>
          </div>
        </div>

        {properties.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-border rounded-lg space-y-2">
            <Home className="h-8 w-8 mx-auto text-muted-foreground opacity-40" />
            <p className="text-xs text-muted-foreground">
              Nenhum imóvel vinculado a este condomínio até o momento.
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-24">Código</TableHead>
                  <TableHead>Título / Complemento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Finalidade</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-20 text-center">Situação</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.map((prop) => {
                  const typeLabel =
                    PROPERTY_TYPE_LABELS[prop.property_type as keyof typeof PROPERTY_TYPE_LABELS] ||
                    prop.property_type
                  const purposeLabel =
                    PROPERTY_PURPOSE_LABELS[prop.purpose as keyof typeof PROPERTY_PURPOSE_LABELS] ||
                    prop.purpose
                  const priceFormatted = formatPropertyPrice(prop)

                  return (
                    <TableRow
                      key={prop.id}
                      onClick={() => navigate(`/imoveis/${prop.id}`)}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="font-mono text-xs text-foreground font-medium">
                        {prop.code}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground truncate max-w-xs">
                          {prop.title || prop.street || 'Imóvel sem título'}
                        </div>
                        {prop.complement && (
                          <div className="text-[11px] text-muted-foreground truncate">
                            {prop.complement}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{typeLabel}</TableCell>
                      <TableCell className="text-muted-foreground">{purposeLabel}</TableCell>
                      <TableCell className="text-right tabular font-medium text-foreground">
                        {priceFormatted}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-[10px] font-normal capitalize">
                          {prop.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          to={`/imoveis/${prop.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground hover:text-foreground inline-flex items-center"
                          title="Abrir imóvel"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* MODAL M15b: EXCLUSÃO DE CONDOMÍNIO */}
      {condo && isAdmin && (
        <DeleteRecordDialog
          type="condominio"
          recordId={condo.id}
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onDelete={async () => {
            await deleteCondominium(condo.id)
          }}
          onDeleted={() => {
            navigate('/condominios', { state: { successMessage: 'Condomínio excluído.' } })
          }}
        />
      )}
    </div>
  )
}
