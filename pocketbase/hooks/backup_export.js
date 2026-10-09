// Exporta os dados da organização para um arquivo JSON (cópia de segurança própria, fora do Skip).
// Só o admin e o SDR. O SDR recebe o backup OPERACIONAL (sem CPF/data de nascimento); o admin recebe o
// COMPLETO (com client_private). Nunca exporta senhas, tokens, e-mails de usuários nem o audit_log.
// Fotos entram só como endereço (file_url), não como arquivo. Grava o histórico sem dados.
routerAdd(
  'GET',
  '/backend/v1/backup/export',
  (e) => {
    const actor = e.auth
    const role = String(actor.get('role') || '')
    if (actor.get('active') !== true || ['admin', 'sdr'].indexOf(role) < 0) {
      throw new ForbiddenError('Só o admin e o SDR exportam os dados.')
    }
    const orgId = String(actor.get('organization_id') || '')
    const full = role === 'admin'

    const names = [
      'leads',
      'lead_events',
      'clients',
      'properties',
      'property_photos',
      'condominiums',
      'condominium_photos',
      'visits',
      'tasks',
      'property_visit_slots',
      'negotiations',
      'negotiation_people',
    ]
    if (full) names.push('client_private', 'negotiation_documents')

    const collections = {}
    const counts = {}
    names.forEach((name) => {
      const rows = $app.findRecordsByFilter(name, 'organization_id = {:o}', 'created', 200000, 0, {
        o: orgId,
      })
      collections[name] = rows.map((r) => {
        const item = r.publicExport()
        if (name === 'negotiation_documents') delete item.file
        if (name === 'property_photos' || name === 'condominium_photos') {
          item.file_url = '/api/files/' + name + '/' + r.id + '/' + r.getString('file')
        }
        return item
      })
      counts[name] = rows.length
    })

    // usuários: só quem é e o que faz (sem e-mail, sem credenciais)
    const users = $app.findRecordsByFilter('users', 'organization_id = {:o}', 'created', 5000, 0, {
      o: orgId,
    })
    collections.users = users.map((u) => ({
      id: u.id,
      name: u.getString('name'),
      role: u.getString('role'),
      active: u.get('active') === true,
      organization_id: u.getString('organization_id'),
    }))
    counts.users = users.length

    const org = $app.findRecordById('organizations', orgId)
    collections.organizations = [org.publicExport()]
    counts.organizations = 1

    const now = new Date()
    const day = now.toISOString().slice(0, 10)
    let total = 0
    Object.keys(counts).forEach((k) => {
      total += counts[k]
    })

    try {
      const audit = new Record($app.findCollectionByNameOrId('audit_log'))
      audit.set('organization_id', orgId)
      audit.set('actor_id', actor.id)
      audit.set('actor_role', role)
      audit.set('action', 'backup_exportado')
      audit.set('collection_name', 'backup')
      audit.set('reason', (full ? 'completo' : 'operacional') + '; registros=' + total)
      audit.set('occurred_at', now.toISOString())
      $app.save(audit)
    } catch (err) {
      $app.logger().error('backup_audit_failed', 'err', String((err && err.message) || err))
    }

    e.response.header().set('Content-Disposition', 'attachment; filename="backup-' + day + '.json"')
    return e.json(200, {
      generated_at: now.toISOString(),
      scope: full ? 'completo' : 'operacional',
      organization_id: orgId,
      counts: counts,
      collections: collections,
    })
  },
  $apis.requireAuth(),
)
