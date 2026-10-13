import * as pdfjsLib from 'pdfjs-dist'

// Configura o worker do pdfjs-dist usando import padrão do Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  })

  const pdfDoc = await loadingTask.promise
  const pageTexts: string[] = []

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum)
    const textContent = await page.getTextContent()
    const textItems = textContent.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ')
    pageTexts.push(textItems)
  }

  return pageTexts.join('\n')
}
