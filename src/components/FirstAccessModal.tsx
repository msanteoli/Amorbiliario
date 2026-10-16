import React, { useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle } from 'lucide-react'

interface FirstAccessModalProps {
  userId: string
  onNameSaved: (name: string) => void
}

export function FirstAccessModal({ userId, onNameSaved }: FirstAccessModalProps) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)
    setValidationError(null)

    const trimmed = name.trim()
    if (trimmed.length < 2 || trimmed.length > 60) {
      setValidationError('O nome deve ter entre 2 e 60 caracteres.')
      return
    }

    setSubmitting(true)
    try {
      // Atualiza apenas o campo 'name' no registro do usuário (users.name)
      const updated = await pb.collection('users').update(userId, { name: trimmed })
      // Se pb.authStore.record for o mesmo usuário, atualiza a authStore local
      if (pb.authStore.record && pb.authStore.record.id === userId) {
        pb.authStore.save(pb.authStore.token, updated)
      }
      onNameSaved(trimmed)
    } catch (err: unknown) {
      const msg = getErrorMessage(err)
      setServerError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-access-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in-50 zoom-in-95">
        <div className="space-y-1.5 text-left">
          <h2
            id="first-access-title"
            className="text-xl font-semibold tracking-tight text-foreground font-sans"
          >
            Como você quer ser chamado?
          </h2>
          <p className="text-xs text-muted-foreground font-sans">
            Defina seu nome de exibição no sistema para que seus colegas identifiquem você.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5 text-left">
            <label
              htmlFor="first-access-name"
              className="text-xs font-medium text-foreground block font-sans"
            >
              Nome
            </label>
            <Input
              id="first-access-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (validationError) setValidationError(null)
                if (serverError) setServerError(null)
              }}
              placeholder="Ex: Matheus"
              autoFocus
              minLength={2}
              maxLength={60}
              disabled={submitting}
              className="h-11 font-sans text-sm border-border"
            />
            <div className="flex justify-between items-center text-[11px] text-muted-foreground font-sans">
              <span>Mínimo 2, máximo 60 caracteres</span>
              <span className="tabular">{name.trim().length}/60</span>
            </div>
          </div>

          {validationError && (
            <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs font-sans flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {serverError && (
            <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs font-sans space-y-1 text-left">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Não foi possível salvar seu nome:</span>
              </div>
              <p className="pl-6 text-[11px] break-words">{serverError}</p>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              disabled={submitting || name.trim().length < 2 || name.trim().length > 60}
              className="w-full sm:w-auto h-10 px-6 rounded-md font-sans text-xs bg-primary text-primary-foreground gap-2"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Continuar</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
