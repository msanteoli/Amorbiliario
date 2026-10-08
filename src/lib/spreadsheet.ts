import * as XLSX from 'xlsx'

export interface ReadSpreadsheetOptions {
  /** Se informado, lança erro se o total de linhas exceder o limite */
  maxRows?: number
}

/**
 * Formata um objeto Date ou número serial de data do Excel para "dd/mm/aaaa".
 */
function formatDateToBR(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Lê no navegador um arquivo de planilha (.xlsx, .xls ou .csv com separador ";" ou ",")
 * usando a PRIMEIRA planilha e retorna um array de objetos cujas chaves são os
 * CABEÇALHOS ORIGINAIS da planilha (sem renomear).
 *
 * Datas são formatadas como texto "dd/mm/aaaa" e números permanecem como números.
 */
export async function readSpreadsheetFile<T = Record<string, unknown>>(
  file: File,
  options: ReadSpreadsheetOptions = {},
): Promise<T[]> {
  const buffer = await file.arrayBuffer()
  const isCsv = file.name.toLowerCase().endsWith('.csv')

  let workbook: XLSX.WorkBook
  if (isCsv) {
    // Para CSVs brasileiros com delimitador ';'
    const textDecoder = new TextDecoder('utf-8')
    let csvText = textDecoder.decode(buffer)
    // Se parecer corrompido ou ISO-8859-1 (ex: acentos estranhos), ainda funciona com XLSX.read
    workbook = XLSX.read(csvText, {
      type: 'string',
      raw: true,
      cellDates: true,
    })
  } else {
    workbook = XLSX.read(buffer, {
      type: 'array',
      cellDates: true,
    })
  }

  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    throw new Error('A planilha está vazia ou não possui abas.')
  }

  const worksheet = workbook.Sheets[firstSheetName]
  if (!worksheet) {
    throw new Error('A planilha está vazia ou não possui abas.')
  }

  // Percorre as células para garantir que qualquer célula com tipo data seja formatada como "dd/mm/aaaa"
  // e números fiquem como números
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
    raw: true, // mantém números como números e datas como objetos Date quando cellDates: true
  })

  if (!rawRows || rawRows.length === 0) {
    throw new Error('Nenhuma linha de dados encontrada no arquivo.')
  }

  if (options.maxRows && rawRows.length > options.maxRows) {
    throw new Error(`O arquivo excede o limite de ${options.maxRows} linhas por vez.`)
  }

  // Normaliza valores: Date -> "dd/mm/aaaa", strings aparadas ou mantidas, números mantidos
  const formattedRows = rawRows.map((row) => {
    const formatted: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(row)) {
      if (val instanceof Date && !Number.isNaN(val.getTime())) {
        formatted[key] = formatDateToBR(val)
      } else if (typeof val === 'number') {
        formatted[key] = val
      } else if (typeof val === 'string') {
        // Se for uma data serial que não foi convertida ou string
        formatted[key] = val.trim()
      } else {
        formatted[key] = val ?? ''
      }
    }
    return formatted as T
  })

  return formattedRows
}
