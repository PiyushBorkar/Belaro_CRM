import { useDeferredValue, useState } from 'react';
import { Link } from 'react-router';
import {
  Activity, ArchiveRestore, Ban, CheckCircle2, ChevronLeft, ChevronRight, FolderPlus, PencilLine, RotateCcw, Search, Trash2, UserRoundCog,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { formatDateTime, formatTime } from '../../lib/format';
import { useActivity, useUsers } from '../../services/queries';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Page, PageHeader, Select, Skeleton } from '../ui';
import { ChangeList } from '../projects/ProjectTrackingTimeline';

// What kind of change an entry is. The notes are fixed sentences written by ProjectController.
const KINDS = {
  created:   { icon: FolderPlus,     tone: 'bg-primary-soft text-primary-soft-fg', verb: 'created' },
  assigned:  { icon: UserRoundCog,   tone: 'bg-info-soft text-info-soft-fg',       verb: 'reassigned' },
  installed: { icon: CheckCircle2,   tone: 'bg-success-soft text-success-soft-fg', verb: 'completed installation for' },
  closed:    { icon: CheckCircle2,   tone: 'bg-success-soft text-success-soft-fg', verb: 'closed the order for' },
  lost:      { icon: Ban,            tone: 'bg-danger-soft text-danger-soft-fg',   verb: 'marked', after: 'as lost' },
  reopened:  { icon: RotateCcw,      tone: 'bg-success-soft text-success-soft-fg', verb: 'reopened' },
  binned:    { icon: Trash2,         tone: 'bg-warning-soft text-warning-soft-fg', verb: 'moved', after: 'to the bin' },
  restored:  { icon: ArchiveRestore, tone: 'bg-success-soft text-success-soft-fg', verb: 'restored', after: 'from the bin' },
  filled:    { icon: PencilLine,     tone: 'bg-surface-muted text-fg-muted',       verb: 'updated' },
  // Amber: an existing value was overwritten or cleared (a correction), not normal progress
  changed:   { icon: PencilLine,     tone: 'bg-warning-soft text-warning-soft-fg', verb: 'changed details of' },
};

function kindOf(r) {
  const note = r.note ?? '';
  // production_status starts as 'not_started' (the column default), so leaving it is not a correction
  const changes = Object.entries(r.changes ?? {})
    .map(([field, c]) => (field === 'production_status' && c.old === 'not_started' ? { ...c, old: null } : c));
  if (note.startsWith('Project created') || note.startsWith('Imported')) return 'created';
  if (note.startsWith('Reassigned')) return 'assigned';
  if (note.startsWith('Marked as lost')) return 'lost';
  if (note.startsWith('Reopened')) return 'reopened';
  if (note.startsWith('Order closed')) return 'closed';
  if (note.includes('moved to the bin')) return 'binned';
  if (note.includes('restored from the bin')) return 'restored';
  if (r.changes?.installation_date?.new) return 'installed';
  // Overwriting or clearing an existing value is a correction; filling an empty field is normal progress
  return changes.some((c) => c.old !== null && c.old !== '') ? 'changed' : 'filled';
}

// Notes that add something the change list doesn't show ("assigned to Ravi")
const showsNote = (kind) => ['created', 'assigned'].includes(kind);

