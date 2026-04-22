// src/components/TemplateStatusBadge.tsx
import { Badge, badgeVariants } from '@/components/ui/badge'
import type { VariantProps } from 'class-variance-authority'
import { normalizeTemplateStatus } from '@/lib/template-status'

interface TemplateStatusBadgeProps extends VariantProps<typeof badgeVariants> {
  status?: string
}

export function TemplateStatusBadge({ status, ...props }: TemplateStatusBadgeProps) {
  const statusMap: Record<string, { label: string; variant: VariantProps<typeof badgeVariants>['variant'] }> = {
    draft: { label: 'Draft', variant: 'outline' },
    requested: { label: 'Requested', variant: 'secondary' },
    approved: { label: 'Approved', variant: 'default' },
    rejected: { label: 'Rejected', variant: 'destructive' },
  }

  const currentStatus = normalizeTemplateStatus(status)

  return (
    <Badge variant={statusMap[currentStatus].variant} {...props}>
      {statusMap[currentStatus].label}
    </Badge>
  )
}
