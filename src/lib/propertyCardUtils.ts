/**
 * Utilitários para exibição de cômodos e vagas nos cartões e detalhes do imóvel
 */

export function formatRoomsText(bedrooms?: number, suites?: number): string {
  const b = Number(bedrooms) || 0
  const s = Number(suites) || 0
  if (b <= 0) return ''
  const qto = b === 1 ? '1 quarto' : `${b} quartos`
  if (s > 0) {
    const sui = s === 1 ? '1 suíte' : `${s} suítes`
    return `${qto} (${sui})`
  }
  return qto
}

export function formatParkingText(parking?: number): string | null {
  const p = Number(parking) || 0
  if (p <= 0) return null
  return `Vagas: ${p}`
}
