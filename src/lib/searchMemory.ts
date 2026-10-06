export interface SearchFiltersMemory {
  neighborhood?: string
  type?: string
  purpose?: string
  bedrooms?: number
  max_price?: number
}

export interface SearchMemorySnapshot {
  filters: SearchFiltersMemory
  viewed: string[]
}

let memoryFilters: SearchFiltersMemory = {}
let memoryViewed: string[] = []

export function setFilters(f: SearchFiltersMemory): void {
  // Guarda a última busca feita: bairro, tipo, finalidade, quartos, valor máximo
  memoryFilters = {
    neighborhood: f.neighborhood || undefined,
    type: f.type || undefined,
    purpose: f.purpose || undefined,
    bedrooms: f.bedrooms != null && f.bedrooms > 0 ? f.bedrooms : undefined,
    max_price: f.max_price != null && f.max_price > 0 ? f.max_price : undefined,
  }
}

export function addViewed(code: string): void {
  const clean = String(code || '').trim()
  if (!clean) return

  // Acrescenta o código ao conjunto de imóveis vistos, sem repetir, máximo 20, os mais recentes
  const filtered = memoryViewed.filter((c) => c !== clean)
  // Adiciona o mais recente no início
  memoryViewed = [clean, ...filtered].slice(0, 20)
}

export function snapshot(): SearchMemorySnapshot {
  return {
    filters: { ...memoryFilters },
    viewed: [...memoryViewed],
  }
}

export function clear(): void {
  memoryFilters = {}
  memoryViewed = []
}
