// Ajustes do site, Fase 1 (spec docs/superpowers/specs/2026-10-19-ajustes-do-site-design.md). Só admin. Atenção (goja): nada de função no topo do arquivo.
// Publica o rascunho: grava um snapshot novo (a publicação ativa passa a substituida). Auditoria site_publicado, só com a versão (nunca telefone ou e-mail).
// Site tecnológico, Parte A (15/11): o snapshot leva também os banners ATIVOS (até 5, na ordem), com as URLs das imagens resolvidas.
routerAdd(
  'POST',
  '/backend/v1/admin/site/publish',
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
    // rascunho -> objeto do site (mesma forma do snapshot publicado)
    const toSnap = (r) => {
      const o = {}
      ;[
        'about_title',
        'about_text',
        'address',
        'hours',
        'phone',
        'email',
        'instagram',
        'whatsapp',
        'primary_color',
      ].forEach((k) => {
        o[k] = r ? r.getString(k) : ''
      })
      let links = []
      if (r) {
        try {
          const raw = r.getString('links')
          links = raw ? JSON.parse(raw) : []
        } catch (_) {
          links = []
        }
      }
      o.links = Array.isArray(links) ? links : []
      const url = (assetId) => {
        if (!assetId) return ''
        try {
          const a = $app.findRecordById('site_assets', assetId)
          return '/api/files/site_assets/' + a.id + '/' + a.getString('file')
        } catch (_) {
          return ''
        }
      }
      o.logo_url = r ? url(r.getString('logo_asset_id')) : ''
      o.favicon_url = r ? url(r.getString('favicon_asset_id')) : ''
      return o
    }
    const loadDraft = () => {
      const rows = $app.findRecordsByFilter('site_settings', 'organization_id = {:o}', '', 1, 0, {
        o: orgId,
      })
      return rows.length ? rows[0] : null
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
    const draft = loadDraft()
    if (!draft) throw new BadRequestError('Nada para publicar: salve o rascunho antes.')
    const snap = toSnap(draft)
    const assetUrl = (assetId) => {
      if (!assetId) return ''
      try {
        const a = $app.findRecordById('site_assets', assetId)
        return '/api/files/site_assets/' + a.id + '/' + a.getString('file')
      } catch (_) {
        return ''
      }
    }
    snap.banners = $app
      .findRecordsByFilter(
        'site_banners',
        'organization_id = {:o} && active = true',
        'position,created',
        5,
        0,
        {
          o: orgId,
        },
      )
      .map((b) => ({
        id: b.id,
        title: b.getString('title'),
        subtitle: b.getString('subtitle'),
        button_text: b.getString('button_text'),
        tipo: b.getString('tipo'),
        destino_url: b.getString('destino_url'),
        imovel_codigo: b.getString('imovel_codigo'),
        desktop_url: assetUrl(b.getString('desktop_asset_id')),
        mobile_url: assetUrl(b.getString('mobile_asset_id')),
        night_desktop_url: assetUrl(b.getString('night_desktop_asset_id')),
        night_mobile_url: assetUrl(b.getString('night_mobile_asset_id')),
        start_at: b.getString('start_at'),
        end_at: b.getString('end_at'),
      }))
    let novaId = ''
    let novaVersao = 0
    $app.runInTransaction((tx) => {
      const ultimas = tx.findRecordsByFilter(
        'site_publications',
        'organization_id = {:o}',
        '-version',
        1,
        0,
        { o: orgId },
      )
      novaVersao = (ultimas.length ? ultimas[0].getInt('version') : 0) + 1
      const ativas = tx.findRecordsByFilter(
        'site_publications',
        "organization_id = {:o} && status = 'ativa'",
        '',
        5,
        0,
        { o: orgId },
      )
      ativas.forEach((a) => {
        a.set('status', 'substituida')
        tx.save(a)
      })
      const rec = new Record(tx.findCollectionByNameOrId('site_publications'))
      rec.set('organization_id', orgId)
      rec.set('version', novaVersao)
      rec.set('snapshot', snap)
      rec.set('status', 'ativa')
      rec.set('published_by', actor.id)
      rec.set('published_at', new Date().toISOString())
      tx.save(rec)
      novaId = rec.id
    })
    audit('site_publicado', novaId, 'versao=' + novaVersao)
    return e.json(200, { publication_id: novaId, version: novaVersao })
  },
  $apis.requireAuth(),
)
