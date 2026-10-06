/**
 * Utilitários para formatação e validação de dados de clientes
 */

/**
 * Formata um telefone com dígitos para (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
 * Se tiver prefixo 55 internacional, remove para exibição brasileira
 */
export function formatPhoneNumber(phone?: string | null): string {
  if (!phone) return '-'
  let digits = phone.replace(/\D/g, '')

  // Se começar com 55 e tiver 12 ou 13 dígitos, remove o 55 para exibir no formato nacional
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2)
  }

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }

  return phone
}

/**
 * Aplica máscara de telefone durante a digitação: (XX) XXXXX-XXXX
 */
export function maskPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

/**
 * Aplica máscara de CPF: 000.000.000-00
 */
export function maskCpfInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (!digits) return ''
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}

/**
 * Validação rigorosa dos dígitos verificadores do CPF
 */
export function isValidCpf(cpf?: string | null): boolean {
  if (!cpf) return false
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * (10 - i)
  }
  let remainder = (sum * 10) % 11
  if (remainder === 10) remainder = 0
  if (remainder !== parseInt(digits[9], 10)) return false

  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i], 10) * (11 - i)
  }
  remainder = (sum * 10) % 11
  if (remainder === 10) remainder = 0
  if (remainder !== parseInt(digits[10], 10)) return false

  return true
}

/**
 * Formata data no formato brasileiro dd/mm/aaaa
 */
export function formatDate(dateString?: string | null): string {
  if (!dateString) return '-'
  try {
    const clean = dateString.replace(' ', 'T')
    const d = new Date(clean)
    if (isNaN(d.getTime())) return dateString
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  } catch {
    return dateString
  }
}

/**
 * Rótulo amigável para tipos de cliente
 */
export const KIND_LABELS: Record<string, string> = {
  comprador: 'Comprador',
  locatario: 'Locatário',
  proprietario: 'Proprietário',
  investidor: 'Investidor',
}

/**
 * Rótulo amigável para status de consentimento
 */
export const CONSENT_STATUS_LABELS: Record<string, string> = {
  opt_in: 'Autorizou',
  opt_out: 'Não autorizou',
  unknown: 'Sem informação',
}
