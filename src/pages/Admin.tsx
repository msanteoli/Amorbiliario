import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
import { listOwnersWithoutProperty, OwnerWithoutPropertyItem } from '@/services/properties'
import { formatDateTimeBahia, bahiaLocalToIsoUtc } from '@/services/visits'
import { getRoleLabel } from '@/lib/roles'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Loader2,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  FilterX,
  FileSpreadsheet,
} from 'lucide-react'

export default function Admin() {
  const { user: currentUser } = useAuth()
  const [searchParams] = useSearchParams()

  // Abas
  const [activeTab, setActiveTab] = useState<
    'usuarios' | 'organizacao' | 'auditoria' | 'sem-imovel'
  >(() => {
    const tabParam = searchParams.get('tab')
    if (
      tabParam === 'usuarios' ||
      tabParam === 'organizacao' ||
      tabParam === 'auditoria' ||
      tabParam === 'sem-imovel'
    ) {
      return tabParam
    }
    return 'usuarios'
  })

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
  const [sendInviteNow, setSendInviteNow] = useState(true)
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
        send_invite: sendInviteNow,
      })

      setInviteModalOpen(false)
      setInviteName('')
      setInviteEmail('')
      setInviteRole('corretor')
      setSendInviteNow(true)

      if (res.invited === false) {
        setGlobalSuccess('Usuário criado sem convite')
      } else if (res.email_sent === false) {
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
  // ABA 4: PROPRIETÁRIOS SEM IMÓVEL (M2b)
  // ═════════════════════════════════════════════════════════════════
  const [ownersWithoutProp, setOwnersWithoutProp] = useState<OwnerWithoutPropertyItem[]>([])
  const [loadingOwnersWithoutProp, setLoadingOwnersWithoutProp] = useState(false)
  const [ownersSearchTerm, setOwnersSearchTerm] = useState('')

  const loadOwnersWithoutProp = useCallback(async () => {
    setLoadingOwnersWithoutProp(true)
    try {
      const items = await listOwnersWithoutProperty()
      setOwnersWithoutProp(items)
    } catch (err) {
      setGlobalError(formatAdminErrorMessage(err, 'Erro ao carregar proprietários sem imóvel.'))
    } finally {
      setLoadingOwnersWithoutProp(false)
    }
  }, [])

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (
      tabParam === 'usuarios' ||
      tabParam === 'organizacao' ||
      tabParam === 'auditoria' ||
      tabParam === 'sem-imovel'
    ) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  useEffect(() => {
    if (activeTab === 'sem-imovel') {
      loadOwnersWithoutProp()
    }
  }, [activeTab, loadOwnersWithoutProp])

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="display-sm text-foreground">Administração</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gerencie os usuários da equipe, configurações da organização, importações e registro de
            auditoria.
          </p>
        </div>

        <Link
          to="/admin/importar-imoveis"
          className="inline-flex items-center gap-2 h-10 px-5 rounded-full text-xs font-normal border border-border bg-background hover:bg-muted text-foreground transition-colors self-start sm:self-auto shrink-0"
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>Importar imóveis</span>
        </Link>
      </div>

      {/* Alertas globais de Sucesso ou Erro */}
      {globalSuccess && (
        <div className="p-3.5 rounded-lg border border-border bg-card text-xs text-foreground flex items-center justify-between">
          <span>{globalSuccess}</span>
          <button
            type="button"
            onClick={() => setGlobalSuccess(null)}
            className="text-xs text-muted-foreground hover:text-foreground ml-3"
          >
            Fechar
          </button>
        </div>
      )}

      {globalError && (
        <div className="p-3.5 rounded-lg border border-destructive/20 bg-destructive/10 text-xs text-destructive flex items-center justify-between">
          <span>{globalError}</span>
          <button
            type="button"
            onClick={() => setGlobalError(null)}
            className="text-xs text-destructive hover:underline ml-3"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Abas como pílulas */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setGlobalSuccess(null)
          setGlobalError(null)
          setActiveTab(val as 'usuarios' | 'organizacao' | 'auditoria' | 'sem-imovel')
        }}
        className="w-full space-y-6"
      >
        <TabsList className="h-auto p-1 bg-muted/40 border border-border rounded-full inline-flex gap-1 flex-wrap">
          <TabsTrigger
            value="usuarios"
            className="rounded-full px-4 py-1.5 text-xs font-normal data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Usuários
          </TabsTrigger>
          <TabsTrigger
            value="sem-imovel"
            className="rounded-full px-4 py-1.5 text-xs font-normal data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Proprietários sem imóvel
          </TabsTrigger>
          <TabsTrigger
            value="organizacao"
            className="rounded-full px-4 py-1.5 text-xs font-normal data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Organização
          </TabsTrigger>
          <TabsTrigger
            value="auditoria"
            className="rounded-full px-4 py-1.5 text-xs font-normal data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Auditoria
          </TabsTrigger>
        </TabsList>

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* ABA 1: USUÁRIOS */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <TabsContent value="usuarios" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-[20px] font-normal text-foreground">Equipe da organização</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Controle de acessos, papéis e convites de novos colaboradores
              </p>
            </div>
            <Button
              onClick={() => {
                setInviteError(null)
                setInviteName('')
                setInviteEmail('')
                setInviteRole('corretor')
                setSendInviteNow(true)
                setInviteModalOpen(true)
              }}
              className="h-9 rounded-full px-4 text-xs font-normal bg-primary text-primary-foreground gap-1.5 shrink-0 self-start sm:self-auto"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Convidar usuário</span>
            </Button>
          </div>

          {loadingUsers ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10">
              Nenhum usuário cadastrado. Convide um membro da equipe para começar.
            </p>
          ) : (
            <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id
                return (
                  <div
                    key={u.id}
                    className={`p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors ${
                      !u.active ? 'opacity-60' : ''
                    }`}
                  >
                    {/* Identificação do Usuário */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-normal text-foreground truncate">
                          {u.name || 'Sem nome'}
                        </span>
                        {isSelf && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                            Você
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-[11px] font-normal">
                          {getRoleLabel(u.role)}
                        </Badge>
                        <Badge
                          variant={u.active ? 'success' : 'destructive'}
                          className="text-[11px] font-normal"
                        >
                          {u.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>

                    {/* Ações no Desktop (pílulas de contorno) */}
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(u)}
                        className="h-8 rounded-full px-3 text-xs font-normal border-border"
                      >
                        Editar
                      </Button>

                      {u.active && (
                        <div className="flex flex-col items-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleReinvite(u)}
                            disabled={reinvitingId === u.id}
                            className="h-8 rounded-full px-3 text-xs font-normal border-border gap-1"
                          >
                            {reinvitingId === u.id && <Loader2 className="h-3 w-3 animate-spin" />}
                            <span>Reenviar convite</span>
                          </Button>
                          <span className="text-[11px] text-muted-foreground mt-0.5">
                            Envia o e-mail para a pessoa criar a senha.
                          </span>
                        </div>
                      )}

                      {!isSelf && (
                        <>
                          {u.active ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleStartDeactivate(u)}
                              className="h-8 rounded-full px-3 text-xs font-normal border-border text-destructive hover:bg-destructive/10"
                            >
                              Desativar
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleReactivate(u)}
                              className="h-8 rounded-full px-3 text-xs font-normal border-border"
                            >
                              Reativar
                            </Button>
                          )}
                        </>
                      )}
                    </div>

                    {/* Ações no Celular (menu três pontos de 44px de alvo) */}
                    <div className="sm:hidden shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="Ações do usuário"
                            className="w-11 h-11 rounded-full border border-border flex items-center justify-center hover:bg-muted text-foreground"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => handleOpenEdit(u)}>
                            Editar
                          </DropdownMenuItem>
                          {u.active && (
                            <DropdownMenuItem
                              onClick={() => handleReinvite(u)}
                              disabled={reinvitingId === u.id}
                              className="flex flex-col items-start gap-0.5"
                            >
                              <span>Reenviar convite</span>
                              <span className="text-[10px] text-muted-foreground font-normal">
                                Envia o e-mail para a pessoa criar a senha.
                              </span>
                            </DropdownMenuItem>
                          )}
                          {!isSelf && (
                            <>
                              {u.active ? (
                                <DropdownMenuItem
                                  onClick={() => handleStartDeactivate(u)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  Desativar
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => handleReactivate(u)}>
                                  Reativar
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* ABA 2: ORGANIZAÇÃO */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <TabsContent value="organizacao" className="space-y-6">
          <div>
            <h2 className="text-[20px] font-normal text-foreground">Dados da organização</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Informações cadastrais e dados de contato corporativo exibidos aos clientes
            </p>
          </div>

          {loadingOrg ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ) : (
            <form onSubmit={handleOrgSubmit} className="space-y-6 max-w-3xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="org-name"
                    className="text-[13px] font-normal text-foreground block"
                  >
                    Nome da organização <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="org-name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Ex: Imobiliária Modelo"
                    required
                    disabled={submittingOrg}
                    className="h-12 text-sm border-border"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="org-phone"
                    className="text-[13px] font-normal text-foreground block"
                  >
                    Telefone de contato
                  </label>
                  <Input
                    id="org-phone"
                    value={orgPhone}
                    onChange={(e) => setOrgPhone(e.target.value)}
                    placeholder="Ex: (71) 99999-9999"
                    disabled={submittingOrg}
                    className="h-12 text-sm border-border tabular"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="org-email"
                    className="text-[13px] font-normal text-foreground block"
                  >
                    E-mail de contato
                  </label>
                  <Input
                    id="org-email"
                    type="email"
                    value={orgEmail}
                    onChange={(e) => setOrgEmail(e.target.value)}
                    placeholder="contato@empresa.com.br"
                    disabled={submittingOrg}
                    className="h-12 text-sm border-border"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="org-address"
                    className="text-[13px] font-normal text-foreground block"
                  >
                    Endereço
                  </label>
                  <Input
                    id="org-address"
                    value={orgAddress}
                    onChange={(e) => setOrgAddress(e.target.value)}
                    placeholder="Ex: Av. Tancredo Neves, 1000 - Salvador/BA"
                    disabled={submittingOrg}
                    className="h-12 text-sm border-border"
                  />
                </div>
              </div>

              {/* Identificador (slug) e fuso horário em texto de apoio, não editáveis */}
              <div className="rounded-lg border border-border bg-card p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="eyebrow text-muted-foreground block">Identificador (slug)</span>
                  <p className="text-xs font-mono text-foreground">{org?.slug || '-'}</p>
                  <p className="text-xs text-muted-foreground">
                    Definido no provisionamento e não editável.
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="eyebrow text-muted-foreground block">Fuso horário</span>
                  <p className="text-xs font-mono text-foreground">
                    {org?.timezone || 'America/Bahia'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Horário padrão do sistema (America/Bahia).
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={submittingOrg}
                  className="h-10 rounded-full px-6 text-xs font-normal bg-primary text-primary-foreground gap-2"
                >
                  {submittingOrg && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Salvar alterações</span>
                </Button>
              </div>
            </form>
          )}
        </TabsContent>

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* ABA 4: PROPRIETÁRIOS SEM IMÓVEL */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <TabsContent value="sem-imovel" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-[20px] font-normal text-foreground">Proprietários sem imóvel</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Clientes marcados como proprietários que ainda não possuem nenhum imóvel ativo ou
                rascunho vinculado.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadOwnersWithoutProp}
              disabled={loadingOwnersWithoutProp}
              className="h-9 rounded-full px-4 text-xs font-normal border-border gap-1.5 shrink-0 self-start sm:self-auto"
            >
              {loadingOwnersWithoutProp && <Loader2 className="h-3 w-3 animate-spin" />}
              <span>Atualizar lista</span>
            </Button>
          </div>

          {/* Busca na lista */}
          <div className="relative max-w-sm">
            <Input
              placeholder="Buscar proprietário por nome..."
              value={ownersSearchTerm}
              onChange={(e) => setOwnersSearchTerm(e.target.value)}
              className="h-10 text-xs border-border rounded-full px-4"
            />
          </div>

          {loadingOwnersWithoutProp ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : ownersWithoutProp.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center">
              <p className="text-xs text-muted-foreground">
                Nenhum proprietário sem imóvel encontrado. Todos os proprietários possuem imóveis
                cadastrados.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
              {ownersWithoutProp
                .filter((owner) =>
                  ownersSearchTerm.trim()
                    ? owner.name.toLowerCase().includes(ownersSearchTerm.trim().toLowerCase())
                    : true,
                )
                .map((owner) => (
                  <div
                    key={owner.id}
                    className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <span className="font-normal text-sm text-foreground block truncate">
                        {owner.name}
                      </span>
                      <span className="text-xs text-muted-foreground block font-mono text-[11px]">
                        ID: {owner.id}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-full px-3.5 text-xs font-normal border-border"
                      >
                        <Link to={`/clientes/${owner.id}`}>
                          <span>Ver cliente</span>
                        </Link>
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        className="h-8 rounded-full px-3.5 text-xs font-normal bg-primary text-primary-foreground gap-1"
                      >
                        <Link to={`/imoveis/novo`}>
                          <Plus className="h-3 w-3" />
                          <span>Cadastrar imóvel</span>
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </TabsContent>

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* ABA 3: AUDITORIA */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <TabsContent value="auditoria" className="space-y-6">
          <div>
            <h2 className="text-[20px] font-normal text-foreground">Registro de auditoria</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Rastreabilidade de ações críticas executadas na organização
            </p>
          </div>

          {/* Filtros em pílulas */}
          <div className="p-4 rounded-lg border border-border bg-card space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Data inicial */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-normal text-foreground block">
                  Data inicial (Bahia)
                </label>
                <Input
                  type="date"
                  value={startDateBahia}
                  onChange={(e) => {
                    setStartDateBahia(e.target.value)
                    setAuditPage(1)
                  }}
                  className="h-10 text-xs border-border tabular"
                />
              </div>

              {/* Data final */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-normal text-foreground block">
                  Data final (Bahia)
                </label>
                <Input
                  type="date"
                  value={endDateBahia}
                  onChange={(e) => {
                    setEndDateBahia(e.target.value)
                    setAuditPage(1)
                  }}
                  className="h-10 text-xs border-border tabular"
                />
              </div>

              {/* Ação */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-normal text-foreground block">Ação</label>
                <Select
                  value={selectedAction}
                  onValueChange={(val) => {
                    setSelectedAction(val)
                    setAuditPage(1)
                  }}
                >
                  <SelectTrigger className="h-10 text-xs border-border rounded-full">
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
                <label className="text-[13px] font-normal text-foreground block">Usuário</label>
                <Select
                  value={selectedActor}
                  onValueChange={(val) => {
                    setSelectedActor(val)
                    setAuditPage(1)
                  }}
                >
                  <SelectTrigger className="h-10 text-xs border-border rounded-full">
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
                <label className="text-[13px] font-normal text-foreground block">Coleção</label>
                <Select
                  value={selectedCollection}
                  onValueChange={(val) => {
                    setSelectedCollection(val)
                    setAuditPage(1)
                  }}
                >
                  <SelectTrigger className="h-10 text-xs border-border rounded-full">
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
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearAuditFilters}
                  className="h-8 rounded-full px-3 text-xs font-normal border-border gap-1.5"
                >
                  <FilterX className="h-3 w-3" />
                  <span>Limpar filtros</span>
                </Button>
              </div>
            )}
          </div>

          {/* Linhas com divisores de 1px */}
          {loadingAudit ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : auditLogs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10">
              Nenhum registro de auditoria encontrado.
            </p>
          ) : (
            <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
              {auditLogs.map((log) => {
                const actorName = log.actor_id
                  ? userMap.get(log.actor_id) || log.actor_id
                  : 'Sistema'
                const actionLabel = AUDIT_ACTION_LABELS[log.action] || log.action
                const reasonLabel = log.reason ? AUDIT_REASON_LABELS[log.reason] || log.reason : '-'

                return (
                  <div
                    key={log.id}
                    className="p-3.5 sm:p-4 text-xs space-y-1 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="tabular text-muted-foreground font-normal">
                          {formatDateTimeBahia(log.occurred_at || log.created)}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-foreground">{actionLabel}</span>
                        {log.collection_name && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 font-normal border-border"
                          >
                            {log.collection_name}
                          </Badge>
                        )}
                        {log.field_name && (
                          <span className="text-muted-foreground">campo: {log.field_name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <span>por</span>
                        <span className="text-foreground">{actorName}</span>
                        {log.actor_role && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 font-normal"
                          >
                            {getRoleLabel(log.actor_role)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {reasonLabel !== '-' && (
                      <p className="text-muted-foreground pt-0.5">
                        Motivo: <span className="text-foreground">{reasonLabel}</span>
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Paginação */}
          {!loadingAudit && auditTotalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground tabular">
                Página {auditPage} de {auditTotalPages} ({auditTotalItems} registros)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                  disabled={auditPage <= 1}
                  className="h-8 rounded-full px-3 text-xs font-normal border-border gap-1"
                >
                  <ChevronLeft className="h-3 w-3" />
                  <span>Anterior</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))}
                  disabled={auditPage >= auditTotalPages}
                  className="h-8 rounded-full px-3 text-xs font-normal border-border gap-1"
                >
                  <span>Próxima</span>
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* MODAL: CONVIDAR USUÁRIO */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-normal text-lg">Convidar usuário</DialogTitle>
            <DialogDescription className="text-xs">
              A pessoa receberá um e-mail para criar a própria senha.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInviteSubmit} className="space-y-4">
            {inviteError && (
              <p className="text-xs text-destructive font-normal" role="alert">
                {inviteError}
              </p>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="invite-name"
                className="text-[13px] font-normal text-foreground block"
              >
                Nome completo
              </label>
              <Input
                id="invite-name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Ex: Carlos Eduardo"
                required
                disabled={submittingInvite}
                className="h-12 text-sm border-border"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="invite-email"
                className="text-[13px] font-normal text-foreground block"
              >
                E-mail
              </label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="carlos@exemplo.com.br"
                required
                disabled={submittingInvite}
                className="h-12 text-sm border-border"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="invite-role"
                className="text-[13px] font-normal text-foreground block"
              >
                Papel de acesso
              </label>
              <Select
                value={inviteRole}
                onValueChange={(val) => setInviteRole(val as 'admin' | 'sdr' | 'corretor')}
                disabled={submittingInvite}
              >
                <SelectTrigger id="invite-role" className="h-12 text-sm border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="sdr">SDR (Pré-atendimento)</SelectItem>
                  <SelectItem value="corretor">Corretor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send-invite-checkbox"
                  checked={sendInviteNow}
                  onCheckedChange={(checked) => setSendInviteNow(checked === true)}
                  disabled={submittingInvite}
                />
                <label
                  htmlFor="send-invite-checkbox"
                  className="text-xs font-normal text-foreground leading-none cursor-pointer"
                >
                  Enviar convite por e-mail agora
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground pl-6">
                Desmarque para cadastrar a pessoa agora e convidar depois, quando o sistema estiver
                publicado.
              </p>
            </div>

            <DialogFooter className="pt-3 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteModalOpen(false)}
                disabled={submittingInvite}
                className="h-9 rounded-full px-4 text-xs font-normal border-border"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submittingInvite}
                className="h-9 rounded-full px-5 text-xs font-normal bg-primary text-primary-foreground gap-2"
              >
                {submittingInvite && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
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
            <DialogTitle className="font-normal text-lg">Editar usuário</DialogTitle>
            <DialogDescription className="text-xs">
              Atualize as informações de nome e papel do colaborador.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4">
            {editError && (
              <p className="text-xs text-destructive font-normal" role="alert">
                {editError}
              </p>
            )}

            <div className="space-y-1.5">
              <label htmlFor="edit-name" className="text-[13px] font-normal text-foreground block">
                Nome completo
              </label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Ex: Carlos Eduardo"
                required
                disabled={submittingEdit}
                className="h-12 text-sm border-border"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-email" className="text-[13px] font-normal text-foreground block">
                E-mail
              </label>
              <Input
                id="edit-email"
                value={editingUser?.email || ''}
                disabled
                className="h-12 text-sm border-border bg-muted/40 cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">
                O e-mail é a chave de login e não pode ser alterado aqui.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-role" className="text-[13px] font-normal text-foreground block">
                Papel de acesso
              </label>
              {editingUser?.id === currentUser?.id ? (
                <div>
                  <Input
                    value={getRoleLabel(editingUser?.role)}
                    disabled
                    className="h-12 text-sm border-border bg-muted/40 cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    O administrador não pode alterar o próprio papel.
                  </p>
                </div>
              ) : (
                <Select
                  value={editRole}
                  onValueChange={(val) => setEditRole(val as 'admin' | 'sdr' | 'corretor')}
                  disabled={submittingEdit}
                >
                  <SelectTrigger id="edit-role" className="h-12 text-sm border-border">
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

            <DialogFooter className="pt-3 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditModalOpen(false)}
                disabled={submittingEdit}
                className="h-9 rounded-full px-4 text-xs font-normal border-border"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submittingEdit}
                className="h-9 rounded-full px-5 text-xs font-normal bg-primary text-primary-foreground gap-2"
              >
                {submittingEdit && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
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
            <AlertDialogTitle className="font-normal text-lg">Desativar usuário</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-xs text-muted-foreground font-normal">
                {loadingOpenItems ? (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-foreground" />
                    <span>Verificando pendências em aberto...</span>
                  </div>
                ) : (
                  <>
                    {/* Aviso com borda attention para itens abertos */}
                    <div className="p-3.5 rounded-lg border border-attention/40 bg-muted/20 text-foreground text-xs font-normal">
                      Esta pessoa tem <span className="tabular">{openItems?.leads ?? 0}</span>{' '}
                      leads, <span className="tabular">{openItems?.visits ?? 0}</span> visitas e{' '}
                      <span className="tabular">{openItems?.tasks ?? 0}</span> tarefas abertos. Eles
                      não mudam sozinhos: reatribua depois.
                    </div>
                    <p className="text-foreground">
                      Tem certeza de que deseja desativar o acesso de{' '}
                      <span className="font-medium">
                        {deactivatingUser?.name || deactivatingUser?.email}
                      </span>
                      ?
                    </p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={submittingDeactivate}
              className="h-9 rounded-full px-4 text-xs font-normal border-border"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDeactivate()
              }}
              disabled={loadingOpenItems || submittingDeactivate}
              className="h-9 rounded-full px-5 text-xs font-normal bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submittingDeactivate && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
