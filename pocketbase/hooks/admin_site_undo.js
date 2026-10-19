// Ajustes do site, Fase 1 (spec docs/superpowers/specs/2026-10-19-ajustes-do-site-design.md). Só admin. Atenção (goja): nada de função no topo do arquivo.
// Desfaz a última publicação: a ativa passa a desfeita e a anterior volta a ser a ativa. Recusa (409) se só houver uma. Auditoria site_desfeito, só com a versão.
routerAdd(
  'POST',
  '/backend/v1/admin/site/undo',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    const orgId = String(actor.get('organization_id') || '')
    if (actor.get('active') !== true || role !== 'admin') {
      try {
        const a = new Record($app.findCollectionByNameOrId('audit_log'))
        a.set('organization_id', orgId)
        a.set('actor_id', actor.id)
        a.set('actor_role', role)
        a.set('action', 'acesso_negado')
        a.set('collection_name', 'site_settings')
        a.set('record_id', orgId)
        a.set('reason', 'so_admin_ajusta_o_site')
        a.set('occurred_at', new Date().toISOString())
        $app.save(a)
      } catch (err) {
        $app.logger().error('site_audit_failed', 'err', String((err && err.message) || err))
      }
      throw new ForbiddenError('Só o admin ajusta o site.')
    }
    const audit = (action, recordId, reason) => {
      try {
        const a = new Record($app.findCollectionByNameOrId('audit_log'))
        a.set('organization_id', orgId)
        a.set('actor_id', actor.id)
        a.set('actor_role', role)
        a.set('action', action)
        a.set('collection_name', 'site_publications')
        a.set('record_id', recordId)
        a.set('reason', reason)
        a.set('occurred_at', new Date().toISOString())
        $app.save(a)
      } catch (err) {
        $app.logger().error('site_audit_failed', 'err', String((err && err.message) || err))
      }
    }
    let voltouId = ''
    let voltouVersao = 0
    let semAnterior = false
    $app.runInTransaction((tx) => {
      const ativas = tx.findRecordsByFilter(
        'site_publications',
        "organization_id = {:o} && status = 'ativa'",
        '',
        1,
        0,
        { o: orgId },
      )
      if (!ativas.length) {
        semAnterior = true
        return
      }
      const atual = ativas[0]
      const anteriores = tx.findRecordsByFilter(
        'site_publications',
        "organization_id = {:o} && status = 'substituida' && version < {:v}",
        '-version',
        1,
        0,
        { o: orgId, v: atual.getInt('version') },
      )
      if (!anteriores.length) {
        semAnterior = true
        return
      }
      atual.set('status', 'desfeita')
      tx.save(atual)
      const ant = anteriores[0]
      ant.set('status', 'ativa')
      tx.save(ant)
      voltouId = ant.id
      voltouVersao = ant.getInt('version')
    })
    if (semAnterior) return e.json(409, { message: 'Não há publicação anterior para voltar.' })
    audit('site_desfeito', voltouId, 'voltou_para_versao=' + voltouVersao)
    return e.json(200, { publication_id: voltouId, version: voltouVersao })
  },
  $apis.requireAuth(),
)
