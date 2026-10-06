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
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

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

  return (
    <Link
      to={`/buscar/${encodeURIComponent(property.code)}`}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
    >
      <Card className="h-full overflow-hidden border border-border/80 hover:border-border transition-all duration-200 hover:shadow-md flex flex-col bg-card">
        {/* Foto de Capa (Proporção 4:3) */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted flex items-center justify-center">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={property.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground/60 p-4">
              <Home className="h-10 w-10 stroke-[1.5]" />
              <span className="text-xs mt-1.5 font-medium">Sem foto</span>
            </div>
          )}

          {/* Badge de tipo */}
          <div className="absolute top-3 left-3">
            <Badge
              variant="secondary"
              className="bg-background/90 backdrop-blur-sm text-foreground text-xs font-medium shadow-sm"
            >
              {typeLabel}
            </Badge>
          </div>
        </div>

        {/* Informações */}
        <CardContent className="p-4 flex-1 flex flex-col justify-between">
          <div>
            {/* Preços */}
            <div className="mb-2 space-y-0.5">
              {salePriceStr && (
                <div className="text-lg font-bold text-foreground tracking-tight">
                  {salePriceStr}
                </div>
              )}
              {rentPriceStr && (
                <div className="text-base font-semibold text-foreground/90 tracking-tight">
                  {rentPriceStr}
                </div>
              )}
              {!salePriceStr && !rentPriceStr && (
                <div className="text-base font-medium text-muted-foreground">
                  Valor não informado
                </div>
              )}
            </div>

            {/* Título */}
            <h3 className="font-semibold text-base text-foreground line-clamp-1 group-hover:text-primary transition-colors">
              {property.title}
            </h3>

            {/* Bairro, Cidade */}
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
              {[property.neighborhood, property.city].filter(Boolean).join(', ')}
            </p>
          </div>

          {/* Características */}
          {specsText && (
            <div className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground font-medium">
              {specsText}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
