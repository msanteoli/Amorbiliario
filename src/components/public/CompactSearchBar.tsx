import React from 'react'
import { FilterValues, formatPriceSummary } from './SearchFilterBar'
import { PUBLIC_PROPERTY_TYPE_LABELS } from '@/lib/publicSiteUtils'
import { Search, SlidersHorizontal } from 'lucide-react'

interface CompactSearchBarProps {
  values: FilterValues
  onAlterarClick: () => void
}

export const CompactSearchBar: React.FC<CompactSearchBarProps> = ({ values, onAlterarClick }) => {
  const parts: string[] = []

  // Finalidade
  parts.push(values.purpose === 'locacao' ? 'Alugar' : 'Comprar')

  // Tipo
  if (values.type) {
    parts.push(PUBLIC_PROPERTY_TYPE_LABELS[values.type] || values.type)
  }

  // Bairro
  if (values.neighborhood) {
    parts.push(values.neighborhood)
  }

  // Quartos
  if (values.bedrooms) {
    parts.push(`${values.bedrooms}+ qts`)
  }

  // Preço
  if (values.max_price) {
    parts.push(formatPriceSummary(values.max_price))
  } else if (values.min_price) {
    parts.push(`A partir de R$ ${Number(values.min_price).toLocaleString('pt-BR')}`)
  }

  const summary = parts.join(' · ')

  return (
    <div
      id="compact-search-bar"
      className="sticky top-20 z-30 w-full bg-background/95 backdrop-blur-md border-b border-border shadow-sm py-2.5 px-4 sm:px-6 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Resumo com ícone de lupa */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
            <Search className="h-4 w-4" />
          </div>
          <p className="text-xs sm:text-sm font-medium text-foreground truncate">{summary}</p>
        </div>

        {/* Botão Alterar que rola ao topo do cartão */}
        <button
          type="button"
          onClick={onAlterarClick}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-card hover:bg-muted text-xs sm:text-sm font-medium text-foreground transition-colors min-h-[44px]"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Alterar</span>
        </button>
      </div>
    </div>
  )
}
