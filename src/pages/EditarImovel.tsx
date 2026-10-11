import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  getPropertyById,
  updateProperty,
  formatErrorMessage,
  PropertyOwnerRecord,
} from '@/services/properties'
import { listEligibleResponsibleUsers, ResponsibleUser } from '@/services/clients'
import { parseCurrencyInput, formatCurrencyInput } from '@/lib/currencyUtils'
import { PropertyForm, PropertyFormData } from '@/components/properties/PropertyForm'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2, ShieldAlert } from 'lucide-react'

export default function EditarImovel() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isLoading: authLoading } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [warningMessage, setWarningMessage] = useState<string | null>(null)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)

  const [eligibleUsers, setEligibleUsers] = useState<ResponsibleUser[]>([])
  const [initialFormData, setInitialFormData] = useState<Partial<PropertyFormData> | null>(null)
  const [initialOwner, setInitialOwner] = useState<PropertyOwnerRecord | null>(null)

  const role = user?.role || ''
  const isAuthorizedRole = role === 'admin' || role === 'corretor'

  // Redireciona SDR para /imoveis
  useEffect(() => {
    if (!authLoading && user && !isAuthorizedRole) {
      navigate('/imoveis', { replace: true })
    }
  }, [authLoading, user, isAuthorizedRole, navigate])

  // Carrega usuários elegíveis para captador
  useEffect(() => {
    listEligibleResponsibleUsers()
      .then(setEligibleUsers)
      .catch(() => {})
  }, [])

  // Carrega imóvel e valida permissão de corretor
  useEffect(() => {
    if (!id || !user || !isAuthorizedRole) return

    let active = true
    setLoading(true)
    setErrorMessage(null)

    getPropertyById(id)
      .then((prop) => {
        if (!active) return

        // Regra: "O corretor só edita imóveis que ele captou (se abrir outro, mostre "Você não tem permissão para editar este imóvel.")."
        if (role === 'corretor' && prop.captured_by !== user.id) {
          setHasPermission(false)
          setLoading(false)
          return
        }

        setHasPermission(true)

        // Configura dados iniciais do formulário
        setInitialFormData({
          code: prop.code || '',
          title: prop.title || '',
          purpose: prop.purpose || 'venda',
          property_type: prop.property_type || 'apartamento',
          use_type: prop.use_type || 'residencial',
          in_condominium: Boolean(prop.in_condominium),
          condominium_id: prop.condominium_id || '',
          status: prop.status || 'rascunho',
          street: prop.street || '',
          street_number: prop.street_number || '',
          complement: prop.complement || '',
          neighborhood: prop.neighborhood || '',
          city: prop.city || '',
          state: prop.state || 'BA',
          zip_code: prop.zip_code || '',
          publish_to: Array.isArray(prop.publish_to) ? prop.publish_to : [],
          bedrooms: prop.bedrooms && prop.bedrooms > 0 ? String(prop.bedrooms) : '',
          bathrooms: prop.bathrooms && prop.bathrooms > 0 ? String(prop.bathrooms) : '',
          parking: prop.parking && prop.parking > 0 ? String(prop.parking) : '',
          area: prop.area && prop.area > 0 ? String(prop.area) : '',
          sale_price: formatCurrencyInput(prop.sale_price),
          rent_price: formatCurrencyInput(prop.rent_price),
          condo_fee: formatCurrencyInput(prop.condo_fee),
          iptu: formatCurrencyInput(prop.iptu),
          price_on_request: Boolean(prop.price_on_request),
          description: prop.description || '',
          owner_id: prop.owner_id || '',
          captured_by: prop.captured_by || user.id,
          highlight_level: (prop.highlight_level as any) || 'comum',
          highlight_until: prop.highlight_until || '',
        })

        if (prop.expand?.owner_id) {
          setInitialOwner(prop.expand.owner_id)
        } else if (prop.owner_id) {
          setInitialOwner({
            id: prop.owner_id,
            name: 'Proprietário vinculado',
          })
        }
      })
      .catch((err) => {
        if (!active) return
        setErrorMessage(formatErrorMessage(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [id, user, role, isAuthorizedRole])

  if (authLoading || (!isAuthorizedRole && user)) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-muted-foreground gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Verificando permissões...</p>
      </div>
    )
  }

  // Corretor tentando editar imóvel que não captou
  if (hasPermission === false) {
    return (
      <div className="max-w-md mx-auto my-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-normal text-foreground">
          Você não tem permissão para editar este imóvel.
        </h2>
        <p className="text-xs text-muted-foreground">
          O corretor só pode editar imóveis que ele próprio captou.
        </p>
        <Button
          onClick={() => navigate('/imoveis')}
          variant="outline"
          className="h-11 min-h-[44px] rounded-full px-5 text-xs font-normal border-border gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar para Imóveis</span>
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-muted-foreground gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Carregando dados do imóvel...</p>
      </div>
    )
  }

  if (!user || !id) {
    return null
  }

  const handleUpdate = async (formData: PropertyFormData) => {
    setErrorMessage(null)
    setWarningMessage(null)

    if (!formData.code.trim()) {
      setErrorMessage('Informe o código do imóvel.')
      return
    }

    if (!formData.title.trim()) {
      setErrorMessage('Informe o título do imóvel.')
      return
    }

    // Processa cômodos e área
    const bedrooms = formData.bedrooms ? parseInt(formData.bedrooms, 10) : 0
    const bathrooms = formData.bathrooms ? parseInt(formData.bathrooms, 10) : 0
    const parking = formData.parking ? parseInt(formData.parking, 10) : 0
    const area = formData.area ? parseFloat(formData.area.replace(',', '.')) : 0

    // Processa valores monetários
    const rawSalePrice = parseCurrencyInput(formData.sale_price)
    const rawRentPrice = parseCurrencyInput(formData.rent_price)
    const rawCondoFee = parseCurrencyInput(formData.condo_fee)
    const rawIptu = parseCurrencyInput(formData.iptu)

    const salePrice = rawSalePrice !== undefined && rawSalePrice > 0 ? rawSalePrice : null
    const rentPrice = rawRentPrice !== undefined && rawRentPrice > 0 ? rawRentPrice : null
    const condoFee = rawCondoFee !== undefined && rawCondoFee > 0 ? rawCondoFee : null
    const iptu = rawIptu !== undefined && rawIptu > 0 ? rawIptu : null

    const intendedStatus = formData.status

    setSaving(true)
    try {
      // Atualiza imóvel
      await updateProperty(id, {
        code: formData.code,
        title: formData.title,
        purpose: formData.purpose,
        property_type: formData.property_type,
        use_type: formData.use_type,
        in_condominium: formData.in_condominium,
        condominium_id: formData.in_condominium ? formData.condominium_id : undefined,
        status: intendedStatus,
        street: formData.street,
        street_number: formData.street_number,
        complement: formData.complement,
        neighborhood: formData.neighborhood,
        city: formData.city,
        state: formData.state || 'BA',
        zip_code: formData.zip_code ? formData.zip_code.replace(/\D/g, '') : '',
        publish_to: formData.publish_to,
        bedrooms: !isNaN(bedrooms) ? bedrooms : 0,
        bathrooms: !isNaN(bathrooms) ? bathrooms : 0,
        parking: !isNaN(parking) ? parking : 0,
        area: !isNaN(area) ? area : 0,
        sale_price: salePrice,
        rent_price: rentPrice,
        price_on_request: formData.price_on_request,
        condo_fee: condoFee,
        iptu: iptu,
        description: formData.description,
        owner_id: formData.owner_id,
        // O corretor não pode alterar captured_by; só o admin pode
        captured_by: role === 'admin' ? formData.captured_by : undefined,
        highlight_level: formData.highlight_level || 'comum',
        highlight_until: formData.highlight_until || '',
      } as any)

      // Releitura do imóvel conforme especificação:
      // "depois de salvar, releia o imóvel e mostre 'Este imóvel voltou para Rascunho porque está incompleto.'
      // quando a situação voltar diferente do que o usuário havia escolhido."
      const reloaded = await getPropertyById(id)

      if (intendedStatus && intendedStatus !== 'rascunho' && reloaded.status === 'rascunho') {
        setWarningMessage('Este imóvel voltou para Rascunho porque está incompleto.')
        toast({
          title: 'Atenção',
          description: 'Este imóvel voltou para Rascunho porque está incompleto.',
          variant: 'destructive',
        })
        // Atualiza formulário com novo status
        setInitialFormData((prev) => ({
          ...prev,
          status: 'rascunho',
        }))
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        toast({
          title: 'Imóvel atualizado.',
          description: 'As alterações foram salvas com sucesso.',
        })
        navigate(`/imoveis/${id}`)
      }
    } catch (err) {
      setErrorMessage(formatErrorMessage(err))
      window.scrollTo({ top: 0, behavior: 'smooth' })
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
          onClick={() => navigate(`/imoveis/${id}`)}
          className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-full border border-border flex items-center justify-center hover:bg-muted shrink-0 text-foreground"
          aria-label="Voltar para detalhes do imóvel"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="display-sm text-foreground">Editar imóvel</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Altere as informações, situação, valores e características do imóvel.
          </p>
        </div>
      </div>

      {/* Alerta de erro do servidor no topo (ex: imóvel incompleto) */}
      {errorMessage && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 font-normal">
          {errorMessage}
        </div>
      )}

      {/* Alerta de retorno para rascunho */}
      {warningMessage && (
        <div className="p-4 rounded-lg border border-attention/40 bg-muted/20 text-xs text-foreground font-normal">
          {warningMessage}
        </div>
      )}

      {initialFormData && (
        <PropertyForm
          propertyId={id}
          isEditing={true}
          initialData={initialFormData}
          initialOwner={initialOwner}
          eligibleUsers={eligibleUsers}
          currentUser={user}
          onSubmit={handleUpdate}
          saving={saving}
          onCancel={() => navigate(`/imoveis/${id}`)}
        />
      )}
    </div>
  )
}
