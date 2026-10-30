import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ArrowRight, BadgeIndianRupee, Ban, CheckCircle2, Clock, HandCoins, Hourglass, Factory, FolderKanban, Gauge, Handshake, PackageCheck, Truck, UsersRound, Wallet,
} from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { can, hasRole } from '../../lib/permissions';
import { cn } from '../../lib/cn';
import { formatCurrency } from '../../lib/format';
import { STAGE_LABELS } from '../../lib/pipeline';
import { useDashboardStats, useDesigners } from '../../services/queries';
import { Alert, ButtonLink, Card, CardBody, CardHeader, EmptyState, Page, PageHeader, Select, Skeleton, StatCard, Table, TBody, TD, TH, THead, TR } from '../ui';
import { StatusBadge } from '../projects/StatusBadge';
import { BarList, FunnelChart, KpiTile } from './Charts';
import { presetRange } from '../../lib/dateRanges';
import { trackPointer } from '../../lib/pointer';
import { DateRangePicker } from './DateRangePicker';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

const money = (v) => formatCurrency(v ?? 0);

function StaleAlert({ count }) {
  if (!count) return null;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 text-warning-soft-fg">
        <Clock className="size-5 shrink-0" />
        <p className="text-sm">
          <span className="font-semibold">{count} project{count === 1 ? '' : 's'}</span> had no update for 3 days or more.
        </p>
      </div>
      <ButtonLink to="/projects?view=stale" variant="secondary" size="sm">Review<ArrowRight className="size-3.5" /></ButtonLink>
    </div>
  );
}

// The old sheet's top row: Total clients · In-Progress · In-hand · Order Closed · Order Lost, with values.
// Each tile opens the list with the same filters the tile counted: status, employee, and the
// customers who came in the selected range (filters.from/to on created_at).
function OutcomeRow({ outcomes, showMoney, filters }) {
  const tiles = [
    { key: 'total', label: 'Total clients', icon: UsersRound, status: '' },
    // "In-progress" here is every open order (new + under way), as in the old sheet → status=open
    { key: 'in_progress', label: 'In-progress', icon: Hourglass, status: 'open' },
    // Project value is entered after the advance, so in-hand orders show the advance received
    { key: 'in_hand', label: 'In-hand orders', icon: HandCoins, status: 'in_hand', money: 'advance', moneyLabel: 'advance collected' },
    { key: 'closed', label: 'Order closed', icon: CheckCircle2, status: 'closed' },
    { key: 'lost', label: 'Order lost', icon: Ban, status: 'lost' },
  ];

  const listLink = (status) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (filters.designer_id) params.set('designer_id', filters.designer_id);
    if (filters.from || filters.to) {
      params.set('date_field', 'created_at');
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
    }
    const qs = params.toString();
    return qs ? `/projects?${qs}` : '/projects';
  };

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((t) => (
        <Link key={t.key} to={listLink(t.status)} onPointerMove={trackPointer}
          className={cn('fx-tile group rounded-xl border border-border bg-surface p-5 shadow-xs',
            t.key === 'total' && 'col-span-2 sm:col-span-1')}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-medium text-fg-muted">{t.label}</p>
            <t.icon className="fx-tile-icon size-4 text-fg-subtle" />
          </div>
          <p className="fx-tile-value tabular mt-3 text-[26px] leading-none font-semibold tracking-tight text-fg">{outcomes[t.key]?.count ?? 0}</p>
          {showMoney && (
            <p className="tabular mt-2 text-xs text-fg-subtle">{money(outcomes[t.key]?.[t.money ?? 'value'])} {t.moneyLabel ?? 'value'}</p>
          )}
        </Link>
      ))}
    </div>
  );
}

