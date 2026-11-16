/**
 * Título do imóvel e pendências do cadastro — um só lugar para a regra.
 *
 * O título é uma FRASE que identifica o imóvel, não uma lista de campos:
 *   "Casa à venda em Registro"        ·  "Apartamento para alugar no Capuchinhos"
 *
 * Regras (decisão da dona, 16/11):
 *  - tipo + finalidade + bairro (bairro vazio cai para a cidade; os dois vazios cai para o tipo);
 *  - usa a preposição certa (em / no / na) conforme o nome do bairro;
 *  - NUNCA inclui o código do imóvel — o código tem coluna própria;
 *  - finalidade "ambos" vira "à venda ou para alugar";
 *  - preço não entra no título (tem coluna própria).
 */

const TIPO: Record<string, string> = {
  casa: 'Casa',
  apartamento: 'Apartamento',
  terreno: 'Terreno',
  comercial: 'Sala comercial',
  galpao: 'Galpão',
  chacara: 'Chácara',
  outro: 'Imóvel',
}

/** Preposição + artigo para o nome do lugar: "em Registro", "no Capuchinhos", "na Mangabeira". */
function comPreposicao(lugar: string): string {
  const nome = String(lugar || '').trim()
  if (!nome) return ''

  const primeiro = nome.split(/\s+/)[0]
  const minusculo = primeiro.toLowerCase()

  const femininos = [
    'mangabeira',
    'brasília',
    'brasilia',
    'avenida',
    'praça',
    'praca',
    'rua',
    'alameda',
    'vila',
    'lagoa',
    'quadra',
    'estrada',
    'ilha',
  ]
  const masculinos = [
    'capuchinhos',
    'sim',
    'parque',
    'jardim',
    'bairro',
    'centro',
    'conjunto',
    'loteamento',
    'residencial',
    'condomínio',
    'condominio',
    'distrito',
    'shopping',
    'lote',
  ]

  if (femininos.indexOf(minusculo) >= 0) return 'na ' + nome
  if (masculinos.indexOf(minusculo) >= 0) return 'no ' + nome
  return 'em ' + nome
}

/** "à venda", "para alugar", "à venda ou para alugar" */
function finalidade(purpose?: string): string {
  switch (purpose) {
    case 'venda':
      return 'à venda'
    case 'locacao':
      return 'para alugar'
    case 'ambos':
      return 'à venda ou para alugar'
    default:
      return ''
  }
}

/** Monta o título a partir dos dados do imóvel. Devolve '' quando não há tipo reconhecido. */
export function montarTitulo(property: {
  property_type?: string
  purpose?: string
  neighborhood?: string
  city?: string
}): string {
  const tipo = TIPO[String(property.property_type || '')] || ''
  const fin = finalidade(property.purpose)
  const lugar = String(property.neighborhood || '').trim() || String(property.city || '').trim()

  const partes: string[] = []
  if (tipo) partes.push(tipo)
  if (fin) partes.push(fin)
  const com = comPreposicao(lugar)
  if (com) partes.push(com)

  if (!partes.length) return ''
  return partes.join(' ')
}

/**
 * O título que a tela mostra, na ordem de preferência:
 *  1. o que a pessoa escreveu (se não for o texto de reserva antigo);
 *  2. o título montado a partir dos campos;
 *  3. o tipo, como último recurso.
 */
export function tituloParaLista(property: {
  title?: string
  property_type?: string
  purpose?: string
  neighborhood?: string
  city?: string
}): string {
  const escrito = String(property.title || '').trim()
  // o backend gravava "Imóvel sem título CA-0006" quando o campo estava vazio
  const ehTextoDeReserva = !escrito || escrito.indexOf('Imóvel sem título') === 0
  if (!ehTextoDeReserva) return escrito

  const montado = montarTitulo(property)
  if (montado) return montado
  return String(property.property_type || 'Imóvel')
}

