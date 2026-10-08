import React, { useState, useEffect, useRef, useId } from 'react'
import { Home, DoorOpen, Search, ChevronDown, SlidersHorizontal } from 'lucide-react'
import { Enter } from './Enter'
import { PublicNeighborhoodOption, PublicTypeOption } from '@/services/publicSite'
import { PUBLIC_PROPERTY_TYPE_LABELS } from '@/lib/publicSiteUtils'
import { FilterValues } from './SearchFilterBar'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'

interface HeroSearchCardProps {
  values: FilterValues
  neighborhoods: PublicNeighborhoodOption[]
  types: PublicTypeOption[]
  onSearch: (newValues: FilterValues) => void
  onOpenMoreFilters: () => void
}

/**
 * Remove acentos e normaliza para busca insensível
 */
function normalizeStr(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export const HeroSearchCard: React.FC<HeroSearchCardProps> = ({
  values,
  neighborhoods,
  types,
  onSearch,
  onOpenMoreFilters,
}) => {
  const [purpose, setPurpose] = useState<'venda' | 'locacao'>(values.purpose || 'venda')
  const [neighborhoodInput, setNeighborhoodInput] = useState(values.neighborhood || '')
  const [selectedType, setSelectedType] = useState<string>(values.type || '')
  const [selectedBedrooms, setSelectedBedrooms] = useState<string>(values.bedrooms || '')
  const [selectedMaxPrice, setSelectedMaxPrice] = useState<string>(values.max_price || '')

  // Sugestões de bairro
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const listboxId = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sincroniza quando os valores externos mudam (ex: URL ou clique no menu do header)
  useEffect(() => {
    setPurpose(values.purpose || 'venda')
    setNeighborhoodInput(values.neighborhood || '')
    setSelectedType(values.type || '')
    setSelectedBedrooms(values.bedrooms || '')
    setSelectedMaxPrice(values.max_price || '')
  }, [values])

  // Fecha sugestões ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setSuggestionsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Filtra bairros da base
  const queryNorm = normalizeStr(neighborhoodInput)
  const filteredNeighborhoods = neighborhoods.filter((n) => {
    if (!queryNorm) return true
    return normalizeStr(n.name).includes(queryNorm)
  })

  const triggerSearch = (overrideNeighborhood?: string) => {
    const finalNeighborhood =
      overrideNeighborhood !== undefined ? overrideNeighborhood : neighborhoodInput.trim()

    onSearch({
      ...values,
      purpose,
      neighborhood: finalNeighborhood,
      type: selectedType,
      bedrooms: selectedBedrooms,
      max_price: selectedMaxPrice,
    })
    setSuggestionsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!suggestionsOpen) {
        setSuggestionsOpen(true)
        setHighlightedIndex(0)
      } else {
        setHighlightedIndex((prev) => (prev < filteredNeighborhoods.length - 1 ? prev + 1 : prev))
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (suggestionsOpen) {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1))
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestionsOpen && highlightedIndex >= 0 && filteredNeighborhoods[highlightedIndex]) {
        const chosen = filteredNeighborhoods[highlightedIndex].name
        setNeighborhoodInput(chosen)
        triggerSearch(chosen)
      } else {
        triggerSearch()
      }
    } else if (e.key === 'Escape') {
      setSuggestionsOpen(false)
    }
  }

  // Opções para o filtro de Até R$ conforme a finalidade
  const priceOptions =
    purpose === 'locacao'
      ? [
          { value: '', label: 'Qualquer valor' },
          { value: '1500', label: 'Até R$ 1.500' },
          { value: '2500', label: 'Até R$ 2.500' },
          { value: '4000', label: 'Até R$ 4.000' },
          { value: '6000', label: 'Até R$ 6.000' },
          { value: '10000', label: 'Até R$ 10.000' },
        ]
      : [
          { value: '', label: 'Qualquer valor' },
          { value: '300000', label: 'Até R$ 300 mil' },
          { value: '500000', label: 'Até R$ 500 mil' },
          { value: '800000', label: 'Até R$ 800 mil' },
          { value: '1200000', label: 'Até R$ 1,2 milhão' },
          { value: '2000000', label: 'Até R$ 2 milhões' },
        ]

  // Formatação do label do botão Tipo
  const typeLabel = selectedType
    ? PUBLIC_PROPERTY_TYPE_LABELS[selectedType] || selectedType
    : 'Tipo'

  // Formatação do label do botão Quartos
  const bedroomsLabel = selectedBedrooms ? `${selectedBedrooms}+ quartos` : 'Quartos'

  // Formatação do label do botão Até R$
  const priceLabel = selectedMaxPrice
    ? priceOptions.find((p) => p.value === selectedMaxPrice)?.label ||
      `Até R$ ${Number(selectedMaxPrice).toLocaleString('pt-BR')}`
    : 'Até R$'

  return (
    <div
      id="hero-search-card"
      className="w-full bg-card rounded-[24px] p-5 sm:p-8 shadow-[0_6px_16px_rgba(0,0,0,0.12)] dark:shadow-none dark:border dark:border-border text-foreground space-y-6"
    >
      {/* Título e Subtítulo (sem nome de nenhuma cidade no texto) */}
      <div className="space-y-2 text-left">
        {/* Passo 0: título "Encontre seu imóvel" (classe pequena) */}
        <Enter
          as="h1"
          step={0}
          small
          className="text-[30px] sm:text-[48px] font-semibold tracking-tight leading-[1.1] text-foreground"
        >
          Encontre seu imóvel
        </Enter>
        {/* Passo 1: subtítulo (classe pequena) */}
        <Enter
          as="p"
          step={1}
          small
          className="text-base sm:text-lg text-muted-foreground font-normal"
        >
          Casas, apartamentos e terrenos para comprar e alugar.
        </Enter>
      </div>

      {/* Passo 2: Abas "Comprar" e "Alugar" com ícone, ativa com traço de 2 px na cor primary (classe pequena) */}
      <Enter
        step={2}
        small
        className="flex items-center gap-6 border-b border-border text-sm font-medium"
      >
        <button
          type="button"
          onClick={() => {
            setPurpose('venda')
            onSearch({ ...values, purpose: 'venda' })
          }}
          className={`inline-flex items-center gap-2 pb-3.5 transition-colors relative min-h-[44px] ${
            purpose === 'venda'
              ? 'text-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Home className="h-4 w-4" />
          <span>Comprar</span>
          {purpose === 'venda' && (
            <span className="absolute bottom-0 inset-x-0 h-[2px] bg-primary rounded-t" />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setPurpose('locacao')
            onSearch({ ...values, purpose: 'locacao' })
          }}
          className={`inline-flex items-center gap-2 pb-3.5 transition-colors relative min-h-[44px] ${
            purpose === 'locacao'
              ? 'text-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <DoorOpen className="h-4 w-4" />
          <span>Alugar</span>
          {purpose === 'locacao' && (
            <span className="absolute bottom-0 inset-x-0 h-[2px] bg-primary rounded-t" />
          )}
        </button>
      </Enter>

      {/* Passo 3: Campo "Busque por bairro" (classe pequena) */}
      <Enter step={3} small>
        <div ref={wrapperRef} className="relative w-full space-y-3 min-[480px]:space-y-0">
          <div className="relative flex items-center h-14 w-full rounded-full border border-border bg-background focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all shadow-sm pl-4 pr-4 min-[480px]:pr-1.5">
            <Search className="h-5 w-5 text-muted-foreground shrink-0 mr-3" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={suggestionsOpen}
              aria-controls={listboxId}
              aria-autocomplete="list"
              placeholder="Busque por bairro"
              value={neighborhoodInput}
              onChange={(e) => {
                setNeighborhoodInput(e.target.value)
                setSuggestionsOpen(true)
                setHighlightedIndex(-1)
              }}
              onFocus={() => {
                setSuggestionsOpen(true)
              }}
              onKeyDown={handleKeyDown}
              className="w-full h-full bg-transparent text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
            />

            {/* Botão "Buscar imóveis" dentro do campo apenas a partir de 480px */}
            <button
              type="button"
              onClick={() => triggerSearch()}
              className="hidden min-[480px]:inline-flex shrink-0 h-11 px-4 sm:px-6 rounded-full bg-primary text-primary-foreground font-medium text-xs sm:text-sm items-center gap-2 hover:opacity-90 active:scale-95 transition-all min-h-[44px]"
            >
              <Search className="h-4 w-4 shrink-0 sm:hidden" />
              <span>Buscar imóveis</span>
            </button>
          </div>

          {/* Abaixo de 480px: botão de largura total (48px de altura, pílula, ação principal) logo abaixo do campo */}
          <button
            type="button"
            onClick={() => triggerSearch()}
            className="min-[480px]:hidden w-full h-12 rounded-full bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all min-h-[48px] shadow-sm"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span>Buscar imóveis</span>
          </button>

          {/* Dropdown de sugestões de bairro */}
          {suggestionsOpen && (
            <div
              id={listboxId}
              role="listbox"
              className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 bg-card rounded-[16px] border border-border p-2 shadow-[0_6px_16px_rgba(0,0,0,0.12)] dark:shadow-none max-h-60 overflow-y-auto"
            >
              {filteredNeighborhoods.length > 0 ? (
                filteredNeighborhoods.map((n, idx) => {
                  const isHighlighted = idx === highlightedIndex
                  return (
                    <div
                      key={n.name}
                      role="option"
                      aria-selected={isHighlighted}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onClick={() => {
                        setNeighborhoodInput(n.name)
                        triggerSearch(n.name)
                      }}
                      className={`px-3 py-2.5 rounded-[8px] text-sm cursor-pointer flex items-center justify-between transition-colors min-h-[44px] ${
                        isHighlighted
                          ? 'bg-muted text-foreground'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <span>{n.name}</span>
                      <span className="text-xs text-muted-foreground tabular">
                        {n.count} imóveis
                      </span>
                    </div>
                  )
                })
              ) : (
                <div className="px-3 py-3 text-sm text-muted-foreground text-center">
                  Nenhum bairro com esse nome.
                </div>
              )}
            </div>
          )}
        </div>
      </Enter>

      {/* Passo 4: Pílulas Tipo, Quartos, Até R$ e "Mais filtros" (classe pequena) */}
      <Enter step={4} small className="flex flex-wrap items-center gap-2 pt-1 text-sm">
        {/* Dropdown Tipo */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full border text-xs sm:text-sm font-medium transition-colors min-h-[44px] ${
                selectedType
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border bg-card text-foreground hover:bg-muted'
              }`}
            >
              <span>{typeLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-56 p-1 rounded-[12px] bg-card border-border"
          >
            <DropdownMenuRadioGroup
              value={selectedType}
              onValueChange={(val) => {
                setSelectedType(val)
                onSearch({
                  ...values,
                  purpose,
                  type: val,
                  neighborhood: neighborhoodInput,
                  bedrooms: selectedBedrooms,
                  max_price: selectedMaxPrice,
                })
              }}
            >
              <DropdownMenuRadioItem value="" className="text-sm min-h-[40px] cursor-pointer">
                Todos os tipos
              </DropdownMenuRadioItem>
              {types.map((t) => (
                <DropdownMenuRadioItem
                  key={t.value}
                  value={t.value}
                  className="text-sm min-h-[40px] cursor-pointer"
                >
                  {PUBLIC_PROPERTY_TYPE_LABELS[t.value] || t.value} ({t.count})
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Dropdown Quartos */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full border text-xs sm:text-sm font-medium transition-colors min-h-[44px] ${
                selectedBedrooms
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border bg-card text-foreground hover:bg-muted'
              }`}
            >
              <span>{bedroomsLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-48 p-1 rounded-[12px] bg-card border-border"
          >
            <DropdownMenuRadioGroup
              value={selectedBedrooms}
              onValueChange={(val) => {
                setSelectedBedrooms(val)
                onSearch({
                  ...values,
                  purpose,
                  bedrooms: val,
                  neighborhood: neighborhoodInput,
                  type: selectedType,
                  max_price: selectedMaxPrice,
                })
              }}
            >
              <DropdownMenuRadioItem value="" className="text-sm min-h-[40px] cursor-pointer">
                Qualquer
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="1" className="text-sm min-h-[40px] cursor-pointer">
                1+ quarto
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="2" className="text-sm min-h-[40px] cursor-pointer">
                2+ quartos
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="3" className="text-sm min-h-[40px] cursor-pointer">
                3+ quartos
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="4" className="text-sm min-h-[40px] cursor-pointer">
                4+ quartos
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Dropdown Até R$ */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full border text-xs sm:text-sm font-medium transition-colors min-h-[44px] ${
                selectedMaxPrice
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border bg-card text-foreground hover:bg-muted'
              }`}
            >
              <span>{priceLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-56 p-1 rounded-[12px] bg-card border-border"
          >
            <DropdownMenuRadioGroup
              value={selectedMaxPrice}
              onValueChange={(val) => {
                setSelectedMaxPrice(val)
                onSearch({
                  ...values,
                  purpose,
                  max_price: val,
                  neighborhood: neighborhoodInput,
                  type: selectedType,
                  bedrooms: selectedBedrooms,
                })
              }}
            >
              {priceOptions.map((opt) => (
                <DropdownMenuRadioItem
                  key={opt.value}
                  value={opt.value}
                  className="text-sm min-h-[40px] cursor-pointer"
                >
                  {opt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Link "Mais filtros" que abre o painel completo */}
        <button
          type="button"
          onClick={onOpenMoreFilters}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-foreground hover:text-muted-foreground transition-colors min-h-[44px] underline underline-offset-4 ml-auto"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Mais filtros</span>
        </button>
      </Enter>
    </div>
  )
}
