export interface CampaignParams {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  gclid?: string
  fbclid?: string
}

let campaignMemory: CampaignParams = {}
let campaignInitialized = false

/**
 * Lê os parâmetros de campanha da URL atual e armazena na memória do módulo.
 * Deve ser chamado na primeira carga ou na navegação de páginas públicas.
 */
export function initCampaignFromUrl(searchString?: string): void {
  const query = new URLSearchParams(
    searchString !== undefined ? searchString : window.location.search,
  )

  const utm_source = query.get('utm_source') || undefined
  const utm_medium = query.get('utm_medium') || undefined
  const utm_campaign = query.get('utm_campaign') || undefined
  const gclid = query.get('gclid') || undefined
  const fbclid = query.get('fbclid') || undefined

  if (!campaignInitialized) {
    campaignMemory = {
      utm_source,
      utm_medium,
      utm_campaign,
      gclid,
      fbclid,
    }
    campaignInitialized = true
  } else {
    // Se parâmetros novos vierem na URL durante a navegação, atualiza os que existirem
    if (utm_source) campaignMemory.utm_source = utm_source
    if (utm_medium) campaignMemory.utm_medium = utm_medium
    if (utm_campaign) campaignMemory.utm_campaign = utm_campaign
    if (gclid) campaignMemory.gclid = gclid
    if (fbclid) campaignMemory.fbclid = fbclid
  }
}

export function getCampaign(): CampaignParams {
  // Se ainda não inicializou e estamos no navegador, tenta ler agora
  if (!campaignInitialized && typeof window !== 'undefined') {
    initCampaignFromUrl()
  }
  return { ...campaignMemory }
}