// The old sheet's "Clients stuck at current stage" table
function StuckTable({ rows, showDesigner }) {
  const navigate = useNavigate();

  return (
    <Card className="overflow-hidden">
      <CardHeader icon={Clock} title="Clients stuck at their current stage" description="Open orders with no update for 3 days or more, longest first."
        actions={<ButtonLink to="/projects?view=stale" variant="secondary" size="sm">See all<ArrowRight className="size-3.5" /></ButtonLink>} />
      {rows.length ? (
        <Table>
          <THead>
            {showDesigner && <TH>Employee</TH>}
            <TH>Client</TH>
            <TH>Product</TH>
            <TH className="text-right">Days since update</TH>
            <TH>Status</TH>
            <TH>Current stage</TH>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id} onClick={() => navigate(`/projects/${r.id}`)}>
                {showDesigner && <TD>{r.designer_name ?? '—'}</TD>}
                <TD className="font-medium text-fg">{r.customer_name}</TD>
                <TD>{r.product_name ?? '—'}</TD>
                <TD className="tabular text-right font-medium text-warning">{r.days}</TD>
                <TD><StatusBadge status={r.status} /></TD>
                <TD>{STAGE_LABELS[r.stage] ?? r.stage}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      ) : (
        <EmptyState icon={CheckCircle2} title="Nothing is stuck" description="Every open order was updated in the last 3 days." className="py-8" />
      )}
    </Card>
  );
}

// Orders and money in the range (the outcome row above already covers clients and closures)
function SalesKpis({ kpis, prev = {}, showMoney }) {
  return (
    <div className={cn('grid grid-cols-2 gap-4', showMoney && 'md:grid-cols-3 2xl:grid-cols-6')}>
      <KpiTile label="Orders placed" value={kpis.orders} previous={prev.orders} icon={Handshake} />
      <KpiTile label="Dispatched" value={kpis.dispatched} previous={prev.dispatched} icon={Truck} />
      {showMoney && (
        <>
          <KpiTile label="Order value" value={kpis.order_value} previous={prev.order_value} format={money} icon={BadgeIndianRupee} />
          <KpiTile label="Advance collected" value={kpis.advance_collected} previous={prev.advance_collected} format={money} icon={Wallet} />
          <KpiTile label="Balance to collect" value={kpis.balance_due} previous={prev.balance_due} format={money} icon={Wallet} higherIsBetter={false} />
          <KpiTile label="Avg. order value" value={kpis.avg_order_value} previous={prev.avg_order_value} format={money} icon={Gauge} />
        </>
      )}
    </div>
  );
}

function ProductionKpis({ p }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      <StatCard label="In production" value={p.in_production} icon={Factory} tone="info" hint="Not completed yet" />
      <StatCard label="Ready to dispatch" value={p.awaiting_dispatch} icon={PackageCheck} tone="warning" hint="Completed, not dispatched" />
      <StatCard label="Awaiting installation" value={p.awaiting_install} icon={Truck} tone="primary" hint="Dispatched, not installed" />
      <StatCard label="Completed in range" value={p.completed_in_range} icon={CheckCircle2} tone="success" />
      <StatCard label="Dispatched in range" value={p.dispatched_in_range} icon={Truck} tone="neutral" />
      <StatCard label="Installed in range" value={p.installed_in_range} icon={CheckCircle2} tone="success" />
    </div>
  );
}

