import { useState, useEffect, useCallback, useRef } from 'react'
import { ConfigSidebar } from '@/components/ConfigSidebar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
  getAdminSite,
  updateAdminSiteSettings,
  uploadSiteAsset,
  createSitePreview,
  publishSite,
  undoSitePublication,
  resolveAssetUrl,
  formatSiteErrorMessage,
  type SiteSettings,
  type SiteLink,
} from '@/services/site'
import {
  Globe,
  Palette,
  FileText,
  Link2,
  ExternalLink,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Upload,
  Plus,
  Trash2,
  Smartphone,
  Monitor,
  RotateCcw,
  Send,
  HelpCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024

interface ProcessedImageResult {
  file: File
  blob: Blob
  fileName: string
  fallbackToJpeg: boolean
}

/**
 * Reencoda a imagem em canvas para WebP ou JPEG para remover EXIF/GPS e compatibilizar formato.
 * - Safari não gera WebP pelo canvas (devolve PNG silenciosamente); faz fallback para JPEG com fundo branco.
 * - Valida tipo retornado (somente image/webp ou image/jpeg).
 * - Se passar de 3 MB, reduz qualidade em passos antes de falhar.
 * - Retorna o File com nome e MIME type reais correspondentes ao blob exportado.
 */
async function processAndSanitizeImage(file: File): Promise<ProcessedImageResult> {
  const allowed = ['image/jpeg', 'image/jpg', 'image/webp', 'image/png']
  if (!allowed.includes(file.type.toLowerCase())) {
    throw new Error('Formato inválido. Apenas imagens JPEG ou WebP são aceitas.')
  }

  const cleanBase = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'imagem'

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo selecionado.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Falha ao carregar a imagem selecionada.'))
      img.onload = async () => {
        const width = img.naturalWidth || img.width
        const height = img.naturalHeight || img.height

        const renderToCanvas = (withWhiteBackground: boolean): HTMLCanvasElement | null => {
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) return null
          if (withWhiteBackground) {
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, width, height)
          }
          ctx.drawImage(img, 0, 0, width, height)
          return canvas
        }

        const getCanvasBlob = (
          canvas: HTMLCanvasElement,
          type: string,
          quality: number,
        ): Promise<Blob | null> => {
          return new Promise((res) => {
            canvas.toBlob((b) => res(b), type, quality)
          })
        }

        try {
          // 1. Tentar inicialmente exportar como WebP mantendo transparência (sem fundo branco)
          const transparentCanvas = renderToCanvas(false)
          if (!transparentCanvas) {
            reject(new Error('Não foi possível inicializar o processador de imagem.'))
            return
          }

          let initialBlob = await getCanvasBlob(transparentCanvas, 'image/webp', 0.92)

          // 2. Se o navegador não devolveu image/webp (ex.: Safari que devolve image/png),
          // faz fallback para JPEG com fundo branco
          let finalBlob: Blob | null = null
          let fallbackToJpeg = false

          if (initialBlob && initialBlob.type === 'image/webp') {
            // WebP suportado nativamente
            finalBlob = initialBlob
            // Se passar de 3 MB em WebP, tenta passos de compressão 0.85 e 0.75
            if (finalBlob.size > MAX_IMAGE_SIZE_BYTES) {
              const lower1 = await getCanvasBlob(transparentCanvas, 'image/webp', 0.85)
              if (lower1 && lower1.type === 'image/webp' && lower1.size <= MAX_IMAGE_SIZE_BYTES) {
                finalBlob = lower1
              } else {
                const lower2 = await getCanvasBlob(transparentCanvas, 'image/webp', 0.75)
                if (lower2 && lower2.type === 'image/webp' && lower2.size <= MAX_IMAGE_SIZE_BYTES) {
                  finalBlob = lower2
                }
              }
            }
          } else {
            // Fallback para JPEG com fundo branco
            fallbackToJpeg = true
            const whiteCanvas = renderToCanvas(true)
            if (!whiteCanvas) {
              reject(new Error('Não foi possível inicializar o processador de imagem.'))
              return
            }

            let jpegBlob = await getCanvasBlob(whiteCanvas, 'image/jpeg', 0.92)
            if (jpegBlob && jpegBlob.size > MAX_IMAGE_SIZE_BYTES) {
              const jpegLower1 = await getCanvasBlob(whiteCanvas, 'image/jpeg', 0.85)
              if (jpegLower1 && jpegLower1.size <= MAX_IMAGE_SIZE_BYTES) {
                jpegBlob = jpegLower1
              } else {
                const jpegLower2 = await getCanvasBlob(whiteCanvas, 'image/jpeg', 0.75)
                if (jpegLower2 && jpegLower2.size <= MAX_IMAGE_SIZE_BYTES) {
                  jpegBlob = jpegLower2
                }
              }
            }
            finalBlob = jpegBlob
          }

          if (!finalBlob) {
            reject(new Error('Falha ao reencodar a imagem.'))
            return
          }

          // 3. Checagem do tipo real retornado pelo blob
          if (finalBlob.type !== 'image/webp' && finalBlob.type !== 'image/jpeg') {
            reject(
              new Error('Não foi possível preparar a imagem neste navegador. Tente no Chrome.'),
            )
            return
          }

          // 4. Checagem final de tamanho (3 MB)
          if (finalBlob.size > MAX_IMAGE_SIZE_BYTES) {
            reject(
              new Error(
                `O arquivo tem ${(finalBlob.size / (1024 * 1024)).toFixed(1)} MB. O limite máximo é de 3 MB após processamento.`,
              ),
            )
            return
          }

          // 5. Montar o File com extensão e tipo reais derivados de finalBlob.type
          const ext = finalBlob.type === 'image/webp' ? '.webp' : '.jpg'
          const finalFileName = `${cleanBase}${ext}`
          const finalFile = new File([finalBlob], finalFileName, { type: finalBlob.type })

          resolve({
            file: finalFile,
            blob: finalBlob,
            fileName: finalFileName,
            fallbackToJpeg,
          })
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Falha ao processar a imagem.'))
        }
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color.trim())
}

function isValidHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export default function Site() {
  const [loading, setLoading] = useState(true)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [draftSaved, setDraftSaved] = useState(false)
  const [lastSavedMessage, setLastSavedMessage] = useState<string | null>(null)

  // Estatísticas do site
  const [activeVersion, setActiveVersion] = useState<number>(0)
  const [totalPublications, setTotalPublications] = useState<number>(0)

  // Configurações salvas (servidor)
  const [settings, setSettings] = useState<SiteSettings>({
    about_title: '',
    about_text: '',
    address: '',
    hours: '',
    phone: '',
    email: '',
    instagram: '',
    whatsapp: '',
    links: [],
    primary_color: '#1a73e8',
    logo_asset_id: '',
    favicon_asset_id: '',
    logo_url: '',
    favicon_url: '',
  })

  // Formulário: Marca
  const [primaryColor, setPrimaryColor] = useState('#1a73e8')
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string>('')
  const [faviconPreviewUrl, setFaviconPreviewUrl] = useState<string>('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)
  const [savingMarca, setSavingMarca] = useState(false)
  const [marcaError, setMarcaError] = useState<string | null>(null)
  const [marcaWarning, setMarcaWarning] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const faviconInputRef = useRef<HTMLInputElement>(null)

  // Formulário: Textos
  const [aboutTitle, setAboutTitle] = useState('')
  const [aboutText, setAboutText] = useState('')
  const [address, setAddress] = useState('')
  const [hours, setHours] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [savingTextos, setSavingTextos] = useState(false)
  const [textosError, setTextosError] = useState<string | null>(null)

  // Formulário: Links
  const [instagram, setInstagram] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [linksList, setLinksList] = useState<SiteLink[]>([])
  const [savingLinks, setSavingLinks] = useState(false)
  const [linksError, setLinksError] = useState<string | null>(null)

  // Aba Prévia e Publicar
  const [customSiteUrl, setCustomSiteUrl] = useState<string>(import.meta.env.VITE_SITE_URL || '')
  const [previewToken, setPreviewToken] = useState<string | null>(null)
  const [previewExpiresAt, setPreviewExpiresAt] = useState<string | null>(null)
  const [generatingPreview, setGeneratingPreview] = useState(false)
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop')
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Ações de Publicar e Desfazer
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [undoDialogOpen, setUndoDialogOpen] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const [publishFeedback, setPublishFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const showDraftSavedBadge = (customText = 'Rascunho salvo') => {
    setDraftSaved(true)
    setLastSavedMessage(customText)
    setTimeout(() => {
      setDraftSaved(false)
    }, 3500)
  }

  const loadSiteData = useCallback(async () => {
    setLoading(true)
    setGlobalError(null)
    try {
      const data = await getAdminSite()
      const s = data.settings || ({} as SiteSettings)
      setSettings(s)
      setActiveVersion(data.versao_ativa || 0)
      setTotalPublications(data.publicacoes || 0)

      // Popula Marca
      const color =
        s.primary_color && isValidHexColor(s.primary_color) ? s.primary_color : '#1a73e8'
      setPrimaryColor(color)
      setLogoPreviewUrl(resolveAssetUrl(s.logo_url))
      setFaviconPreviewUrl(resolveAssetUrl(s.favicon_url))

      // Popula Textos
      setAboutTitle(s.about_title || '')
      setAboutText(s.about_text || '')
      setAddress(s.address || '')
      setHours(s.hours || '')
      setPhone(s.phone || '')
      setEmail(s.email || '')

      // Popula Links
      setInstagram(s.instagram || '')
      setWhatsapp(s.whatsapp || '')
      setLinksList(
        Array.isArray(s.links)
          ? s.links.map((l) => ({ label: l.label || '', url: l.url || '' }))
          : [],
      )
    } catch (err) {
      setGlobalError(
        formatSiteErrorMessage(
          err,
          'Erro ao carregar configurações do site. Tente novamente mais tarde.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSiteData()
  }, [loadSiteData])

  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS: MARCA
  // ═══════════════════════════════════════════════════════════════════════
  const JPEG_FALLBACK_NOTICE =
    'Seu navegador não gera WebP; a imagem foi convertida para JPEG com fundo branco (sem transparência). Para manter o fundo transparente, envie pelo Chrome.'

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMarcaError(null)
    setMarcaWarning(null)
    setUploadingLogo(true)

    try {
      const sanitized = await processAndSanitizeImage(file)

      // Checar se o arquivo final é image/jpeg ou image/webp
      if (sanitized.file.type !== 'image/jpeg' && sanitized.file.type !== 'image/webp') {
        throw new Error('Não foi possível preparar a imagem neste navegador. Tente no Chrome.')
      }

      const uploaded = await uploadSiteAsset(sanitized.file, 'logo', sanitized.fileName)
      // Atualiza o rascunho com o novo logo_asset_id
      const res = await updateAdminSiteSettings({ logo_asset_id: uploaded.id })
      setSettings(res.settings)
      setLogoPreviewUrl(resolveAssetUrl(uploaded.url || res.settings.logo_url))
      showDraftSavedBadge('Logo atualizado no rascunho')

      if (sanitized.fallbackToJpeg) {
        setMarcaWarning(JPEG_FALLBACK_NOTICE)
      }
    } catch (err) {
      setMarcaError(formatSiteErrorMessage(err, 'Erro ao enviar o logo.'))
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  const handleUploadFavicon = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMarcaError(null)
    setMarcaWarning(null)
    setUploadingFavicon(true)

    try {
      const sanitized = await processAndSanitizeImage(file)

      // Checar se o arquivo final é image/jpeg ou image/webp
      if (sanitized.file.type !== 'image/jpeg' && sanitized.file.type !== 'image/webp') {
        throw new Error('Não foi possível preparar a imagem neste navegador. Tente no Chrome.')
      }

      const uploaded = await uploadSiteAsset(sanitized.file, 'favicon', sanitized.fileName)
      // Atualiza o rascunho com o novo favicon_asset_id
      const res = await updateAdminSiteSettings({ favicon_asset_id: uploaded.id })
      setSettings(res.settings)
      setFaviconPreviewUrl(resolveAssetUrl(uploaded.url || res.settings.favicon_url))
      showDraftSavedBadge('Favicon atualizado no rascunho')

      if (sanitized.fallbackToJpeg) {
        setMarcaWarning(JPEG_FALLBACK_NOTICE)
      }
    } catch (err) {
      setMarcaError(formatSiteErrorMessage(err, 'Erro ao enviar o favicon.'))
    } finally {
      setUploadingFavicon(false)
      if (faviconInputRef.current) faviconInputRef.current.value = ''
    }
  }

  const handleSaveMarca = async (e: React.FormEvent) => {
    e.preventDefault()
    setMarcaError(null)

    const normalizedColor = primaryColor.trim().toUpperCase()
    if (!isValidHexColor(normalizedColor)) {
      setMarcaError('Cor inválida. Use o formato hexadecimal #RRGGBB (ex.: #1A73E8).')
      return
    }

    setSavingMarca(true)
    try {
      const res = await updateAdminSiteSettings({
        primary_color: normalizedColor,
      })
      setSettings(res.settings)
      setPrimaryColor(res.settings.primary_color || normalizedColor)
      showDraftSavedBadge('Cor da ação principal salva no rascunho')
    } catch (err) {
      setMarcaError(formatSiteErrorMessage(err, 'Erro ao salvar marca.'))
    } finally {
      setSavingMarca(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS: TEXTOS
  // ═══════════════════════════════════════════════════════════════════════
  const handleSaveTextos = async (e: React.FormEvent) => {
    e.preventDefault()
    setTextosError(null)

    if (aboutText.length > 2000) {
      setTextosError('O texto "Sobre a imobiliária" não pode ter mais de 2000 caracteres.')
      return
    }

    setSavingTextos(true)
    try {
      const res = await updateAdminSiteSettings({
        about_title: aboutTitle.trim(),
        about_text: aboutText,
        address: address.trim(),
        hours: hours.trim(),
        phone: phone.trim(),
        email: email.trim(),
      })
      setSettings(res.settings)
      showDraftSavedBadge('Textos salvos no rascunho')
    } catch (err) {
      setTextosError(formatSiteErrorMessage(err, 'Erro ao salvar textos.'))
    } finally {
      setSavingTextos(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS: LINKS
  // ═══════════════════════════════════════════════════════════════════════
  const handleAddLink = () => {
    if (linksList.length >= 10) return
    setLinksList((prev) => [...prev, { label: '', url: 'https://' }])
  }

  const handleRemoveLink = (index: number) => {
    setLinksList((prev) => prev.filter((_, i) => i !== index))
  }

  const handleLinkChange = (index: number, field: 'label' | 'url', val: string) => {
    setLinksList((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: val } : item)))
  }

  const handleSaveLinks = async (e: React.FormEvent) => {
    e.preventDefault()
    setLinksError(null)

    const trimmedInstagram = instagram.trim()
    if (trimmedInstagram && !isValidHttpsUrl(trimmedInstagram)) {
      setLinksError(
        'O endereço do Instagram deve iniciar com https:// (ex.: https://instagram.com/sua_imobiliaria).',
      )
      return
    }

    const trimmedWhatsapp = whatsapp.trim()
    if (trimmedWhatsapp && !isValidHttpsUrl(trimmedWhatsapp)) {
      setLinksError(
        'O endereço do WhatsApp deve iniciar com https:// (ex.: https://wa.me/5575999990000).',
      )
      return
    }

    if (linksList.length > 10) {
      setLinksError('São permitidos no máximo 10 links do rodapé.')
      return
    }

    for (let i = 0; i < linksList.length; i++) {
      const l = linksList[i]
      const trimmedUrl = l.url.trim()
      const trimmedLabel = l.label.trim()
      if (!trimmedLabel) {
        setLinksError(`O link #${i + 1} precisa ter um nome.`)
        return
      }
      if (!trimmedUrl || !isValidHttpsUrl(trimmedUrl)) {
        setLinksError(`O endereço do link "${trimmedLabel}" deve começar com https://`)
        return
      }
    }

    const cleanedLinks = linksList.map((l) => ({
      label: l.label.trim(),
      url: l.url.trim(),
    }))

    setSavingLinks(true)
    try {
      const res = await updateAdminSiteSettings({
        instagram: trimmedInstagram,
        whatsapp: trimmedWhatsapp,
        links: cleanedLinks,
      })
      setSettings(res.settings)
      setInstagram(res.settings.instagram || '')
      setWhatsapp(res.settings.whatsapp || '')
      setLinksList(res.settings.links || [])
      showDraftSavedBadge('Links salvos no rascunho')
    } catch (err) {
      setLinksError(formatSiteErrorMessage(err, 'Erro ao salvar links.'))
    } finally {
      setSavingLinks(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS: PRÉVIA E PUBLICAR
  // ═══════════════════════════════════════════════════════════════════════
  const handleGeneratePreview = async () => {
    setPreviewError(null)
    setGeneratingPreview(true)
    try {
      const res = await createSitePreview()
      setPreviewToken(res.token)
      setPreviewExpiresAt(res.expires_at)
    } catch (err) {
      setPreviewError(formatSiteErrorMessage(err, 'Erro ao gerar o token de prévia.'))
    } finally {
      setGeneratingPreview(false)
    }
  }

  const handleConfirmPublish = async () => {
    setPublishing(true)
    setPublishFeedback(null)
    try {
      const res = await publishSite()
      setPublishFeedback({
        type: 'success',
        message: `Versão ${res.version} publicada com sucesso. As mudanças estão públicas no site.`,
      })
      setActiveVersion(res.version)
      setTotalPublications((prev) => prev + 1)
      setPublishDialogOpen(false)
    } catch (err) {
      setPublishFeedback({
        type: 'error',
        message: formatSiteErrorMessage(err, 'Erro ao publicar o site.'),
      })
      setPublishDialogOpen(false)
    } finally {
      setPublishing(false)
    }
  }

  const handleConfirmUndo = async () => {
    setUndoing(true)
    setPublishFeedback(null)
    try {
      const res = await undoSitePublication()
      setPublishFeedback({
        type: 'success',
        message: `Publicação desfeita com sucesso. A versão ativa agora é a ${res.version}.`,
      })
      setActiveVersion(res.version)
      setUndoDialogOpen(false)
      // Recarrega configurações do backend para atualizar telas
      await loadSiteData()
    } catch (err) {
      setPublishFeedback({
        type: 'error',
        message: formatSiteErrorMessage(err, 'Erro ao desfazer publicação.'),
      })
      setUndoDialogOpen(false)
    } finally {
      setUndoing(false)
    }
  }

  // Montagem do endereço do iframe
  const computeIframeSrc = (): string => {
    if (!previewToken) return ''
    const base = (customSiteUrl || '').trim().replace(/\/+$/, '')
    if (!base) return ''
    const separator = base.includes('?') ? '&' : '?'
    return `${base}${separator}preview=${encodeURIComponent(previewToken)}`
  }

  const iframeSrc = computeIframeSrc()

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold font-sans tracking-tight text-foreground">
              Site
            </h1>
            <Badge variant="outline" className="font-sans text-xs">
              Administração
            </Badge>
          </div>
          <p className="text-sm font-sans text-muted-foreground mt-0.5">
            Edite as configurações do rascunho do site público da Amorbiliário e publique quando
            estiver pronto.
          </p>
        </div>

        {/* Indicadores de status da versão */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-sans">
          <span className="px-2.5 py-1 rounded-md bg-muted text-foreground border border-border">
            Versão ativa:{' '}
            <strong className="font-semibold">
              {activeVersion > 0 ? `v${activeVersion}` : 'Nenhuma'}
            </strong>
          </span>
          <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground border border-border">
            Total de publicações: <strong className="text-foreground">{totalPublications}</strong>
          </span>
        </div>
      </div>

      {/* Aviso fixo no topo */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs font-sans text-amber-800 dark:text-amber-200 flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-medium">As mudanças só aparecem no site depois de Publicar.</p>
          <p className="text-amber-700/90 dark:text-amber-300/80 text-[11px]">
            Qualquer alteração feita nas abas abaixo é salva automaticamente como rascunho interno.
            Para tornar as mudanças visíveis ao público, acesse a aba "Prévia e publicar".
          </p>
        </div>
      </div>

      {/* Indicador de rascunho salvo */}
      {draftSaved && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs rounded-md font-sans flex items-center gap-2 transition-all">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="font-medium">{lastSavedMessage || 'Rascunho salvo'}</span>
        </div>
      )}

      {/* Alerta de erro global */}
      {globalError && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 text-destructive text-xs rounded-md font-sans flex items-center justify-between gap-2">
          <span>{globalError}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={loadSiteData}
            className="h-7 text-xs font-sans"
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Mensagem de sucesso ou erro de publicação */}
      {publishFeedback && (
        <div
          className={cn(
            'p-3 text-xs rounded-md font-sans flex items-center justify-between gap-2 border',
            publishFeedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-destructive/10 border-destructive/30 text-destructive',
          )}
        >
          <span>{publishFeedback.message}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPublishFeedback(null)}
            className="h-7 text-xs font-sans"
          >
            Fechar
          </Button>
        </div>
      )}

      {/* Layout principal com ConfigSidebar */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <ConfigSidebar currentSection="site" />

        <div className="flex-1 w-full min-w-0">
          {loading ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center space-y-3">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
              <p className="text-xs font-sans text-muted-foreground">
                Carregando configurações do site...
              </p>
            </div>
          ) : (
            <Tabs defaultValue="marca" className="w-full space-y-6">
              <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto p-1 bg-muted/60">
                <TabsTrigger value="marca" className="text-xs sm:text-sm font-sans py-2">
                  <Palette className="h-3.5 w-3.5 mr-1.5" />
                  Marca
                </TabsTrigger>
                <TabsTrigger value="textos" className="text-xs sm:text-sm font-sans py-2">
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Textos
                </TabsTrigger>
                <TabsTrigger value="links" className="text-xs sm:text-sm font-sans py-2">
                  <Link2 className="h-3.5 w-3.5 mr-1.5" />
                  Links
                </TabsTrigger>
                <TabsTrigger value="previa" className="text-xs sm:text-sm font-sans py-2">
                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                  Prévia e publicar
                </TabsTrigger>
              </TabsList>

              {/* ─────────────────────────────────────────────────────────────
                  ABA: MARCA
                  ───────────────────────────────────────────────────────────── */}
              <TabsContent value="marca" className="space-y-6">
                <div className="rounded-lg border border-border bg-card p-5 sm:p-6 space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold font-sans text-foreground">
                      Identidade visual
                    </h2>
                    <p className="text-xs font-sans text-muted-foreground mt-0.5">
                      Logo com fundo transparente (WebP); favicon quadrado. As imagens são limpas
                      automaticamente (sem EXIF/GPS) e reencodadas antes do envio.
                    </p>
                  </div>

                  {marcaError && (
                    <div className="p-3 bg-destructive/10 border border-destructive/30 text-destructive text-xs rounded-md font-sans">
                      {marcaError}
                    </div>
                  )}

                  {marcaWarning && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs rounded-md font-sans flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                        <span>{marcaWarning}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setMarcaWarning(null)}
                        className="h-6 px-2 text-xs font-sans text-amber-800 dark:text-amber-200 hover:bg-amber-500/20"
                      >
                        Fechar
                      </Button>
                    </div>
                  )}

                  {/* Logo e Favicon */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-border/60">
                    {/* Logo */}
                    <div className="space-y-3">
                      <Label className="text-xs font-medium font-sans">Logo principal</Label>
                      <div className="border border-dashed border-border rounded-lg p-4 bg-muted/20 flex flex-col items-center justify-center min-h-[140px] text-center gap-3">
                        {logoPreviewUrl ? (
                          <div className="w-full flex items-center justify-center p-2 bg-background/80 rounded border border-border/50 max-h-24">
                            <img
                              src={logoPreviewUrl}
                              alt="Logo do site"
                              className="max-h-20 max-w-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground font-sans">
                            Nenhum logo cadastrado.
                          </div>
                        )}
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={handleUploadLogo}
                          disabled={uploadingLogo}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadingLogo}
                          onClick={() => logoInputRef.current?.click()}
                          className="text-xs font-sans h-8"
                        >
                          {uploadingLogo ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                              <span>Processando...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="h-3.5 w-3.5 mr-1.5" />
                              <span>{logoPreviewUrl ? 'Substituir logo' : 'Enviar logo'}</span>
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-[11px] font-sans text-muted-foreground">
                        Orientação: Logo com fundo transparente (WebP). Máx. 3 MB.
                      </p>
                    </div>

                    {/* Favicon */}
                    <div className="space-y-3">
                      <Label className="text-xs font-medium font-sans">Favicon</Label>
                      <div className="border border-dashed border-border rounded-lg p-4 bg-muted/20 flex flex-col items-center justify-center min-h-[140px] text-center gap-3">
                        {faviconPreviewUrl ? (
                          <div className="h-16 w-16 p-2 bg-background/80 rounded border border-border/50 flex items-center justify-center">
                            <img
                              src={faviconPreviewUrl}
                              alt="Favicon"
                              className="h-10 w-10 object-contain"
                            />
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground font-sans">
                            Nenhum favicon cadastrado.
                          </div>
                        )}
                        <input
                          ref={faviconInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={handleUploadFavicon}
                          disabled={uploadingFavicon}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadingFavicon}
                          onClick={() => faviconInputRef.current?.click()}
                          className="text-xs font-sans h-8"
                        >
                          {uploadingFavicon ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                              <span>Processando...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="h-3.5 w-3.5 mr-1.5" />
                              <span>
                                {faviconPreviewUrl ? 'Substituir favicon' : 'Enviar favicon'}
                              </span>
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-[11px] font-sans text-muted-foreground">
                        Orientação: Favicon quadrado (32x32 ou 64x64). Máx. 3 MB.
                      </p>
                    </div>
                  </div>

                  {/* Cor da ação principal */}
                  <form
                    onSubmit={handleSaveMarca}
                    className="space-y-4 pt-4 border-t border-border/60"
                  >
                    <div className="space-y-1">
                      <Label htmlFor="primary-color" className="text-xs font-medium font-sans">
                        Cor da ação principal
                      </Label>
                      <p className="text-xs font-sans text-muted-foreground">
                        Usada nos botões de destaque, links e chamadas à ação do site.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      {/* Seletor nativo */}
                      <div className="flex items-center gap-2">
                        <input
                          id="primary-color"
                          type="color"
                          value={isValidHexColor(primaryColor) ? primaryColor : '#1a73e8'}
                          onChange={(e) => setPrimaryColor(e.target.value.toUpperCase())}
                          className="h-10 w-12 rounded border border-border cursor-pointer bg-background p-1"
                        />
                        <Input
                          type="text"
                          value={primaryColor}
                          onChange={(e) => {
                            setPrimaryColor(e.target.value.toUpperCase())
                            if (marcaError) setMarcaError(null)
                          }}
                          placeholder="#1A73E8"
                          maxLength={7}
                          className="h-10 w-28 font-mono text-xs uppercase"
                        />
                      </div>

                      {/* Pré-visualização do botão */}
                      <div className="flex items-center gap-2 pl-2 border-l border-border">
                        <span className="text-xs font-sans text-muted-foreground">
                          Prévia do botão:
                        </span>
                        <button
                          type="button"
                          style={{
                            backgroundColor: isValidHexColor(primaryColor)
                              ? primaryColor
                              : '#1a73e8',
                            color: '#ffffff',
                          }}
                          className="px-4 py-2 rounded-md font-sans text-xs font-medium shadow-sm transition-opacity hover:opacity-95"
                        >
                          Fale conosco no WhatsApp
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <Button
                        type="submit"
                        disabled={savingMarca}
                        className="text-xs font-sans h-9 px-4"
                      >
                        {savingMarca ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                            <span>Salvando...</span>
                          </>
                        ) : (
                          <span>Salvar marca</span>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              </TabsContent>

              {/* ─────────────────────────────────────────────────────────────
                  ABA: TEXTOS
                  ───────────────────────────────────────────────────────────── */}
              <TabsContent value="textos" className="space-y-6">
                <form
                  onSubmit={handleSaveTextos}
                  className="rounded-lg border border-border bg-card p-5 sm:p-6 space-y-5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold font-sans text-foreground">
                        Textos institucionais e contato
                      </h2>
                      <p className="text-xs font-sans text-muted-foreground mt-0.5">
                        Edite o "Sobre", endereço físico e canais de atendimento exibidos no site.
                      </p>
                    </div>
                  </div>

                  {textosError && (
                    <div className="p-3 bg-destructive/10 border border-destructive/30 text-destructive text-xs rounded-md font-sans">
                      {textosError}
                    </div>
                  )}

                  <div className="space-y-4 pt-2 border-t border-border/60">
                    {/* Título Sobre */}
                    <div className="space-y-1.5">
                      <Label htmlFor="about-title" className="text-xs font-medium font-sans">
                        Título do "Sobre a imobiliária"
                      </Label>
                      <Input
                        id="about-title"
                        type="text"
                        value={aboutTitle}
                        onChange={(e) => setAboutTitle(e.target.value)}
                        placeholder="Ex.: Sobre a Amorbiliário"
                        maxLength={120}
                        className="text-xs font-sans"
                      />
                    </div>

                    {/* Texto Sobre com contador */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="about-text" className="text-xs font-medium font-sans">
                          Texto do "Sobre a imobiliária"
                        </Label>
                        <span
                          className={cn(
                            'text-[11px] font-mono',
                            aboutText.length > 2000
                              ? 'text-destructive font-semibold'
                              : 'text-muted-foreground',
                          )}
                        >
                          {aboutText.length} / 2000 caracteres
                        </span>
                      </div>
                      <Textarea
                        id="about-text"
                        rows={6}
                        value={aboutText}
                        onChange={(e) => {
                          setTextosError(null)
                          setAboutText(e.target.value)
                        }}
                        placeholder="Conte a história da imobiliária, atuação regional e diferenciais..."
                        maxLength={2000}
                        className="text-xs font-sans resize-y"
                      />
                    </div>

                    {/* Endereço e Horário */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="site-address" className="text-xs font-medium font-sans">
                          Endereço completo
                        </Label>
                        <Input
                          id="site-address"
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Ex.: Av. Senhor dos Passos, 1000 - Centro, Feira de Santana - BA"
                          maxLength={250}
                          className="text-xs font-sans"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="site-hours" className="text-xs font-medium font-sans">
                          Horário de atendimento
                        </Label>
                        <Input
                          id="site-hours"
                          type="text"
                          value={hours}
                          onChange={(e) => setHours(e.target.value)}
                          placeholder="Ex.: Segunda a Sexta, das 08h às 18h"
                          maxLength={150}
                          className="text-xs font-sans"
                        />
                      </div>
                    </div>

                    {/* Telefone e E-mail */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="site-phone" className="text-xs font-medium font-sans">
                          Telefone de contato
                        </Label>
                        <Input
                          id="site-phone"
                          type="text"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Ex.: (75) 3000-0000"
                          maxLength={40}
                          className="text-xs font-sans"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="site-email" className="text-xs font-medium font-sans">
                          E-mail de contato
                        </Label>
                        <Input
                          id="site-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Ex.: contato@amorbiliario.com.br"
                          maxLength={120}
                          className="text-xs font-sans"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      type="submit"
                      disabled={savingTextos || aboutText.length > 2000}
                      className="text-xs font-sans h-9 px-4"
                    >
                      {savingTextos ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          <span>Salvando...</span>
                        </>
                      ) : (
                        <span>Salvar textos</span>
                      )}
                    </Button>
                  </div>
                </form>
              </TabsContent>

              {/* ─────────────────────────────────────────────────────────────
                  ABA: LINKS
                  ───────────────────────────────────────────────────────────── */}
              <TabsContent value="links" className="space-y-6">
                <form
                  onSubmit={handleSaveLinks}
                  className="rounded-lg border border-border bg-card p-5 sm:p-6 space-y-6"
                >
                  <div>
                    <h2 className="text-lg font-semibold font-sans text-foreground">
                      Redes sociais e links do rodapé
                    </h2>
                    <p className="text-xs font-sans text-muted-foreground mt-0.5">
                      Configure os links sociais e até 10 links adicionais no rodapé do site. Todos
                      os endereços devem iniciar obrigatoriamente com https://.
                    </p>
                  </div>

                  {linksError && (
                    <div className="p-3 bg-destructive/10 border border-destructive/30 text-destructive text-xs rounded-md font-sans">
                      {linksError}
                    </div>
                  )}

                  {/* Redes Sociais */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/60">
                    <div className="space-y-1.5">
                      <Label htmlFor="instagram-url" className="text-xs font-medium font-sans">
                        Instagram (https://...)
                      </Label>
                      <Input
                        id="instagram-url"
                        type="url"
                        value={instagram}
                        onChange={(e) => {
                          setInstagram(e.target.value)
                          if (linksError) setLinksError(null)
                        }}
                        placeholder="https://instagram.com/amorbiliario"
                        className="text-xs font-sans"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="whatsapp-url" className="text-xs font-medium font-sans">
                        WhatsApp (https://...)
                      </Label>
                      <Input
                        id="whatsapp-url"
                        type="url"
                        value={whatsapp}
                        onChange={(e) => {
                          setWhatsapp(e.target.value)
                          if (linksError) setLinksError(null)
                        }}
                        placeholder="https://wa.me/5575999990000"
                        className="text-xs font-sans"
                      />
                    </div>
                  </div>

                  {/* Links do rodapé */}
                  <div className="space-y-3 pt-3 border-t border-border/60">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-medium font-sans">
                          Links adicionais do rodapé
                        </Label>
                        <p className="text-[11px] font-sans text-muted-foreground">
                          Até 10 links para páginas externas, termos ou canais parceiros.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={linksList.length >= 10}
                        onClick={handleAddLink}
                        className="text-xs font-sans h-8"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        <span>Adicionar link ({linksList.length}/10)</span>
                      </Button>
                    </div>

                    {linksList.length === 0 ? (
                      <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground font-sans">
                        Nenhum link adicional configurado.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {linksList.map((link, idx) => (
                          <div
                            key={idx}
                            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 rounded-md border border-border bg-muted/20"
                          >
                            <Input
                              type="text"
                              value={link.label}
                              onChange={(e) => handleLinkChange(idx, 'label', e.target.value)}
                              placeholder="Nome do link (ex.: Blog)"
                              className="text-xs font-sans h-8 sm:w-1/3"
                            />
                            <Input
                              type="url"
                              value={link.url}
                              onChange={(e) => handleLinkChange(idx, 'url', e.target.value)}
                              placeholder="https://..."
                              className="text-xs font-sans h-8 flex-1"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveLink(idx)}
                              className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 self-end sm:self-auto"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      type="submit"
                      disabled={savingLinks}
                      className="text-xs font-sans h-9 px-4"
                    >
                      {savingLinks ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          <span>Salvando...</span>
                        </>
                      ) : (
                        <span>Salvar links</span>
                      )}
                    </Button>
                  </div>
                </form>
              </TabsContent>

              {/* ─────────────────────────────────────────────────────────────
                  ABA: PRÉVIA E PUBLICAR
                  ───────────────────────────────────────────────────────────── */}
              <TabsContent value="previa" className="space-y-6">
                <div className="rounded-lg border border-border bg-card p-5 sm:p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold font-sans text-foreground">
                        Pré-visualização e publicação
                      </h2>
                      <p className="text-xs font-sans text-muted-foreground mt-0.5">
                        Gere uma prévia temporária para conferir o visual exato antes de publicar.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleGeneratePreview}
                        disabled={generatingPreview}
                        className="text-xs font-sans h-9"
                      >
                        {generatingPreview ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                            <span>Gerando prévia...</span>
                          </>
                        ) : (
                          <>
                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                            <span>Gerar prévia</span>
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="default"
                        onClick={() => setPublishDialogOpen(true)}
                        className="text-xs font-sans h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Send className="h-3.5 w-3.5 mr-1.5" />
                        <span>Publicar agora</span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setUndoDialogOpen(true)}
                        className="text-xs font-sans h-9 text-muted-foreground hover:text-foreground"
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        <span>Desfazer última</span>
                      </Button>
                    </div>
                  </div>

                  {previewError && (
                    <div className="p-3 bg-destructive/10 border border-destructive/30 text-destructive text-xs rounded-md font-sans">
                      {previewError}
                    </div>
                  )}

                  {/* Informações da prévia */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="space-y-1.5">
                      <Label htmlFor="custom-site-url" className="text-xs font-medium font-sans">
                        Endereço base do site público
                      </Label>
                      <Input
                        id="custom-site-url"
                        type="url"
                        value={customSiteUrl}
                        onChange={(e) => setCustomSiteUrl(e.target.value)}
                        placeholder="https://seusite.com.br"
                        className="text-xs font-sans h-8 bg-background"
                      />
                      <p className="text-[11px] font-sans text-muted-foreground">
                        Definido por VITE_SITE_URL ou colado aqui para testar no iframe.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium font-sans">Status da prévia</Label>
                      <div className="text-xs font-sans">
                        {previewToken ? (
                          <div className="space-y-1">
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Prévia gerada com sucesso!
                            </span>
                            <p className="text-[11px] text-muted-foreground">
                              A prévia vale por 30 minutos após a geração.
                            </p>
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-xs">
                            Clique em "Gerar prévia" para carregar a versão de rascunho.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Barra de controle do iframe */}
                  {previewToken && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-muted/40 rounded-lg border border-border">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-sans text-muted-foreground">
                            Visualização:
                          </span>
                          <div className="flex items-center bg-background rounded-md border border-border p-0.5">
                            <button
                              type="button"
                              onClick={() => setPreviewViewport('desktop')}
                              className={cn(
                                'flex items-center gap-1.5 px-3 py-1 text-xs font-sans rounded transition-colors',
                                previewViewport === 'desktop'
                                  ? 'bg-primary text-primary-foreground font-medium'
                                  : 'text-muted-foreground hover:text-foreground',
                              )}
                            >
                              <Monitor className="h-3.5 w-3.5" />
                              <span>Desktop</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreviewViewport('mobile')}
                              className={cn(
                                'flex items-center gap-1.5 px-3 py-1 text-xs font-sans rounded transition-colors',
                                previewViewport === 'mobile'
                                  ? 'bg-primary text-primary-foreground font-medium'
                                  : 'text-muted-foreground hover:text-foreground',
                              )}
                            >
                              <Smartphone className="h-3.5 w-3.5" />
                              <span>Celular (390 px)</span>
                            </button>
                          </div>
                        </div>

                        {iframeSrc && (
                          <a
                            href={iframeSrc}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-sans text-primary hover:underline flex items-center gap-1 self-start sm:self-auto"
                          >
                            <span>Abrir prévia em nova aba</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>

                      {/* Iframe */}
                      <div className="flex justify-center bg-muted/20 border border-border rounded-lg p-4 overflow-hidden min-h-[500px]">
                        {!customSiteUrl ? (
                          <div className="flex flex-col items-center justify-center p-8 text-center max-w-md space-y-2">
                            <HelpCircle className="h-8 w-8 text-muted-foreground" />
                            <p className="text-xs font-sans font-medium text-foreground">
                              Informe o endereço base do site acima
                            </p>
                            <p className="text-[11px] font-sans text-muted-foreground">
                              Cole a URL do site público (ou configure VITE_SITE_URL) para
                              visualizar a prévia interativa aqui.
                            </p>
                          </div>
                        ) : (
                          <div
                            className={cn(
                              'transition-all duration-200 border border-border shadow-md rounded-lg overflow-hidden bg-background',
                              previewViewport === 'mobile' ? 'w-[390px]' : 'w-full',
                            )}
                            style={{ height: '640px' }}
                          >
                            <iframe
                              src={iframeSrc}
                              title="Pré-visualização do site"
                              className="w-full h-full border-0"
                              sandbox="allow-scripts allow-same-origin allow-forms"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      {/* Diálogo de confirmação: Publicar */}
      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent className="rounded-lg p-6 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-normal font-sans text-foreground">
              Publicar alterações no site
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-sans text-muted-foreground">
              Publicar torna as mudanças públicas no site agora.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 pt-2">
            <AlertDialogCancel disabled={publishing} className="rounded-md font-normal font-sans">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmPublish()
              }}
              disabled={publishing}
              className="rounded-md font-normal font-sans bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {publishing ? 'Publicando...' : 'Confirmar publicação'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de confirmação: Desfazer */}
      <AlertDialog open={undoDialogOpen} onOpenChange={setUndoDialogOpen}>
        <AlertDialogContent className="rounded-lg p-6 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-normal font-sans text-foreground">
              Desfazer última publicação
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-sans text-muted-foreground">
              Tem certeza que deseja reverter o site público para a versão imediatamente anterior?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 pt-2">
            <AlertDialogCancel disabled={undoing} className="rounded-md font-normal font-sans">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmUndo()
              }}
              disabled={undoing}
              className="rounded-md font-normal font-sans bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {undoing ? 'Desfazendo...' : 'Sim, desfazer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
