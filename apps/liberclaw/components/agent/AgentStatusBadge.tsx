import React from 'react';
import Badge from '../ui/Badge';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface AgentStatusBadgeProps {
  status: string;
}

const statusMap: Record<string, { label: string; variant: BadgeVariant }> = {
  running: { label: 'Running', variant: 'success' },
  deploying: { label: 'Deploying', variant: 'warning' },
  failed: { label: 'Failed', variant: 'error' },
  pending: { label: 'Pending', variant: 'info' },
  stopped: { label: 'Stopped', variant: 'neutral' },
};

export default function AgentStatusBadge({ status }: AgentStatusBadgeProps) {
  const mapping = statusMap[status] ?? { label: status, variant: 'neutral' as BadgeVariant };

  return <Badge text={mapping.label} variant={mapping.variant} />;
}
