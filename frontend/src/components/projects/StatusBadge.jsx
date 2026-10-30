import { STAGE_LABELS } from '../../lib/pipeline';
import { STATUS } from '../../lib/status';
import { Badge } from '../ui';

const PRODUCTION = {
  not_started: { label: 'Not started', tone: 'neutral' },
  in_progress: { label: 'In progress', tone: 'info' },
  completed:   { label: 'Completed',   tone: 'success' },
};

export function StatusBadge({ status }) {
  const s = STATUS[status] ?? STATUS.not_started;
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}

// Advance received, order still open
export function InHandBadge() {
  return <Badge tone="info">In-hand</Badge>;
}

export function ProductionStatusBadge({ status }) {
  const s = PRODUCTION[status] ?? PRODUCTION.not_started;
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}

// The step the project is waiting on
export function StageBadge({ stage }) {
  return <Badge tone={stage === 'installed' ? 'success' : 'primary'}>{STAGE_LABELS[stage] ?? stage}</Badge>;
}
