import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { RecordModel } from 'pocketbase'
import {
  CreateVisitInput,
  createVisit,
  listActiveBrokers,
  ActiveBroker,
  bahiaLocalToIsoUtc,
  extractErrorMessage,
  VisitStatus,
} from '@/services/visits'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Building2,
  Calendar,
  User,
  Clock,
  Search,
  AlertTriangle,
  Loader2,
  Check,
  Building,
} from 'lucide-react'

export interface CreateVisitModalTarget {
  lead?: { id: string; name: string }
  client?: { id: string; name: string }
}

interface CreateVisitModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fixedTarget?: CreateVisitModalTarget
  onSuccess: (status: VisitStatus) => void
}

interface TargetSearchResult {
  id: string
  name: string
  phone?: string
  kind: 'lead' | 'client'
}

interface PropertySearchResult {
  id: string
  code: string
  title: string
  neighborhood?: string
  status: string
}

export function CreateVisitModal({
  open,
  onOpenChange,
  fixedTarget,
  onSuccess,
}: CreateVisitModalProps) {
  // Busca unificada de pessoa (lead ou cliente) quando não for fixo
  const [personQuery, setPersonQuery] = useState('')
  const [personResults, setPersonResults] = useState<TargetSearchResult[]>([])
  const [searchingPerson, setSearchingPerson] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState<TargetSearchResult | null>(null)

  // Busca de imóvel (disponível ou reservado)
  const [propertyQuery, setPropertyQuery] = useState('')
  const [propertyResults, setPropertyResults] = useState<PropertySearchResult[]>([])
  const [searchingProperty, setSearchingProperty] = useState(false)
  const [selectedProperty, setSelectedProperty] = useState<PropertySearchResult | null>(null)

  // Corretor
  const [brokersList, setBrokersList] = useState<ActiveBroker[]>([])
  const [selectedBrokerId, setSelectedBrokerId] = useState('')

  // Datas no fuso America/Bahia
  const [startLocal, setStartLocal] = useState('')
  const [endLocal, setEndLocal] = useState('')

  // Estados de envio e erro
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Inicialização ao abrir modal
  useEffect(() => {
    if (open) {
      setErrorMessage(null)
      setSubmitting(false)
      setPropertyQuery('')
      setPropertyResults([])
      setSelectedProperty(null)
      setSelectedBrokerId('')
      setStartLocal('')
      setEndLocal('')

      // Se tiver target fixo (vindo de /leads/:id ou /clientes/:id)
      if (fixedTarget?.lead) {
        setSelectedPerson({
          id: fixedTarget.lead.id,
          name: fixedTarget.lead.name,
          kind: 'lead',
        })
      } else if (fixedTarget?.client) {
        setSelectedPerson({
          id: fixedTarget.client.id,
          name: fixedTarget.client.name,
          kind: 'client',
        })
      } else {
        setSelectedPerson(null)
        setPersonQuery('')
        setPersonResults([])
      }

      // Carregar lista de corretores ativos
      listActiveBrokers()
        .then(setBrokersList)
        .catch(() => {})
    }
  }, [open, fixedTarget])

  // Busca de Leads e Clientes (caixa única)
  useEffect(() => {
    if (fixedTarget?.lead || fixedTarget?.client) return
    const q = personQuery.trim()
    if (!q || q.length < 2) {
      setPersonResults([])
      return
    }

    let active = true
    const timer = setTimeout(async () => {
      setSearchingPerson(true)
      try {
        const clean = q.replace(/['"\\]/g, '')
        // Buscar em leads
        const leadsPromise = pb.collection('leads').getList(1, 6, {
          filter: `name ~ "${clean}" || phone ~ "${clean}"`,
          sort: 'name',
          requestKey: null,
        })

        // Buscar em clients
        const clientsPromise = pb.collection('clients').getList(1, 6, {
          filter: `name ~ "${clean}" || phone ~ "${clean}"`,
          sort: 'name',
          requestKey: null,
        })

        const [leadsRes, clientsRes] = await Promise.all([leadsPromise, clientsPromise])

        if (!active) return

        const combined: TargetSearchResult[] = [
          ...leadsRes.items.map((l) => ({
            id: l.id,
            name: l.name as string,
            phone: l.phone as string,
            kind: 'lead' as const,
          })),
          ...clientsRes.items.map((c) => ({
            id: c.id,
            name: c.name as string,
            phone: c.phone as string,
            kind: 'client' as const,
          })),
        ]

        setPersonResults(combined)
      } catch {
        if (active) setPersonResults([])
      } finally {
        if (active) setSearchingPerson(false)
      }
    }, 300)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [personQuery, fixedTarget])

  // Busca de Imóveis (disponível ou reservado)
  useEffect(() => {
    const q = propertyQuery.trim()
    if (!q || q.length < 1) {
      setPropertyResults([])
      return
    }

    let active = true
    const timer = setTimeout(async () => {
      setSearchingProperty(true)
      try {
        const clean = q.replace(/['"\\]/g, '')
        const res = await pb.collection('properties').getList(1, 10, {
          filter: `(status = "disponivel" || status = "reservado") && (code ~ "${clean}" || title ~ "${clean}")`,
          sort: 'code',
          requestKey: null,
        })

        if (!active) return

        setPropertyResults(
          res.items.map((p) => ({
            id: p.id,
            code: p.code as string,
            title: p.title as string,
            neighborhood: p.neighborhood as string,
            status: p.status as string,
          })),
        )
      } catch {
        if (active) setPropertyResults([])
      } finally {
        if (active) setSearchingProperty(false)
      }
    }, 300)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [propertyQuery])

  // Sugestão de fim = início + 1 hora
  const handleStartChange = (val: string) => {
    setStartLocal(val)
    if (val) {
      try {
        const d = new Date(val)
        if (!isNaN(d.getTime())) {
          const endD = new Date(d.getTime() + 60 * 60 * 1000)
          const yyyy = endD.getFullYear()
          const mm = String(endD.getMonth() + 1).padStart(2, '0')
          const dd = String(endD.getDate()).padStart(2, '0')
          const hh = String(endD.getHours()).padStart(2, '0')
          const min = String(endD.getMinutes()).padStart(2, '0')
          setEndLocal(`${yyyy}-${mm}-${dd}T${hh}:${min}`)
        }
      } catch {
        // ignore
      }
    }
  }

  // Submissão do agendamento
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPerson) {
      setErrorMessage('Selecione para quem é a visita (lead ou cliente).')
      return
    }
    if (!selectedProperty) {
      setErrorMessage('Selecione o imóvel da visita.')
      return
    }

    setSubmitting(true)
    setErrorMessage(null)

    try {
      const payload: CreateVisitInput = {
        property_id: selectedProperty.id,
        broker_id: selectedBrokerId || undefined,
      }

      if (selectedPerson.kind === 'lead') {
        payload.lead_id = selectedPerson.id
      } else {
        payload.client_id = selectedPerson.id
      }

      if (startLocal) {
        payload.start_at = bahiaLocalToIsoUtc(startLocal)
      }
      if (endLocal) {
        payload.end_at = bahiaLocalToIsoUtc(endLocal)
      }

      const res = await createVisit(payload)
      onOpenChange(false)
      onSuccess(res.status)
    } catch (err: unknown) {
      // Ler corpo do erro em conflito 409 ou validação
      const msg = extractErrorMessage(err, 'Erro ao agendar visita.')
      setErrorMessage(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const isFixed = Boolean(fixedTarget?.lead || fixedTarget?.client)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6 sm:rounded-lg rounded-t-2xl rounded-b-none border border-border bg-popover text-popover-foreground shadow-none fixed bottom-0 top-auto sm:top-[50%] sm:bottom-auto translate-y-0 sm:translate-y-[-50%]">
        <DialogHeader className="pb-3 border-b border-border">
          <DialogTitle className="text-lg font-normal text-foreground">Agendar visita</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Sem corretor ou sem horário, a visita fica como Pendente de agenda.
          </DialogDescription>
        </DialogHeader>

        {/* Aviso de erro ou conflito no topo com borda destructive */}
        {errorMessage && (
          <div className="rounded-lg border border-destructive p-3 text-xs text-destructive flex items-start gap-2 my-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-normal">{errorMessage}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Escolha outro horário ou selecione outro corretor para esta visita.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Para quem: Lead ou Cliente */}
          <div className="space-y-1.5">
            <Label className="text-xs eyebrow text-muted-foreground">
              Para quem <span className="text-destructive">*</span>
            </Label>

            {isFixed && selectedPerson ? (
              <div className="p-3 rounded-lg border border-border flex items-center justify-between text-sm">
                <div>
                  <span className="font-normal text-foreground">{selectedPerson.name}</span>
                  <Badge variant="default" className="ml-2 text-xs">
                    {selectedPerson.kind === 'lead' ? 'Lead' : 'Cliente'}
                  </Badge>
                </div>
              </div>
            ) : selectedPerson ? (
              <div className="p-3 rounded-lg border border-border flex items-center justify-between text-sm bg-secondary/30">
                <div>
                  <span className="font-normal text-foreground">{selectedPerson.name}</span>
                  {selectedPerson.phone && (
                    <span className="text-xs text-muted-foreground tabular ml-2">
                      ({selectedPerson.phone})
                    </span>
                  )}
                  <Badge variant="default" className="ml-2 text-xs">
                    {selectedPerson.kind === 'lead' ? 'Lead' : 'Cliente'}
                  </Badge>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedPerson(null)
                    setPersonQuery('')
                  }}
                  className="h-7 text-[11px] rounded-full font-normal"
                >
                  Trocar
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar lead ou cliente por nome ou telefone..."
                    className="pl-9 h-12 min-h-[48px] rounded-lg text-sm"
                    value={personQuery}
                    onChange={(e) => setPersonQuery(e.target.value)}
                  />
                  {searchingPerson && (
                    <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>

                {personResults.length > 0 && (
                  <div className="border border-border rounded-lg divide-y divide-border max-h-40 overflow-y-auto bg-popover">
                    {personResults.map((p) => (
                      <button
                        key={`${p.kind}-${p.id}`}
                        type="button"
                        onClick={() => {
                          setSelectedPerson(p)
                          setPersonResults([])
                        }}
                        className="w-full text-left p-2.5 hover:bg-muted/50 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-normal text-foreground">{p.name}</p>
                          {p.phone && <p className="text-muted-foreground tabular">{p.phone}</p>}
                        </div>
                        <Badge variant="default" className="text-[10px]">
                          {p.kind === 'lead' ? 'Lead' : 'Cliente'}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Imóvel (obrigatório) */}
          <div className="space-y-1.5">
            <Label className="text-xs eyebrow text-muted-foreground">
              Imóvel <span className="text-destructive">*</span>
            </Label>

            {selectedProperty ? (
              <div className="p-3 rounded-lg border border-border flex items-center justify-between text-sm bg-secondary/30">
                <div>
                  <p className="font-normal text-foreground">
                    [{selectedProperty.code}] {selectedProperty.title}
                  </p>
                  {selectedProperty.neighborhood && (
                    <p className="text-xs text-muted-foreground">
                      Bairro: {selectedProperty.neighborhood}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedProperty(null)
                    setPropertyQuery('')
                  }}
                  className="h-7 text-[11px] rounded-full font-normal"
                >
                  Trocar
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar imóvel por código ou título..."
                    className="pl-9 h-12 min-h-[48px] rounded-lg text-sm"
                    value={propertyQuery}
                    onChange={(e) => setPropertyQuery(e.target.value)}
                  />
                  {searchingProperty && (
                    <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>

                {propertyResults.length > 0 && (
                  <div className="border border-border rounded-lg divide-y divide-border max-h-40 overflow-y-auto bg-popover">
                    {propertyResults.map((pr) => (
                      <button
                        key={pr.id}
                        type="button"
                        onClick={() => {
                          setSelectedProperty(pr)
                          setPropertyResults([])
                        }}
                        className="w-full text-left p-2.5 hover:bg-muted/50 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-normal text-foreground">
                            [{pr.code}] {pr.title}
                          </p>
                          {pr.neighborhood && (
                            <p className="text-muted-foreground">Bairro: {pr.neighborhood}</p>
                          )}
                        </div>
                        <Badge variant="default" className="text-[10px]">
                          {pr.status}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Corretor (opcional) */}
          <div className="space-y-1.5">
            <Label className="text-xs eyebrow text-muted-foreground">Corretor (opcional)</Label>
            <Select
              value={selectedBrokerId || 'unassigned'}
              onValueChange={(val) => setSelectedBrokerId(val === 'unassigned' ? '' : val)}
            >
              <SelectTrigger className="w-full h-12 min-h-[48px] rounded-lg text-sm">
                <SelectValue placeholder="Ainda sem corretor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Ainda sem corretor</SelectItem>
                {brokersList.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} ({b.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data e hora de início e fim (opcionais, fuso Bahia UTC-3) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs eyebrow text-muted-foreground">Início (opcional)</Label>
              <Input
                type="datetime-local"
                value={startLocal}
                onChange={(e) => handleStartChange(e.target.value)}
                className="h-12 min-h-[48px] rounded-lg text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs eyebrow text-muted-foreground">Fim (sugestão +1h)</Label>
              <Input
                type="datetime-local"
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
                className="h-12 min-h-[48px] rounded-lg text-sm"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-border flex flex-col sm:flex-row gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="rounded-full font-normal"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting || !selectedPerson || !selectedProperty}
              className="rounded-full font-normal"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Salvar visita
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
