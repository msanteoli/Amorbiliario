import React, { useState, useEffect } from 'react'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Search } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'

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
  open: boolean
  onOpenChange: (open: boolean) => void
  values: FilterValues
  neighborhoods: PublicNeighborhoodOption[]
  types: PublicTypeOption[]
  onChange: (newValues: FilterValues) => void
  onClear: () => void
}

export function formatPriceSummary(valStr: string): string {
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
  open,
  onOpenChange,
  values,
  neighborhoods,
  types,
  onChange,
  onClear,
}) => {
  const isMobile = useIsMobile()
  const [draft, setDraft] = useState<FilterValues>(values)

  useEffect(() => {
    if (open) {
      setDraft(values)
    }
  }, [open, values])

  const handleApply = () => {
    onChange(draft)
    onOpenChange(false)
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
    onOpenChange(false)
  }

  const renderFormFields = () => (
    <div className="space-y-6">
      {/* Finalidade: abas-chip "Comprar" e "Alugar" */}
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

      {/* Grid de campos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <Label className="text-[13px] font-medium text-foreground">Vagas de garagem</Label>
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

        {/* Preço Mínimo e Preço Máximo NA MESMA LINHA */}
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
        <div className="space-y-1.5 text-left sm:col-span-2">
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
    </div>
  )

  const footerActions = (
    <div className="flex items-center justify-between pt-4 border-t border-border gap-4 bg-background">
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
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-[16px] px-6 pt-6 pb-4 max-h-[90vh] flex flex-col justify-between overflow-hidden"
        >
          <SheetHeader className="text-left mb-2 shrink-0">
            <SheetTitle className="text-lg font-semibold text-foreground">Mais filtros</SheetTitle>
          </SheetHeader>

          {/* Área com rolagem interna */}
          <div className="flex-1 overflow-y-auto pr-1 py-2">{renderFormFields()}</div>

          {/* Rodapé fixo com "Limpar filtros" e "Buscar" */}
          <div className="shrink-0 pt-2">{footerActions}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl rounded-[16px] border border-border p-6 shadow-[0_6px_16px_rgba(0,0,0,0.12)] dark:shadow-none">
        <DialogHeader className="text-left mb-2">
          <DialogTitle className="text-lg font-semibold text-foreground">Mais filtros</DialogTitle>
        </DialogHeader>
        {renderFormFields()}
        {footerActions}
      </DialogContent>
    </Dialog>
  )
}
