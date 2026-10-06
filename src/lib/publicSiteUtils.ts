import { PriceDetail } from '@/services/publicSite'

export const PUBLIC_PROPERTY_TYPE_LABELS: Record<string, string> = {
  casa: 'Casa',
  apartamento: 'Apartamento',
  terreno: 'Terreno',
  comercial: 'Sala ou loja comercial',
  galpao: 'Galpão',
  chacara: 'Chácara ou sítio',
  outro: 'Outro',
}

export function formatPrice(price: PriceDetail | null, purpose: 'sale' | 'rent'): string {
  if (!price) return ''
  if (price.state === 'consulte') return 'Consulte'
  if (price.state === 'nao_informado') return 'Valor não informado'
  if (price.state === 'informado' && price.value != null) {
    const formatted = price.value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    })
    return purpose === 'rent' ? `${formatted}/mês` : formatted
  }
  return 'Valor não informado'
}

export function formatCurrencyBR(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

export function getFullPhotoUrl(path: string | null): string | null {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const base = (import.meta.env.VITE_POCKETBASE_URL || '').replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}

export function buildSpecsSummary(props: {
  bedrooms?: number
  bathrooms?: number
  parking?: number
  area?: number
}): string {
  const parts: string[] = []

  if (props.bedrooms && props.bedrooms > 0) {
    parts.push(`${props.bedrooms} ${props.bedrooms === 1 ? 'quarto' : 'quartos'}`)
  }
  if (props.bathrooms && props.bathrooms > 0) {
    parts.push(`${props.bathrooms} ${props.bathrooms === 1 ? 'banheiro' : 'banheiros'}`)
  }
  if (props.parking && props.parking > 0) {
    parts.push(`${props.parking} ${props.parking === 1 ? 'vaga' : 'vagas'}`)
  }
  if (props.area && props.area > 0) {
    parts.push(`${props.area} m²`)
  }

  return parts.join(' · ')
}
