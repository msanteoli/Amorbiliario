import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme, type ThemePreference } from '@/contexts/ThemeContext'
import { requestPasswordReset } from '@/services/auth'
import {
  getGoogleStatus,
  getGoogleConnectUrl,
  disconnectGoogle,
  type GoogleConnectionStatus,
} from '@/services/googleCalendar'
import { ConfigSidebar } from '@/components/ConfigSidebar'
import { Button } from '@/components/ui/button'
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
import { getRoleLabel } from '@/lib/roles'
import { CheckCircle2, Calendar, Loader2, Sun, Moon, Laptop } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Configuracoes() {
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()

  // Trocar senha
  const [sendingReset, setSendingReset] = useState(false)
  const [resetMessage, setResetMessage] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)

  // Google Calendar
  const [googleStatus, setGoogleStatus] = useState<GoogleConnectionStatus | null>(null)
  const [googleEmail, setGoogleEmail] = useState<string>('')
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false)
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false)
  const [googleError, setGoogleError] = useState<string | null>(null)

  const isBrokerOrAdmin = user?.role === 'admin' || user?.role === 'corretor'

  const loadGoogle = useCallback(async () => {
    if (!isBrokerOrAdmin) return
    setLoadingGoogle(true)
    try {
      const res = await getGoogleStatus()
      setGoogleStatus(res.status)
      setGoogleEmail(res.google_email || '')
    } catch {
      setGoogleStatus('nao_conectado')
      setGoogleEmail('')
    } finally {
      setLoadingGoogle(false)
    }
  }, [isBrokerOrAdmin])

  useEffect(() => {
    loadGoogle()
  }, [loadGoogle])

  const handlePasswordReset = async () => {
    if (!user?.email) return
    setSendingReset(true)
    setResetMessage(null)
    setResetError(null)
    try {
      await requestPasswordReset(user.email)
      setResetMessage(`Enviamos um link para ${user.email}.`)
    } catch {
      setResetError('Não foi possível enviar o e-mail de redefinição de senha.')
    } finally {
      setSendingReset(false)
    }
  }

  const handleConnectGoogle = async () => {
    setGoogleError(null)
    try {
      const url = await getGoogleConnectUrl()
      if (url) {
        window.location.href = url
      }
    } catch {
      setGoogleError('Integração com o Google ainda não configurada.')
    }
  }

  const handleDisconnectGoogle = async () => {
    setDisconnectingGoogle(true)
    try {
      await disconnectGoogle()
      setGoogleStatus('nao_conectado')
      setGoogleEmail('')
      setDisconnectModalOpen(false)
    } catch {
      setDisconnectModalOpen(false)
    } finally {
      setDisconnectingGoogle(false)
    }
  }

  // Controle do indicador deslizante do seletor de tema
  const themeOptions: { value: ThemePreference; label: string; icon: typeof Laptop }[] = [
    { value: 'auto', label: 'Automático', icon: Laptop },
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Escuro', icon: Moon },
  ]

  const themeContainerRef = useRef<HTMLDivElement>(null)
  const [sliderStyle, setSliderStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  })

  useEffect(() => {
    if (!themeContainerRef.current) return
    const activeBtn = themeContainerRef.current.querySelector<HTMLButtonElement>(
      `[data-theme-value="${theme}"]`,
    )
    if (activeBtn) {
      setSliderStyle({
        left: activeBtn.offsetLeft,
        width: activeBtn.offsetWidth,
      })
    }
  }, [theme])

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold font-sans tracking-tight text-foreground">
          Configurações
        </h1>
        <p className="text-sm font-sans text-muted-foreground mt-0.5">
          Gerencie sua conta, preferências de visualização e integrações.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Barra lateral de Configurações (220 px no desktop, no topo no mobile) */}
        <ConfigSidebar currentSection="minha-conta" />

        {/* Conteúdo à direita */}
        <div className="flex-1 space-y-6 w-full min-w-0">
          {/* Cartão Minha conta */}
          <div className="rounded-lg border border-border bg-card p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold font-sans text-foreground">Minha conta</h2>
                <p className="text-xs font-sans text-muted-foreground mt-0.5">
                  Informações de identificação e segurança de acesso.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handlePasswordReset}
                disabled={sendingReset}
                className="self-start sm:self-auto rounded-md font-sans text-xs h-9 min-h-[36px]"
              >
                {sendingReset ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <span>Trocar senha</span>
                )}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border/60">
              <div>
                <span className="text-xs font-sans text-muted-foreground block">Nome</span>
                <span className="text-sm font-sans font-medium text-foreground block mt-0.5 truncate">
                  {user?.name || 'Não informado'}
                </span>
              </div>
              <div>
                <span className="text-xs font-sans text-muted-foreground block">Papel</span>
                <span className="text-sm font-sans font-medium text-foreground block mt-0.5">
                  {getRoleLabel(user?.role)}
                </span>
              </div>
              <div>
                <span className="text-xs font-sans text-muted-foreground block">E-mail</span>
                <span className="text-sm font-mono text-foreground block mt-0.5 truncate">
                  {user?.email}
                </span>
              </div>
            </div>

            {resetMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs rounded-md font-sans flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{resetMessage}</span>
              </div>
            )}

            {resetError && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 text-destructive text-xs rounded-md font-sans">
                {resetError}
              </div>
            )}
          </div>

          {/* Cartão Aparência (com indicador que desliza 220ms) */}
          <div className="rounded-lg border border-border bg-card p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold font-sans text-foreground">Aparência</h2>
              <p className="text-xs font-sans text-muted-foreground mt-0.5">
                Escolha o tema visual do sistema para este dispositivo.
              </p>
            </div>

            <div
              ref={themeContainerRef}
              role="radiogroup"
              aria-label="Escolha do tema"
              className="relative inline-flex items-center rounded-lg border border-border bg-muted/50 p-1"
            >
              {/* Indicador que desliza */}
              <div
                className="absolute top-1 bottom-1 rounded-md bg-background shadow-sm transition-all duration-[220ms] ease-out pointer-events-none"
                style={{
                  left: `${sliderStyle.left}px`,
                  width: `${sliderStyle.width}px`,
                }}
                aria-hidden="true"
              />

              {themeOptions.map((opt) => {
                const isSelected = theme === opt.value
                const Icon = opt.icon
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    data-theme-value={opt.value}
                    onClick={() => setTheme(opt.value)}
                    className={cn(
                      'relative z-10 flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-sans font-medium rounded-md transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isSelected
                        ? 'text-foreground font-semibold'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Cartão Google Agenda */}
          {isBrokerOrAdmin && (
            <div className="rounded-lg border border-border bg-card p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold font-sans text-foreground flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    Google Agenda
                  </h2>
                  <p className="text-xs font-sans text-muted-foreground mt-0.5">
                    Sincronização automática das visitas criadas no Imobdigital.
                  </p>
                </div>
              </div>

              {loadingGoogle ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 font-sans">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Consultando status da agenda...</span>
                </div>
              ) : googleStatus === 'conectado' ? (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-2 text-xs font-sans text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Conectada como {googleEmail || 'sua conta'}</span>
                  </div>
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDisconnectModalOpen(true)}
                      className="rounded-md font-sans text-xs"
                    >
                      Desconectar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <p className="text-xs font-sans text-muted-foreground">Não conectada</p>
                  <div>
                    <Button
                      type="button"
                      onClick={handleConnectGoogle}
                      className="rounded-md font-sans text-xs"
                    >
                      Conectar Google Agenda
                    </Button>
                  </div>
                  {googleError && (
                    <p className="text-xs text-destructive font-sans">{googleError}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground font-sans max-w-xl">
                    O Imobdigital só cria, atualiza e remove compromissos de visitas no seu
                    calendário. Não lê seus outros eventos e você pode desconectar a qualquer
                    momento.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Desconectar Google Agenda */}
      <AlertDialog open={disconnectModalOpen} onOpenChange={setDisconnectModalOpen}>
        <AlertDialogContent className="rounded-lg p-6 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-normal font-sans text-foreground">
              Desconectar Google Agenda
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-sans text-muted-foreground">
              Os eventos futuros criados pelo Imobdigital serão removidos da sua agenda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 pt-2">
            <AlertDialogCancel
              disabled={disconnectingGoogle}
              className="rounded-md font-normal font-sans"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDisconnectGoogle()
              }}
              disabled={disconnectingGoogle}
              className="rounded-md font-normal font-sans bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnectingGoogle ? 'Desconectando...' : 'Desconectar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
