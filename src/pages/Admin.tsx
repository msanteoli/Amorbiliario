import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  AdminUserItem,
  listAdminUsers,
  inviteAdminUser,
  reinviteAdminUser,
  getUserOpenItems,
  updateAdminUser,
  getOrganization,
  updateOrganization,
  OrganizationRecord,
  listAuditLogs,
  AuditLogRecord,
  AUDIT_ACTION_LABELS,
  AUDIT_REASON_LABELS,
  formatAdminErrorMessage,
} from '@/services/admin'
import { formatDateTimeBahia, bahiaLocalToIsoUtc } from '@/services/visits'
import { getRoleLabel } from '@/lib/roles'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  Users,
  Building,
  ShieldCheck,
  Plus,
  Mail,
  Edit2,
  Send,
  UserX,
  UserCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FilterX,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

export default function Admin() {
  const { user: currentUser } = useAuth()

  // Abas
  const [activeTab, setActiveTab] = useState<'usuarios' | 'organizacao' | 'auditoria'>('usuarios')

  // Feedback global da página
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)

  // ═════════════════════════════════════════════════════════════════
  // ABA 1: USUÁRIOS
  // ═════════════════════════════════════════════════════════════════
  const [users, setUsers] = useState<AdminUserItem[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Modal Convidar Usuário
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'sdr' | 'corretor'>('corretor')
  const [submittingInvite, setSubmittingInvite] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  // Modal Editar Usuário
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUserItem | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<'admin' | 'sdr' | 'corretor'>('corretor')
  const [submittingEdit, setSubmittingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Reenviar convite
  const [reinvitingId, setReinvitingId] = useState<string | null>(null)

  // Modal Confirmação de Desativação
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false)
  const [deactivatingUser, setDeactivatingUser] = useState<AdminUserItem | null>(null)
  const [openItems, setOpenItems] = useState<{
    leads: number
    visits: number
    tasks: number
  } | null>(null)
  const [loadingOpenItems, setLoadingOpenItems] = useState(false)
  const [submittingDeactivate, setSubmittingDeactivate] = useState(false)

  // Carregar lista de usuários
  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    try {
      const list = await listAdminUsers()
      setUsers(list)
    } catch (err) {
      setGlobalError(formatAdminErrorMessage(err, 'Erro ao carregar usuários.'))
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'usuarios') {
      loadUsers()
    }
  }, [activeTab, loadUsers])

  // Ação Convidar
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteError(null)

    const trimmedName = inviteName.trim()
    const trimmedEmail = inviteEmail.trim().toLowerCase()

    if (trimmedName.length < 2) {
      setInviteError('Informe o nome da pessoa.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setInviteError('Informe um e-mail válido.')
      return
    }

    setSubmittingInvite(true)
    try {
      const res = await inviteAdminUser({
        name: trimmedName,
        email: trimmedEmail,
        role: inviteRole,
      })

      setInviteModalOpen(false)
      setInviteName('')
      setInviteEmail('')
      setInviteRole('corretor')

      if (res.email_sent === false) {
        setGlobalSuccess('Usuário criado, mas o e-mail não foi enviado. Use Reenviar convite.')
      } else {
        setGlobalSuccess('Convite enviado com sucesso.')
      }

      await loadUsers()
    } catch (err) {
      setInviteError(formatAdminErrorMessage(err, 'Falha ao convidar usuário.'))
    } finally {
      setSubmittingInvite(false)
    }
  }

  // Ação Abrir Edição
  const handleOpenEdit = (user: AdminUserItem) => {
    setEditingUser(user)
    setEditName(user.name || '')
    setEditRole((user.role as 'admin' | 'sdr' | 'corretor') || 'corretor')
    setEditError(null)
    setEditModalOpen(true)
  }

  // Ação Salvar Edição
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    setEditError(null)

    const trimmedName = editName.trim()
    if (trimmedName.length < 2) {
      setEditError('Informe o nome da pessoa.')
      return
    }

    const isSelf = editingUser.id === currentUser?.id
    const changes: { name?: string; role?: string } = {}

    if (trimmedName !== (editingUser.name || '')) {
      changes.name = trimmedName
    }
    if (!isSelf && editRole !== editingUser.role) {
      changes.role = editRole
    }

    if (Object.keys(changes).length === 0) {
      setEditModalOpen(false)
      return
    }

    setSubmittingEdit(true)
    try {
      await updateAdminUser(editingUser.id, changes)
      setEditModalOpen(false)
      setGlobalSuccess('Usuário atualizado com sucesso.')
      await loadUsers()
    } catch (err) {
      setEditError(formatAdminErrorMessage(err, 'Falha ao atualizar usuário.'))
    } finally {
      setSubmittingEdit(false)
    }
  }

  // Ação Reenviar Convite
  const handleReinvite = async (user: AdminUserItem) => {
    setReinvitingId(user.id)
    setGlobalError(null)
    try {
      const res = await reinviteAdminUser(user.id)
      if (res.email_sent === false) {
        setGlobalError('Não foi possível enviar o e-mail. Tente novamente mais tarde.')
      } else {
        setGlobalSuccess(`Convite reenviado com sucesso para ${user.email}.`)
      }
    } catch (err) {
      setGlobalError(formatAdminErrorMessage(err, 'Falha ao reenviar convite.'))
    } finally {
      setReinvitingId(null)
    }
  }

  // Ação Iniciar Desativação (busca open items)
  const handleStartDeactivate = async (user: AdminUserItem) => {
    setDeactivatingUser(user)
    setOpenItems(null)
    setDeactivateModalOpen(true)
    setLoadingOpenItems(true)

    try {
      const items = await getUserOpenItems(user.id)
      setOpenItems(items)
    } catch (err) {
      setGlobalError(formatAdminErrorMessage(err, 'Falha ao consultar pendências do usuário.'))
      setDeactivateModalOpen(false)
    } finally {
      setLoadingOpenItems(false)
    }
  }

  // Ação Confirmar Desativação
  const handleConfirmDeactivate = async () => {
    if (!deactivatingUser) return
    setSubmittingDeactivate(true)
    try {
      await updateAdminUser(deactivatingUser.id, { active: false })
      setDeactivateModalOpen(false)
      setGlobalSuccess(`Usuário ${deactivatingUser.name || deactivatingUser.email} foi desativado.`)
      await loadUsers()
    } catch (err) {
      setGlobalError(formatAdminErrorMessage(err, 'Falha ao desativar usuário.'))
    } finally {
      setSubmittingDeactivate(false)
    }
  }

  // Ação Reativar
  const handleReactivate = async (user: AdminUserItem) => {
    try {
      await updateAdminUser(user.id, { active: true })
      setGlobalSuccess(`Usuário ${user.name || user.email} foi reativado.`)
      await loadUsers()
    } catch (err) {
      setGlobalError(formatAdminErrorMessage(err, 'Falha ao reativar usuário.'))
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // ABA 2: ORGANIZAÇÃO
  // ═════════════════════════════════════════════════════════════════
  const [org, setOrg] = useState<OrganizationRecord | null>(null)
  const [loadingOrg, setLoadingOrg] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [orgPhone, setOrgPhone] = useState('')
  const [orgEmail, setOrgEmail] = useState('')
  const [orgAddress, setOrgAddress] = useState('')
  const [submittingOrg, setSubmittingOrg] = useState(false)

  const loadOrg = useCallback(async () => {
    setLoadingOrg(true)
    try {
      const o = await getOrganization()
      setOrg(o)
      setOrgName(o.name || '')
      setOrgPhone(o.contact_phone || '')
      setOrgEmail(o.contact_email || '')
      setOrgAddress(o.address || '')
    } catch (err) {
      setGlobalError(formatAdminErrorMessage(err, 'Erro ao carregar dados da organização.'))
    } finally {
      setLoadingOrg(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'organizacao') {
      loadOrg()
    }
  }, [activeTab, loadOrg])

  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!org) return

    setGlobalError(null)
    setGlobalSuccess(null)

    const changes: {
      name?: string
      contact_phone?: string
      contact_email?: string
      address?: string
    } = {}

    if (orgName.trim() !== (org.name || '')) changes.name = orgName.trim()
    if (orgPhone.trim() !== (org.contact_phone || '')) changes.contact_phone = orgPhone.trim()
    if (orgEmail.trim() !== (org.contact_email || '')) changes.contact_email = orgEmail.trim()
    if (orgAddress.trim() !== (org.address || '')) changes.address = orgAddress.trim()

    if (Object.keys(changes).length === 0) {
      setGlobalSuccess('Dados da organização salvos.')
      return
    }

    setSubmittingOrg(true)
    try {
      const updated = await updateOrganization(org.id, changes)
      setOrg(updated)
      setOrgName(updated.name || '')
      setOrgPhone(updated.contact_phone || '')
      setOrgEmail(updated.contact_email || '')
      setOrgAddress(updated.address || '')
      setGlobalSuccess('Dados da organização salvos.')
    } catch (err) {
      setGlobalError(formatAdminErrorMessage(err, 'Falha ao salvar organização.'))
    } finally {
      setSubmittingOrg(false)
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // ABA 3: AUDITORIA
  // ═════════════════════════════════════════════════════════════════
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([])
  const [auditPage, setAuditPage] = useState(1)
  const [auditTotalPages, setAuditTotalPages] = useState(1)
  const [auditTotalItems, setAuditTotalItems] = useState(0)
  const [loadingAudit, setLoadingAudit] = useState(false)

  // Filtros de auditoria
  const [startDateBahia, setStartDateBahia] = useState('') // yyyy-mm-dd
  const [endDateBahia, setEndDateBahia] = useState('') // yyyy-mm-dd
  const [selectedAction, setSelectedAction] = useState<string>('all')
  const [selectedActor, setSelectedActor] = useState<string>('all')
  const [selectedCollection, setSelectedCollection] = useState<string>('all')

  // Mapa de nomes de usuários por actor_id
  const userMap = useMemo(() => {
    const map = new Map<string, string>()
    users.forEach((u) => {
      map.set(u.id, u.name || u.email || 'Usuário')
    })
    return map
  }, [users])

  // Lista de coleções conhecidas
  const KNOWN_COLLECTIONS = [
    'users',
    'organizations',
    'leads',
    'visits',
    'properties',
    'tasks',
    'clients',
  ]

  // Carregar lista de auditoria
  const loadAudit = useCallback(async () => {
    setLoadingAudit(true)
    try {
      // Converte datas Bahia (yyyy-mm-dd) para ISO UTC
      let startDateIso: string | undefined
      let endDateIso: string | undefined

      if (startDateBahia) {
        startDateIso = bahiaLocalToIsoUtc(`${startDateBahia}T00:00`)
      }
      if (endDateBahia) {
        endDateIso = bahiaLocalToIsoUtc(`${endDateBahia}T23:59:59`)
      }

      const res = await listAuditLogs({
        page: auditPage,
        perPage: 50,
        startDateIso,
        endDateIso,
        action: selectedAction,
        actorId: selectedActor,
        collectionName: selectedCollection,
      })

      setAuditLogs(res.items)
      setAuditTotalPages(res.totalPages || 1)
      setAuditTotalItems(res.totalItems)
    } catch (err) {
      setGlobalError(formatAdminErrorMessage(err, 'Erro ao carregar auditoria.'))
    } finally {
      setLoadingAudit(false)
    }
  }, [auditPage, startDateBahia, endDateBahia, selectedAction, selectedActor, selectedCollection])

  useEffect(() => {
    if (activeTab === 'auditoria') {
      // Assegura que a lista de usuários esteja carregada para mapear actor_id -> nome
      if (users.length === 0) {
        loadUsers()
      }
      loadAudit()
    }
  }, [activeTab, loadAudit, loadUsers, users.length])

  const handleClearAuditFilters = () => {
    setStartDateBahia('')
    setEndDateBahia('')
    setSelectedAction('all')
    setSelectedActor('all')
    setSelectedCollection('all')
    setAuditPage(1)
  }

  const hasAuditFilters =
    Boolean(startDateBahia) ||
    Boolean(endDateBahia) ||
    selectedAction !== 'all' ||
    selectedActor !== 'all' ||
    selectedCollection !== 'all'

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Administração
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie os usuários da equipe, configurações da organização e registro de auditoria.
          </p>
        </div>
      </div>

      {/* Alertas globais de Sucesso ou Erro */}
      {globalSuccess && (
        <Alert className="bg-emerald-50 text-emerald-900 border-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="font-medium text-sm flex items-center justify-between">
            <span>{globalSuccess}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setGlobalSuccess(null)}
              className="h-6 text-xs"
            >
              Fechar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {globalError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="font-medium text-sm flex items-center justify-between">
            <span>{globalError}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setGlobalError(null)}
              className="h-6 text-xs text-destructive-foreground hover:bg-destructive/20"
            >
              Fechar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Abas */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setGlobalSuccess(null)
          setGlobalError(null)
          setActiveTab(val as 'usuarios' | 'organizacao' | 'auditoria')
        }}
        className="w-full space-y-4"
      >
        <TabsList className="grid w-full sm:w-96 grid-cols-3">
          <TabsTrigger value="usuarios" className="gap-2 text-xs">
            <Users className="h-4 w-4" />
            <span>Usuários</span>
          </TabsTrigger>
          <TabsTrigger value="organizacao" className="gap-2 text-xs">
            <Building className="h-4 w-4" />
            <span>Organização</span>
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="gap-2 text-xs">
            <ShieldCheck className="h-4 w-4" />
            <span>Auditoria</span>
          </TabsTrigger>
        </TabsList>

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* ABA 1: USUÁRIOS */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <TabsContent value="usuarios" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Equipe da organização</h2>
              <p className="text-xs text-muted-foreground">
                Controle de acessos, papéis e convites de novos colaboradores
              </p>
            </div>
            <Button
              onClick={() => {
                setInviteError(null)
                setInviteModalOpen(true)
              }}
              className="gap-2 shrink-0 self-start sm:self-auto"
            >
              <Plus className="h-4 w-4" />
              <span>Convidar usuário</span>
            </Button>
          </div>

          {loadingUsers ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-md" />
              ))}
            </div>
          ) : (
            <>
              {/* Tabela no desktop */}
              <div className="hidden md:block rounded-md border bg-card shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                          Nenhum usuário cadastrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((u) => {
                        const isSelf = u.id === currentUser?.id
                        return (
                          <TableRow
                            key={u.id}
                            className={!u.active ? 'opacity-50 bg-muted/20' : undefined}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <span>{u.name || 'Sem nome'}</span>
                                {isSelf && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    Você
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {u.email}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="font-normal text-xs">
                                {getRoleLabel(u.role)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {u.active ? (
                                <Badge
                                  variant="outline"
                                  className="border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30"
                                >
                                  Ativo
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-zinc-300 text-zinc-600 bg-zinc-100 dark:bg-zinc-800"
                                >
                                  Inativo
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenEdit(u)}
                                  className="h-8 gap-1 text-xs"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                  <span>Editar</span>
                                </Button>

                                {u.active && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleReinvite(u)}
                                    disabled={reinvitingId === u.id}
                                    className="h-8 gap-1 text-xs"
                                    title="Reenviar convite por e-mail"
                                  >
                                    {reinvitingId === u.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Send className="h-3.5 w-3.5" />
                                    )}
                                    <span>Reenviar convite</span>
                                  </Button>
                                )}

                                {!isSelf && (
                                  <>
                                    {u.active ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleStartDeactivate(u)}
                                        className="h-8 gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                      >
                                        <UserX className="h-3.5 w-3.5" />
                                        <span>Desativar</span>
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleReactivate(u)}
                                        className="h-8 gap-1 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                      >
                                        <UserCheck className="h-3.5 w-3.5" />
                                        <span>Reativar</span>
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Cartões no celular */}
              <div className="md:hidden space-y-3">
                {users.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Nenhum usuário cadastrado.
                  </p>
                ) : (
                  users.map((u) => {
                    const isSelf = u.id === currentUser?.id
                    return (
                      <Card
                        key={u.id}
                        className={`p-4 space-y-3 shadow-sm ${
                          !u.active ? 'opacity-60 bg-muted/30' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-semibold text-sm text-foreground">
                                {u.name || 'Sem nome'}
                              </h3>
                              {isSelf && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  Você
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{u.email}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="font-normal text-xs">
                              {getRoleLabel(u.role)}
                            </Badge>
                            {u.active ? (
                              <Badge
                                variant="outline"
                                className="border-emerald-300 text-emerald-700 bg-emerald-50 text-[11px]"
                              >
                                Ativo
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-zinc-300 text-zinc-600 bg-zinc-100 text-[11px]"
                              >
                                Inativo
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(u)}
                            className="h-8 text-xs flex-1"
                          >
                            <Edit2 className="h-3 w-3 mr-1" />
                            Editar
                          </Button>

                          {u.active && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReinvite(u)}
                              disabled={reinvitingId === u.id}
                              className="h-8 text-xs flex-1"
                            >
                              {reinvitingId === u.id ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <Send className="h-3 w-3 mr-1" />
                              )}
                              Reenviar convite
                            </Button>
                          )}

                          {!isSelf && (
                            <>
                              {u.active ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleStartDeactivate(u)}
                                  className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive flex-1"
                                >
                                  <UserX className="h-3 w-3 mr-1" />
                                  Desativar
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleReactivate(u)}
                                  className="h-8 text-xs text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 flex-1"
                                >
                                  <UserCheck className="h-3 w-3 mr-1" />
                                  Reativar
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </Card>
                    )
                  })
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* ABA 2: ORGANIZAÇÃO */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <TabsContent value="organizacao">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Dados da organização</CardTitle>
              <CardDescription>
                Informações cadastrais e dados de contato corporativo exibidos aos clientes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingOrg ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <form onSubmit={handleOrgSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="org-name">Nome da organização</Label>
                      <Input
                        id="org-name"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="Ex: Imobiliária Modelo"
                        required
                        disabled={submittingOrg}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="org-phone">Telefone de contato</Label>
                      <Input
                        id="org-phone"
                        value={orgPhone}
                        onChange={(e) => setOrgPhone(e.target.value)}
                        placeholder="Ex: (71) 99999-9999"
                        disabled={submittingOrg}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="org-email">E-mail de contato</Label>
                      <Input
                        id="org-email"
                        type="email"
                        value={orgEmail}
                        onChange={(e) => setOrgEmail(e.target.value)}
                        placeholder="contato@empresa.com.br"
                        disabled={submittingOrg}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="org-address">Endereço</Label>
                      <Input
                        id="org-address"
                        value={orgAddress}
                        onChange={(e) => setOrgAddress(e.target.value)}
                        placeholder="Ex: Av. Tancredo Neves, 1000 - Salvador/BA"
                        disabled={submittingOrg}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/40 border">
                    <div>
                      <span className="text-xs font-semibold uppercase text-muted-foreground block">
                        Identificador (slug)
                      </span>
                      <span className="text-sm font-medium font-mono text-foreground mt-0.5 block">
                        {org?.slug || '-'}
                      </span>
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">
                        Definido no provisionamento e não editável.
                      </span>
                    </div>

                    <div>
                      <span className="text-xs font-semibold uppercase text-muted-foreground block">
                        Fuso horário
                      </span>
                      <span className="text-sm font-medium font-mono text-foreground mt-0.5 block">
                        {org?.timezone || 'America/Bahia'}
                      </span>
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">
                        Horário padrão do sistema (America/Bahia).
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={submittingOrg} className="gap-2">
                      {submittingOrg && <Loader2 className="h-4 w-4 animate-spin" />}
                      <span>Salvar alterações</span>
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* ABA 3: AUDITORIA */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <TabsContent value="auditoria" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Registro de auditoria</h2>
              <p className="text-xs text-muted-foreground">
                Rastreabilidade de ações críticas executadas na organização
              </p>
            </div>
          </div>

          {/* Filtros da auditoria */}
          <Card className="shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Data inicial */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Data inicial (Bahia)</Label>
                  <Input
                    type="date"
                    value={startDateBahia}
                    onChange={(e) => {
                      setStartDateBahia(e.target.value)
                      setAuditPage(1)
                    }}
                    className="h-9 text-xs"
                  />
                </div>

                {/* Data final */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Data final (Bahia)</Label>
                  <Input
                    type="date"
                    value={endDateBahia}
                    onChange={(e) => {
                      setEndDateBahia(e.target.value)
                      setAuditPage(1)
                    }}
                    className="h-9 text-xs"
                  />
                </div>

                {/* Ação */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Ação</Label>
                  <Select
                    value={selectedAction}
                    onValueChange={(val) => {
                      setSelectedAction(val)
                      setAuditPage(1)
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Todas as ações" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as ações</SelectItem>
                      {Object.entries(AUDIT_ACTION_LABELS).map(([actionKey, actionLabel]) => (
                        <SelectItem key={actionKey} value={actionKey} className="text-xs">
                          {actionLabel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Usuário (quem) */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Usuário</Label>
                  <Select
                    value={selectedActor}
                    onValueChange={(val) => {
                      setSelectedActor(val)
                      setAuditPage(1)
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Todos os usuários" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os usuários</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id} className="text-xs">
                          {u.name || u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Coleção */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Coleção</Label>
                  <Select
                    value={selectedCollection}
                    onValueChange={(val) => {
                      setSelectedCollection(val)
                      setAuditPage(1)
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Todas as coleções" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as coleções</SelectItem>
                      {KNOWN_COLLECTIONS.map((c) => (
                        <SelectItem key={c} value={c} className="text-xs">
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {hasAuditFilters && (
                <div className="flex justify-end pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAuditFilters}
                    className="text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <FilterX className="h-3.5 w-3.5" />
                    <span>Limpar filtros</span>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabela de logs */}
          <div className="rounded-md border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="whitespace-nowrap">Data e hora</TableHead>
                    <TableHead>Quem</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Coleção</TableHead>
                    <TableHead>Campo</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingAudit ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Carregando registros...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : auditLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        Nenhum registro de auditoria encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    auditLogs.map((log) => {
                      const actorName = log.actor_id
                        ? userMap.get(log.actor_id) || log.actor_id
                        : 'Sistema'
                      const actionLabel = AUDIT_ACTION_LABELS[log.action] || log.action
                      const reasonLabel = log.reason
                        ? AUDIT_REASON_LABELS[log.reason] || log.reason
                        : '-'

                      return (
                        <TableRow key={log.id} className="text-xs">
                          <TableCell className="font-mono whitespace-nowrap">
                            {formatDateTimeBahia(log.occurred_at || log.created)}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">{actorName}</TableCell>
                          <TableCell>
                            {log.actor_role ? (
                              <Badge variant="secondary" className="font-normal text-[11px]">
                                {getRoleLabel(log.actor_role)}
                              </Badge>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{actionLabel}</TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {log.collection_name || '-'}
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {log.field_name || '-'}
                          </TableCell>
                          <TableCell
                            className="text-muted-foreground max-w-[200px] truncate"
                            title={reasonLabel}
                          >
                            {reasonLabel}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginação */}
            {!loadingAudit && auditTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
                <span className="text-xs text-muted-foreground">
                  Página {auditPage} de {auditTotalPages} ({auditTotalItems} registros)
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                    disabled={auditPage <= 1}
                    className="h-8 text-xs gap-1"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Anterior</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))}
                    disabled={auditPage >= auditTotalPages}
                    className="h-8 text-xs gap-1"
                  >
                    <span>Próxima</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* MODAL: CONVIDAR USUÁRIO */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar usuário</DialogTitle>
            <DialogDescription>
              A pessoa receberá um e-mail para criar a própria senha.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInviteSubmit} className="space-y-4">
            {inviteError && (
              <Alert variant="destructive" className="py-2.5">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs font-medium">{inviteError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="invite-name">Nome completo</Label>
              <Input
                id="invite-name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Ex: Carlos Eduardo"
                required
                disabled={submittingInvite}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-email">E-mail</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="carlos@exemplo.com.br"
                required
                disabled={submittingInvite}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-role">Papel de acesso</Label>
              <Select
                value={inviteRole}
                onValueChange={(val) => setInviteRole(val as 'admin' | 'sdr' | 'corretor')}
                disabled={submittingInvite}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="sdr">SDR (Pré-atendimento)</SelectItem>
                  <SelectItem value="corretor">Corretor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteModalOpen(false)}
                disabled={submittingInvite}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submittingInvite} className="gap-2">
                {submittingInvite && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Enviar convite</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* MODAL: EDITAR USUÁRIO */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>
              Atualize as informações de nome e papel do colaborador.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4">
            {editError && (
              <Alert variant="destructive" className="py-2.5">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs font-medium">{editError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome completo</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Ex: Carlos Eduardo"
                required
                disabled={submittingEdit}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">E-mail</Label>
              <Input
                id="edit-email"
                value={editingUser?.email || ''}
                disabled
                className="bg-muted cursor-not-allowed"
              />
              <p className="text-[11px] text-muted-foreground">
                O e-mail é a chave de login e não pode ser alterado aqui.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role">Papel de acesso</Label>
              {editingUser?.id === currentUser?.id ? (
                <div>
                  <Input
                    value={getRoleLabel(editingUser?.role)}
                    disabled
                    className="bg-muted cursor-not-allowed"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    O administrador não pode alterar o próprio papel.
                  </p>
                </div>
              ) : (
                <Select
                  value={editRole}
                  onValueChange={(val) => setEditRole(val as 'admin' | 'sdr' | 'corretor')}
                  disabled={submittingEdit}
                >
                  <SelectTrigger id="edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="sdr">SDR (Pré-atendimento)</SelectItem>
                    <SelectItem value="corretor">Corretor</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditModalOpen(false)}
                disabled={submittingEdit}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submittingEdit} className="gap-2">
                {submittingEdit && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Salvar alterações</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* MODAL: CONFIRMAÇÃO DE DESATIVAÇÃO */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <AlertDialog open={deactivateModalOpen} onOpenChange={setDeactivateModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar usuário</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                {loadingOpenItems ? (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span>Verificando pendências em aberto...</span>
                  </div>
                ) : (
                  <>
                    <p>
                      Esta pessoa tem {openItems?.leads ?? 0} leads, {openItems?.visits ?? 0}{' '}
                      visitas e {openItems?.tasks ?? 0} tarefas abertos. Eles não mudam sozinhos:
                      reatribua depois.
                    </p>
                    <p className="font-semibold text-foreground">
                      Tem certeza de que deseja desativar o acesso de{' '}
                      {deactivatingUser?.name || deactivatingUser?.email}?
                    </p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submittingDeactivate}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDeactivate()
              }}
              disabled={loadingOpenItems || submittingDeactivate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submittingDeactivate && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