function DesignerTable({ rows, showMoney }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Team performance" description="Customers and orders in the selected range; conversion = share of those customers who placed an order." />
      {rows.length ? (
        <Table>
          <THead>
            <TH>Designer</TH>
            <TH className="text-right">Active</TH>
            <TH className="text-right">Customers</TH>
            <TH className="text-right">Orders</TH>
            <TH className="text-right">Conversion</TH>
            {showMoney && <TH className="text-right">Order value</TH>}
            <TH className="text-right">Closed</TH>
            <TH className="text-right">Lost</TH>
          </THead>
          <TBody>
            {rows.map((d) => (
              <TR key={d.designer_id}>
                <TD className="font-medium text-fg">{d.designer_name ?? '—'}</TD>
                <TD className="tabular text-right">{d.active}</TD>
                <TD className="tabular text-right">{d.customers}</TD>
                <TD className="tabular text-right">{d.orders}</TD>
                <TD className="tabular text-right">{d.conversion === null ? '—' : `${d.conversion}%`}</TD>
                {showMoney && <TD className="tabular text-right">{money(d.order_value)}</TD>}
                <TD className="tabular text-right">{d.installed}</TD>
                <TD className="tabular text-right">{d.lost}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      ) : (
        <EmptyState icon={UsersRound} title="No projects yet" />
      )}
    </Card>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Like the old sheet: all time by default, optionally one employee
  const [range, setRange] = useState(() => ({ preset: 'all', ...presetRange('all') }));
  const [designerId, setDesignerId] = useState('');
  const teamView = can.seeTeamStats(user);
  const { data: designers = [] } = useDesigners(teamView);
  const { data: stats, isPending, error } = useDashboardStats({ from: range.from, to: range.to, designer_id: designerId });

  const isProduction = hasRole(user, 'production');
  const isSupervisor = hasRole(user, 'supervisor');
  const showMoney = can.seeMoney(user);
  const funnelTitle = can.seeTeamStats(user) ? 'Sales funnel' : 'My funnel';

  return (
    <Page>
      <PageHeader
        title={`${greeting()}, ${user?.name?.split(' ')[0] ?? ''}`}
        description={isSupervisor ? 'Projects you supervise.' : "Here's how orders are moving."}
        actions={!isSupervisor && (
          <>
            {teamView && (
              <div className="w-48">
                <Select value={designerId} onChange={(e) => setDesignerId(e.target.value)} aria-label="Employee">
                  <option value="">All employees</option>
                  {designers.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.email})</option>)}
                </Select>
              </div>
            )}
            <DateRangePicker value={range} onChange={setRange} />
          </>
        )}
      />

      {error && <Alert>{error.message}</Alert>}

      {isPending ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-[118px] rounded-xl" />)}
        </div>
      ) : stats && (
        <>
          {!isSupervisor && <StaleAlert count={stats.stale} />}

          {isSupervisor ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="My projects" value={stats.total} icon={FolderKanban} tone="primary" />
              <StatCard label="In progress" value={stats.in_progress} icon={Clock} tone="warning" />
              <StatCard label="Installed" value={stats.installed} icon={CheckCircle2} tone="success" />
            </div>
          ) : isProduction ? (
            <ProductionKpis p={stats.production} />
          ) : (
            <>
              <OutcomeRow outcomes={stats.outcomes} showMoney={showMoney}
                filters={{ from: range.from, to: range.to, designer_id: designerId }} />
              <SalesKpis kpis={stats.kpis} prev={stats.kpis_previous ?? undefined} showMoney={showMoney} />
            </>
          )}

          <div className="grid gap-6 lg:grid-cols-5">
            {!isProduction && !isSupervisor && (
              <Card className="lg:col-span-3">
                <CardHeader title={funnelTitle} description="Of the customers who came in this range, how many reached each step. The small % is conversion from the step before." />
                <CardBody>
                  {stats.funnel[0]?.count ? <FunnelChart rows={stats.funnel} /> : <EmptyState icon={UsersRound} title="No new customers in this range" className="py-8" />}
                </CardBody>
              </Card>
            )}

            <Card className={isProduction || isSupervisor ? 'lg:col-span-5' : 'lg:col-span-2'}>
              <CardHeader title="Pipeline right now" description="Where every open project is waiting. Click a stage to see its projects." />
              <CardBody>
                <BarList
                  rows={stats.by_stage.filter((s) => !isProduction || s.owner === 'production')}
                  onSelect={(s) => navigate(`/projects?stage=${s.key}`)}
                />
              </CardBody>
            </Card>
          </div>

          {!isProduction && !isSupervisor && (
            <div className="grid grid-cols-2 gap-4">
              <StatCard label="Avg. days, token → order" value={stats.cycle.token_to_order_days ?? '—'} icon={Gauge} tone="neutral" hint="For orders placed in this range" />
              <StatCard label="Avg. days, order → installation" value={stats.cycle.order_to_installation_days ?? '—'} icon={Gauge} tone="neutral" hint="For installations in this range" />
            </div>
          )}

          {!isSupervisor && <StuckTable rows={stats.stuck} showDesigner={can.seeTeamStats(user)} />}

          {stats.by_designer && <DesignerTable rows={stats.by_designer} showMoney={showMoney} />}
        </>
      )}
    </Page>
  );
}
