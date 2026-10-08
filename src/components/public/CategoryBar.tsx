import React from 'react'
import { PublicTypeOption } from '@/services/publicSite'
import { PUBLIC_PROPERTY_TYPE_LABELS } from '@/lib/publicSiteUtils'
import { Home, Building2, Trees, Store, Warehouse, LayoutGrid, LucideIcon } from 'lucide-react'

interface CategoryBarProps {
  types: PublicTypeOption[]
  selectedType: string
  onSelectType: (typeValue: string) => void
}

function getCategoryIcon(typeValue: string): LucideIcon {
  const norm = typeValue.toLowerCase()
  if (norm.includes('casa')) return Home
  if (norm.includes('ap') || norm.includes('edificio') || norm.includes('flat')) return Building2
  if (
    norm.includes('terr') ||
    norm.includes('lote') ||
    norm.includes('fazenda') ||
    norm.includes('sitio') ||
    norm.includes('chacara')
  )
    return Trees
  if (norm.includes('comerc') || norm.includes('loja') || norm.includes('sala')) return Store
  if (norm.includes('galp') || norm.includes('barrac') || norm.includes('industr')) return Warehouse
  return Home
}

export const CategoryBar: React.FC<CategoryBarProps> = ({ types, selectedType, onSelectType }) => {
  return (
    <div className="w-full border-b border-border bg-background py-3">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Fileira de pílulas de contorno com rolagem horizontal (sem barra visível) */}
        <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-none py-1 h-[44px]">
          {/* Opção Todos */}
          <button
            type="button"
            onClick={() => onSelectType('')}
            className={`inline-flex items-center gap-2 px-4 h-[44px] rounded-full text-xs sm:text-sm font-medium border transition-all shrink-0 min-h-[44px] ${
              !selectedType
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30'
            }`}
          >
            <LayoutGrid className="h-4 w-4 shrink-0" />
            <span>Todos</span>
          </button>

          {/* Categorias da base */}
          {types.map((t) => {
            const Icon = getCategoryIcon(t.value)
            const isSelected = selectedType === t.value
            const label = PUBLIC_PROPERTY_TYPE_LABELS[t.value] || t.value

            return (
              <button
                key={t.value}
                type="button"
                onClick={() => onSelectType(isSelected ? '' : t.value)}
                className={`inline-flex items-center gap-2 px-4 h-[44px] rounded-full text-xs sm:text-sm font-medium border transition-all shrink-0 min-h-[44px] ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
                {t.count > 0 && (
                  <span
                    className={`text-[11px] opacity-75 ${
                      isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    ({t.count})
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
