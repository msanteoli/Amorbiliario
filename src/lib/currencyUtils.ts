/**
 * Utilitários para formatação e manipulação de valores monetários (BRL)
 */

/**
 * Formata um número como string com máscara BRL "R$ 1.500,00" ou apenas "1.500,00"
 */
export function formatCurrencyInput(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value) || value <= 0) {
    return ''
  }
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Aplica máscara de moeda BRL à medida que o usuário digita.
 * Baseia-se em centavos (shift numérico da direita para a esquerda).
 * Ex: digita 1 -> "0,01"; digita 5 -> "0,15"; digita 0 -> "1,50"; digita 0 -> "15,00"
 */
export function maskCurrencyInput(rawInput: string): string {
  const digits = rawInput.replace(/\D/g, '')
  if (!digits) return ''
  const numberValue = parseInt(digits, 10) / 100
  if (numberValue === 0) return ''
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numberValue)
}

/**
 * Converte string digitada com máscara brasileira ("1.250,50") para number ou undefined se vazia
 */
export function parseCurrencyInput(valueString: string): number | undefined {
  const clean = valueString.trim()
  if (!clean) return undefined
  // remove tudo que não for dígito ou vírgula
  const digitsAndComma = clean.replace(/[^\d,]/g, '').replace(',', '.')
  const num = parseFloat(digitsAndComma)
  if (isNaN(num)) return undefined
  return num
}
