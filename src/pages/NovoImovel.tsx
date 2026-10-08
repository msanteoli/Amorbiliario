import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { createProperty, formatErrorMessage } from '@/services/properties'
import { listEligibleResponsibleUsers, ResponsibleUser } from '@/services/clients'
import { parseCurrencyInput } from '@/lib/currencyUtils'
import { PropertyForm, PropertyFormData } from '@/components/properties/PropertyForm'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Loader2 } from 'lucide-react'

export default function NovoImovel() {
  const navigate = useNavigate()
  const { user, isLoading: authLoading } = useAuth()
  const { toast } = useToast()

  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [eligibleUsers, setEligibleUsers] = useState<ResponsibleUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)

  const role = user?.role || ''
  const isAuthorized = role === 'admin' || role === 'corretor'

  // Redireciona SDR para /imoveis
  useEffect(() => {
    if (!authLoading && user && !isAuthorized) {
      navigate('/imoveis', { replace: true })
    }
  }, [authLoading, user, isAuthorized, navigate])

  // Carrega lista de usuários corretores e admins para seleção do captador (para admin)
  useEffect(() => {
    listEligibleResponsibleUsers()
      .then(setEligibleUsers)
      .catch(() => {})
      .finally(() => setLoadingUsers(false))
  }, [])

  if (authLoading || (!isAuthorized && user)) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-muted-foreground gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Verificando permissões...</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const handleCreate = async (formData: PropertyFormData) => {
    setErrorMessage(null)

    if (!formData.code.trim()) {
      setErrorMessage('Informe o código do imóvel.')
      return
    }

    if (!formData.title.trim()) {
      setErrorMessage('Informe o título do imóvel.')
      return
    }

    // Processa números de cômodos e área
    const bedrooms = formData.bedrooms ? parseInt(formData.bedrooms, 10) : undefined
    const bathrooms = formData.bathrooms ? parseInt(formData.bathrooms, 10) : undefined
    const parking = formData.parking ? parseInt(formData.parking, 10) : undefined
    const area = formData.area ? parseFloat(formData.area.replace(',', '.')) : undefined

    // Processa valores monetários
    const salePrice = parseCurrencyInput(formData.sale_price)
    const rentPrice = parseCurrencyInput(formData.rent_price)
    const condoFee = parseCurrencyInput(formData.condo_fee)
    const iptu = parseCurrencyInput(formData.iptu)

    setSaving(true)
    try {
      const created = await createProperty(
        {
          code: formData.code,
          title: formData.title,
          purpose: formData.purpose,
          property_type: formData.property_type,
          use_type: formData.use_type,
          in_condominium: formData.in_condominium,
          condominium_id: formData.in_condominium ? formData.condominium_id : undefined,
          street: formData.street || undefined,
          street_number: formData.street_number || undefined,
          complement: formData.complement || undefined,
          neighborhood: formData.neighborhood || undefined,
          city: formData.city || undefined,
          bedrooms:
            typeof bedrooms === 'number' && !isNaN(bedrooms) && bedrooms > 0 ? bedrooms : undefined,
          bathrooms:
            typeof bathrooms === 'number' && !isNaN(bathrooms) && bathrooms > 0
              ? bathrooms
              : undefined,
          parking:
            typeof parking === 'number' && !isNaN(parking) && parking > 0 ? parking : undefined,
          area: typeof area === 'number' && !isNaN(area) && area > 0 ? area : undefined,
          sale_price: salePrice,
          rent_price: rentPrice,
          price_on_request: formData.price_on_request,
          condo_fee: condoFee,
          iptu: iptu,
          description: formData.description || undefined,
          owner_id: formData.owner_id || undefined,
          captured_by: role === 'corretor' ? user.id : formData.captured_by || user.id,
          highlight_level: formData.highlight_level || 'comum',
          highlight_until: formData.highlight_until || undefined,
        } as any,
        user,
      )

      toast({
        title: 'Imóvel salvo como Rascunho.',
        description: 'O cadastro inicial foi realizado com sucesso.',
      })

      navigate(`/imoveis/${created.id}`)
    } catch (err) {
      setErrorMessage(formatErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-28 md:pb-12">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/imoveis')}
          className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-full border border-border flex items-center justify-center hover:bg-muted shrink-0 text-foreground"
          aria-label="Voltar para lista de imóveis"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="display-sm text-foreground">Novo imóvel</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cadastre um novo imóvel no catálogo. Ele nascerá como Rascunho.
          </p>
        </div>
      </div>

      {/* Alerta de erro */}
      {errorMessage && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 font-normal">
          {errorMessage}
        </div>
      )}

      {loadingUsers ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs">Carregando formulário...</p>
        </div>
      ) : (
        <PropertyForm
          isEditing={false}
          eligibleUsers={eligibleUsers}
          currentUser={user}
          onSubmit={handleCreate}
          saving={saving}
          onCancel={() => navigate('/imoveis')}
        />
      )}
    </div>
  )
}
