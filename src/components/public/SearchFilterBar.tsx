import React, { useState, useEffect, useRef } from 'react'
import { PublicNeighborhoodOption, PublicTypeOption } from '@/services/publicSite'
import { PUBLIC_PROPERTY_TYPE_LABELS, formatCurrencyBR } from '@/lib/publicSiteUtils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Search, X, RotateCcw } from 'lucide-react'

export interface FilterValues {
  purpose: 'venda' | 'locacao'
  type: string
  neighborhood: string
  bedrooms: string
  parking: string
  min_price: string
  max_price: string
  sort: 'recent' | 'price_asc' | 'price_desc'
}

interface SearchFilterBarProps {
  values: FilterValues
  neighborhoods: PublicNeighborhoodOption[]
  types: PublicTypeOption[]
  onChange: (newValues: FilterValues) => void
  onClear: () => void
}

function formatPriceSummary(valStr: string): string {
  const num = Number(valStr)
  if (!num || isNaN(num)) return ''
  if (num >= 1000000) {
    const mi = (num / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
    return `Até R$ ${mi} mi`
  }
  if (num >= 1000) {
    const mil = (num / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })
    return `Até R$ ${mil} mil`
  }
  return `Até ${formatCurrencyBR(num)}`
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  values,
  neighborhoods,
  types,
  onChange,
  onClear,
}) => {
  const [panelOpen, setPanelOpen] = useState(false)
  const [draft, setDraft] = useState<FilterValues>(values)
  const desktopContainerRef = useRef<HTMLDivElement>(null)

  // Sincroniza draft sempre que values externos mudarem e o painel estiver fechado
  useEffect(() => {
    if (!panelOpen) {
      setDraft(values)
    }
  }, [values, panelOpen])

  // Fecha painel desktop ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (desktopContainerRef.current && !desktopContainerRef.current.contains(e.target as Node)) {
        setPanelOpen(false)
      }
    }
    if (panelOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [panelOpen])

  const handleApply = () => {
    onChange(draft)
    setPanelOpen(false)
  }

  const handleDraftField = <K extends keyof FilterValues>(field: K, val: FilterValues[K]) => {
    setDraft((prev) => ({ ...prev, [field]: val }))
  }

  const handleClearDraft = () => {
    const cleared: FilterValues = {
      purpose: 'venda',
      type: '',
      neighborhood: '',
      bedrooms: '',
      parking: '',
      min_price: '',
      max_price: '',
      sort: 'recent',
    }
    setDraft(cleared)
    onClear()
    setPanelOpen(false)
  }

  // Resumo para a pílula
  const purposeLabel = values.purpose === 'locacao' ? 'Alugar' : 'Comprar'
  const typeLabel = values.type
    ? PUBLIC_PROPERTY_TYPE_LABELS[values.type] || values.type
    : 'Qualquer tipo'
  const neighborhoodLabel = values.neighborhood || 'Qualquer bairro'
  const priceLabel = values.max_price
    ? formatPriceSummary(values.max_price)
    : values.min_price
      ? `A partir de R$ ${Number(values.min_price).toLocaleString('pt-BR')}`
      : 'Qualquer valor'

  // Componente dos campos de busca dentro do painel / sheet
  const renderPanelForm = () => (
    <div className="space-y-5">
      {/* Finalidade: duas pílulas "Comprar" e "Alugar" */}
      <div>
        <span className="block text-[13px] font-medium text-foreground mb-2">Finalidade</span>
        <div className="inline-flex p-1 bg-muted rounded-full">
          <button
            type="button"
            onClick={() => handleDraftField('purpose', 'venda')}
            className={`px-5 py-2 text-sm font-medium rounded-full transition-all min-h-[44px] ${
              draft.purpose === 'venda'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Comprar
          </button>
          <button
            type="button"
            onClick={() => handleDraftField('purpose', 'locacao')}
            className={`px-5 py-2 text-sm font-medium rounded-full transition-all min-h-[44px] ${
              draft.purpose === 'locacao'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Alugar
          </button>
        </div>
      </div>

      {/* Grid de campos: tipo, bairro, quartos, vagas, preço mín e máx, ordenação */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {/* Tipo */}
        <div className="space-y-1.5 text-left">
          <Label className="text-[13px] font-medium text-foreground">Tipo de imóvel</Label>
          <Select
            value={draft.type || 'todos'}
            onValueChange={(val) => handleDraftField('type', val === 'todos' ? '' : val)}
          >
            <SelectTrigger className="h-12 rounded-[8px] bg-background text-sm border-border">
              <SelectValue placeholder="Todos os tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {types.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {PUBLIC_PROPERTY_TYPE_LABELS[t.value] || t.value} ({t.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bairro */}
        <div className="space-y-1.5 text-left">
          <Label className="text-[13px] font-medium text-foreground">Bairro</Label>
          <Select
            value={draft.neighborhood || 'todos'}
            onValueChange={(val) => handleDraftField('neighborhood', val === 'todos' ? '' : val)}
          >
            <SelectTrigger className="h-12 rounded-[8px] bg-background text-sm border-border">
              <SelectValue placeholder="Todos os bairros" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os bairros</SelectItem>
              {neighborhoods.map((n) => (
                <SelectItem key={n.name} value={n.name}>
                  {n.name} ({n.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Quartos */}
        <div className="space-y-1.5 text-left">
          <Label className="text-[13px] font-medium text-foreground">Quartos</Label>
          <Select
            value={draft.bedrooms || 'qualquer'}
            onValueChange={(val) => handleDraftField('bedrooms', val === 'qualquer' ? '' : val)}
          >
            <SelectTrigger className="h-12 rounded-[8px] bg-background text-sm border-border">
              <SelectValue placeholder="Qualquer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="qualquer">Qualquer</SelectItem>
              <SelectItem value="1">1+ quarto</SelectItem>
              <SelectItem value="2">2+ quartos</SelectItem>
              <SelectItem value="3">3+ quartos</SelectItem>
              <SelectItem value="4">4+ quartos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Vagas */}
        <div className="space-y-1.5 text-left">
          <Label className="text-[13px] font-medium text-foreground">Vagas</Label>
          <Select
            value={draft.parking || 'qualquer'}
            onValueChange={(val) => handleDraftField('parking', val === 'qualquer' ? '' : val)}
          >
            <SelectTrigger className="h-12 rounded-[8px] bg-background text-sm border-border">
              <SelectValue placeholder="Qualquer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="qualquer">Qualquer</SelectItem>
              <SelectItem value="1">1+ vaga</SelectItem>
              <SelectItem value="2">2+ vagas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Preço Mínimo */}
        <div className="space-y-1.5 text-left">
          <Label className="text-[13px] font-medium text-foreground">Preço mínimo (R$)</Label>
          <Input
            type="number"
            min="0"
            step="1000"
            placeholder="R$ 0"
            className="h-12 rounded-[8px] bg-background text-sm border-border"
            value={draft.min_price}
            onChange={(e) => handleDraftField('min_price', e.target.value.replace(/\D/g, ''))}
          />
        </div>

        {/* Preço Máximo */}
        <div className="space-y-1.5 text-left">
          <Label className="text-[13px] font-medium text-foreground">Preço máximo (R$)</Label>
          <Input
            type="number"
            min="0"
            step="1000"
            placeholder="Qualquer valor"
            className="h-12 rounded-[8px] bg-background text-sm border-border"
            value={draft.max_price}
            onChange={(e) => handleDraftField('max_price', e.target.value.replace(/\D/g, ''))}
          />
        </div>

        {/* Ordenação */}
        <div className="space-y-1.5 text-left sm:col-span-2 md:col-span-3">
          <Label className="text-[13px] font-medium text-foreground">Ordenar por</Label>
          <Select
            value={draft.sort}
            onValueChange={(val: 'recent' | 'price_asc' | 'price_desc') =>
              handleDraftField('sort', val)
            }
          >
            <SelectTrigger className="h-12 rounded-[8px] bg-background text-sm border-border">
              <SelectValue placeholder="Mais recentes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="price_asc">Menor preço</SelectItem>
              <SelectItem value="price_desc">Maior preço</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Botões do painel: "Limpar filtros" (texto) e "Buscar" (ação principal preenchida, raio 8 px) */}
      <div className="flex items-center justify-between pt-4 border-t border-border gap-4">
        <button
          type="button"
          onClick={handleClearDraft}
          className="text-sm font-medium text-muted-foreground hover:text-foreground underline underline-offset-4 min-h-[44px] px-2 transition-colors"
        >
          Limpar filtros
        </button>
        <Button
          type="button"
          onClick={handleApply}
          className="rounded-[8px] h-12 px-8 font-medium text-sm min-h-[44px]"
        >
          <Search className="h-4 w-4 mr-2" />
          Buscar
        </Button>
      </div>
    </div>
  )

  return (
    <div ref={desktopContainerRef} className="relative w-full">
      {/* Pílula de busca central estilo Airbnb */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setDraft(values)
          setPanelOpen((prev) => !prev)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setDraft(values)
            setPanelOpen((prev) => !prev)
          }
        }}
        aria-label="Abrir busca de imóveis"
        className="w-full inline-flex items-center justify-between border border-border bg-card hover:bg-muted/40 text-foreground rounded-full pl-4 sm:pl-5 pr-2 py-2 shadow-sm transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary h-12"
      >
        {/* Segmentos separados por divisores: finalidade | tipo | bairro | preço */}
        <div className="flex-1 flex items-center min-w-0 text-left overflow-hidden">
          {/* Finalidade */}
          <span className="text-xs sm:text-sm font-semibold truncate shrink-0">{purposeLabel}</span>
          <span className="mx-2 sm:mx-3 text-border">|</span>

          {/* Tipo */}
          <span className="text-xs sm:text-sm font-medium truncate shrink-0 max-w-[120px] sm:max-w-none text-muted-foreground">
            {typeLabel}
          </span>
          <span className="hidden sm:inline mx-3 text-border">|</span>

          {/* Bairro */}
          <span className="hidden sm:inline text-xs sm:text-sm font-medium truncate max-w-[140px] text-muted-foreground">
            {neighborhoodLabel}
          </span>
          <span className="hidden md:inline mx-3 text-border">|</span>

          {/* Preço */}
          <span className="hidden md:inline text-xs sm:text-sm font-medium truncate text-muted-foreground">
            {priceLabel}
          </span>
        </div>

        {/* Botão redondo de busca com lupa */}
        <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 ml-2">
          <Search className="h-4 w-4" />
        </div>
      </div>

      {/* Painel flutuante Desktop (logo abaixo da pílula, cartão com raio 16 px e sombra suave 0 6px 16px rgba(0,0,0,0.12) / borda no escuro) */}
      {panelOpen && (
        <div className="hidden md:block absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-full max-w-2xl bg-card rounded-[16px] border border-border p-6 z-50 shadow-[0_6px_16px_rgba(0,0,0,0.12)] dark:shadow-none animate-in fade-in zoom-in-95 duration-150">
          {renderPanelForm()}
        </div>
      )}

      {/* Folha inferior no celular (tela cheia/max-h, cantos de 16 px no topo) */}
      <Sheet
        open={panelOpen}
        onOpenChange={(open) => {
          setPanelOpen(open)
          if (!open) setDraft(values)
        }}
      >
        <SheetContent
          side="bottom"
          className="md:hidden rounded-t-[16px] px-6 py-6 max-h-[90vh] overflow-y-auto"
        >
          <SheetHeader className="text-left mb-4">
            <SheetTitle className="text-lg font-semibold text-foreground">
              Buscar imóveis
            </SheetTitle>
          </SheetHeader>
          {renderPanelForm()}
        </SheetContent>
      </Sheet>
    </div>
  )
}
