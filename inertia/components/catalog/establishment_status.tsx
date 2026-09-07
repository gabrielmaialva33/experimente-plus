import { Badge } from '~/components/ui/badge'
import {
  businessStatusLabel,
  type CatalogAvailability,
  type CatalogBusinessStatus,
} from '~/lib/catalog'
import { cn } from '~/lib/utils'

interface EstablishmentStatusProps {
  businessStatus: CatalogBusinessStatus
  isOpenNow: boolean
  availabilityType?: CatalogAvailability
  id?: string
  size?: 'sm' | 'md'
  className?: string
}

export function EstablishmentStatus({
  businessStatus,
  isOpenNow,
  availabilityType,
  id,
  size = 'md',
  className,
}: EstablishmentStatusProps) {
  let colors = 'border-border bg-muted text-muted-foreground'

  if (businessStatus === 'temporarily_closed') {
    colors = 'border-warning/30 bg-warning-soft text-warning-accent'
  } else if (businessStatus === 'open') {
    if (availabilityType === 'appointment_only') {
      colors = 'border-info/25 bg-info-soft text-info-accent'
    } else if (isOpenNow) {
      colors = 'border-success/25 bg-success-soft text-success-accent'
    }
  }

  return (
    <Badge id={id} variant="outline" size={size} className={cn(colors, className)}>
      {businessStatusLabel(businessStatus, isOpenNow, availabilityType)}
    </Badge>
  )
}
