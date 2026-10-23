import React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IndicatorItem, PainelPeriod } from '@/services/today'

// Blocos de dados do Painel (spec 2026-10-22-painel-agenda-e-indicadores): só números e gráficos, sem listas.

export function PeriodSelector({
  value,
  onChange,
  disabled,
}: {
  value: PainelPeriod
  onChange: (p: PainelPeriod) => void
  disabled?: boolean
}) {
  const opts: Array<{ v: PainelPeriod; label: string }> = [
    { v: 'semana', label: 'Esta semana' },
    { v: 'mes', label: 'Este mês' },
  ]
  return (
    <div
      role="group"
      aria-label="Período dos indicadores"
      className="inline-flex rounded-full border border-border bg-card p-0.5"
    >
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={value === o.v}
          disabled={disabled}
          onClick={() => onChange(o.v)}
          className={cn(
            'h-8 rounded-full px-3.5 text-xs transition-colors disabled:opacity-60',
            value === o.v
              ? 'bg-primary text-primary-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function formatValue(item: IndicatorItem): string {
  if (item.no_data) return '—'
  const v = Number(item.value) || 0
  if (item.unit === 'R$') {
    if (v >= 1000000)
      return `R$ ${(v / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
    if (v >= 1000) return `R$ ${Math.round(v / 1000).toLocaleString('pt-BR')} mil`
    return `R$ ${v.toLocaleString('pt-BR')}`
  }
  if (item.unit === '%') return `${v}%`
  if (item.unit === 'min') return `${v} min`
  return v.toLocaleString('pt-BR')
}

function secondaryText(item: IndicatorItem): string | null {
  const s = item.secondary
  if (item.parts && item.parts.length > 0) {
    return item.parts.map((p) => `${p.value} ${p.label.toLowerCase()}`).join(' · ')
  }
  if (!s) return null
  if (item.key === 'visitas') return `de ${s.value} agendadas`
  if (item.key === 'negociacoes') return `conversão de ${s.value}%`
  if (item.key === 'tarefas') {
    return s.no_data ? 'sem tarefas concluídas no período' : `${s.value}% concluídas no prazo`
  }
  return `${s.label}: ${s.value}${s.unit === '%' ? '%' : ''}`
}

export function IndicatorCard({ item, highlight }: { item: IndicatorItem; highlight?: boolean }) {
  const prev = item.previous
  const lowerIsBetter = item.key === 'tempo_primeiro_atendimento'
  let chip: { text: string; good: boolean | null } | null = null
  if (typeof prev === 'number' && !item.no_data) {
    if (prev > 0) {
      const delta = Math.round(((item.value - prev) / prev) * 100)
      if (delta === 0) chip = { text: 'igual ao período anterior', good: null }
      else {
        const up = delta > 0
        chip = {
          text: `${up ? '↑' : '↓'} ${Math.abs(delta)}% vs período anterior`,
          good: lowerIsBetter ? !up : up,
        }
      }
    } else if (item.value > 0) {
      chip = { text: 'novo neste período', good: true }
    }
  }
  const sec = secondaryText(item)
  return (
    <div
      className={cn(
        'rounded-xl p-5 space-y-1.5',
        highlight ? 'bg-primary text-primary-foreground' : 'border border-border bg-card',
      )}
    >
      <p
        className={cn(
          'text-xs',
          highlight ? 'text-primary-foreground/80' : 'text-muted-foreground',
        )}
      >
        {item.label}
      </p>
      <p className="text-3xl font-semibold tracking-tight tabular-nums">{formatValue(item)}</p>
      {sec && (
        <p
          className={cn(
            'text-xs',
            highlight ? 'text-primary-foreground/80' : 'text-muted-foreground',
          )}
        >
          {sec}
        </p>
      )}
      {chip && (
        <p
          className={cn(
            'text-xs font-medium',
            highlight
              ? 'text-primary-foreground'
              : chip.good === null
                ? 'text-muted-foreground'
                : chip.good
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-destructive',
          )}
        >
          {chip.text}
        </p>
      )}
    </div>
  )
}

export function MiniBarChart({
  title,
  labels,
  values,
}: {
  title: string
  labels: string[]
  values: number[]
}) {
  const max = Math.max(1, ...values)
  const total = values.reduce((a, b) => a + b, 0)
  const top = values.indexOf(Math.max(...values))
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{total} no período</span>
      </div>
      {total === 0 ? (
        <p className="text-xs text-muted-foreground py-6">Sem dados neste período.</p>
      ) : (
        <div
          className="flex items-end gap-2 h-28"
          role="img"
          aria-label={`${title}: ${labels.map((l, i) => `${l} ${values[i]}`).join(', ')}`}
        >
          {values.map((v, i) => (
            <div
              key={labels[i] || i}
              className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
            >
              <div
                title={`${labels[i]}: ${v}`}
                className={cn('w-full rounded-md', i === top ? 'bg-primary' : 'bg-muted')}
                style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
              />
              <span className="text-[10px] text-muted-foreground">{labels[i]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function StatCard({
  title,
  value,
  hint,
  attention,
  onClick,
}: {
  title: string
  value: number | string
  hint?: string
  attention?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-xl border border-border bg-card p-5 space-y-1.5 hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{title}</p>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
      <p
        className={cn(
          'text-3xl font-semibold tracking-tight tabular-nums',
          attention ? 'text-attention' : 'text-foreground',
        )}
      >
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </button>
  )
}

export function StageBars({
  title,
  items,
  labelOf,
  onPick,
}: {
  title: string
  items: Array<{ stage: string; count: number }>
  labelOf: (stage: string) => string
  onPick: (stage: string) => void
}) {
  const max = Math.max(1, ...items.map((i) => i.count))
  const total = items.reduce((a, b) => a + b.count, 0)
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{total} leads</span>
      </div>
      {total === 0 ? (
        <p className="text-xs text-muted-foreground py-4">Nenhum lead ainda.</p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <button
              key={it.stage}
              type="button"
              onClick={() => onPick(it.stage)}
              className="w-full flex items-center gap-3 text-left hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
            >
              <span className="w-32 shrink-0 text-xs text-muted-foreground">
                {labelOf(it.stage)}
              </span>
              <span className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${(it.count / max) * 100}%` }}
                />
              </span>
              <span className="w-8 text-right text-xs tabular-nums text-foreground">
                {it.count}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
