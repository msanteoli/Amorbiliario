// M15b (spec docs/superpowers/specs/2026-10-16-exclusao-admin-design.md, seção 9.2): anonimiza um cliente.
// Alternativa à exclusão quando há vínculos (negociação, visita...): o registro e os vínculos ficam; os dados pessoais saem.
// Troca o nome por "Cliente anonimizado"; limpa telefone, e-mail e razão social; limpa CPF, nascimento, RG, endereço,
// dados bancários e CNPJ de client_private; e anonimiza o contato dos leads ligados ao cliente (nome, telefone, e-mail,
// observações, referência de conversa e próximo passo). NÃO é reversível. Só admin ativo da mesma organização.
// Auditoria 'registro_anonimizado' (só com contagens) e 'acesso_negado' para os outros papéis. Os textos livres de
// lead_events NÃO são limpos aqui (ponto aberto da spec: decidir com o advogado).
// Atenção (goja): o callback de runInTransaction NÃO pode devolver valor; nada de função no topo do arquivo.
routerAdd(
  'POST',
  '/backend/v1/clients/{id}/anonymize',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    const orgId = String(actor.get('organization_id') || '')
    const id = String(e.request.pathValue('id') || '')
    if (actor.get('active') !== true || role !== 'admin') {
      try {
        const a = new Record($app.findCollectionByNameOrId('audit_log'))
        a.set('organization_id', orgId)
        a.set('actor_id', actor.id)
        a.set('actor_role', role)
        a.set('action', 'acesso_negado')
        a.set('collection_name', 'clients')
        a.set('record_id', id)
        a.set('reason', 'so_admin_anonimiza')
        a.set('occurred_at', new Date().toISOString())
        $app.save(a)
      } catch (err) {
        $app.logger().error('anonimizar_audit_failed', 'err', String((err && err.message) || err))
      }
      throw new ForbiddenError('Só o admin anonimiza clientes.')
    }
    let rec = null
    try {
      rec = $app.findRecordById('clients', id)
    } catch (_) {}
    if (!rec || rec.getString('organization_id') !== orgId)
      throw new NotFoundError('Registro não encontrado.')
    let leadsAnonimizados = 0
    $app.runInTransaction((tx) => {
      rec.set('name', 'Cliente anonimizado')
      rec.set('phone', '')
      rec.set('email', '')
      rec.set('company_name', '')
      tx.save(rec)
      const privados = tx.findRecordsByFilter(
        'client_private',
        'organization_id = {:o} && client_id = {:i}',
        '',
        10,
        0,
        { o: orgId, i: id },
      )
      privados.forEach((p) => {
        p.set('cpf', '')
        p.set('birth_date', '')
        p.set('rg', '')
        p.set('address', '')
        p.set('bank_details', '')
        p.set('cnpj', '')
        tx.save(p)
      })
      const leads = tx.findRecordsByFilter(
        'leads',
        'organization_id = {:o} && client_id = {:i}',
        '',
        1000,
        0,
        { o: orgId, i: id },
      )
      leads.forEach((l) => {
        l.set('name', 'Lead anonimizado')
        l.set('phone', '')
        l.set('email', '')
        l.set('notes', '')
        l.set('conversation_ref', '')
        l.set('next_step', '')
        tx.save(l)
        leadsAnonimizados++
      })
      const a = new Record(tx.findCollectionByNameOrId('audit_log'))
      a.set('organization_id', orgId)
      a.set('actor_id', actor.id)
      a.set('actor_role', role)
      a.set('action', 'registro_anonimizado')
      a.set('collection_name', 'clients')
      a.set('record_id', id)
      a.set('reason', 'privados=' + privados.length + '; leads=' + leadsAnonimizados)
      a.set('occurred_at', new Date().toISOString())
      tx.save(a)
    })
    return e.json(200, { ok: true, leads_anonimizados: leadsAnonimizados })
  },
  $apis.requireAuth(),
)
