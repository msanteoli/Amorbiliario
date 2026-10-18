// M15b (spec docs/superpowers/specs/2026-10-16-exclusao-admin-design.md): exclusão de lead pelo admin.
// Só o admin ativo da mesma organização exclui. Se houver vínculos que bloqueiam, responde 409 com
// { bloqueios: [{ tipo, quantidade }] } e NADA é apagado (auditoria 'exclusao_bloqueada', só com contagens).
// Sem bloqueio: numa transação só, apaga os filhos e o registro e grava 'registro_excluido' (sem valores).
// Quem não é admin recebe 403 e 'acesso_negado' no audit_log. Nenhum valor do registro vai à auditoria nem ao erro.
// Atenção (goja): o callback de runInTransaction NÃO pode devolver valor; nada de função no topo do arquivo.
routerAdd(
  'DELETE',
  '/backend/v1/leads/{id}',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    const orgId = String(actor.get('organization_id') || '')
    const id = String(e.request.pathValue('id') || '')
    const audit = (action, recordId, reason) => {
      try {
        const a = new Record($app.findCollectionByNameOrId('audit_log'))
        a.set('organization_id', orgId)
        a.set('actor_id', actor.id)
        a.set('actor_role', role)
        a.set('action', action)
        a.set('collection_name', 'leads')
        a.set('record_id', recordId)
        a.set('reason', reason)
        a.set('occurred_at', new Date().toISOString())
        $app.save(a)
      } catch (err) {
        $app.logger().error('exclusao_audit_failed', 'err', String((err && err.message) || err))
      }
    }
    if (actor.get('active') !== true || role !== 'admin') {
      audit('acesso_negado', id, 'so_admin_exclui')
      throw new ForbiddenError('Só o admin exclui lead.')
    }
    let rec = null
    try {
      rec = $app.findRecordById('leads', id)
    } catch (_) {}
    if (!rec || rec.getString('organization_id') !== orgId)
      throw new NotFoundError('Registro não encontrado.')
    const count = (coll, filter) =>
      $app.findRecordsByFilter(coll, 'organization_id = {:o} && (' + filter + ')', '', 1000, 0, {
        o: orgId,
        i: id,
      }).length
    const bloqueios = []
    const add = (tipo, quantidade) => {
      if (quantidade > 0) bloqueios.push({ tipo: tipo, quantidade: quantidade })
    }
    add('visita', count('visits', 'lead_id = {:i}'))
    add('tarefa', count('tasks', "lead_id = {:i} && status = 'aberta'"))
    add('negociacao', count('negotiations', 'lead_id = {:i}'))
    add('cliente', rec.getString('client_id') !== '' ? 1 : 0)
    if (bloqueios.length) {
      audit('exclusao_bloqueada', id, bloqueios.map((b) => b.tipo + '=' + b.quantidade).join(';'))
      return e.json(409, { bloqueios: bloqueios })
    }
    $app.runInTransaction((tx) => {
      const filhos = (coll, filter) =>
        tx.findRecordsByFilter(coll, 'organization_id = {:o} && (' + filter + ')', '', 5000, 0, {
          o: orgId,
          i: id,
        })
      let removidos = 0
      filhos('lead_events', 'lead_id = {:i}').forEach((r) => {
        tx.delete(r)
        removidos++
      })
      filhos('tasks', "lead_id = {:i} && status != 'aberta'").forEach((r) => {
        tx.delete(r)
        removidos++
      })
      tx.delete(rec)
      const a = new Record(tx.findCollectionByNameOrId('audit_log'))
      a.set('organization_id', orgId)
      a.set('actor_id', actor.id)
      a.set('actor_role', role)
      a.set('action', 'registro_excluido')
      a.set('collection_name', 'leads')
      a.set('record_id', id)
      a.set('reason', 'filhos_removidos=' + removidos)
      a.set('occurred_at', new Date().toISOString())
      tx.save(a)
    })
    return e.json(200, { ok: true })
  },
  $apis.requireAuth(),
)
