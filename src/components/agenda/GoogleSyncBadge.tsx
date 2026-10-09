import React, { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/contexts/AuthContext'
import { getGoogleConnectUrl, GoogleIntegrationConfigError } from '@/services/googleCalendar'
import { Check, Clock, AlertCircle, Calendar, ExternalLink, Loader2 } from 'lucide-react'

export interface GoogleSyncBadgeProps {
  /**
   * Valor de google_sync vindo do registro da visita ou endpoint.
   * Valores: 'sincronizada' | 'pendente' | 'falhou' | 'nao_aplicavel' | '' | undefined
   */
  googleSync?: string | null
  /**
   * Id do corretor responsável pela visita (broker_id)
   */
  brokerId?: string | null
  /**
   * Se o corretor precisa reconectar a conta Google ('reconectar')
   */
  brokerNeedsReconnect?: boolean
  /**
   * Situação da visita ('confirmada', 'agendada', etc.)
   */
  visitStatus?: string
  /**
   * Se os botões ou dicas de ação rápida devem ser exibidos (padrão true)
   */
  showConnectAction?: boolean
  /**
   * Classe customizada
   */
  className?: string
}

export function GoogleSyncBadge({
  googleSync,
  brokerId,
  brokerNeedsReconnect = false,
  visitStatus = 'confirmada',
  showConnectAction = true,
  className,
}: GoogleSyncBadgeProps) {
  const { user } = useAuth()
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

  // Só o próprio corretor pode conectar
  const isMyVisit = !!(user && brokerId && user.id === brokerId)

  const handleConnect = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setConnectError(null)
    setConnecting(true)
    try {
      const url = await getGoogleConnectUrl()
      if (url) {
        window.location.href = url
      }
    } catch (err: unknown) {
      if (err instanceof GoogleIntegrationConfigError) {
        setConnectError('Integração com o Google ainda não configurada.')
      } else {
        const errorObj = err as { status?: number; data?: { message?: string } } | undefined
        if (errorObj?.status === 503) {
          setConnectError('Integração com o Google ainda não configurada.')
        } else {
          setConnectError('Integração com o Google ainda não configurada.')
        }
      }
      setConnecting(false)
    }
  }

  const raw = (googleSync || '').trim()

  // 1. sincronizada = "Na agenda Google" (verde)
  if (raw === 'sincronizada') {
    return (
      <Badge
        variant="outline"
        className={`border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-normal gap-1 text-[11px] ${className || ''}`}
        title="Evento adicionado à agenda Google do corretor"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0" />
        <span>Na agenda Google</span>
      </Badge>
    )
  }

  // 2. pendente = "Aguardando agenda Google" (amarelo) OU "Aguardando reconexão do Google" se o corretor precisa reconectar
  if (raw === 'pendente') {
    if (brokerNeedsReconnect) {
      return (
        <div className={`inline-flex items-center gap-1.5 ${className || ''}`}>
          <Badge
            variant="outline"
            className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-normal gap-1 text-[11px]"
            title="Aguardando o corretor reconectar a agenda Google"
          >
            <Clock className="h-3 w-3 shrink-0" />
            <span>Aguardando reconexão do Google</span>
          </Badge>
          {isMyVisit && showConnectAction && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleConnect}
              disabled={connecting}
              className="h-6 px-2 text-[10px] rounded-full border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 gap-1"
            >
              {connecting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : null}
              <span>Reconectar</span>
            </Button>
          )}
        </div>
      )
    }

    return (
      <Badge
        variant="outline"
        className={`border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-normal gap-1 text-[11px] ${className || ''}`}
        title="Sincronização em andamento com a agenda Google"
      >
        <Clock className="h-3 w-3 shrink-0" />
        <span>Aguardando agenda Google</span>
      </Badge>
    )
  }

  // 3. falhou = "Falhou ao sincronizar" (vermelho, com dica "avise o administrador")
  if (raw === 'falhou') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-help">
              <Badge
                variant="destructive"
                className={`font-normal gap-1 text-[11px] ${className || ''}`}
              >
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>Falhou ao sincronizar</span>
              </Badge>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <p>avise o administrador</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // 4. nao_aplicavel ou vazio em visita confirmada = "Fora da agenda Google" (cinza)
  // e, só para o próprio corretor, o botão Conectar e adicionar que leva à conexão Google
  if (visitStatus === 'confirmada' && (raw === 'nao_aplicavel' || raw === '')) {
    return (
      <div className={`inline-flex flex-wrap items-center gap-1.5 ${className || ''}`}>
        <Badge variant="secondary" className="font-normal text-muted-foreground gap-1 text-[11px]">
          <span>Fora da agenda Google</span>
        </Badge>

        {isMyVisit && showConnectAction && (
          <div className="inline-flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleConnect}
              disabled={connecting}
              className="h-6 px-2 text-[10px] rounded-full gap-1 font-normal"
              title="Conectar sua conta Google Agenda para sincronizar visitas"
            >
              {connecting ? (
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
              ) : (
                <Calendar className="h-2.5 w-2.5" />
              )}
              <span>Conectar e adicionar</span>
            </Button>
            {connectError && <span className="text-[10px] text-destructive">{connectError}</span>}
          </div>
        )}
      </div>
    )
  }

  return null
}

export default GoogleSyncBadge
