import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  listSiteBanners,
  createSiteBanner,
  updateSiteBanner,
  setSiteBannerActive,
  orderSiteBanners,
  uploadSiteAsset,
  resolveAssetUrl,
  bannerErrorMessage,
  type SiteBanner,
  type SiteBannerTipo,
  type SiteBannerPayload,
} from '@/services/site'
import { ArrowUp, ArrowDown, Pencil, Plus, Loader2, Upload, ImageIcon, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

const BANNER_MAX_BYTES = 3 * 1024 * 1024
const BANNER_MAX_SIDE = 1920

const TIPO_LABEL: Record<SiteBannerTipo, string> = {
  campanha: 'Campanha',
  lancamento: 'Lançamento',
  super_destaque: 'Super-destaque',
}

type ImageSlot = 'desktop' | 'mobile' | 'night_desktop' | 'night_mobile'

const SLOTS: { key: ImageSlot; label: string; kind: 'banner_desktop' | 'banner_mobile' }[] = [
  { key: 'desktop', label: 'Computador (obrigatória)', kind: 'banner_desktop' },
  { key: 'mobile', label: 'Celular', kind: 'banner_mobile' },
  { key: 'night_desktop', label: 'Noite, computador', kind: 'banner_desktop' },
  { key: 'night_mobile', label: 'Noite, celular', kind: 'banner_mobile' },
]

interface FormState {
  title: string
  subtitle: string
  button_text: string
  tipo: SiteBannerTipo
  destino_url: string
  imovel_codigo: string
  start_local: string
  end_local: string
  assets: Record<ImageSlot, string>
  previews: Record<ImageSlot, string>
}

function emptyForm(): FormState {
  return {
    title: '',
    subtitle: '',
    button_text: '',
    tipo: 'campanha',
    destino_url: '',
    imovel_codigo: '',
    start_local: '',
    end_local: '',
    assets: { desktop: '', mobile: '', night_desktop: '', night_mobile: '' },
    previews: { desktop: '', mobile: '', night_desktop: '', night_mobile: '' },
  }
}

/** Data do servidor (UTC, "2026-11-30 23:59:00.000Z") para o valor do campo datetime-local (hora do aparelho). */
function serverToLocalInput(value: string): string {
  if (!value) return ''
  const d = new Date(value.replace(' ', 'T'))
  if (isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Valor do campo datetime-local (sem fuso) para ISO com fuso; vazio vai como "". */
function localInputToIso(value: string): string {
  if (!value) return ''
  const d = new Date(value)
  return isNaN(d.getTime()) ? '' : d.toISOString()
}

function formatBahia(value: string): string {
  if (!value) return ''
  const d = new Date(value.replace(' ', 'T'))
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' })
}

function periodLabel(b: SiteBanner): string {
  const s = formatBahia(b.start_at)
  const f = formatBahia(b.end_at)
  if (!s && !f) return 'Sem data'
  if (s && f) return `${s} a ${f}`
  if (s) return `A partir de ${s}`
  return `Até ${f}`
}

function isValidDestino(v: string): boolean {
  const t = v.trim()
  if (!t) return true
  return /^\/(?!\/)\S*$/.test(t) || /^https:\/\/\S+$/.test(t)
}

/** Reencoda em JPEG pelo canvas (remove EXIF e GPS) e limita o lado maior a 1920 px. */
async function reencodeBannerImage(file: File): Promise<File> {
  const allowed = ['image/jpeg', 'image/jpg', 'image/webp', 'image/png']
  if (!allowed.includes(file.type.toLowerCase())) {
    throw new Error('Formato inválido. Use JPEG ou WebP.')
  }
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader()
    r.onerror = () => rej(new Error('Falha ao ler o arquivo selecionado.'))
    r.onload = () => res(String(r.result))
    r.readAsDataURL(file)
  })
  const img: HTMLImageElement = await new Promise((res, rej) => {
    const i = new Image()
    i.onerror = () => rej(new Error('Falha ao carregar a imagem selecionada.'))
    i.onload = () => res(i)
    i.src = dataUrl
  })
  const w0 = img.naturalWidth || img.width
  const h0 = img.naturalHeight || img.height
  const scale = Math.min(1, BANNER_MAX_SIDE / Math.max(w0, h0))
  const w = Math.round(w0 * scale)
  const h = Math.round(h0 * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível preparar a imagem neste navegador.')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  let blob: Blob | null = null
  for (const q of [0.88, 0.8, 0.7]) {
    blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), 'image/jpeg', q))
    if (blob && blob.size <= BANNER_MAX_BYTES) break
  }
  if (!blob || blob.type !== 'image/jpeg') {
    throw new Error('Não foi possível preparar a imagem neste navegador. Tente no Chrome.')
  }
  if (blob.size > BANNER_MAX_BYTES) {
    throw new Error(
      `A imagem tem ${(blob.size / (1024 * 1024)).toFixed(1)} MB depois de preparada. O limite é 3 MB.`,
    )
  }
  const base = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'banner'
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
}

