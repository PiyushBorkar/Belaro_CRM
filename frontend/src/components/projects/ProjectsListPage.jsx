import { useDeferredValue, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ChevronRight, Clock, FolderKanban, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { can } from '../../lib/permissions';
import { cn } from '../../lib/cn';
import { daysSince, formatCurrency, formatDate, timeAgo } from '../../lib/format';
import { PRODUCTION_STATUS, STAGES } from '../../lib/pipeline';
import { useDesigners, useProducts, useProjects } from '../../services/queries';
import { Alert, Avatar, Badge, Button, ButtonLink, Card, EmptyState, Field, Input, Page, PageHeader, Select, Skeleton, Table, TBody, TD, TH, THead, TR } from '../ui';
import { STATUS } from '../../lib/status';
import { InHandBadge, StageBadge, StatusBadge } from './StatusBadge';

const STALE_DAYS = 3; // Project::STALE_DAYS

const FILTER_KEYS = ['status', 'designer_id', 'stage', 'production_status', 'product', 'date_field', 'from', 'to'];

const DATE_FIELDS = {
  created_at: 'Created date',
  erp_order_date: 'ERP order date',
  installation_date: 'Installation date',
};

function Tabs({ view, setView, staleCount, showBin }) {
  const tabs = [
    { id: 'all', label: 'All projects' },
    { id: 'stale', label: 'No update', icon: Clock, count: staleCount },
    showBin && { id: 'trashed', label: 'Bin', icon: Trash2 },
  ].filter(Boolean);

  return (
    <div className="flex gap-1 border-b border-border px-4" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={view === t.id}
          onClick={() => setView(t.id)}
          className={cn(
            '-mb-px flex h-11 cursor-pointer items-center gap-2 border-b-2 px-3 text-[13px] font-medium transition-colors',
            view === t.id ? 'border-primary text-fg' : 'border-transparent text-fg-muted hover:text-fg',
          )}
        >
          {t.icon && <t.icon className="size-3.5" />}
          {t.label}
          {t.count > 0 && <Badge tone="warning" className="tabular px-1.5">{t.count}</Badge>}
        </button>
      ))}
    </div>
  );
}

