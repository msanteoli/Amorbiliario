import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  parseFichaPdfText,
  ParseFichaResult,
  FichaImovelParsed,
  FichaProprietarioParsed,
  FichaNaoImportado,
} from '@/lib/fichaPdf'
import { extractTextFromPdf } from '@/lib/fichaPdf/extractText'
import { AiBadge } from '@/components/AiBadge'
import { matchFicha, commitFicha, FichaMatchResult, FichaCommitResult } from '@/services/fichaPdf'
import { suggestPropertyTitles } from '@/services/properties'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  FileUp,
  Loader2,
  AlertCircle,
  HelpCircle,
  Home,
  User,
  Info,
  CheckCircle2,
  X,
} from 'lucide-react'

interface ImportFichaPdfModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId?: string | null
  currentPropertyCode?: string | null
  currentPropertyData?: Record<string, any> | null
  currentOwnerData?: Record<string, any> | null
}

interface FieldComparisonItem {
  key: string
  label: string
  category: 'imovel' | 'proprietario'
  fichaValue: any
  currentValue: any
  isMissingInFicha: boolean
  checked: boolean
  isSensitive?: boolean
}

export function ImportFichaPdfModal({
  open,
  onOpenChange,
  propertyId,
  currentPropertyCode,
  currentPropertyData,
  currentOwnerData,
}: ImportFichaPdfModalProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Estados de fluxo
  const [reading, setReading] = useState(false)
  const [matching, setMatching] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)

  // Dados lidos e de correspondência
  const [parsedData, setParsedData] = useState<{
    imovel: FichaImovelParsed
    proprietario: FichaProprietarioParsed
    naoImportado: FichaNaoImportado
  } | null>(null)
  const [matchResult, setMatchResult] = useState<FichaMatchResult | null>(null)

  // Pergunta telefone
  const [showingPhoneQuestion, setShowingPhoneQuestion] = useState(false)
  const [samePersonPhone, setSamePersonPhone] = useState<boolean | null>(null)

  // Seleção de campos na prévia
  const [selectedImovelFields, setSelectedImovelFields] = useState<Record<string, boolean>>({})
  const [selectedPropFields, setSelectedPropFields] = useState<Record<string, boolean>>({})

  // Título e Descrição editáveis
  const [customTitle, setCustomTitle] = useState('')
  const [customDescription, setCustomDescription] = useState('')
  const [suggestingTitle, setSuggestingTitle] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [titleOptions, setTitleOptions] = useState<string[]>([])

  // Resultado de commit
  const [commitSuccess, setCommitSuccess] = useState<FichaCommitResult | null>(null)

  const role = user?.role || ''
  const canSeeSensitive = role === 'admin' || role === 'corretor'

  // Limpa tudo ao fechar ou trocar de arquivo
  const handleReset = () => {
    setReading(false)
    setMatching(false)
    setCommitting(false)
    setErrorMessage(null)
    setErrorDetail(null)
    setParsedData(null)
    setMatchResult(null)
    setShowingPhoneQuestion(false)
    setSamePersonPhone(null)
    setSelectedImovelFields({})
    setSelectedPropFields({})
    setCustomTitle('')
    setCustomDescription('')
    setSuggestingTitle(false)
    setSuggestError(null)
    setTitleOptions([])
    setCommitSuccess(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleModalClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      handleReset()
    }
    onOpenChange(nextOpen)
  }

  // 1. LEITURA DO PDF
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setErrorMessage(null)
    setErrorDetail(null)
    setParsedData(null)
    setMatchResult(null)
    setCommitSuccess(null)

    // Recusar ANTES de ler se não for PDF ou > 5 MB
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const isUnder5Mb = file.size <= 5 * 1024 * 1024

    if (!isPdf || !isUnder5Mb) {
      setErrorMessage('Escolha um arquivo PDF de até 5 MB.')
      setErrorDetail(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setReading(true)
    try {
      const extractedText = await extractTextFromPdf(file)
      const parseResult: ParseFichaResult = parseFichaPdfText(extractedText)

      if (!parseResult.ok) {
        const failed = parseResult as { ok: false; motivo: 'sem_texto' | 'nao_e_ficha' }
        if (failed.motivo === 'sem_texto') {
          setErrorMessage('Esta ficha não tem texto legível. Cadastre pelo formulário.')
        } else {
          setErrorMessage('Este arquivo não parece uma ficha do Kenlo.')
        }
        return
      }

      // Prepara dados iniciais
      const imovel = parseResult.imovel
      const proprietario = parseResult.proprietario
      const naoImportado = parseResult.nao_importado

      setParsedData({
        imovel,
        proprietario,
        naoImportado,
      })
      setCustomDescription(imovel.description || '')

      // 2. CONSULTA (/ficha/match)
      await runMatch(imovel, proprietario)
    } catch (err: any) {
      const errDetail = err?.message || ''
      console.error('[ficha-pdf]', errDetail)
      setErrorMessage('Não foi possível ler o arquivo PDF. Tente de novo.')
      setErrorDetail(errDetail)
    } finally {
      setReading(false)
      // O arquivo PDF NÃO é guardado em memória nem no disco
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Consulta match no servidor
  const runMatch = async (imovel: FichaImovelParsed, proprietario: FichaProprietarioParsed) => {
    setMatching(true)
    setErrorMessage(null)
    try {
      const result = await matchFicha({
        imovel,
        proprietario,
        property_id: propertyId || null,
      })

      setMatchResult(result)

      if (result.pergunta_telefone) {
        setShowingPhoneQuestion(true)
      } else {
        initFieldCheckboxes(imovel, proprietario, result)
      }
    } catch (err: any) {
      // Endpoint match retornou erro ou fallback
      initFieldCheckboxes(imovel, proprietario, null)
    } finally {
      setMatching(false)
    }
  }

  // Inicializa checkboxes conforme regras:
  // - Vazio no sistema: marcado por padrão (true)
  // - Preenchido no sistema: desmarcado por padrão (false)
  const initFieldCheckboxes = (
    imovel: FichaImovelParsed,
    proprietario: FichaProprietarioParsed,
    matchRes: FichaMatchResult | null,
  ) => {
    const existingProp = matchRes?.imovel?.existing || currentPropertyData || {}
    const existingOwner = matchRes?.proprietario?.existing || currentOwnerData || {}

    const imovelCheck: Record<string, boolean> = {}
    const imovelKeys = [
      'code',
      'purpose',
      'property_type',
      'use_type',
      'street',
      'street_number',
      'complement',
      'neighborhood',
      'city',
      'state',
      'zip_code',
      'bedrooms',
      'bathrooms',
      'parking',
      'area',
      'sale_price',
      'rent_price',
      'condo_fee',
      'iptu',
      'description',
      'in_condominium',
    ]

    imovelKeys.forEach((k) => {
      const hasCurrent =
        existingProp[k] !== undefined &&
        existingProp[k] !== null &&
        existingProp[k] !== '' &&
        existingProp[k] !== 0
      imovelCheck[k] = !hasCurrent
    })
    setSelectedImovelFields(imovelCheck)

    const propCheck: Record<string, boolean> = {}
    const ownerKeys = ['name', 'cpf', 'rg', 'email', 'phone', 'phone2']
    ownerKeys.forEach((k) => {
      const hasCurrent =
        existingOwner[k] !== undefined && existingOwner[k] !== null && existingOwner[k] !== ''
      propCheck[k] = !hasCurrent
    })
    setSelectedPropFields(propCheck)
  }

  const handlePhoneAnswer = (isSame: boolean) => {
    setSamePersonPhone(isSame)
    setShowingPhoneQuestion(false)
    if (parsedData) {
      initFieldCheckboxes(parsedData.imovel, parsedData.proprietario, matchResult)
    }
  }

  // Sugerir título
  const handleSuggestTitle = async () => {
    setSuggestError(null)
    setTitleOptions([])

    if (propertyId) {
      setSuggestingTitle(true)
      try {
        const list = await suggestPropertyTitles(propertyId)
        setTitleOptions(list)
      } catch (err: any) {
        fallbackGenerateTitles()
      } finally {
        setSuggestingTitle(false)
      }
    } else {
      fallbackGenerateTitles()
    }
  }

  const fallbackGenerateTitles = () => {
    if (!parsedData) return
    const p = parsedData.imovel
    const typeLabel = p.property_type
      ? p.property_type.charAt(0).toUpperCase() + p.property_type.slice(1)
      : 'Imóvel'
    const neigh = p.neighborhood ? ` em ${p.neighborhood}` : ''
    const city = p.city ? `, ${p.city}` : ''
    const beds = p.bedrooms ? ` com ${p.bedrooms} quarto${p.bedrooms > 1 ? 's' : ''}` : ''
    const opt1 = `${typeLabel}${beds}${neigh}${city}`
    const opt2 = `Excelente ${typeLabel.toLowerCase()}${neigh}${beds}`
    const opt3 = `Oportunidade: ${typeLabel.toLowerCase()}${beds}${neigh}`

    setTitleOptions([opt1, opt2, opt3])
  }

  // Validação de campos essenciais antes de Confirmar:
  // - Endereço: rua, número, CEP, UF
  // - Proprietário: nome e um contato (telefone ou email)
  const getMissingEssentials = (): string[] => {
    if (!parsedData) return []
    const missing: string[] = []
    const p = parsedData.imovel
    const o = parsedData.proprietario

    const existingProp = matchResult?.imovel?.existing || currentPropertyData || {}
    const existingOwner = matchResult?.proprietario?.existing || currentOwnerData || {}

    const street =
      (selectedImovelFields.street ? p.street : existingProp.street) ||
      p.street ||
      existingProp.street
    const number =
      (selectedImovelFields.street_number ? p.street_number : existingProp.street_number) ||
      p.street_number ||
      existingProp.street_number
    const zip =
      (selectedImovelFields.zip_code ? p.zip_code : existingProp.zip_code) ||
      p.zip_code ||
      existingProp.zip_code
    const state =
      (selectedImovelFields.state ? p.state : existingProp.state) || p.state || existingProp.state

    if (!street || !street.trim()) missing.push('Endereço: rua/logradouro')
    if (!number || !number.trim()) missing.push('Endereço: número')
    if (!zip || !zip.trim()) missing.push('Endereço: CEP')
    if (!state || !state.trim()) missing.push('Endereço: UF')

    const ownerName =
      (selectedPropFields.name ? o.name : existingOwner.name) || o.name || existingOwner.name
    const ownerPhone =
      (selectedPropFields.phone ? o.phone : existingOwner.phone) || o.phone || existingOwner.phone
    const ownerEmail =
      (selectedPropFields.email ? o.email : existingOwner.email) || o.email || existingOwner.email

    if (!ownerName || !ownerName.trim()) missing.push('Proprietário: nome')
    if ((!ownerPhone || !ownerPhone.trim()) && (!ownerEmail || !ownerEmail.trim())) {
      missing.push('Proprietário: ao menos um contato (telefone ou e-mail)')
    }

    return missing
  }

  const missingEssentials = getMissingEssentials()
  const canConfirm = missingEssentials.length === 0 && !committing

  // 4. CONFIRMAR IMPORTAÇÃO
  const handleConfirmImport = async () => {
    if (!parsedData || !canConfirm) return

    setCommitting(true)
    setErrorMessage(null)

    const imovelToSave: FichaImovelParsed = {
      ...parsedData.imovel,
      title: customTitle.trim() || parsedData.imovel.title || '',
      description: customDescription.trim() || parsedData.imovel.description || '',
    }

    const markedImovelKeys = Object.keys(selectedImovelFields).filter(
      (k) => selectedImovelFields[k],
    )
    const markedPropKeys = Object.keys(selectedPropFields).filter((k) => selectedPropFields[k])

    try {
      const res = await commitFicha({
        imovel: imovelToSave,
        proprietario: parsedData.proprietario,
        property_id: propertyId || matchResult?.imovel?.id || null,
        owner_id: samePersonPhone === false ? null : matchResult?.proprietario?.id || null,
        vincular_proprietario_existente: samePersonPhone === true,
        selected_imovel_fields: markedImovelKeys,
        selected_proprietario_fields: markedPropKeys,
      })

      setCommitSuccess(res)
    } catch (err: any) {
      // Erro exato: "Não foi possível importar. Nada foi gravado. Tente de novo."
      // Não limpar a prévia, para não perder a conferência feita.
      setErrorMessage('Não foi possível importar. Nada foi gravado. Tente de novo.')
    } finally {
      setCommitting(false)
    }
  }

  // Navegar para a ficha do imóvel criado ou atualizado
  const handleGoToProperty = (targetId: string) => {
    handleReset()
    onOpenChange(false)
    navigate(`/imoveis/${targetId}`)
  }

  // Prepara lista de campos para prévia
  const renderComparisons = () => {
    if (!parsedData) return null
    const existingProp = matchResult?.imovel?.existing || currentPropertyData || {}
    const existingOwner = matchResult?.proprietario?.existing || currentOwnerData || {}

    const imovelFieldList: { key: string; label: string; fichaVal: any; currentVal: any }[] = [
      {
        key: 'code',
        label: 'Código do imóvel',
        fichaVal: parsedData.imovel.code,
        currentVal: existingProp.code || currentPropertyCode,
      },
      {
        key: 'purpose',
        label: 'Finalidade',
        fichaVal: parsedData.imovel.purpose,
        currentVal: existingProp.purpose,
      },
      {
        key: 'property_type',
        label: 'Tipo de imóvel',
        fichaVal: parsedData.imovel.property_type,
        currentVal: existingProp.property_type,
      },
      {
        key: 'use_type',
        label: 'Uso',
        fichaVal: parsedData.imovel.use_type,
        currentVal: existingProp.use_type,
      },
      {
        key: 'street',
        label: 'Rua / Logradouro',
        fichaVal: parsedData.imovel.street,
        currentVal: existingProp.street,
      },
      {
        key: 'street_number',
        label: 'Número',
        fichaVal: parsedData.imovel.street_number,
        currentVal: existingProp.street_number,
      },
      {
        key: 'complement',
        label: 'Complemento',
        fichaVal: parsedData.imovel.complement,
        currentVal: existingProp.complement,
      },
      {
        key: 'neighborhood',
        label: 'Bairro',
        fichaVal: parsedData.imovel.neighborhood,
        currentVal: existingProp.neighborhood,
      },
      {
        key: 'city',
        label: 'Cidade',
        fichaVal: parsedData.imovel.city,
        currentVal: existingProp.city,
      },
      {
        key: 'state',
        label: 'Estado (UF)',
        fichaVal: parsedData.imovel.state,
        currentVal: existingProp.state,
      },
      {
        key: 'zip_code',
        label: 'CEP',
        fichaVal: parsedData.imovel.zip_code,
        currentVal: existingProp.zip_code,
      },
      {
        key: 'bedrooms',
        label: 'Quartos',
        fichaVal: parsedData.imovel.bedrooms,
        currentVal: existingProp.bedrooms,
      },
      {
        key: 'bathrooms',
        label: 'Banheiros',
        fichaVal: parsedData.imovel.bathrooms,
        currentVal: existingProp.bathrooms,
      },
      {
        key: 'parking',
        label: 'Vagas',
        fichaVal: parsedData.imovel.parking,
        currentVal: existingProp.parking,
      },
      {
        key: 'area',
        label: 'Área (m²)',
        fichaVal: parsedData.imovel.area,
        currentVal: existingProp.area,
      },
      {
        key: 'sale_price',
        label: 'Preço de venda',
        fichaVal: parsedData.imovel.sale_price ? `R$ ${parsedData.imovel.sale_price}` : undefined,
        currentVal: existingProp.sale_price ? `R$ ${existingProp.sale_price}` : undefined,
      },
      {
        key: 'rent_price',
        label: 'Preço de locação',
        fichaVal: parsedData.imovel.rent_price ? `R$ ${parsedData.imovel.rent_price}` : undefined,
        currentVal: existingProp.rent_price ? `R$ ${existingProp.rent_price}` : undefined,
      },
      {
        key: 'condo_fee',
        label: 'Condomínio',
        fichaVal: parsedData.imovel.condo_fee ? `R$ ${parsedData.imovel.condo_fee}` : undefined,
        currentVal: existingProp.condo_fee ? `R$ ${existingProp.condo_fee}` : undefined,
      },
      {
        key: 'iptu',
        label: 'IPTU',
        fichaVal: parsedData.imovel.iptu ? `R$ ${parsedData.imovel.iptu}` : undefined,
        currentVal: existingProp.iptu ? `R$ ${existingProp.iptu}` : undefined,
      },
    ]

    const propFieldList: {
      key: string
      label: string
      fichaVal: any
      currentVal: any
      sensitive?: boolean
    }[] = [
      {
        key: 'name',
        label: 'Nome completo',
        fichaVal: parsedData.proprietario.name,
        currentVal: existingOwner.name,
      },
      {
        key: 'phone',
        label: 'Telefone principal',
        fichaVal: parsedData.proprietario.phone,
        currentVal: existingOwner.phone,
      },
      {
        key: 'phone2',
        label: 'Telefone secundário',
        fichaVal: parsedData.proprietario.phone2,
        currentVal: existingOwner.phone2,
      },
      {
        key: 'email',
        label: 'E-mail',
        fichaVal: parsedData.proprietario.email,
        currentVal: existingOwner.email,
      },
      {
        key: 'cpf',
        label: 'CPF',
        fichaVal: canSeeSensitive ? parsedData.proprietario.cpf : undefined,
        currentVal: canSeeSensitive ? existingOwner.cpf : undefined,
        sensitive: true,
      },
      {
        key: 'rg',
        label: 'RG',
        fichaVal: canSeeSensitive ? parsedData.proprietario.rg : undefined,
        currentVal: canSeeSensitive ? existingOwner.rg : undefined,
        sensitive: true,
      },
    ]

    return (
      <div className="space-y-6">
        {/* BLOCO 1: IMÓVEL e BLOCO 2: PROPRIETÁRIO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* BLOCO IMÓVEL */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-2.5">
              <Home className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium text-foreground">Imóvel</h3>
            </div>

            <div className="space-y-3">
              {imovelFieldList.map((item) => {
                const isZeroOrMissing = !item.fichaVal
                const isChecked = Boolean(selectedImovelFields[item.key])
                const hasCurrent =
                  item.currentVal !== undefined &&
                  item.currentVal !== null &&
                  item.currentVal !== ''

                return (
                  <div
                    key={item.key}
                    className="p-2.5 rounded-lg border border-border/70 bg-muted/20 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">{item.label}</span>
                      {!isZeroOrMissing && (
                        <label className="flex items-center gap-1.5 text-[11px] cursor-pointer text-muted-foreground hover:text-foreground">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(c) =>
                              setSelectedImovelFields((prev) => ({
                                ...prev,
                                [item.key]: Boolean(c),
                              }))
                            }
                          />
                          <span>Importar</span>
                        </label>
                      )}
                    </div>

                    {isZeroOrMissing ? (
                      <div className="p-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px]">
                        Preencha depois de confirmar.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Ficha:</span>
                          <span className="text-foreground font-medium block truncate">
                            {String(item.fichaVal)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Atual:</span>
                          <span className="text-muted-foreground block truncate">
                            {hasCurrent ? String(item.currentVal) : '— (vazio)'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* BLOCO PROPRIETÁRIO */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-2.5">
              <User className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium text-foreground">Proprietário</h3>
            </div>

            <div className="space-y-3">
              {propFieldList.map((item) => {
                // Se for CPF/RG e usuário não puder ver, nem renderiza
                if (item.sensitive && !canSeeSensitive) return null

                const isZeroOrMissing = !item.fichaVal
                const isChecked = Boolean(selectedPropFields[item.key])
                const hasCurrent =
                  item.currentVal !== undefined &&
                  item.currentVal !== null &&
                  item.currentVal !== ''

                return (
                  <div
                    key={item.key}
                    className="p-2.5 rounded-lg border border-border/70 bg-muted/20 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">{item.label}</span>
                      {!isZeroOrMissing && (
                        <label className="flex items-center gap-1.5 text-[11px] cursor-pointer text-muted-foreground hover:text-foreground">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(c) =>
                              setSelectedPropFields((prev) => ({
                                ...prev,
                                [item.key]: Boolean(c),
                              }))
                            }
                          />
                          <span>Importar</span>
                        </label>
                      )}
                    </div>

                    {isZeroOrMissing ? (
                      <div className="p-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px]">
                        Preencha depois de confirmar.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Ficha:</span>
                          <span className="text-foreground font-medium block truncate">
                            {String(item.fichaVal)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Atual:</span>
                          <span className="text-muted-foreground block truncate">
                            {hasCurrent ? String(item.currentVal) : '— (vazio)'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* TÍTULO E DESCRIÇÃO EDITÁVEIS */}
        <div className="p-4 rounded-xl border border-border bg-card space-y-4">
          <h3 className="text-sm font-medium text-foreground">Título e Descrição do Anúncio</h3>

          {/* TÍTULO com Sugerir Título */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="import-custom-title" className="text-xs font-normal text-foreground">
                Título do anúncio
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSuggestTitle}
                disabled={suggestingTitle}
                className="h-8 rounded-full px-3 text-xs font-normal border-border text-foreground hover:bg-muted/40"
              >
                <span>Sugerir título</span>
              </Button>
            </div>
            <Input
              id="import-custom-title"
              placeholder="Ex.: Apartamento com 3 quartos em Salvador"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="h-10 text-xs border-border"
            />

            {/* Enquanto a IA trabalha na sugestão de título */}
            {suggestingTitle && (
              <div className="space-y-2 py-3">
                <p className="text-xs text-foreground font-normal">Gerando título…</p>
                <div className="h-0.5 w-full bg-border overflow-hidden">
                  <div className="h-full w-full bg-primary" />
                </div>
              </div>
            )}

            {titleOptions.length > 0 && !suggestingTitle && (
              <div className="space-y-2 pt-1.5">
                {titleOptions.map((opt, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-[4px] bg-accent border border-border/60 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-normal text-foreground leading-relaxed flex-1">
                        {opt}
                      </p>
                      <AiBadge className="shrink-0" />
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setCustomTitle(opt)
                          setTitleOptions([])
                        }}
                        className="h-7 rounded-[4px] px-3 text-xs font-normal bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        Usar este título
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCustomTitle(opt)
                          setTitleOptions([])
                          const inputEl = document.getElementById('import-custom-title')
                          inputEl?.focus()
                        }}
                        className="h-7 rounded-[4px] px-2.5 text-xs font-normal border-border hover:bg-card"
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleSuggestTitle}
                        className="h-7 rounded-[4px] px-2 text-xs font-normal text-muted-foreground hover:text-foreground hover:bg-transparent"
                      >
                        Gerar outro
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DESCRIÇÃO montada a partir de lazer, infraestrutura e comentário interno; editável */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="import-custom-desc" className="text-xs font-normal text-foreground">
                Descrição (editável antes de confirmar)
              </label>
              <span className="text-[11px] text-muted-foreground">
                Montada com lazer, infraestrutura e notas
              </span>
            </div>
            <Textarea
              id="import-custom-desc"
              rows={4}
              placeholder="Descrição montada a partir da ficha..."
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              className="text-xs border-border resize-y"
            />
          </div>
        </div>

        {/* BLOCO "NÃO IMPORTADO" */}
        <div className="p-4 rounded-xl border border-border/80 bg-muted/15 space-y-3">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-xs font-medium text-foreground">Não importado</h4>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Estes campos da ficha não entram no sistema e são exibidos apenas para consulta e
            conferência:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            <div className="p-2 rounded border border-border/60 bg-card text-[11px]">
              <span className="text-muted-foreground block text-[10px]">Garantia:</span>
              <span className="text-foreground">{parsedData.naoImportado.garantia}</span>
            </div>
            <div className="p-2 rounded border border-border/60 bg-card text-[11px]">
              <span className="text-muted-foreground block text-[10px]">FGTS:</span>
              <span className="text-foreground">{parsedData.naoImportado.fgts}</span>
            </div>
            <div className="p-2 rounded border border-border/60 bg-card text-[11px]">
              <span className="text-muted-foreground block text-[10px]">Permuta:</span>
              <span className="text-foreground">{parsedData.naoImportado.permuta}</span>
            </div>
            <div className="p-2 rounded border border-border/60 bg-card text-[11px]">
              <span className="text-muted-foreground block text-[10px]">Financiamento:</span>
              <span className="text-foreground">{parsedData.naoImportado.financiamento}</span>
            </div>
            <div className="p-2 rounded border border-border/60 bg-card text-[11px]">
              <span className="text-muted-foreground block text-[10px]">Posição solar:</span>
              <span className="text-foreground">{parsedData.naoImportado.posicao}</span>
            </div>
            <div className="p-2 rounded border border-border/60 bg-card text-[11px]">
              <span className="text-muted-foreground block text-[10px]">Pacote:</span>
              <span className="text-foreground">{parsedData.naoImportado.pacote}</span>
            </div>
            <div className="p-2 rounded border border-border/60 bg-card text-[11px] sm:col-span-2 lg:col-span-1">
              <span className="text-muted-foreground block text-[10px]">Local da chave:</span>
              <span className="text-foreground">{parsedData.naoImportado.local_da_chave}</span>
            </div>
          </div>
        </div>

        {/* LISTA DE CAMPOS ESSENCIAIS FALTANTES (se houver) */}
        {missingEssentials.length > 0 && (
          <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-xs text-destructive space-y-1.5">
            <div className="flex items-center gap-1.5 font-medium">
              <AlertCircle className="h-4 w-4" />
              <span>Campos essenciais pendentes para importação:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px]">
              {missingEssentials.map((m, idx) => (
                <li key={idx}>{m}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleModalClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-normal text-foreground flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            <span>Importar ficha PDF</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Importe dados diretamente da ficha PDF do Kenlo com leitura 100% no seu navegador.
          </DialogDescription>
        </DialogHeader>

        {/* MENSAGEM DE ERRO */}
        {errorMessage && (
          <div className="p-3.5 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 font-normal flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span>{errorMessage}</span>
              {errorDetail && (
                <p className="text-[10px] text-destructive/80 font-mono break-all">{errorDetail}</p>
              )}
            </div>
          </div>
        )}

        {/* RESULTADO DE SUCESSO DO COMMIT */}
        {commitSuccess ? (
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 text-foreground space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium text-sm">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>
                  {commitSuccess.criado
                    ? `Imóvel criado com o código ${commitSuccess.code} em rascunho.`
                    : `Este imóvel já estava cadastrado (${commitSuccess.code}). Os campos vazios foram preenchidos.`}
                </span>
              </div>

              {commitSuccess.pendencias && commitSuccess.pendencias.length > 0 && (
                <div className="pt-2 border-t border-emerald-500/20">
                  <span className="text-xs font-medium text-foreground block mb-1">
                    Pendências para completar na ficha:
                  </span>
                  <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                    {commitSuccess.pendencias.map((pend, i) => (
                      <li key={i}>{pend}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                onClick={() => handleGoToProperty(commitSuccess.property_id)}
                className="h-10 rounded-full px-6 text-xs font-normal bg-primary text-primary-foreground"
              >
                Ir para a ficha do imóvel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {/* SELEÇÃO DO ARQUIVO PDF */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border bg-card gap-4">
              <div className="space-y-1 min-w-0">
                <span className="text-xs font-medium text-foreground block">
                  Escolha o arquivo PDF da ficha Kenlo (até 5 MB)
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  O arquivo é lido no navegador e descartado imediatamente ao sair da tela.
                </span>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="ficha-pdf-upload-input"
                />
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={reading || matching || committing}
                  className="h-9 rounded-full px-4 text-xs font-normal bg-primary text-primary-foreground gap-2"
                >
                  {reading ? (
                    <span>Lendo a ficha…</span>
                  ) : (
                    <>
                      <FileUp className="h-4 w-4" />
                      <span>Selecionar PDF</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* STATUS: CONFERINDO CADASTROS EXISTENTES */}
            {matching && (
              <div className="p-8 rounded-xl border border-border bg-card flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-xs">Conferindo cadastros existentes…</p>
              </div>
            )}

            {/* DIÁLOGO / AVISO: PERGUNTA TELEFONE */}
            {showingPhoneQuestion && (
              <div className="p-5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-foreground space-y-3">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-sm">
                  <HelpCircle className="h-5 w-5 shrink-0" />
                  <span>Este telefone já está cadastrado com outro nome. É a mesma pessoa?</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Identificamos um contato existente no sistema com o mesmo número, porém com grafia
                  ou nome diferente.
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="button"
                    onClick={() => handlePhoneAnswer(true)}
                    className="h-9 rounded-full px-4 text-xs font-normal bg-primary text-primary-foreground"
                  >
                    Sim, é a mesma pessoa
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handlePhoneAnswer(false)}
                    className="h-9 rounded-full px-4 text-xs font-normal border-border"
                  >
                    Não, é outra pessoa
                  </Button>
                </div>
              </div>
            )}

            {/* Enquanto a IA/leitor trabalha lendo o PDF */}
            {reading && (
              <div className="p-6 rounded-[4px] bg-accent border border-border/60 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-foreground font-normal">Lendo a ficha…</p>
                  <AiBadge />
                </div>
                <div className="h-0.5 w-full bg-border overflow-hidden">
                  <div className="h-full w-full bg-primary" />
                </div>
              </div>
            )}

            {/* PRÉVIA DOS CAMPOS: Bloco com fundo accent e o selo "IA · sugestão" */}
            {!reading && !matching && !showingPhoneQuestion && parsedData && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-[4px] bg-accent border border-border/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AiBadge />
                    <span className="text-xs text-foreground font-medium">
                      Dados extraídos automaticamente da ficha PDF
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground hidden sm:inline">
                    Confira antes de confirmar a importação
                  </span>
                </div>
                {renderComparisons()}
              </div>
            )}

            {/* BOTÃO CONFIRMAR IMPORTAÇÃO (EM 360px FICA FIXO NO RODAPÉ) */}
            {parsedData && !showingPhoneQuestion && (
              <div className="pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky bottom-0 bg-background/95 backdrop-blur-sm py-3 -mx-4 px-4 sm:static sm:bg-transparent sm:py-0 sm:mx-0 sm:px-0">
                <span className="text-[11px] text-muted-foreground">
                  Nenhum dado é gravado no servidor até você clicar em Confirmar.
                </span>

                <div className="flex items-center gap-2 self-end sm:self-auto w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleModalClose(false)}
                    disabled={committing}
                    className="h-10 rounded-full px-4 text-xs font-normal border-border flex-1 sm:flex-none"
                  >
                    Cancelar
                  </Button>

                  <Button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={!canConfirm}
                    className="h-10 rounded-full px-5 text-xs font-normal bg-primary text-primary-foreground gap-2 flex-1 sm:flex-none"
                  >
                    {committing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Confirmando...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Confirmar importação</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
