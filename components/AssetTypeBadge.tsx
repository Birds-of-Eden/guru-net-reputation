// @ts-nocheck
// src/components/AssetTypeBadge.tsx
import { Badge } from '@/components/ui/badge'
import { formatAssetTypeLabel, normalizeAssetTypeSlug } from '@/lib/asset-types'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

interface AssetTypeBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  type: string
}

export function AssetTypeBadge({ type, ...props }: AssetTypeBadgeProps) {
  const typeMap: Record<string, { label: string; variant: BadgeVariant }> = {
    social_site: { label: 'Social Site', variant: 'default' },
    web2_site: { label: 'Web 2.0', variant: 'secondary' },
    other_asset: { label: 'Other', variant: 'outline' },
  }
  const normalized = normalizeAssetTypeSlug(type)
  const fallbackLabel = formatAssetTypeLabel(normalized)
  const resolved = typeMap[normalized] ?? { label: fallbackLabel, variant: 'outline' }

  return (
    <Badge variant={resolved.variant} {...props}>
      {resolved.label}
    </Badge>
  )
}
// @ts-nocheck
