import React from 'react'
import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'
import { PublicPropertyListItem } from '@/services/publicSite'
import {
  formatPrice,
  getFullPhotoUrl,
  buildSpecsSummary,
  PUBLIC_PROPERTY_TYPE_LABELS,
} from '@/lib/publicSiteUtils'

interface PropertyCardProps {
  property: PublicPropertyListItem
}

export const PropertyCard: React.FC<PropertyCardProps> = ({ property }) => {
  const coverUrl = getFullPhotoUrl(property.cover)
  const specsText = buildSpecsSummary({
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    parking: property.parking,
    area: property.area,
  })

  const typeLabel = PUBLIC_PROPERTY_TYPE_LABELS[property.type] || property.type

  // Preços
  const salePriceStr = property.sale ? formatPrice(property.sale, 'sale') : null
  const rentPriceStr = property.rent ? formatPrice(property.rent, 'rent') : null
  const targetUrl = `/buscar/${encodeURIComponent(property.code)}`

  return (
    <Link
      to={targetUrl}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-[12px] p-2 -m-2 transition-[box-shadow,border-color] duration-150 hover:shadow-[0_6px_16px_rgba(0,0,0,0.12)] dark:hover:shadow-none dark:hover:ring-1 dark:hover:ring-border bg-transparent hover:bg-card"
    >
      {/* Sem moldura de cartão: a foto (proporção 4:3, raio 12 px) e o texto logo abaixo */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[12px] bg-muted flex items-center justify-center">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={property.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground/60 p-4 h-full w-full rounded-[12px] bg-muted">
            <Home className="h-10 w-10 stroke-[1.5]" />
            <span className="text-xs mt-1.5 font-medium">Sem foto</span>
          </div>
        )}

        {/* Sobre a foto, no canto, só a pílula do tipo com .on-photo */}
        <div className="absolute top-3 left-3">
          <span className="on-photo px-3 py-1 rounded-full text-[11px] font-medium text-foreground border border-line">
            {typeLabel}
          </span>
        </div>
      </div>

      {/* Abaixo, em ordem: título (peso 500, uma linha), bairro e cidade em texto de apoio, dados (quartos, vagas, área) em texto de apoio, e preço em peso 600 */}
      <div className="pt-3 pb-1 space-y-1 text-left">
        {/* Título: peso 500, uma linha */}
        <h3 className="font-medium text-[15px] sm:text-base text-foreground truncate">
          {property.title}
        </h3>

        {/* Bairro e cidade em texto de apoio */}
        <p className="text-sm text-muted-foreground truncate">
          {[property.neighborhood, property.city].filter(Boolean).join(', ') ||
            'Localização não informada'}
        </p>

        {/* Dados (quartos, vagas, área) em texto de apoio */}
        {specsText && <p className="text-sm text-muted-foreground truncate">{specsText}</p>}

        {/* Preço em peso 600 (venda e locação em duas linhas quando houver os dois) */}
        <div className="pt-1 space-y-0.5 tabular font-semibold text-foreground">
          {salePriceStr && <div className="text-[15px] sm:text-base">{salePriceStr}</div>}
          {rentPriceStr && <div className="text-[15px] sm:text-base">{rentPriceStr}</div>}
          {!salePriceStr && !rentPriceStr && (
            <div className="text-sm font-medium text-muted-foreground">Valor não informado</div>
          )}
        </div>
      </div>
    </Link>
  )
}