// "Today", "Yesterday", or "Wednesday, 22 October 2026"
function dayLabel(value) {
  const day = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (day.toDateString() === today.toDateString()) return 'Today';
  if (day.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return day.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// Rows arrive newest first; keep that order and split them by calendar day
function groupByDay(rows) {
  const groups = [];
  for (const r of rows) {
    const key = new Date(r.created_at).toDateString();
    if (groups.at(-1)?.key !== key) groups.push({ key, label: dayLabel(r.created_at), rows: [] });
    groups.at(-1).rows.push(r);
  }
  return groups;
}

// Which project: one customer can have several orders, so the product and ERP number tell them apart
function ProjectLine({ project }) {
  const parts = [
    project.product_name && <span key="product" className="font-medium text-fg">{project.product_name}</span>,
    project.erp_order_number && <span key="erp" className="tabular">ERP {project.erp_order_number}</span>,
    <span key="id" className="tabular">Project #{project.id}</span>,
  ].filter(Boolean);

  return (
    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-fg-muted">
      {parts.flatMap((part, i) => (i ? [<span key={`dot-${i}`} aria-hidden className="text-fg-subtle">·</span>, part] : [part]))}
      {project.deleted_at && <Badge tone="warning" className="ml-1">In the bin</Badge>}
    </p>
  );
}

function Entry({ r }) {
  const kind = kindOf(r);
  const { icon: Icon, tone, verb, after } = KINDS[kind];

  return (
    <li className="flex gap-3.5 px-5 py-4">
      <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-full', tone)}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm leading-6 text-fg-muted">
            <span className="font-semibold text-fg">{r.changed_by ? (r.changed_by_user?.name ?? 'Unknown') : 'System'}</span>{' '}
            <Badge className="mx-0.5 capitalize align-[1px]">{r.role}</Badge>{' '}
            {verb}{' '}
            {r.project ? (
              <Link to={`/projects/${r.project.id}`} className="font-semibold text-fg underline decoration-border-strong underline-offset-4 hover:text-primary hover:decoration-primary">
                {r.project.customer_name}
              </Link>
            ) : <span className="italic">a deleted project</span>}
            {after && ` ${after}`}
          </p>
          <time dateTime={r.created_at} title={formatDateTime(r.created_at)} className="tabular shrink-0 pt-0.5 text-xs font-medium text-fg-muted">
            {formatTime(r.created_at)}
          </time>
        </div>
        {r.project && <ProjectLine project={r.project} />}
        {showsNote(kind) && r.note && <p className="mt-1 text-[13px] text-fg-muted">{r.note}</p>}
        <ChangeList changes={r.changes} />
      </div>
    </li>
  );
}

export function ActivityPage() {
  const [filters, setFilters] = useState({ user_id: '', from: '', to: '', page: 1 });
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const { data, isPending, isFetching, error } = useActivity({ ...filters, q });
  const { data: users = [] } = useUsers();
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value, page: 1 }));
  const rows = data?.data ?? [];

  return (
    <Page className="max-w-5xl">
      <PageHeader title="Activity log" description="Every change made to any project, newest first." />

      <Card className="overflow-hidden">
        <div className="grid gap-4 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto]">
          <Field label="Project">
            {(id) => (
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
                <Input id={id} type="search" value={search} className="pl-9" placeholder="Customer, ERP or project no."
                  onChange={(e) => { setSearch(e.target.value); setFilters((f) => ({ ...f, page: 1 })); }} />
              </div>
            )}
          </Field>
          <Field label="Person">
            {(id) => (
              <Select id={id} value={filters.user_id} onChange={set('user_id')}>
                <option value="">Everyone</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="From">{(id) => <Input id={id} type="date" value={filters.from} max={filters.to || undefined} onChange={set('from')} />}</Field>
          <Field label="To">{(id) => <Input id={id} type="date" value={filters.to} min={filters.from || undefined} onChange={set('to')} />}</Field>
        </div>

        {error && <Alert className="m-4">{error.message}</Alert>}

        {isPending ? (
          <div className="space-y-3 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Activity} title="No activity found" description="Try another project, person or date range." />
        ) : (
          <div className={cn(isFetching && 'opacity-70')}>
            {groupByDay(rows).map((g) => (
              <section key={g.key}>
                <h2 className="border-y border-border bg-surface-muted px-5 py-2 text-xs font-semibold tracking-wide text-fg uppercase">
                  {g.label}
                </h2>
                <ul className="divide-y divide-border">
                  {g.rows.map((r) => <Entry key={r.id} r={r} />)}
                </ul>
              </section>
            ))}
          </div>
        )}

        {data && data.last_page > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="tabular text-xs text-fg-subtle">Page {data.current_page} of {data.last_page} · {data.total} changes</p>
            <div className="flex gap-1">
              <Button variant="secondary" size="icon-sm" icon={ChevronLeft} aria-label="Previous page"
                disabled={data.current_page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))} />
              <Button variant="secondary" size="icon-sm" icon={ChevronRight} aria-label="Next page"
                disabled={data.current_page >= data.last_page} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))} />
            </div>
          </div>
        )}
      </Card>
    </Page>
  );
}
