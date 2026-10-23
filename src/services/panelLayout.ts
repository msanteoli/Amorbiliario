import pb from '@/lib/pocketbase/client'

// Arranjo dos quadros do Painel, guardado na conta da pessoa (spec 2026-10-23-painel-personalizar-design).
// Servidor: GET/PUT/DELETE /backend/v1/panel/layout (hooks panel_layout_*).

export type PanelBlockWidth = 4 | 6 | 8 | 12

export interface PanelBlock {
  id: string
  w: PanelBlockWidth
}

export interface PanelLayout {
  version: 1
  blocks: PanelBlock[]
}

export async function getPanelLayout(): Promise<PanelLayout | null> {
  const resp = await pb.send<{ layout: PanelLayout | null }>('/backend/v1/panel/layout', {
    method: 'GET',
    requestKey: null,
  })
  return resp?.layout || null
}

export async function savePanelLayout(blocks: PanelBlock[]): Promise<void> {
  await pb.send('/backend/v1/panel/layout', {
    method: 'PUT',
    body: { layout: { version: 1, blocks } },
    requestKey: null,
  })
}

export async function resetPanelLayout(): Promise<void> {
  await pb.send('/backend/v1/panel/layout', { method: 'DELETE', requestKey: null })
}
