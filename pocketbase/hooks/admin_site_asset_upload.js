// Ajustes do site, Fase 1 (spec docs/superpowers/specs/2026-10-19-ajustes-do-site-design.md). Só admin. Atenção (goja): nada de função no topo do arquivo.
// Envia uma imagem (logo ou favicon): JPEG ou WebP, até 3 MB, SEM marcador EXIF ou GPS. A imagem nunca é substituída nem apagada.
routerAdd(
  'POST',
  '/backend/v1/admin/site/assets',
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
    const body = e.requestInfo().body || {}
    const kind = String(body.kind || '')
    if (['logo', 'favicon'].indexOf(kind) < 0)
      throw new BadRequestError('Tipo de imagem inválido (use logo ou favicon).')
    const files = e.findUploadedFiles('file')
    if (!files || !files.length) throw new BadRequestError('Envie o arquivo no campo "file".')
    const f = files[0]
    if (Number(f.size || 0) > 3145728) throw new BadRequestError('A imagem passa de 3 MB.')
    // marcadores ASCII de EXIF (JPEG e WebP) e de GPS no XMP; o teste T0 mostrou que a leitura por texto funciona no Skip
    let texto = ''
    try {
      texto = toString(f.reader.open())
    } catch (err) {
      throw new BadRequestError('Não foi possível ler a imagem.')
    }
    if (
      texto.indexOf('Exif\u0000\u0000') >= 0 ||
      texto.indexOf('EXIF') >= 0 ||
      texto.indexOf('GPSLatitude') >= 0 ||
      texto.indexOf('GPSLongitude') >= 0
    ) {
      throw new BadRequestError(
        'A imagem tem dados de localização ou da câmera (EXIF). Reenvie uma cópia sem esses dados.',
      )
    }
    const rec = new Record($app.findCollectionByNameOrId('site_assets'))
    rec.set('organization_id', orgId)
    rec.set('kind', kind)
    rec.set('file', f)
    rec.set('uploaded_by', actor.id)
    try {
      $app.save(rec)
    } catch (err) {
      throw new BadRequestError('Imagem inválida: use JPEG ou WebP de até 3 MB.')
    }
    try {
      const a = new Record($app.findCollectionByNameOrId('audit_log'))
      a.set('organization_id', orgId)
      a.set('actor_id', actor.id)
      a.set('actor_role', role)
      a.set('action', 'site_imagem_enviada')
      a.set('collection_name', 'site_assets')
      a.set('record_id', rec.id)
      a.set('reason', kind)
      a.set('occurred_at', new Date().toISOString())
      $app.save(a)
    } catch (_) {}
    return e.json(200, {
      id: rec.id,
      url: '/api/files/site_assets/' + rec.id + '/' + rec.getString('file'),
    })
  },
  $apis.requireAuth(),
)
