// Painel personalizável (spec 2026-10-23): grava (substitui) o arranjo dos quadros da pessoa logada. Valida tudo no servidor:
// version 1, ids do catálogo da FUNÇÃO da pessoa, sem repetir, tamanhos 4/6/8/12, até 20 quadros e até 8000 caracteres. Atenção (goja): sem função no topo do arquivo.
// O catálogo de ids é o mesmo da tela (src/pages/Hoje.tsx): mexeu num, mexa no outro. Auditoria só com a contagem de quadros.
routerAdd(
  'PUT',
  '/backend/v1/panel/layout',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    const orgId = String(actor.get('organization_id') || '')
    if (actor.get('active') !== true || ['admin', 'sdr', 'corretor'].indexOf(role) < 0) {
      throw new ForbiddenError('Papel sem acesso a estes dados.')
    }
    const common = ['agenda', 'visitas_confirmar', 'grafico']
    const catalog = {
      sdr: common.concat([
        'ind:leads_sem_followup',
        'ind:tempo_primeiro_atendimento',
        'ind:pct_repassados',
        'apoio:leads_sem_dono',
        'apoio:duplicidade',
        'apoio:visitas_pendentes',
      ]),
      corretor: common.concat(['ind:visitas', 'ind:negociacoes', 'ind:vgv_fechado']),
      admin: common.concat([
        'ind:vgv_equipe',
        'ind:funil',
        'ind:tarefas',
        'apoio:etapas',
        'apoio:parados',
        'apoio:revisao',
        'apoio:visitas_semana',
      ]),
    }
    const allowed = catalog[role]

    const body = e.requestInfo().body || {}
    const layout = body.layout
    if (!layout || typeof layout !== 'object' || Array.isArray(layout))
      throw new BadRequestError('Informe o arranjo do painel.')
    if (layout.version !== 1) throw new BadRequestError('Versão do arranjo inválida.')
    if (!Array.isArray(layout.blocks)) throw new BadRequestError('Informe a lista de quadros.')
    if (layout.blocks.length > 20) throw new BadRequestError('No máximo 20 quadros.')
    if (JSON.stringify(layout).length > 8000)
      throw new BadRequestError('O arranjo é grande demais.')
    const seen = {}
    const blocks = []
    layout.blocks.forEach((b) => {
      if (!b || typeof b !== 'object' || Array.isArray(b))
        throw new BadRequestError('Quadro inválido.')
      if (typeof b.id !== 'string' || allowed.indexOf(b.id) < 0)
        throw new BadRequestError('Quadro fora do catálogo da sua função.')
      if (seen[b.id]) throw new BadRequestError('Quadro repetido.')
      seen[b.id] = true
      if (typeof b.w !== 'number' || [4, 6, 8, 12].indexOf(b.w) < 0)
        throw new BadRequestError('Tamanho inválido (use 4, 6, 8 ou 12).')
      blocks.push({ id: b.id, w: b.w })
    })
    const clean = { version: 1, blocks: blocks }

    let rec = null
    try {
      rec = $app.findFirstRecordByData('panel_layouts', 'user_id', actor.id)
    } catch (_) {}
    if (!rec) {
      rec = new Record($app.findCollectionByNameOrId('panel_layouts'))
      rec.set('organization_id', orgId)
      rec.set('user_id', actor.id)
    }
    rec.set('layout', JSON.stringify(clean))
    $app.save(rec)

    try {
      const a = new Record($app.findCollectionByNameOrId('audit_log'))
      a.set('organization_id', orgId)
      a.set('actor_id', actor.id)
      a.set('actor_role', role)
      a.set('action', 'painel_personalizado')
      a.set('collection_name', 'panel_layouts')
      a.set('record_id', rec.id)
      a.set('reason', 'n=' + blocks.length)
      a.set('occurred_at', new Date().toISOString())
      $app.save(a)
    } catch (err) {
      $app.logger().error('painel_audit_failed', 'err', String((err && err.message) || err))
    }
    return e.json(200, { ok: true, layout: clean })
  },
  $apis.requireAuth(),
)
