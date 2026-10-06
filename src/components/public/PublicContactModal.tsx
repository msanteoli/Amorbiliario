import React, { useState, useEffect, useRef } from 'react'
import { submitLead } from '@/services/publicSite'
import { snapshot } from '@/lib/searchMemory'
import { getCampaign } from '@/lib/campaign'
import { trackLead, trackWhatsapp } from '@/lib/marketing'
import { maskPhoneInput } from '@/lib/clientUtils'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { AlertCircle, CheckCircle2, MessageCircle } from 'lucide-react'

interface PublicContactModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyCode?: string
}

export const PublicContactModal: React.FC<PublicContactModalProps> = ({
  open,
  onOpenChange,
  propertyCode,
}) => {
  const isMobile = useIsMobile()

  // Form states
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('') // Honey-pot

  // Interaction & submission states
  const [submissionId, setSubmissionId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [consentError, setConsentError] = useState(false)
  const [successResponse, setSuccessResponse] = useState<{
    whatsapp_url: string | null
  } | null>(null)

  const consentCheckboxRef = useRef<HTMLButtonElement>(null)

  // Quando o modal abre, gera um submissionId UMA vez se não houver um ativo para este fluxo
  useEffect(() => {
    if (open) {
      if (!submissionId || successResponse) {
        setSubmissionId(crypto.randomUUID())
      }
      setConsentError(false)
      setServerError(null)
      // Se já estava com sucesso e abriu de novo, reseta tudo
      if (successResponse) {
        setSuccessResponse(null)
        setName('')
        setPhone('')
        setEmail('')
        setConsent(false)
        setWebsite('')
      }
    }
  }, [open, successResponse, submissionId])

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setPhone(maskPhoneInput(raw))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)

    if (!consent) {
      setConsentError(true)
      if (consentCheckboxRef.current) {
        consentCheckboxRef.current.focus()
      }
      return
    }
    setConsentError(false)

    setLoading(true)
    try {
      const memorySnap = snapshot()
      const campaign = getCampaign()

      const res = await submitLead({
        name,
        phone,
        email: email.trim() || undefined,
        consent: true,
        submission_id: submissionId,
        property_code: propertyCode || undefined,
        search: {
          filters: memorySnap.filters,
          viewed: memorySnap.viewed,
        },
        utm_source: campaign.utm_source,
        utm_medium: campaign.utm_medium,
        utm_campaign: campaign.utm_campaign,
        gclid: campaign.gclid,
        fbclid: campaign.fbclid,
        website: website || undefined,
      })

      // Conversão Lead
      trackLead(propertyCode)

      setSuccessResponse({
        whatsapp_url: res.whatsapp_url,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar contato.'
      setServerError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenWhatsApp = () => {
    if (!successResponse?.whatsapp_url) return
    trackWhatsapp(propertyCode)
    window.open(successResponse.whatsapp_url, '_blank', 'noopener,noreferrer')
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  const formContent = (
    <div>
      {successResponse ? (
        <div className="py-6 flex flex-col items-center text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            Recebemos o seu contato. Em breve falaremos com você.
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Nossa equipe entrará em contato para tirar suas dúvidas e prestar o melhor atendimento.
          </p>

          <div className="w-full pt-4 space-y-3">
            {successResponse.whatsapp_url && (
              <Button
                type="button"
                className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white flex items-center justify-center gap-2 font-medium h-11"
                onClick={handleOpenWhatsApp}
              >
                <MessageCircle className="h-5 w-5" />
                Falar no WhatsApp
              </Button>
            )}
            <Button type="button" variant="outline" className="w-full h-11" onClick={handleClose}>
              Continuar buscando
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Honeypot field - escondido para humanos */}
          <div
            style={{
              position: 'absolute',
              opacity: 0,
              zIndex: -1,
              pointerEvents: 'none',
              top: '-9999px',
              left: '-9999px',
            }}
            aria-hidden="true"
          >
            <label htmlFor="website-trap">Website</label>
            <input
              id="website-trap"
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 text-left">
            <Label htmlFor="lead-name">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              id="lead-name"
              type="text"
              required
              placeholder="Seu nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              className="h-10"
            />
          </div>

          <div className="space-y-1.5 text-left">
            <Label htmlFor="lead-phone">
              WhatsApp <span className="text-destructive">*</span>
            </Label>
            <Input
              id="lead-phone"
              type="tel"
              required
              placeholder="(75) 99999-9999"
              value={phone}
              onChange={handlePhoneChange}
              disabled={loading}
              className="h-10"
            />
          </div>

          <div className="space-y-1.5 text-left">
            <Label htmlFor="lead-email">E-mail (opcional)</Label>
            <Input
              id="lead-email"
              type="email"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="h-10"
            />
          </div>

          <div className="space-y-2 pt-2 text-left">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="lead-consent"
                ref={consentCheckboxRef}
                checked={consent}
                onCheckedChange={(checked) => {
                  setConsent(checked === true)
                  if (checked) setConsentError(false)
                }}
                disabled={loading}
                className="mt-1"
              />
              <Label
                htmlFor="lead-consent"
                className="text-xs text-muted-foreground leading-relaxed cursor-pointer font-normal select-none"
              >
                Autorizo a imobiliária a entrar em contato comigo por WhatsApp, telefone ou e-mail e
                a usar as buscas que fiz neste site para me atender melhor.
              </Label>
            </div>
            {consentError && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                Para enviar, marque a autorização de contato.
              </p>
            )}
          </div>

          {serverError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <div className="pt-2">
            <Button type="submit" disabled={loading} className="w-full h-11 font-medium text-sm">
              {loading ? 'Enviando...' : 'Enviar'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )

  const titleText = propertyCode
    ? `Tenho interesse no imóvel ${propertyCode}`
    : 'Falar com a imobiliária'
  const descText = 'Preencha seus dados para receber atendimento de um dos nossos corretores.'

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl px-6 py-6 max-h-[90vh] overflow-y-auto"
        >
          <SheetHeader className="text-left mb-4">
            <SheetTitle>{titleText}</SheetTitle>
            <SheetDescription>{descText}</SheetDescription>
          </SheetHeader>
          {formContent}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titleText}</DialogTitle>
          <DialogDescription>{descText}</DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  )
}
