import { PanelBlock, PanelBlockWidth, PanelLayout } from '@/services/panelLayout'

// Registro dos quadros do Painel (spec 2026-10-23-painel-personalizar-design).
// O catálogo por função é o mesmo do servidor (pocketbase/hooks/panel_layout_put.js): mexeu num, mexa no outro.

const COMMON = ['agenda', 'visitas_confirmar', 'grafico']

export const PANEL_CATALOG: Record<string, string[]> = {
  sdr: [
    ...COMMON,
    'ind:leads_sem_followup',
    'ind:tempo_primeiro_atendimento',
    'ind:pct_repassados',
    'apoio:leads_sem_dono',
    'apoio:duplicidade',
    'apoio:visitas_pendentes',
  ],
  corretor: [...COMMON, 'ind:visitas', 'ind:negociacoes', 'ind:vgv_fechado'],
  admin: [
    ...COMMON,
    'ind:vgv_equipe',
    'ind:funil',
    'ind:tarefas',
    'apoio:etapas',
    'apoio:parados',
    'apoio:revisao',
    'apoio:visitas_semana',
  ],
}

export const PANEL_BLOCK_TITLES: Record<string, string> = {
  agenda: 'Minha agenda de hoje',
  visitas_confirmar: 'Visitas para confirmar',
  grafico: 'Gráfico do período',
  'ind:leads_sem_followup': 'Leads sem follow-up',
  'ind:tempo_primeiro_atendimento': 'Tempo para o primeiro atendimento',
  'ind:pct_repassados': 'Leads repassados ao corretor',
  'ind:visitas': 'Visitas realizadas',
  'ind:negociacoes': 'Negociações em andamento',
  'ind:vgv_fechado': 'VGV fechado',
  'ind:vgv_equipe': 'VGV fechado da equipe',
  'ind:funil': 'Funil do período',
  'ind:tarefas': 'Tarefas atrasadas e no prazo',
  'apoio:leads_sem_dono': 'Leads novos sem dono',
  'apoio:duplicidade': 'Pendências de duplicidade',
  'apoio:visitas_pendentes': 'Visitas pendentes de agenda',
  'apoio:etapas': 'Leads por etapa',
  'apoio:parados': 'Leads parados sem dono',
  'apoio:revisao': 'Imóveis pendentes de revisão',
  'apoio:visitas_semana': 'Visitas da semana',
}

// Padrão por função: o desenho de hoje em grade de 12 colunas (agenda à esquerda, indicadores e gráfico empilhados à direita)
const DEFAULT_BY_ROLE: Record<string, PanelBlock[]> = {
  sdr: [
    { id: 'visitas_confirmar', w: 8 },
    { id: 'agenda', w: 8 },
    { id: 'ind:leads_sem_followup', w: 4 },
    { id: 'ind:tempo_primeiro_atendimento', w: 4 },
    { id: 'ind:pct_repassados', w: 4 },
    { id: 'grafico', w: 4 },
    { id: 'apoio:leads_sem_dono', w: 4 },
    { id: 'apoio:duplicidade', w: 4 },
    { id: 'apoio:visitas_pendentes', w: 4 },
  ],
  corretor: [
    { id: 'visitas_confirmar', w: 8 },
    { id: 'agenda', w: 8 },
    { id: 'ind:visitas', w: 4 },
    { id: 'ind:negociacoes', w: 4 },
    { id: 'ind:vgv_fechado', w: 4 },
    { id: 'grafico', w: 4 },
  ],
  admin: [
    { id: 'visitas_confirmar', w: 8 },
    { id: 'agenda', w: 8 },
    { id: 'ind:vgv_equipe', w: 4 },
    { id: 'ind:funil', w: 4 },
    { id: 'ind:tarefas', w: 4 },
    { id: 'grafico', w: 4 },
    { id: 'apoio:etapas', w: 8 },
    { id: 'apoio:parados', w: 4 },
    { id: 'apoio:revisao', w: 4 },
    { id: 'apoio:visitas_semana', w: 4 },
  ],
}

export function getDefaultBlocks(role: string): PanelBlock[] {
  return (DEFAULT_BY_ROLE[role] || []).map((b) => ({ ...b }))
}

// Arranjo que vale na tela: o salvo (sem ids que a função não tem mais) ou o padrão da função
export function resolveBlocks(role: string, saved: PanelLayout | null): PanelBlock[] {
  if (!saved || !Array.isArray(saved.blocks)) return getDefaultBlocks(role)
  const allowed = PANEL_CATALOG[role] || []
  const seen: Record<string, boolean> = {}
  const out: PanelBlock[] = []
  saved.blocks.forEach((b) => {
    if (!b || typeof b.id !== 'string' || allowed.indexOf(b.id) < 0 || seen[b.id]) return
    seen[b.id] = true
    const w: PanelBlockWidth = b.w === 4 || b.w === 6 || b.w === 8 || b.w === 12 ? b.w : 12
    out.push({ id: b.id, w })
  })
  return out
}

// Classes fixas (o Tailwind só gera classes escritas por inteiro). Abaixo de 1024 px todo quadro ocupa a largura toda.
export function colSpanClass(w: PanelBlockWidth): string {
  if (w === 4) return 'lg:col-span-4'
  if (w === 6) return 'lg:col-span-6'
  if (w === 8) return 'lg:col-span-8'
  return 'lg:col-span-12'
}
