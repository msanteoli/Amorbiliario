import React, { useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Loader2, FileText, Sparkles, AlertTriangle } from 'lucide-react'
import { readCondominiumBook, BookProposal } from '@/services/condominiums'

export type BookFieldKey = keyof BookProposal

const FIELDS: Array<{ key: BookFieldKey; label: string }> = [
  { key: 'name', label: 'Nome do condomínio' },
  { key: 'street', label: 'Endereço' },
  { key: 'neighborhood', label: 'Bairro' },
  { key: 'city', label: 'Cidade' },
  { key: 'amenities', label: 'Itens de lazer' },
  { key: 'infrastructure', label: 'Itens de infraestrutura' },
  { key: 'rules', label: 'Regras e observações' },
]

interface BookReaderButtonProps {
  /** Valores que estão hoje nos campos da tela (para comparar com a proposta) */
  current: Record<BookFieldKey, string>
  condominiumId?: string
  disabled?: boolean
  /** Recebe só os campos que o usuário marcou "Usar". Nada é gravado aqui: o usuário salva pela edição normal. */
  onApply: (values: Partial<Record<BookFieldKey, string>>) => void
}

export function BookReaderButton({
  current,
  condominiumId,
  disabled,
  onApply,
}: BookReaderButtonProps) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [proposal, setProposal] = useState<BookProposal | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [use, setUse] = useState<Record<string, boolean>>({})

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    if (!/\.pdf$/i.test(file.name)) {
      setError('Envie um arquivo PDF.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('O PDF passa de 10 MB. Envie um arquivo menor.')
      return
    }
    setReading(true)
    try {
      const res = await readCondominiumBook(file, condominiumId)
      const initial: Record<string, boolean> = {}
      // "Usar" vem marcado só onde o campo hoje está vazio e o book trouxe algo
      FIELDS.forEach((f) => {
        initial[f.key] = res.proposal[f.key] !== '' && (current[f.key] || '').trim() === ''
      })
      setProposal(res.proposal)
      setTruncated(res.truncated)
      setUse(initial)
      setOpen(true)
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Não consegui ler o book. Preencha os dados manualmente.',
      )
    } finally {
      setReading(false)
    }
  }

  const handleApply = () => {
    if (!proposal) return
    const values: Partial<Record<BookFieldKey, string>> = {}
    FIELDS.forEach((f) => {
      if (use[f.key]) values[f.key] = proposal[f.key]
    })
    onApply(values)
    setOpen(false)
    setProposal(null)
  }

  const marked = Object.values(use).filter(Boolean).length

  return (
    <div className="space-y-1.5">
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFile}
        className="hidden"
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => fileRef.current?.click()}
        disabled={disabled || reading}
        className="h-9 rounded-full px-4 text-xs font-normal border-border gap-1.5"
      >
        {reading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Lendo o book...</span>
          </>
        ) : (
          <>
            <FileText className="h-3.5 w-3.5" />
            <span>Preencher com o book (PDF)</span>
          </>
        )}
      </Button>
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 font-normal">
          {error}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-normal text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span>Dados lidos do book</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Marque o que deseja usar. Nada é salvo até você salvar o condomínio. O PDF não é
              guardado.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 rounded-lg border border-attention/40 bg-muted/20 text-xs text-foreground font-normal flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Confira antes de salvar: a leitura por IA pode errar.</span>
          </div>
          {truncated && (
            <div className="p-3 rounded-lg border border-attention/40 bg-muted/20 text-xs text-foreground font-normal">
              O book é muito longo e foi lido só até certo ponto. Pode haver informações que não
              apareceram aqui.
            </div>
          )}

          <div className="max-h-[55vh] overflow-y-auto space-y-3 pr-1">
            {proposal &&
              FIELDS.map((f) => {
                const proposed = proposal[f.key]
                const now = (current[f.key] || '').trim()
                const empty = proposed === ''
                return (
                  <div key={f.key} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-xs eyebrow text-muted-foreground">{f.label}</Label>
                      <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                        <Checkbox
                          checked={Boolean(use[f.key])}
                          disabled={empty}
                          onCheckedChange={(c) =>
                            setUse((prev) => ({ ...prev, [f.key]: Boolean(c) }))
                          }
                        />
                        <span>Usar</span>
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <p className="text-[11px] text-muted-foreground">Valor atual</p>
                        <p className="text-xs text-foreground whitespace-pre-wrap rounded bg-muted/30 p-2 min-h-[2rem]">
                          {now || <span className="text-muted-foreground">(vazio)</span>}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] text-muted-foreground">Proposta do book</p>
                        <p className="text-xs text-foreground whitespace-pre-wrap rounded bg-muted/30 p-2 min-h-[2rem]">
                          {empty ? (
                            <span className="text-muted-foreground">Não encontrado no book</span>
                          ) : (
                            proposed
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-9 rounded-full px-4 text-xs font-normal border-border"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleApply}
              disabled={marked === 0}
              className="h-9 rounded-full px-5 text-xs font-normal bg-primary text-primary-foreground"
            >
              Usar os campos marcados ({marked})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
