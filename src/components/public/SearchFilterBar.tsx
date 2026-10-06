import React, { useState } from 'react'
import { PublicNeighborhoodOption, PublicTypeOption } from '@/services/publicSite'
import { PUBLIC_PROPERTY_TYPE_LABELS } from '@/lib/publicSiteUtils'
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SlidersHorizontal, RotateCcw } from 'lucide-react'

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

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  values,
  neighborhoods,
  types,
  onChange,
  onClear,
}) => {
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)

  const handlePurposeChange = (purpose: 'venda' | 'locacao') => {
    onChange({ ...values, purpose })
  }

  const handleFieldChange = (field: keyof FilterValues, val: string) => {
    onChange({ ...values, [field]: val })
  }

  const activeFiltersCount = [
    values.type,
    values.neighborhood,
    values.bedrooms,
    values.parking,
    values.min_price,
    values.max_price,
    values.sort !== 'recent' ? values.sort : '',
  ].filter(Boolean).length

  // Componente dos campos de formulário (reutilizado no desktop e no sheet mobile)
  const renderFilterFields = (isMobileSheet = false) => (
    <div
      className={`grid gap-4 ${isMobileSheet ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 items-end'}`}
    >
      {/* Tipo */}
      <div className="space-y-1.5 text-left">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Tipo
        </Label>
        <Select
          value={values.type || 'todos'}
          onValueChange={(val) => handleFieldChange('type', val === 'todos' ? '' : val)}
        >
          <SelectTrigger className="h-10 bg-background text-sm">
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
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Bairro
        </Label>
        <Select
          value={values.neighborhood || 'todos'}
          onValueChange={(val) => handleFieldChange('neighborhood', val === 'todos' ? '' : val)}
        >
          <SelectTrigger className="h-10 bg-background text-sm">
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
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Quartos
        </Label>
        <Select
          value={values.bedrooms || 'qualquer'}
          onValueChange={(val) => handleFieldChange('bedrooms', val === 'qualquer' ? '' : val)}
        >
          <SelectTrigger className="h-10 bg-background text-sm">
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
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Vagas
        </Label>
        <Select
          value={values.parking || 'qualquer'}
          onValueChange={(val) => handleFieldChange('parking', val === 'qualquer' ? '' : val)}
        >
          <SelectTrigger className="h-10 bg-background text-sm">
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
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Preço Mín (R$)
        </Label>
        <Input
          type="number"
          min="0"
          step="1"
          placeholder="R$ Mín"
          className="h-10 bg-background text-sm"
          value={values.min_price}
          onChange={(e) => handleFieldChange('min_price', e.target.value.replace(/\D/g, ''))}
        />
      </div>

      {/* Preço Máximo */}
      <div className="space-y-1.5 text-left">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Preço Máx (R$)
        </Label>
        <Input
          type="number"
          min="0"
          step="1"
          placeholder="R$ Máx"
          className="h-10 bg-background text-sm"
          value={values.max_price}
          onChange={(e) => handleFieldChange('max_price', e.target.value.replace(/\D/g, ''))}
        />
      </div>

      {/* Ordenação */}
      <div className="space-y-1.5 text-left">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Ordenar por
        </Label>
        <Select
          value={values.sort}
          onValueChange={(val: 'recent' | 'price_asc' | 'price_desc') =>
            handleFieldChange('sort', val)
          }
        >
          <SelectTrigger className="h-10 bg-background text-sm">
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
  )

  return (
    <div className="w-full bg-card rounded-2xl border border-border shadow-sm p-4 sm:p-5">
      {/* Topo da barra: Abas de Finalidade e Botão Mobile de Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border/80">
        <div className="flex items-center p-1 bg-muted rounded-xl">
          <button
            type="button"
            onClick={() => handlePurposeChange('venda')}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
              values.purpose === 'venda'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Comprar
          </button>
          <button
            type="button"
            onClick={() => handlePurposeChange('locacao')}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
              values.purpose === 'locacao'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Alugar
          </button>
        </div>

        {/* Mobile: Botão que abre a folha de filtros */}
        <div className="flex items-center gap-2 sm:hidden w-full xs:w-auto">
          <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="flex-1 xs:flex-none gap-2 h-10">
                <SlidersHorizontal className="h-4 w-4" />
                <span>Filtrar</span>
                {activeFiltersCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-primary text-primary-foreground font-bold">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="rounded-t-2xl px-6 py-6 max-h-[85vh] overflow-y-auto"
            >
              <SheetHeader className="text-left mb-4">
                <SheetTitle>Filtrar imóveis</SheetTitle>
              </SheetHeader>
              <div className="space-y-4">
                {renderFilterFields(true)}
                <div className="flex items-center gap-3 pt-3 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 gap-1.5"
                    onClick={() => {
                      onClear()
                      setMobileSheetOpen(false)
                    }}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Limpar filtros
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    className="flex-1"
                    onClick={() => setMobileSheetOpen(false)}
                  >
                    Ver resultados
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {activeFiltersCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-xs text-muted-foreground h-10 px-2"
            >
              Limpar
            </Button>
          )}
        </div>

        {/* Desktop: Botão Limpar Filtros */}
        <div className="hidden sm:flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-9"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Desktop Filter Row */}
      <div className="hidden sm:block pt-4">{renderFilterFields(false)}</div>
    </div>
  )
}
