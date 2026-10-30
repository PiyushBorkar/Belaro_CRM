import { ArrowRight } from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/format';
import { PRODUCTION_STATUS } from '../../lib/pipeline';
import { useProjectTracking } from '../../services/queries';
import { Alert, Skeleton } from '../ui';

// Field names as people say them on the project page
const FIELD_LABELS = {
  customer_name: 'Customer name',
  product_name: 'Product',
  token_date: 'Token date',
  token_amount: 'Token amount',
  site_supervisor_token: 'Site supervisor (token)',
  initial_measurement_date: 'Initial measurement',
  design_finalization_date: 'Design finalised',
  site_supervisor_design: 'Site supervisor (design)',
  quotation_submission_date: 'Quotation sent',
  quotation_value: 'Quotation value',
  advance_payment_received_date: 'Advance date',
  advance_payment_received: 'Advance amount',
  final_measurement_date: 'Final measurement',
  project_value: 'Project value',
  erp_order_number: 'ERP order number',
  erp_order_date: 'ERP order date',
  erp_party_name: 'Party name',
  erp_order_amount: 'ERP order amount',
  erp_gst_rate: 'GST',
  erp_order_total: 'ERP order total (incl. GST)',
  production_login_date: 'Production login',
  factory_production_login_date: 'Factory production login date',
  production_status: 'Production status',
  production_date: 'Production date',
  production_plan_number: 'Plan number',
  production_commitment_date: 'Committed completion date',
  production_stages: 'Factory stages',
  production_plans: 'Factory plans',
  dispatch_date: 'Dispatch date',
  dispatch_status: 'Dispatch status',
  dispatch_items: 'Dispatched items',
  installation_date: 'Installation date',
  installation: 'Installation',
  closed_on: 'Order closed on',
  remark: 'Remark',
  lost_reason: 'Reason lost',
};

// Recorded with reassignments, but only as IDs; the note already names the new designer
const HIDDEN_FIELDS = ['assigned_designer_id'];

// "erp_order_number" → "ERP order number"
function label(field) {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  const text = field.replaceAll('_', ' ').replace(/\berp\b/g, 'ERP');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Stored values → what people read
function display(field, value) {
  if (value === null || value === undefined || value === '') return null;
  if (field === 'production_status') return PRODUCTION_STATUS[value] ?? value;
  if (field === 'erp_gst_rate') return `${Number(value)}%`;
  if (['token_amount', 'quotation_value', 'advance_payment_received', 'project_value', 'erp_order_amount', 'erp_order_total'].includes(field)) return formatCurrency(value);
  if (/_date$/.test(field)) return formatDate(value);
  return value;
}

// Old → new values recorded with a change. The new value is what matters, so it is the
// darkest text; a filled-in field shows just its value, a changed one shows old → new.
// Sized by its own width (container query), not the screen's: in the narrow project sidebar each
// label sits above its value; where there is room (the Activity page) they sit side by side.
export function ChangeList({ changes }) {
  const entries = Object.entries(changes ?? {}).filter(([field]) => !HIDDEN_FIELDS.includes(field));
  if (!entries.length) return null;

  return (
    <div className="@container mt-2">
      <ul className="grid gap-y-2.5 rounded-lg border border-border bg-surface-muted/50 px-3 py-2.5 text-[13px] @xs:grid-cols-[minmax(0,40%)_minmax(0,1fr)] @xs:gap-x-4 @xs:gap-y-1.5">
        {entries.map(([field, { old, new: next }]) => {
          const before = display(field, old);
          const after = display(field, next);
          return (
            <li key={field} className="flex min-w-0 flex-col gap-0.5 @xs:contents">
              <span className="text-xs text-fg-muted [overflow-wrap:anywhere] @xs:text-[13px]">{label(field)}</span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-1.5">
                {before !== null && (
                  <>
                    <span className="min-w-0 text-fg-subtle line-through [overflow-wrap:anywhere]">{before}</span>
                    <ArrowRight className="size-3.5 shrink-0 text-fg-subtle" aria-label="changed to" />
                  </>
                )}
                {after !== null
                  ? <span className="min-w-0 font-semibold text-fg [overflow-wrap:anywhere]">{after}</span>
                  : <span className="text-fg-subtle italic">cleared</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ProjectTrackingTimeline({ projectId }) {
  const { data: rows = [], isPending, error } = useProjectTracking(projectId);

  if (isPending) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-10" />)}
      </div>
    );
  }
  if (error) return <Alert>{error.message}</Alert>;
  if (!rows.length) return <p className="text-[13px] text-fg-subtle">No activity yet.</p>;

  return (
    <ol className="relative space-y-5">
      {/* vertical rail */}
      <span className="absolute top-2 bottom-2 left-[5px] w-px bg-border" aria-hidden />
      {rows.map((r, i) => (
        <li key={r.id} className="relative flex gap-3.5">
          <span className={`relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-surface ${i === 0 ? 'bg-primary' : 'bg-border-strong'}`} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] leading-5 text-fg [overflow-wrap:anywhere]">{r.note}</p>
            <ChangeList changes={r.changes} />
            <p className="mt-1 text-xs text-fg-subtle [overflow-wrap:anywhere]">
              <span className="font-medium text-fg-muted">{r.changed_by ? (r.changed_by_user?.name ?? 'Unknown') : 'System'}</span>
              <span className="capitalize"> · {r.role}</span> · {formatDateTime(r.created_at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
