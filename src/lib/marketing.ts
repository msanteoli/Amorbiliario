export type MarketingConsent = 'accepted' | 'declined' | null

const CONSENT_STORAGE_KEY = 'imob_marketing_consent'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    fbq?: (...args: unknown[]) => void
    _fbq?: unknown
  }
}

let metaInitialized = false
let googleInitialized = false

export function getConsent(): MarketingConsent {
  if (typeof window === 'undefined') return null
  try {
    const val = localStorage.getItem(CONSENT_STORAGE_KEY)
    if (val === 'accepted' || val === 'declined') {
      return val
    }
    return null
  } catch {
    return null
  }
}

export function setConsent(v: 'accepted' | 'declined'): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, v)
  } catch {
    // se o armazenamento falhar, não quebre a página
  }

  if (v === 'accepted') {
    initMarketingScripts()
  }
}

/**
 * Injeta e inicializa Meta Pixel e Google Ads apenas se houver IDs e consentimento for 'accepted'.
 */
export function initMarketingScripts(): void {
  if (typeof window === 'undefined') return
  if (getConsent() !== 'accepted') return

  const metaPixelId = (import.meta.env.VITE_META_PIXEL_ID || '').trim()
  const googleAdsId = (import.meta.env.VITE_GOOGLE_ADS_ID || '').trim()

  // Meta Pixel
  if (metaPixelId && !metaInitialized) {
    /* eslint-disable */
    ;(function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
      if (f.fbq) return
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments)
      }
      if (!f._fbq) f._fbq = n
      n.push = n
      n.loaded = true
      n.version = '2.0'
      n.queue = []
      t = b.createElement(e)
      t.async = true
      t.src = v
      s = b.getElementsByTagName(e)[0]
      s.parentNode.insertBefore(t, s)
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
    /* eslint-enable */

    if (window.fbq) {
      window.fbq('init', metaPixelId)
      window.fbq('track', 'PageView')
      metaInitialized = true
    }
  }

  // Google Ads
  if (googleAdsId && !googleInitialized) {
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleAdsId)}`
    document.head.appendChild(script)

    window.dataLayer = window.dataLayer || []
    window.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments)
    }
    window.gtag('js', new Date())
    window.gtag('config', googleAdsId)
    googleInitialized = true
  }
}

/**
 * Conversão (a): no sucesso do envio do formulário
 * Meta fbq('track', 'Lead') e Google gtag('event', 'generate_lead')
 */
export function trackLead(code?: string): void {
  if (getConsent() !== 'accepted') return

  const cleanCode = code ? String(code).trim() : ''

  // Meta
  if (window.fbq && (import.meta.env.VITE_META_PIXEL_ID || '').trim()) {
    if (cleanCode) {
      window.fbq('track', 'Lead', {
        content_ids: [cleanCode],
      })
    } else {
      window.fbq('track', 'Lead')
    }
  }

  // Google Ads
  if (window.gtag && (import.meta.env.VITE_GOOGLE_ADS_ID || '').trim()) {
    if (cleanCode) {
      window.gtag('event', 'generate_lead', {
        items: [{ id: cleanCode }],
      })
    } else {
      window.gtag('event', 'generate_lead')
    }
  }
}

/**
 * Conversão (b): no clique em "Falar no WhatsApp"
 * Meta fbq('track', 'Contact') e Google gtag('event', 'contact')
 */
export function trackWhatsapp(code?: string): void {
  if (getConsent() !== 'accepted') return

  const cleanCode = code ? String(code).trim() : ''

  // Meta
  if (window.fbq && (import.meta.env.VITE_META_PIXEL_ID || '').trim()) {
    if (cleanCode) {
      window.fbq('track', 'Contact', {
        content_ids: [cleanCode],
      })
    } else {
      window.fbq('track', 'Contact')
    }
  }

  // Google Ads
  if (window.gtag && (import.meta.env.VITE_GOOGLE_ADS_ID || '').trim()) {
    if (cleanCode) {
      window.gtag('event', 'contact', {
        items: [{ id: cleanCode }],
      })
    } else {
      window.gtag('event', 'contact')
    }
  }
}
