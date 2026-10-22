// Rotina das pendências do cadastro (spec 2026-10-21-cadastro-livre): a cada 2 minutos confere os imóveis vivos (Rascunho, Disponível,
// Reservado) e cria/fecha as tarefas "Preencher ..." do captador. Cobre os caminhos que gravam sem passar pelos hooks de edição (fotos,
// vínculo do proprietário, importações, MCP, fechamento de negociação). Também cancela as pendências de imóvel vendido, alugado ou inativo.
// A lógica de cada imóvel é a MESMA de properties_write_create.js e properties_write_update.js (o Skip não compartilha funções).
cronAdd('properties_pending_sync', '*/2 * * * *', () => {
  const orgs = $app.findRecordsByFilter('organizations', "id != ''", 'created', 200, 0)
  orgs.forEach((org) => {
    const ids = {}
    const props = []
    for (let offset = 0; offset < 5000; offset += 200) {
      const page = $app.findRecordsByFilter(
        'properties',
        "organization_id = {:o} && (status = 'rascunho' || status = 'disponivel' || status = 'reservado')",
        'created',
        200,
        offset,
        { o: org.id },
      )
      page.forEach((p) => {
        ids[p.id] = true
        props.push(p)
      })
      if (page.length < 200) break
    }
    // imóveis encerrados que ainda têm pendência aberta
    $app
      .findRecordsByFilter(
        'tasks',
        "organization_id = {:o} && status = 'aberta' && description ~ 'pend:'",
        '',
        1000,
        0,
        { o: org.id },
      )
      .forEach((t) => {
        const pid = t.getString('property_id')
        if (!pid || ids[pid]) return
        ids[pid] = true
        try {
          props.push($app.findRecordById('properties', pid))
        } catch (_) {}
      })
    props.forEach((rec) => {
      try {
        const p = rec
        const live = ['rascunho', 'disponivel', 'reservado'].indexOf(p.getString('status')) >= 0
        const labels = {
          titulo: 'o título',
          preco_venda: 'o preço de venda',
          preco_locacao: 'o preço de locação',
          bairro: 'o bairro',
          cidade: 'a cidade',
          rua: 'a rua',
          numero: 'o número',
          area: 'a área',
          quartos: 'os quartos',
          banheiros: 'os banheiros',
          descricao: 'a descrição',
          proprietario: 'o proprietário',
          condominio: 'o condomínio',
          fotos: 'as fotos (pelo menos 5)',
        }
        const missing = {}
        if (live) {
          const num = (k) => Number(p.get(k) || 0)
          const pu = p.getString('purpose')
          const consult = p.get('price_on_request') === true
          const t = p.getString('title')
          if (!t || t.indexOf('Imóvel sem título') === 0) missing.titulo = true
          if ((pu === 'venda' || pu === 'ambos') && !(num('sale_price') > 0 || consult))
            missing.preco_venda = true
          if ((pu === 'locacao' || pu === 'ambos') && !(num('rent_price') > 0 || consult))
            missing.preco_locacao = true
          if (!p.getString('neighborhood')) missing.bairro = true
          if (!p.getString('city')) missing.cidade = true
          if (!p.getString('street')) missing.rua = true
          if (!p.getString('street_number')) missing.numero = true
          if (!(num('area') > 0)) missing.area = true
          const residential =
            ['casa', 'apartamento', 'chacara'].indexOf(p.getString('property_type')) >= 0
          if (residential && !(num('bedrooms') >= 1)) missing.quartos = true
          if (residential && !(num('bathrooms') >= 1)) missing.banheiros = true
          if (!p.getString('description')) missing.descricao = true
          if (!p.getString('owner_id')) missing.proprietario = true
          if (p.get('in_condominium') === true && !p.getString('condominium_id'))
            missing.condominio = true
          const nPhotos = $app.findRecordsByFilter(
            'property_photos',
            'property_id = {:p} && is_active = true',
            '',
            100,
            0,
            { p: p.id },
          ).length
          if (nPhotos < 5) missing.fotos = true
        }
        const open = $app.findRecordsByFilter(
          'tasks',
          "property_id = {:p} && status = 'aberta' && description ~ 'pend:'",
          '',
          300,
          0,
          { p: p.id },
        )
        const byKey = {}
        const agora = new Date().toISOString()
        open.forEach((t) => {
          const m = /^pend:([a-z_]+)/.exec(t.getString('description'))
          if (!m) return
          const dup = !!byKey[m[1]]
          if (dup || !missing[m[1]]) {
            t.set('status', dup || !live ? 'cancelada' : 'concluida')
            t.set('closed_at', agora)
            t.set('closed_by', rec.getString('captured_by'))
            $app.save(t)
          } else {
            byKey[m[1]] = t
          }
        })
        Object.keys(missing).forEach((k) => {
          if (byKey[k]) return
          const nt = new Record($app.findCollectionByNameOrId('tasks'))
          nt.set('organization_id', p.getString('organization_id'))
          nt.set('title', 'Preencher ' + labels[k] + ' do imóvel ' + p.getString('code'))
          nt.set('description', 'pend:' + k)
          nt.set('assigned_to', p.getString('captured_by'))
          nt.set('status', 'aberta')
          nt.set('property_id', p.id)
          nt.set('created_by', rec.getString('captured_by'))
          nt.set('due_at', new Date(Date.now() + 3 * 86400000).toISOString())
          $app.save(nt)
        })
      } catch (err) {
        $app.logger().error('pendencias_failed', 'err', String((err && err.message) || err))
      }
    })
  })
})
