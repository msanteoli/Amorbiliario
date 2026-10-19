// SPIKE DESCARTÁVEL (plano do site, T0): só diz se o hook consegue ler os bytes de um arquivo enviado e se ele tem marcador EXIF.
// NÃO grava nada (nem arquivo, nem registro). Só admin. Depois do teste, este arquivo é APAGADO do Skip.
// Atenção (goja): nada de função no topo do arquivo.
routerAdd(
  'POST',
  '/backend/v1/admin/site/spike-exif',
  (e) => {
    const actor = e.auth
    if (actor.get('active') !== true || String(actor.get('role') || '') !== 'admin') {
      throw new ForbiddenError('Só o admin.')
    }
    const files = e.findUploadedFiles('file')
    if (!files || !files.length) throw new BadRequestError('Envie o arquivo no campo "file".')
    const f = files[0]
    const out = {
      nome_enviado: String(f.originalName || f.name || ''),
      tamanho: Number(f.size || 0),
      tentativas: {},
    }

    // tentativa A: abrir o leitor do arquivo e converter para texto
    let texto = null
    try {
      const rc = f.reader.open()
      texto = toString(rc)
      out.tentativas.A = { ok: true, bytes_lidos: texto.length }
    } catch (err) {
      out.tentativas.A = { ok: false, erro: String((err && err.message) || err) }
    }

    if (texto !== null) {
      const head = texto.slice(0, 16)
      const hex = []
      for (let i = 0; i < head.length; i++)
        hex.push(('0' + head.charCodeAt(i).toString(16)).slice(-2))
      out.cabecalho_hex = hex.join(' ')
      out.eh_jpeg = texto.charCodeAt(0) === 0xff && texto.charCodeAt(1) === 0xd8
      out.eh_webp = texto.slice(0, 4) === 'RIFF' && texto.slice(8, 12) === 'WEBP'
      out.tem_exif = texto.indexOf('Exif\u0000\u0000') >= 0 || texto.indexOf('EXIF') >= 0
      out.tem_xmp = texto.indexOf('http://ns.adobe.com/xap/') >= 0
      out.tem_gps = texto.indexOf('GPS') >= 0
    }
    return e.json(200, out)
  },
  $apis.requireAuth(),
)
