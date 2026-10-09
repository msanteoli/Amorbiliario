import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { finishGoogleConnection, extractGoogleErrorMessage } from '@/services/googleCalendar'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

// Guard a nível de módulo para garantir EXATAMENTE UMA execução do POST finish,
// protegendo contra remontagens do React 18 StrictMode e chamadas simultâneas.
let moduleFinishExecuted = false

export const GoogleRetorno: React.FC = () => {
  const navigate = useNavigate()

  // Estados locais
  const [loading, setLoading] = useState(true)
  const [successEmail, setSuccessEmail] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Ref de instância por segurança adicional
  const instanceCalledRef = useRef(false)

  useEffect(() => {
    // 1. Título da aba em português
    const prevTitle = document.title
    document.title = 'Conectando agenda...'

    // 2. Extrai parâmetros da URL atual antes de limpar
    const searchParams = new URLSearchParams(window.location.search)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // 3. Limpa a barra de endereço com history.replaceState (sem code, state ou error),
    // antes de qualquer outra coisa, sem registrar code ou state.
    try {
      window.history.replaceState({}, document.title, window.location.pathname)
    } catch {
      // Ignora falhas em navegadores restritivos
    }

    // 4. Se o usuário recusou a autorização (?error=access_denied ou qualquer error)
    if (error) {
      setLoading(false)
      if (error === 'access_denied') {
        setErrorMessage('Você não autorizou o acesso. Nada foi conectado.')
      } else {
        setErrorMessage('Acesso não autorizado pelo Google.')
      }
      return () => {
        document.title = prevTitle
      }
    }

    // 5. Se não vieram os parâmetros necessários
    if (!code || !state) {
      setLoading(false)
      setErrorMessage('Parâmetros de autorização ausentes ou inválidos.')
      return () => {
        document.title = prevTitle
      }
    }

    // 6. Chamada única protegida com module guard e ref
    if (moduleFinishExecuted || instanceCalledRef.current) {
      return () => {
        document.title = prevTitle
      }
    }
    moduleFinishExecuted = true
    instanceCalledRef.current = true

    // Dispara POST /google/finish
    let isMounted = true
    finishGoogleConnection({ code, state })
      .then((res) => {
        if (!isMounted) return
        setLoading(false)
        setSuccessEmail(res.google_email || 'sua conta')
        // Em 200: redireciona para a Hoje depois de 2 segundos
        setTimeout(() => {
          navigate('/hoje', { replace: true })
        }, 2000)
      })
      .catch((err) => {
        if (!isMounted) return
        setLoading(false)
        const msg = extractGoogleErrorMessage(
          err,
          'Não foi possível conectar a agenda do Google. Tente de novo.',
        )
        setErrorMessage(msg)
      })

    return () => {
      isMounted = false
      document.title = prevTitle
    }
  }, [navigate])

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-4 py-8 text-foreground">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 sm:p-8 shadow-none text-center">
        {/* Estado 1: Carregando / Conectando */}
        {loading && (
          <div className="flex flex-col items-center justify-center space-y-4 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-foreground" />
            <div className="space-y-1">
              <h1 className="text-base sm:text-lg font-medium text-foreground">
                Conectando sua agenda...
              </h1>
              <p className="text-xs text-muted-foreground">
                Finalizando autorização com a Google Agenda. Por favor, aguarde.
              </p>
            </div>
          </div>
        )}

        {/* Estado 2: Sucesso 200 */}
        {!loading && successEmail && (
          <div className="flex flex-col items-center justify-center space-y-4 py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-base sm:text-lg font-medium text-foreground">
                Agenda conectada: {successEmail}
              </h1>
              <p className="text-xs text-muted-foreground">
                Redirecionando para o painel em instantes...
              </p>
            </div>
          </div>
        )}

        {/* Estado 3: Erro ou Recusa */}
        {!loading && errorMessage && (
          <div className="flex flex-col items-center justify-center space-y-4 py-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-base sm:text-lg font-medium text-foreground">{errorMessage}</h1>
            </div>
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  // Reseta guard para permitir nova tentativa se voltar e tentar conectar
                  moduleFinishExecuted = false
                  navigate('/hoje', { replace: true })
                }}
                className="rounded-full font-normal min-h-[44px] h-11 px-6 text-sm"
              >
                {errorMessage.includes('não autorizou') ? 'Voltar para Hoje' : 'Tentar de novo'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default GoogleRetorno