/** Rótulo curto do que falta no cadastro, na ordem em que a pessoa deve resolver. */
const LABEL_FALTA: Record<string, string> = {
  titulo: 'título',
  preco_venda: 'preço de venda',
  preco_locacao: 'preço de locação',
  bairro: 'bairro',
  cidade: 'cidade',
  rua: 'rua',
  numero: 'número',
  area: 'área',
  quartos: 'quartos',
  banheiros: 'banheiros',
  descricao: 'descrição',
  proprietario: 'proprietário',
  condominio: 'condomínio',
  fotos: 'fotos',
}

export interface PendenciaImovel {
  completo: boolean
  texto: string
  faltando: string[]
  revisaoVencida: boolean
}

/**
 * O que falta no cadastro — MESMA regra do backend (properties_pending_cron.js), para a tela nunca
 * dizer uma coisa e a tarefa do captador dizer outra.
 */
export function pendenciasDoImovel(
  property: {
    status?: string
    title?: string
    purpose?: string
    price_on_request?: boolean
    sale_price?: number
    rent_price?: number
    neighborhood?: string
    city?: string
    street?: string
    street_number?: string
    area?: number
    bedrooms?: number
    bathrooms?: number
    property_type?: string
    description?: string
    owner_id?: string
    in_condominium?: boolean
    condominium_id?: string
    last_reviewed_at?: string
  },
  fotosAtivas: number,
  now: Date = new Date(),
): PendenciaImovel {
  const faltando: string[] = []

  const vivo = ['rascunho', 'disponivel', 'reservado'].indexOf(String(property.status || '')) >= 0

  if (vivo) {
    const num = (v: unknown) => Number(v) || 0
    const pu = String(property.purpose || '')
    const consulta = property.price_on_request === true
    const t = String(property.title || '')
    if (!t || t.indexOf('Imóvel sem título') === 0) faltando.push('titulo')
    if ((pu === 'venda' || pu === 'ambos') && !(num(property.sale_price) > 0 || consulta))
      faltando.push('preco_venda')
    if ((pu === 'locacao' || pu === 'ambos') && !(num(property.rent_price) > 0 || consulta))
      faltando.push('preco_locacao')
    if (!String(property.neighborhood || '').trim()) faltando.push('bairro')
    if (!String(property.city || '').trim()) faltando.push('cidade')
    if (!String(property.street || '').trim()) faltando.push('rua')
    if (!String(property.street_number || '').trim()) faltando.push('numero')
    if (!(num(property.area) > 0)) faltando.push('area')
    const residencial =
      ['casa', 'apartamento', 'chacara'].indexOf(String(property.property_type || '')) >= 0
    if (residencial && !(num(property.bedrooms) >= 1)) faltando.push('quartos')
    if (residencial && !(num(property.bathrooms) >= 1)) faltando.push('banheiros')
    if (!String(property.description || '').trim()) faltando.push('descricao')
    if (!String(property.owner_id || '').trim()) faltando.push('proprietario')
    if (property.in_condominium === true && !String(property.condominium_id || '').trim())
      faltando.push('condominio')
    if (fotosAtivas < 5) faltando.push('fotos')
  }

  // o alerta da tela fala do que a PESSOA precisa preencher; o título agora é montado a partir
  // dos campos, então "sem título" sozinho não vira aviso na lista
  const paraTexto = faltando.filter((k) => k !== 'titulo')

  let revisaoVencida = false
  if (vivo) {
    if (!property.last_reviewed_at) revisaoVencida = true
    else {
      const d = new Date(property.last_reviewed_at)
      if (Number.isNaN(d.getTime())) revisaoVencida = true
      else revisaoVencida = d.getTime() < now.getTime() - 7 * 24 * 60 * 60 * 1000
    }
  }

  const rotulos = paraTexto.map((k) => LABEL_FALTA[k] || k)
  let texto = ''
  if (rotulos.length === 1) texto = 'falta ' + rotulos[0]
  else if (rotulos.length === 2) texto = 'falta ' + rotulos[0] + ' e ' + rotulos[1]
  else if (rotulos.length > 2)
    texto = 'falta ' + rotulos.slice(0, 2).join(', ') + ' e mais ' + (rotulos.length - 2)

  return {
    completo: paraTexto.length === 0 && !revisaoVencida,
    texto,
    faltando: paraTexto,
    revisaoVencida,
  }
}
