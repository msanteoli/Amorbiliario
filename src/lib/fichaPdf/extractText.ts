import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import * as pdfjsWorkerModule from 'pdfjs-dist/legacy/build/pdf.worker.mjs'
;(globalThis as any).pdfjsWorker = pdfjsWorkerModule

interface RawTextItem {
  str: string
  transform: number[]
}

interface LineGroup {
  y: number
  items: { x: number; text: string }[]
}

export async function extractTextFromPdf(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    })

    const pdfDoc = await loadingTask.promise
    if (!pdfDoc.numPages || pdfDoc.numPages === 0) {
      return ''
    }

    const pagesText: string[] = []

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum)
      const textContent = await page.getTextContent()

      // 1. Filtrar e extrair itens válidos com posição
      const validItems: { text: string; x: number; y: number }[] = []
      for (const item of textContent.items) {
        if ('str' in item && typeof item.str === 'string') {
          const rawItem = item as unknown as RawTextItem
          // Ignora itens vazios (str só com espaços)
          if (
            rawItem.str.trim() !== '' &&
            Array.isArray(rawItem.transform) &&
            rawItem.transform.length >= 6
          ) {
            validItems.push({
              text: rawItem.str,
              x: rawItem.transform[4],
              y: rawItem.transform[5],
            })
          }
        }
      }

      if (validItems.length === 0) {
        continue
      }

      // 2. Agrupar em linhas cuja posição vertical difira menos de 3 unidades
      const lineGroups: LineGroup[] = []

      for (const item of validItems) {
        let matchedGroup = lineGroups.find((g) => Math.abs(g.y - item.y) < 3)
        if (!matchedGroup) {
          matchedGroup = { y: item.y, items: [] }
          lineGroups.push(matchedGroup)
        }
        matchedGroup.items.push({ x: item.x, text: item.text })
      }

      // 3. Ordenar as linhas de cima para baixo (maior transform[5] primeiro)
      lineGroups.sort((a, b) => b.y - a.y)

      // 4. Dentro de cada linha, ordenar os itens pela posição horizontal e unir com espaço
      const pageLines: string[] = []
      for (const group of lineGroups) {
        group.items.sort((a, b) => a.x - b.x)
        const lineText = group.items
          .map((it) => it.text)
          .join(' ')
          .trim()
        if (lineText) {
          pageLines.push(lineText)
        }
      }

      if (pageLines.length > 0) {
        pagesText.push(pageLines.join('\n'))
      }
    }

    const fullText = pagesText.join('\n\n').trim()
    if (!fullText) {
      return ''
    }

    return fullText
  } catch (err: any) {
    throw new Error('LEITURA_PDF ' + (err?.name || '') + ': ' + (err?.message || ''))
  }
}