export function SiteBannersTab() {
  const [items, setItems] = useState<SiteBanner[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SiteBanner | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<ImageSlot | null>(null)
  const [askCode, setAskCode] = useState(false)
  const [codeDraft, setCodeDraft] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setListError(null)
    try {
      const res = await listSiteBanners()
      setItems(res.items || [])
    } catch (err) {
      setListError(bannerErrorMessage(err, 'Não foi possível carregar os banners.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const activeCount = items.filter((b) => b.active).length

  const openNew = () => {
    setEditing(null)
    setForm(emptyForm())
    setFormError(null)
    setAskCode(false)
    setDialogOpen(true)
  }

  const openEdit = (b: SiteBanner) => {
    setEditing(b)
    setForm({
      title: b.title || '',
      subtitle: b.subtitle || '',
      button_text: b.button_text || '',
      tipo: b.tipo || 'campanha',
      destino_url: b.destino_url || '',
      imovel_codigo: b.imovel_codigo || '',
      start_local: serverToLocalInput(b.start_at),
      end_local: serverToLocalInput(b.end_at),
      assets: {
        desktop: b.desktop_asset_id || '',
        mobile: b.mobile_asset_id || '',
        night_desktop: b.night_desktop_asset_id || '',
        night_mobile: b.night_mobile_asset_id || '',
      },
      previews: {
        desktop: resolveAssetUrl(b.desktop_url),
        mobile: resolveAssetUrl(b.mobile_url),
        night_desktop: resolveAssetUrl(b.night_desktop_url),
        night_mobile: resolveAssetUrl(b.night_mobile_url),
      },
    })
    setFormError(null)
    setAskCode(false)
    setDialogOpen(true)
  }

  const handleToggleActive = async (b: SiteBanner, next: boolean) => {
    setBusyId(b.id)
    setListError(null)
    try {
      const res = await setSiteBannerActive(b.id, next)
      setItems((prev) => prev.map((x) => (x.id === b.id ? res.banner : x)))
    } catch (err) {
      setListError(bannerErrorMessage(err, 'Não foi possível mudar o banner.'))
    } finally {
      setBusyId(null)
    }
  }

  const handleMove = async (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= items.length) return
    const next = items.slice()
    const tmp = next[index]
    next[index] = next[target]
    next[target] = tmp
    setBusyId(tmp.id)
    setListError(null)
    try {
      const res = await orderSiteBanners(next.map((b) => b.id))
      setItems(res.items || next)
    } catch (err) {
      setListError(bannerErrorMessage(err, 'Não foi possível mudar a ordem.'))
    } finally {
      setBusyId(null)
    }
  }

  const handleImage = async (
    slot: ImageSlot,
    kind: 'banner_desktop' | 'banner_mobile',
    file?: File,
  ) => {
    if (!file) return
    setFormError(null)
    setUploading(slot)
    try {
      const clean = await reencodeBannerImage(file)
      const up = await uploadSiteAsset(clean, kind, clean.name)
      setForm((f) => ({
        ...f,
        assets: { ...f.assets, [slot]: up.id },
        previews: { ...f.previews, [slot]: resolveAssetUrl(up.url) },
      }))
    } catch (err) {
      setFormError(bannerErrorMessage(err, 'Não foi possível enviar a imagem.'))
    } finally {
      setUploading(null)
    }
  }

  const removeImage = (slot: ImageSlot) => {
    setForm((f) => ({
      ...f,
      assets: { ...f.assets, [slot]: '' },
      previews: { ...f.previews, [slot]: '' },
    }))
  }

  const buttonWithoutDestino = form.button_text.trim() !== '' && form.destino_url.trim() === ''

  const handleSave = async () => {
    setFormError(null)
    if (!form.assets.desktop) {
      setFormError('Envie a imagem de computador.')
      return
    }
    if (!isValidDestino(form.destino_url)) {
      setFormError('O destino deve começar com / ou https://.')
      return
    }
    if (buttonWithoutDestino) {
      setFormError('O texto do botão só vale com um destino.')
      return
    }
    const startIso = localInputToIso(form.start_local)
    const endIso = localInputToIso(form.end_local)
    if (startIso && endIso && new Date(endIso).getTime() < new Date(startIso).getTime()) {
      setFormError('O fim não pode ser antes do início.')
      return
    }
    const full: SiteBannerPayload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      button_text: form.button_text.trim(),
      tipo: form.tipo,
      destino_url: form.destino_url.trim(),
      imovel_codigo: form.tipo === 'super_destaque' ? form.imovel_codigo.trim() : '',
      desktop_asset_id: form.assets.desktop,
      mobile_asset_id: form.assets.mobile,
      night_desktop_asset_id: form.assets.night_desktop,
      night_mobile_asset_id: form.assets.night_mobile,
      start_at: startIso,
      end_at: endIso,
    }
    setSaving(true)
    try {
      if (editing) {
        const original: SiteBannerPayload = {
          title: editing.title || '',
          subtitle: editing.subtitle || '',
          button_text: editing.button_text || '',
          tipo: editing.tipo,
          destino_url: editing.destino_url || '',
          imovel_codigo: editing.imovel_codigo || '',
          desktop_asset_id: editing.desktop_asset_id || '',
          mobile_asset_id: editing.mobile_asset_id || '',
          night_desktop_asset_id: editing.night_desktop_asset_id || '',
          night_mobile_asset_id: editing.night_mobile_asset_id || '',
          start_at: localInputToIso(serverToLocalInput(editing.start_at)),
          end_at: localInputToIso(serverToLocalInput(editing.end_at)),
        }
        const changes: SiteBannerPayload = {}
        ;(Object.keys(full) as (keyof SiteBannerPayload)[]).forEach((k) => {
          if (full[k] !== original[k]) {
            ;(changes as Record<string, unknown>)[k] = full[k]
          }
        })
        if (Object.keys(changes).length > 0) {
          await updateSiteBanner(editing.id, changes)
        }
      } else {
        await createSiteBanner(full)
      }
      setDialogOpen(false)
      await load()
    } catch (err) {
      setFormError(bannerErrorMessage(err, 'Não foi possível salvar o banner.'))
    } finally {
      setSaving(false)
    }
  }

  const counter = (value: string, max: number) => (
    <span
      className={cn(
        'text-[11px] font-sans',
        value.length > max ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {value.length}/{max}
    </span>
  )

  return (
    <div className="rounded-lg border border-border bg-card p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold font-sans text-foreground">Banners da capa</h2>
          <p className="text-xs font-sans text-muted-foreground mt-0.5">
            Imagens grandes no topo da página inicial do site.
          </p>
        </div>
        <Button type="button" onClick={openNew} className="font-sans text-sm shrink-0">
          <Plus className="h-4 w-4 mr-1.5" />
          Novo banner
        </Button>
      </div>

      <div className="p-3 rounded-md border border-border bg-muted/40 text-xs font-sans text-muted-foreground space-y-1">
        <p className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 shrink-0" />
          O site só muda quando você Publicar.
        </p>
        <p className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 shrink-0" />
          No máximo 5 banners ativos. Agora: {activeCount} de 5.
        </p>
      </div>

      {listError && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 text-destructive text-xs rounded-md font-sans">
          {listError}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center space-y-3 border border-dashed border-border rounded-md">
          <p className="text-sm font-sans text-muted-foreground">
            Nenhum banner ainda. A capa mostra a busca sem imagem.
          </p>
          <Button type="button" variant="outline" onClick={openNew} className="font-sans text-sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Novo banner
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-md">
          {items.map((b, i) => (
            <li key={b.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="h-14 w-24 shrink-0 rounded bg-muted overflow-hidden flex items-center justify-center">
                  {b.desktop_url ? (
                    <img
                      src={resolveAssetUrl(b.desktop_url)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-sans font-medium text-foreground truncate">
                    {b.title || 'Sem título'}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[11px] font-sans font-normal">
                      {TIPO_LABEL[b.tipo] || b.tipo}
                    </Badge>
                    <span className="text-[11px] font-sans text-muted-foreground">
                      {periodLabel(b)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <label className="flex items-center gap-2 text-xs font-sans text-muted-foreground">
                  <Switch
                    checked={b.active}
                    disabled={busyId === b.id}
                    onCheckedChange={(v) => handleToggleActive(b, v)}
                    aria-label="Ativo"
                  />
                  Ativo
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={i === 0 || busyId !== null}
                  onClick={() => handleMove(i, -1)}
                  aria-label="Subir"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={i === items.length - 1 || busyId !== null}
                  onClick={() => handleMove(i, 1)}
                  aria-label="Descer"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-sans"
                  onClick={() => openEdit(b)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Editar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !saving && setDialogOpen(o)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-sans text-base">
              {editing ? 'Editar banner' : 'Novo banner'}
            </DialogTitle>
            <DialogDescription className="font-sans text-xs">
              Salvar grava o rascunho. O site só muda quando você Publicar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {formError && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 text-destructive text-xs rounded-md font-sans">
                {formError}
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="bn-title" className="font-sans text-xs">
                  Título
                </Label>
                {counter(form.title, 80)}
              </div>
              <Input
                id="bn-title"
                maxLength={80}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="bn-subtitle" className="font-sans text-xs">
                  Subtítulo
                </Label>
                {counter(form.subtitle, 120)}
              </div>
              <Input
                id="bn-subtitle"
                maxLength={120}
                value={form.subtitle}
                onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bn-button" className="font-sans text-xs">
                    Texto do botão
                  </Label>
                  {counter(form.button_text, 30)}
                </div>
                <Input
                  id="bn-button"
                  maxLength={30}
                  value={form.button_text}
                  onChange={(e) => setForm((f) => ({ ...f, button_text: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-sans text-xs">Tipo</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as SiteBannerTipo }))}
                >
                  <SelectTrigger className="font-sans text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="campanha">Campanha</SelectItem>
                    <SelectItem value="lancamento">Lançamento</SelectItem>
                    <SelectItem value="super_destaque">Super-destaque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {buttonWithoutDestino && (
              <p className="text-xs font-sans text-amber-700 dark:text-amber-300">
                O texto do botão só vale com um destino.
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="bn-destino" className="font-sans text-xs">
                Destino
              </Label>
              <Input
                id="bn-destino"
                maxLength={300}
                placeholder="/buscar ou https://..."
                value={form.destino_url}
                onChange={(e) => setForm((f) => ({ ...f, destino_url: e.target.value }))}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs font-sans"
                  onClick={() => setForm((f) => ({ ...f, destino_url: '/buscar' }))}
                >
                  Busca
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs font-sans"
                  onClick={() => setForm((f) => ({ ...f, destino_url: '/vender' }))}
                >
                  Anuncie
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs font-sans"
                  onClick={() => {
                    setCodeDraft(form.imovel_codigo)
                    setAskCode(true)
                  }}
                >
                  Imóvel
                </Button>
              </div>
              {askCode && (
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    autoFocus
                    maxLength={20}
                    placeholder="Código do imóvel (ex.: CA-0008)"
                    value={codeDraft}
                    onChange={(e) => setCodeDraft(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs font-sans"
                    disabled={!codeDraft.trim()}
                    onClick={() => {
                      const c = codeDraft.trim()
                      setForm((f) => ({ ...f, destino_url: `/buscar/${encodeURIComponent(c)}` }))
                      setAskCode(false)
                    }}
                  >
                    Usar
                  </Button>
                </div>
              )}
              {!isValidDestino(form.destino_url) && (
                <p className="text-xs font-sans text-destructive">
                  O destino deve começar com / ou https://.
                </p>
              )}
            </div>

            {form.tipo === 'super_destaque' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bn-code" className="font-sans text-xs">
                    Código do imóvel
                  </Label>
                  {counter(form.imovel_codigo, 20)}
                </div>
                <Input
                  id="bn-code"
                  maxLength={20}
                  placeholder="CA-0008"
                  value={form.imovel_codigo}
                  onChange={(e) => setForm((f) => ({ ...f, imovel_codigo: e.target.value }))}
                />
                <p className="text-[11px] font-sans text-muted-foreground">
                  Usado para o banner virar o painel do imóvel.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="bn-start" className="font-sans text-xs">
                  Início (opcional)
                </Label>
                <Input
                  id="bn-start"
                  type="datetime-local"
                  value={form.start_local}
                  onChange={(e) => setForm((f) => ({ ...f, start_local: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bn-end" className="font-sans text-xs">
                  Fim (opcional)
                </Label>
                <Input
                  id="bn-end"
                  type="datetime-local"
                  value={form.end_local}
                  onChange={(e) => setForm((f) => ({ ...f, end_local: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-sans text-xs">Imagens</Label>
              <p className="text-[11px] font-sans text-muted-foreground">
                Computador 1920×1080, celular 1080×1920, JPEG ou WebP, até 3 MB. Sem a imagem de
                celular, o site usa a de computador. A versão de noite aparece no tema escuro.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {SLOTS.map((s) => (
                  <div key={s.key} className="space-y-1.5">
                    <p className="text-[11px] font-sans text-foreground">{s.label}</p>
                    <div
                      className={cn(
                        'rounded bg-muted overflow-hidden flex items-center justify-center',
                        s.kind === 'banner_mobile' ? 'aspect-[9/16]' : 'aspect-video',
                      )}
                    >
                      {uploading === s.key ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : form.previews[s.key] ? (
                        <img
                          src={form.previews[s.key]}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <label
                      className={cn(
                        'flex items-center justify-center gap-1 h-7 rounded-md border border-border text-[11px] font-sans cursor-pointer hover:bg-secondary',
                        uploading !== null && 'pointer-events-none opacity-50',
                      )}
                    >
                      <Upload className="h-3 w-3" />
                      Enviar
                      <input
                        type="file"
                        accept="image/jpeg,image/webp,image/png"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          e.target.value = ''
                          handleImage(s.key, s.kind, f)
                        }}
                      />
                    </label>
                    {s.key !== 'desktop' && form.assets[s.key] && (
                      <button
                        type="button"
                        className="w-full text-[11px] font-sans text-muted-foreground hover:text-foreground"
                        onClick={() => removeImage(s.key)}
                      >
                        Tirar imagem
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setDialogOpen(false)}
              className="font-sans text-sm"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={saving || uploading !== null}
              onClick={handleSave}
              className="font-sans text-sm"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
