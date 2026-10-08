import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  exportBackup,
  createBackupReminder,
  formatBackupErrorMessage,
  BackupExportResult,
} from '@/services/backup'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Download,
  BellRing,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Database,
  Users,
  UserCheck,
  Home,
  CalendarDays,
  CheckSquare,
  Shield,
  RefreshCw,
  Info,
} from 'lucide-react'

export default function Backup() {
  const { user } = useAuth()
  const role = user?.role
  const isAdmin = role === 'admin'

  // Estados de exportação
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [lastExport, setLastExport] = useState<{
    result: BackupExportResult
    downloadedAt: Date
  } | null>(null)

  // Estados de lembrete semanal (apenas admin)
  const [isReminding, setIsReminding] = useState(false)
  const [remindMessage, setRemindMessage] = useState<{
    type: 'success' | 'info' | 'error'
    text: string
  } | null>(null)

  const handleExport = async () => {
    setIsExporting(true)
    setExportError(null)
    try {
      const result = await exportBackup()
      setLastExport({
        result,
        downloadedAt: new Date(),
      })
    } catch (err) {
      setExportError(
        formatBackupErrorMessage(err, 'Falha ao gerar o arquivo de backup. Tente novamente.'),
      )
    } finally {
      setIsExporting(false)
    }
  }

  const handleCreateReminder = async () => {
    setIsReminding(true)
    setRemindMessage(null)
    try {
      const res = await createBackupReminder()
      if (res.created) {
        setRemindMessage({
          type: 'success',
          text: 'Tarefa criada para o SDR',
        })
      } else {
        setRemindMessage({
          type: 'info',
          text: 'Já existe um lembrete aberto',
        })
      }
    } catch (err) {
      setRemindMessage({
        type: 'error',
        text: formatBackupErrorMessage(err, 'Não foi possível criar o lembrete semanal.'),
      })
    } finally {
      setIsReminding(false)
    }
  }

  const formatDateTime = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${day}/${month}/${year} às ${hours}:${minutes}:${seconds}`
  }

  // Resumo de escopo
  const renderScopeNotice = (scope?: string) => {
    const isScopeFull = scope === 'completo' || (scope === undefined && isAdmin)

    if (isScopeFull) {
      return (
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-xs sm:text-sm text-foreground">
          <Shield className="h-5 w-5 shrink-0 text-primary mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block">Escopo do arquivo:</span>
            <p className="text-muted-foreground leading-relaxed">
              Backup completo: inclui CPF e data de nascimento. Guarde com cuidado.
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4 text-xs sm:text-sm text-foreground">
        <Info className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold block">Escopo do arquivo:</span>
          <p className="text-muted-foreground leading-relaxed">
            Backup operacional: não inclui CPF nem data de nascimento dos clientes
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Topo: Título da tela e explicação curta mandatória */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Backup</h1>
          <Badge variant="outline" className="text-[11px] font-normal uppercase">
            {role === 'admin' ? 'Admin' : 'SDR'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Baixe uma cópia dos dados da imobiliária e guarde fora do sistema (por exemplo, no seu
          Drive). Faça isto toda semana.
        </p>
      </div>

      {/* Cartão principal de Ações de Backup */}
      <Card className="rounded-lg border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Database className="h-5 w-5 text-foreground" />
              Exportação de dados
            </CardTitle>
            <span className="text-xs eyebrow text-muted-foreground">JSON padrão</span>
          </div>
          <CardDescription className="text-xs sm:text-sm text-muted-foreground">
            A geração consolida registros de leads, clientes, imóveis, visitas e tarefas da
            imobiliária. O processo pode levar de 5 a 30 segundos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Informação prévia de escopo conforme papel atual */}
          {renderScopeNotice(lastExport?.result.data.scope)}

          {/* Botões de ação */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="h-11 min-h-[44px] px-6 gap-2 font-normal rounded-lg w-full sm:w-auto justify-center"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span>Gerando backup (5 a 30s)...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 shrink-0" />
                  <span>Exportar dados</span>
                </>
              )}
            </Button>

            {isAdmin && (
              <Button
                variant="outline"
                onClick={handleCreateReminder}
                disabled={isReminding || isExporting}
                className="h-11 min-h-[44px] px-5 gap-2 font-normal rounded-lg border-border w-full sm:w-auto justify-center"
              >
                {isReminding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <BellRing className="h-4 w-4 shrink-0" />
                    <span>Criar lembrete semanal agora</span>
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Mensagem de resultado do lembrete (Admin) */}
          {remindMessage && (
            <Alert
              className={`rounded-lg ${
                remindMessage.type === 'success'
                  ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200'
                  : remindMessage.type === 'error'
                    ? 'border-destructive/30 bg-destructive/5 text-destructive'
                    : 'border-border bg-muted/40 text-foreground'
              }`}
            >
              {remindMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : remindMessage.type === 'error' ? (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              ) : (
                <Info className="h-4 w-4 text-muted-foreground" />
              )}
              <AlertTitle className="text-sm font-medium">Lembrete de backup</AlertTitle>
              <AlertDescription className="text-xs sm:text-sm mt-1">
                {remindMessage.text}
              </AlertDescription>
            </Alert>
          )}

          {/* Erro ao exportar dados com opção de tentar novamente */}
          {exportError && (
            <Alert variant="destructive" className="rounded-lg">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-sm font-medium">
                Não foi possível baixar o backup
              </AlertTitle>
              <AlertDescription className="mt-1 space-y-3">
                <p className="text-xs sm:text-sm">{exportError}</p>
                <div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExport}
                    className="h-9 min-h-[44px] px-3 gap-1.5 text-xs rounded-md border-destructive/40 hover:bg-destructive/10"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Tentar novamente
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Indicador de carregamento enquanto espera */}
          {isExporting && (
            <div className="rounded-lg border border-border bg-muted/20 p-6 flex flex-col items-center justify-center text-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Gerando arquivo de backup...</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Isso pode levar de 5 a 30 segundos dependendo do volume de dados. Por favor,
                  aguarde o download iniciar automaticamente.
                </p>
              </div>
            </div>
          )}

          {/* Resultado de sucesso do último download com totais de counts */}
          {lastExport && !isExporting && (
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-medium">Backup baixado</span>
                </div>
                <div className="text-xs text-muted-foreground tabular">
                  {formatDateTime(lastExport.downloadedAt)}
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Arquivo salvo no navegador:{' '}
                <span className="font-mono text-foreground">{lastExport.result.filename}</span>
              </div>

              {/* Cards com os totais de counts devolvidos (leads, clientes, imóveis, visitas, tarefas) */}
              <div className="space-y-2">
                <div className="text-xs eyebrow text-muted-foreground">Totais exportados</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="rounded-lg border border-border bg-card p-3 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Leads</span>
                    </div>
                    <div className="text-xl font-normal tabular text-foreground">
                      {lastExport.result.data.counts.leads ?? 0}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-3 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <UserCheck className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Clientes</span>
                    </div>
                    <div className="text-xl font-normal tabular text-foreground">
                      {lastExport.result.data.counts.clients ?? 0}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-3 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Home className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Imóveis</span>
                    </div>
                    <div className="text-xl font-normal tabular text-foreground">
                      {lastExport.result.data.counts.properties ?? 0}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-3 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Visitas</span>
                    </div>
                    <div className="text-xl font-normal tabular text-foreground">
                      {lastExport.result.data.counts.visits ?? 0}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-3 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckSquare className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Tarefas</span>
                    </div>
                    <div className="text-xl font-normal tabular text-foreground">
                      {lastExport.result.data.counts.tasks ?? 0}
                    </div>
                  </div>
                </div>

                {/* Detalhes extras se disponíveis (fotos, condomínios, usuários) */}
                <div className="pt-2 text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                  {lastExport.result.data.counts.condominiums !== undefined && (
                    <span>
                      Condomínios:{' '}
                      <strong className="tabular text-foreground">
                        {lastExport.result.data.counts.condominiums}
                      </strong>
                    </span>
                  )}
                  {lastExport.result.data.counts.property_photos !== undefined && (
                    <span>
                      Fotos de imóveis:{' '}
                      <strong className="tabular text-foreground">
                        {lastExport.result.data.counts.property_photos}
                      </strong>
                    </span>
                  )}
                  {lastExport.result.data.counts.lead_events !== undefined && (
                    <span>
                      Eventos de leads:{' '}
                      <strong className="tabular text-foreground">
                        {lastExport.result.data.counts.lead_events}
                      </strong>
                    </span>
                  )}
                  {lastExport.result.data.counts.users !== undefined && (
                    <span>
                      Usuários:{' '}
                      <strong className="tabular text-foreground">
                        {lastExport.result.data.counts.users}
                      </strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dicas de boas práticas e segurança */}
      <Card className="rounded-lg border-border bg-muted/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-foreground">
            Boas práticas de segurança
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside leading-relaxed">
            <li>
              Guarde o arquivo em um local seguro com autenticação em duas etapas (como Google
              Drive, OneDrive ou disco criptografado).
            </li>
            <li>
              Nunca compartilhe arquivos de backup por canais abertos ou aplicativos de mensagem
              desprotegidos.
            </li>
            <li>O sistema realiza o registro de auditoria a cada exportação gerada.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