function FilterPanel({ filters, set, clear, showDesigner }) {
  const { data: designers = [] } = useDesigners(showDesigner);
  const { data: products = [] } = useProducts();

  return (
    <div className="grid gap-4 border-b border-border bg-surface-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
      {showDesigner && (
        <Field label="Designer">
          {(id) => (
            <Select id={id} value={filters.designer_id} onChange={set('designer_id')}>
              <option value="">All designers</option>
              {designers.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.email})</option>)}
            </Select>
          )}
        </Field>
      )}
      <Field label="Status">
        {(id) => (
          <Select id={id} value={filters.status} onChange={set('status')}>
            <option value="">Any status</option>
            <option value="open">Open (new + in-progress)</option>
            <option value="in_progress">{STATUS.in_progress.label}</option>
            <option value="in_hand">In-hand (advance received)</option>
            <option value="installed">{STATUS.installed.label} (not closed yet)</option>
            <option value="closed">{STATUS.closed.label}</option>
            <option value="lost">{STATUS.lost.label}</option>
            <option value="not_started">{STATUS.not_started.label}</option>
          </Select>
        )}
      </Field>
      <Field label="Current stage">
        {(id) => (
          <Select id={id} value={filters.stage} onChange={set('stage')}>
            <option value="">Any stage</option>
            {STAGES.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
            <option value="installed">Installed</option>
          </Select>
        )}
      </Field>
      <Field label="Production status">
        {(id) => (
          <Select id={id} value={filters.production_status} onChange={set('production_status')}>
            <option value="">Any</option>
            {Object.entries(PRODUCTION_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        )}
      </Field>
      <Field label="Product">
        {(id) => (
          <Select id={id} value={filters.product} onChange={set('product')}>
            <option value="">All products</option>
            {products.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
          </Select>
        )}
      </Field>
      <Field label="Date">
        {(id) => (
          <Select id={id} value={filters.date_field || 'created_at'} onChange={set('date_field')}>
            {Object.entries(DATE_FIELDS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        )}
      </Field>
      <Field label="From">{(id) => <Input id={id} type="date" value={filters.from} onChange={set('from')} />}</Field>
      <Field label="To">{(id) => <Input id={id} type="date" value={filters.to} min={filters.from || undefined} onChange={set('to')} />}</Field>
      <div className="flex items-end">
        <Button variant="ghost" icon={X} onClick={clear}>Clear filters</Button>
      </div>
    </div>
  );
}

export function ProjectsListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Filters live in the URL, so a filtered list can be bookmarked or shared
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(() => FILTER_KEYS.some((k) => params.get(k)));

  const view = params.get('view') || 'all';
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? '']));
  const activeCount = FILTER_KEYS.filter((k) => k !== 'date_field' && filters[k]).length;

  const update = (changes) => setParams((p) => {
    const next = new URLSearchParams(p);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    return next;
  }, { replace: true });

  const set = (key) => (e) => update({ [key]: e.target.value });
  const clear = () => update(Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])));

  const [search, setSearch] = useState(params.get('q') ?? '');
  const q = useDeferredValue(search.trim());

  const { data, isPending, isFetching, error } = useProjects({ view, q, ...filters });
  const projects = data?.data ?? [];
  const showDesigner = can.seeTeamStats(user);
  const filtered = !!(q || activeCount);
  // Project value and advance per order, with totals in the footer (roles that may see money).
  // On the In-hand list the advance total matches the dashboard's In-hand tile.
  const showMoney = can.seeMoney(user);
  const total = (key) => projects.reduce((sum, p) => sum + Number(p[key] ?? 0), 0);

  return (
    <Page>
      <PageHeader
        title="Projects"
        description="Every customer order and where it is in the pipeline."
        actions={can.createProject(user) && <ButtonLink to="/projects/new" icon={Plus}>New project</ButtonLink>}
      />

      <Card className="overflow-hidden">
        <Tabs view={view} setView={(v) => update({ view: v === 'all' ? '' : v })} staleCount={data?.meta?.stale_count} showBin={can.deleteProjects(user)} />

        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
            <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer name or ERP order number…" className="pl-9" />
          </div>
          <Button variant={showFilters ? 'primary' : 'secondary'} icon={SlidersHorizontal} onClick={() => setShowFilters((s) => !s)}>
            Filters{activeCount > 0 && <span className="tabular">({activeCount})</span>}
          </Button>
        </div>

        {showFilters && <FilterPanel filters={filters} set={set} clear={clear} showDesigner={showDesigner} />}

        {view === 'stale' && (
          <p className="flex items-center gap-2 border-b border-border bg-warning-soft px-4 py-2.5 text-[13px] text-warning-soft-fg">
            <Clock className="size-4" />
            Unfinished projects with no change of any kind for {STALE_DAYS} days or more. Oldest first.
          </p>
        )}

        {error && <Alert className="m-4">{error.message}</Alert>}

        {isPending ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={view === 'stale' ? Clock : view === 'trashed' ? Trash2 : FolderKanban}
            title={filtered ? 'No matching projects' : view === 'stale' ? 'Everything is moving' : view === 'trashed' ? 'The bin is empty' : 'No projects yet'}
            description={filtered ? 'Try a different search or clear the filters.' : view === 'stale' ? `No unfinished project has gone ${STALE_DAYS} days without an update.` : undefined}
          />
        ) : (
          <>
            <Table className={isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
              <THead>
                <TH>Customer</TH>
                {showDesigner && <TH>Designer</TH>}
                <TH>Product</TH>
                {showMoney && <TH className="text-right">Project value</TH>}
                {showMoney && <TH className="text-right">Advance</TH>}
                <TH>Current stage</TH>
                <TH>Status</TH>
                <TH>Last update</TH>
                <TH>Created</TH>
                <TH className="w-10" />
              </THead>
              <TBody>
                {projects.map((p) => {
                  const idle = daysSince(p.updated_at);
                  return (
                    <TR key={p.id} onClick={() => navigate(`/projects/${p.id}`)}>
                      <TD>
                        {/* Real link so Ctrl/middle-click opens the project in a new tab */}
                        <Link to={`/projects/${p.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-fg hover:text-primary">
                          {p.customer_name}
                        </Link>
                        {p.erp_order_number && <p className="tabular text-xs text-fg-subtle">ERP {p.erp_order_number}</p>}
                        {can.superviseOnly(user, p) && <Badge tone="info" className="mt-1">Site supervisor</Badge>}
                      </TD>
                      {showDesigner && (
                        <TD>
                          {p.assigned_designer ? (
                            <span className="flex items-center gap-2">
                              <Avatar name={p.assigned_designer.name} className="size-6 text-[10px]" />
                              {p.assigned_designer.name}
                            </span>
                          ) : '—'}
                        </TD>
                      )}
                      <TD>{p.product_name ?? '—'}</TD>
                      {showMoney && <TD className="tabular text-right font-medium text-fg">{formatCurrency(p.project_value)}</TD>}
                      {showMoney && <TD className="tabular text-right">{formatCurrency(p.advance_payment_received)}</TD>}
                      <TD>{['installed', 'closed', 'lost'].includes(p.status) ? '—' : <StageBadge stage={p.stage} />}</TD>
                      <TD>
                        <span className="flex gap-1.5">
                          <StatusBadge status={p.status} />
                          {p.in_hand && <InHandBadge />}
                        </span>
                      </TD>
                      <TD className={cn('tabular', !['installed', 'closed', 'lost'].includes(p.status) && idle >= STALE_DAYS && 'font-medium text-warning')}>{timeAgo(p.updated_at)}</TD>
                      <TD className="tabular">{formatDate(p.created_at)}</TD>
                      <TD className="text-fg-subtle"><ChevronRight className="size-4" /></TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
            <p className="tabular border-t border-border px-4 py-3 text-xs text-fg-subtle">
              {projects.length} project{projects.length === 1 ? '' : 's'}
              {showMoney && (
                <>
                  {' · '}<span className="font-medium text-fg">{formatCurrency(total('project_value'))}</span> project value
                  {' · '}<span className="font-medium text-fg">{formatCurrency(total('advance_payment_received'))}</span> advance collected
                </>
              )}
            </p>
          </>
        )}
      </Card>
    </Page>
  );
}
