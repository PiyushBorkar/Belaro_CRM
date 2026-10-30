import { useState } from 'react';
import { ArrowRight, CalendarCheck, Check,ChevronLeft, ChevronRight, Drill, Hammer, History, Layers, Lock, Package, Paintbrush, Scissors, SearchCheck, ShieldAlert } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { formatCurrency, formatDate, toDateInput, today } from '../../../lib/format';
import { DISPATCH_STATUS, FACTORY_STAGES, isFilled, isLocked, isStageComplete, PRODUCTION_STATUS, STAGES as ALL_STAGES, waitingFor } from '../../../lib/pipeline';
import { useErpLookup, useProducts, useSupervisors } from '../../../services/queries';
import { Alert, Badge, Button, Card, CardHeader, Field, Input, Select } from '../../ui';
import { DispatchProgress } from './DispatchProgress';
import { InstallationPanel } from './InstallationPanel';
import { ClosingStep } from '../CloseOrderButton';

function formatValue(field, value) {
  if (!isFilled(value)) return '—';
  if (field.type === 'date') return formatDate(value);
  if (field.type === 'number' || field.format === 'currency') return formatCurrency(value);
  if (field.format === 'percent') return `${Number(value)}%`;
  if (field.type === 'status') return PRODUCTION_STATUS[value] ?? value;
  if (field.type === 'dispatch_status') return DISPATCH_STATUS[value] ?? value;
  return value;
}

// Initial form values for one stage; empty dates default to today (except ERP's, which the ERP fills).
// A revision starts blank: the designer enters the new version from scratch.
function initialForm(stage, project, blank = false) {
  const form = {};
  if (blank) {
    stage.fields.forEach((f) => { form[f.key] = ''; });
    return form;
  }
  stage.fields.forEach((f) => {
    if (f.type === 'date') form[f.key] = toDateInput(project[f.key]) || (f.key === 'erp_order_date' ? '' : today());
    else if (f.type === 'status') form[f.key] = project[f.key] ?? 'not_started';
    else form[f.key] = project[f.key] ?? '';
  });
  // Usually the same supervisor handles both visits
  if (stage.key === 'design_finalization' && !form.site_supervisor_design) {
    form.site_supervisor_design = project.site_supervisor_token ?? '';
  }
  // The project value starts from the quotation value (the quotation value itself never changes here)
  if (stage.key === 'final_measurement' && !isFilled(form.project_value)) {
    form.project_value = project.quotation_value ?? '';
  }
  return form;
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

// An automatic step (synced from the factory / ERP) can have data before it is reached — e.g. a partial
// dispatch while production is still running — so it can be opened to see that progress
const hasSyncedData = (stage, project) => !!stage.auto && stage.fields.some((f) => f.type !== 'status' && isFilled(project[f.key]));

function Stepper({ stages, project, currentIndex, selectedIndex, onSelect }) {
  return (
    <ol className="flex items-start overflow-x-auto border-b border-border bg-surface-muted/50 px-3 py-4 sm:px-5">
      {stages.map((stage, index) => {
        const done = isStageComplete(stage, project);
        const current = index === currentIndex;
        const reachable = done || current || hasSyncedData(stage, project);
        const selected = index === selectedIndex;

        return (
          <li key={stage.key} className="relative flex min-w-16 flex-1 flex-col items-center">
            {index < stages.length - 1 && (
              <span className={cn('absolute top-3.5 left-1/2 h-0.5 w-full', done ? 'bg-success' : 'bg-border')} aria-hidden />
            )}
            <button
              type="button"
              disabled={!reachable}
              onClick={() => onSelect(index)}
              title={reachable ? stage.title : 'Complete the previous step first'}
              className={cn('relative z-10 flex flex-col items-center gap-1.5 px-1', reachable ? 'cursor-pointer' : 'cursor-not-allowed')}
            >
              <span
                className={cn(
                  'flex size-7 items-center justify-center rounded-full text-[11px] font-semibold transition',
                  done && 'bg-success text-on-color',
                  current && !done && 'bg-primary text-primary-fg ring-4 ring-primary-soft',
                  !done && !current && reachable && 'border-2 border-primary bg-primary-soft text-primary-soft-fg',
                  !reachable && 'border border-border-strong bg-surface text-fg-subtle',
                  selected && 'outline-2 outline-offset-2 outline-primary',
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
              </span>
              <span className={cn('hidden text-center text-[11px] leading-tight font-medium sm:block', selected ? 'text-fg' : 'text-fg-subtle')}>
                {stage.short}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// ─── ERP order number input with "check in ERP" ───────────────────────────────

function ErpNumberInput({ id, value, onChange, onFound, error }) {
  const lookup = useErpLookup();
  const result = lookup.data;

  function check() {
    if (!value.trim()) return;
    lookup.mutate(value.trim(), { onSuccess: (res) => res.status === 'found' && onFound(res) });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input id={id} value={value} onChange={(e) => { lookup.reset(); onChange(e); }} placeholder="e.g. SO-10234" aria-invalid={!!error} className="tabular" />
        <Button variant="secondary" icon={SearchCheck} onClick={check} loading={lookup.isPending} disabled={!value.trim()}>Check</Button>
      </div>
      {result && (
        <p className={cn('text-xs', result.status === 'found' ? 'text-success' : result.status === 'not_found' ? 'text-danger' : 'text-fg-muted')}>
          {result.status === 'found'
            ? `Found in the ERP — ${[
                result.party_name,
                result.order_amount != null && (result.order_total != null
                  ? `${formatCurrency(result.order_amount)} + ${Number(result.gst_rate)}% GST = ${formatCurrency(result.order_total)}`
                  : formatCurrency(result.order_amount)),
                `order date ${formatDate(result.order_date)}`,
              ].filter(Boolean).join(', ')}.`
            : result.message}
        </p>
      )}
      {lookup.error && <p className="text-xs text-danger">{lookup.error.message}</p>}
    </div>
  );
}

// ─── Factory stages (from the planning system) ────────────────────────────────

const STAGE_ICONS = { cutting: Scissors, binding: Layers, painting: Paintbrush, cnc: Drill, assembly: Hammer, packing: Package };

const FACTORY_STATUS = {
  done:        { text: 'Done',        dot: 'bg-success text-on-color',                       card: 'border-success/30 bg-success-soft/60' },
  in_progress: { text: 'In progress', dot: 'bg-primary text-primary-fg ring-4 ring-primary-soft', card: 'border-primary/40 bg-primary-soft/50 shadow-sm' },
  not_started: { text: 'Up next',     dot: 'border border-dashed border-border-strong bg-surface text-fg-subtle', card: 'border-border bg-surface/60' },
  skipped:     { text: 'Not needed',  dot: 'bg-surface-sunken text-fg-subtle',               card: 'border-border bg-surface/40 opacity-60' },
};

// One plan's stages as a thin bar: done / in progress / not started / not needed
const PLAN_SEGMENT = { done: 'bg-success', in_progress: 'bg-primary', not_started: 'bg-surface-sunken', skipped: 'bg-border' };

/** Where one plan stands: packed, not on the floor yet, or the stage it is at. */
function planState(plan) {
  if (plan.completed_on) return { tone: 'success', text: `Packed ${formatDate(plan.completed_on)}` };
  if (!plan.assigned) return { tone: 'neutral', text: 'Not on the floor yet' };
  const atStage = FACTORY_STAGES.find(([key]) => ['in_progress', 'not_started'].includes(plan.stages[key]?.status));
  if (!atStage) return { tone: 'primary', text: 'In progress' };
  return plan.stages[atStage[0]].status === 'in_progress'
    ? { tone: 'primary', text: `In ${atStage[1].toLowerCase()}` }
    : { tone: 'neutral', text: `Next: ${atStage[1].toLowerCase()}` };
}

function FactoryPlans({ plans }) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-surface/60">
      {plans.map((plan) => {
        const state = planState(plan);
        return (
          <li key={plan.plan_number} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
            <div className="w-28 shrink-0">
              <p className="tabular text-sm font-semibold text-fg">{plan.plan_number}</p>
              <p className="tabular text-[11px] text-fg-subtle">Planned {plan.plan_date ? formatDate(plan.plan_date) : '—'}</p>
            </div>
            <ol className="flex min-w-40 flex-1 items-center gap-1">
              {FACTORY_STAGES.map(([key, label]) => {
                const status = plan.stages[key]?.status ?? 'not_started';
                const text = `${label}: ${FACTORY_STATUS[status]?.text ?? status}`;
                return (
                  <li key={key} title={text} className={cn('h-1.5 flex-1 rounded-full', PLAN_SEGMENT[status])}>
                    <span className="sr-only">{text}</span>
                  </li>
                );
              })}
            </ol>
            <Badge tone={state.tone}>{state.text}</Badge>
          </li>
        );
      })}
    </ul>
  );
}

function FactoryStages({ stages, plans = [] }) {
  const multiPlan = plans.length > 1;
  const packedPlans = plans.filter((p) => p.completed_on).length;
  const all = FACTORY_STAGES.map(([key, label]) => ({ key, label, ...(stages?.[key] ?? { status: 'not_started' }) }));
  const needed = all.filter((s) => s.status !== 'skipped');
  const doneCount = needed.filter((s) => s.status === 'done').length;
  const active = all.find((s) => s.status === 'in_progress');
  const pct = needed.length ? Math.round((doneCount / needed.length) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Summary: optimistic headline + mini progress bar */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-fg">
          {multiPlan && doneCount !== needed.length
            ? <><span className="text-primary">{packedPlans} of {plans.length} plans</span> packed</>
            : active ? <>Your order is in <span className="text-primary">{active.label.toLowerCase()}</span></> : doneCount === needed.length ? 'All factory work complete 🎉' : 'Queued at the factory'}
        </p>
        <p className="tabular text-xs text-fg-subtle">{doneCount} of {needed.length} stages</p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
        <div className="h-full rounded-full bg-gradient-to-r from-success to-primary transition-all duration-700" style={{ width: `${Math.max(pct, active ? 8 : 0)}%` }} />
      </div>

      {/* Stage line */}
      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {all.map((s, i) => {
          const st = FACTORY_STATUS[s.status] ?? FACTORY_STATUS.not_started;
          const Icon = STAGE_ICONS[s.key];
          return (
            <li key={s.key} className={cn('relative flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition', st.card)}>
              <span className={cn('relative flex size-9 items-center justify-center rounded-full', st.dot)}>
                {s.status === 'done' ? <Check className="size-4" strokeWidth={3} /> : <Icon className="size-4" />}
                {s.status === 'in_progress' && <span className="absolute -top-0.5 -right-0.5 flex size-2.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" /><span className="relative inline-flex size-2.5 rounded-full bg-primary" /></span>}
              </span>
              <p className="text-xs font-semibold text-fg">{s.label}</p>
              <p className={cn('text-[11px]', s.status === 'done' ? 'text-success-soft-fg' : s.status === 'in_progress' ? 'font-medium text-primary-soft-fg' : 'text-fg-subtle')}>
                {multiPlan && s.status !== 'skipped' && s.total_plans
                  ? `${s.done_plans} of ${s.total_plans} plans`
                  : s.completed_on ? formatDate(s.completed_on) : st.text}
              </p>
              {i < all.length - 1 && <span className="absolute top-1/2 -right-2 hidden h-0.5 w-2 bg-border-strong sm:block" aria-hidden />}
            </li>
          );
        })}
      </ol>

      {/* An order split over several plans: where each one is */}
      {multiPlan && (
        <div className="space-y-2 pt-1">
          <p className="text-xs font-medium text-fg-subtle">{plans.length} plans</p>
          <FactoryPlans plans={plans} />
        </div>
      )}
    </div>
  );
}

// ─── Stage form ───────────────────────────────────────────────────────────────

// revision — a new version of a revisable stage: starts blank, sent with "revise" (earlier versions are kept)
function StageForm({ project, stage, previousDate, showMoney, mutation, overrideNotice, isCurrent, isLast, revision = false, onCancel, onSaved }) {
  const [form, setForm] = useState(() => initialForm(stage, project, revision));
  const [localError, setLocalError] = useState('');
  const needsProducts = stage.fields.some((f) => f.optionsFrom === 'products');
  const needsSupervisors = stage.fields.some((f) => f.optionsFrom === 'supervisors');
  const { data: products = [] } = useProducts(needsProducts);
  const { data: supervisors = [] } = useSupervisors(needsSupervisors);
  const options = { products, supervisors };

  const fields = stage.fields.filter((f) => showMoney || !f.money);
  const setValue = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const set = (key) => (e) => setValue(key, e.target.value);
  const fieldErrors = mutation.error?.errors ?? {};

  function handleSubmit(e) {
    e.preventDefault();
    const missing = fields.filter((f) => (f.required || f.mandatory) && f.type !== 'status' && !isFilled(form[f.key]) && f.key !== 'erp_order_date');
    if (missing.length) {
      setLocalError(`Please fill ${missing.map((f) => f.label).join(', ')}.`);
      return;
    }
    setLocalError('');
    const payload = Object.fromEntries(fields.map((f) => [f.key, form[f.key] === '' ? null : form[f.key]]));
    mutation.mutate(revision ? { ...payload, revise: stage.key } : payload, { onSuccess: onSaved });
  }

  const generalError = localError || (mutation.error && !Object.keys(fieldErrors).length ? mutation.error.message : '');

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {overrideNotice && <Alert tone="warning">{overrideNotice}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const error = fieldErrors[field.key]?.[0];
          const hint =
            field.type === 'number' && isFilled(form[field.key]) ? formatCurrency(form[field.key])
              : field.key === 'erp_order_date' || field.type === 'erp_info' ? 'Fetched from the ERP when you check the order number.'
                : undefined;

          return (
            <Field key={field.key} label={field.label} required={(field.required || field.mandatory) && field.key !== 'erp_order_date'} error={error} hint={hint}>
              {(id) =>
                field.key === 'erp_order_date' ? (
                  // Read-only: the date always comes from the ERP lookup
                  <p id={id} className="tabular flex h-10 items-center text-sm font-medium">
                    {isFilled(form[field.key]) ? formatDate(form[field.key]) : <span className="text-fg-subtle">Check the order number to fetch the date</span>}
                  </p>
                ) : field.type === 'erp_info' ? (
                  // Read-only: filled from the ERP lookup
                  <p id={id} className={cn('flex h-10 items-center truncate text-sm font-medium', field.format && 'tabular')}>
                    {isFilled(form[field.key])
                      ? formatValue(field, form[field.key])
                      : <span className="text-fg-subtle">Check the order number to fetch this</span>}
                  </p>
                ) : field.type === 'erp' ? (
                  <ErpNumberInput
                    id={id}
                    value={form[field.key]}
                    onChange={set(field.key)}
                    onFound={(res) => setForm((f) => ({
                      ...f,
                      erp_order_date: res.order_date,
                      erp_party_name: res.party_name ?? '',
                      erp_order_amount: res.order_amount ?? '',
                      erp_gst_rate: res.gst_rate ?? '',
                      erp_order_total: res.order_total ?? '',
                    }))}
                    error={error}
                  />
                ) : field.type === 'select' ? (
                  <Select id={id} value={form[field.key]} onChange={set(field.key)} aria-invalid={!!error}>
                    <option value="">{field.placeholder}</option>
                    {/* Keep an old value visible even if it's no longer in the list */}
                    {isFilled(form[field.key]) && !options[field.optionsFrom].some((o) => o.name === form[field.key]) && (
                      <option value={form[field.key]}>{form[field.key]}</option>
                    )}
                    {field.optionsFrom === 'supervisors' ? (
                      // Supervisors and designers can both be named site supervisor
                      [['supervisor', 'Site supervisors'], ['designer', 'Designers']].map(([role, label]) => (
                        <optgroup key={role} label={label}>
                          {options.supervisors.filter((o) => o.role === role).map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
                        </optgroup>
                      ))
                    ) : (
                      options[field.optionsFrom].map((o) => <option key={o.id} value={o.name}>{o.name}</option>)
                    )}
                  </Select>
                ) : field.type === 'status' ? (
                  <Select id={id} value={form[field.key]} onChange={set(field.key)}>
                    {Object.entries(PRODUCTION_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </Select>
                ) : (
                  <Input
                    id={id}
                    type={field.type}
                    value={form[field.key]}
                    onChange={set(field.key)}
                    placeholder={field.placeholder}
                    inputMode={field.type === 'number' ? 'decimal' : undefined}
                    min={field.type === 'number' ? 0 : field.type === 'date' ? previousDate : undefined}
                    step={field.type === 'number' ? '0.01' : undefined}
                    aria-invalid={!!error}
                    className="tabular"
                  />
                )
              }
            </Field>
          );
        })}
      </div>

      {generalError && <Alert>{generalError}</Alert>}

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-fg-subtle"><span className="text-danger">*</span> Required</p>
        <div className="flex gap-2">
          {onCancel && <Button variant="secondary" onClick={onCancel} disabled={mutation.isPending}>Cancel</Button>}
          <Button type="submit" loading={mutation.isPending}>
            {revision
              ? (isLast ? 'Save revision' : <>Save revision & next <ArrowRight className="size-4" /></>)
              : isCurrent && !isLast ? <>Save & continue <ArrowRight className="size-4" /></> : 'Save changes'}
          </Button>
        </div>
      </div>
    </form>
  );
}

// ─── Revisions ────────────────────────────────────────────────────────────────

/** Earlier versions of a revised stage, newest first (the project holds the current one). */
function RevisionHistory({ stage, revisions, showMoney }) {
  if (!revisions.length) return null;
  const fields = stage.fields.filter((f) => showMoney || !f.money);

  return (
    <section className="space-y-2">
      <h5 className="text-xs font-medium text-fg-subtle">Earlier versions</h5>
      <ol className="space-y-2">
        {[...revisions].reverse().map((r) => (
          <li key={r.id} className="rounded-xl border border-dashed border-border-strong bg-surface/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge tone="neutral">Version {r.version}</Badge>
              <p className="text-[11px] text-fg-subtle">Revised {formatDate(r.created_at)}{r.replaced_by?.name ? ` by ${r.replaced_by.name}` : ''}</p>
            </div>
            <dl className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fields.filter((f) => f.key in r.values).map((f) => (
                <div key={f.key} className="min-w-0">
                  <dt className="text-xs text-fg-subtle">{f.label}</dt>
                  <dd className="tabular mt-0.5 truncate text-sm text-fg-muted">{formatValue(f, r.values[f.key])}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ─── Pipeline card ────────────────────────────────────────────────────────────

/**
 * A run of stages owned by one role (designer or production).
 *  editable       — the user may fill these stages
 *  lockable       — a stage locks once the next one is filled (production); designer stages never lock
 *  canBypassLocks — the user may change stages that are locked (production head)
 */
export function StagePipeline({ title, description, icon, stages, project, editable, lockable = true, canBypassLocks, showMoney, mutation, waitingText, lockedText, overrideText }) {
  // null = follow the current step; a number = the step the user clicked
  const [activeIndex, setActiveIndex] = useState(null);
  const [editing, setEditing] = useState(false);
  const [revising, setRevising] = useState(false);

  const firstIncomplete = stages.findIndex((s) => !isStageComplete(s, project));
  const allDone = firstIncomplete === -1;
  const currentIndex = allDone ? -1 : firstIncomplete;
  const completedCount = stages.filter((s) => isStageComplete(s, project)).length;
  const progress = Math.round((completedCount / stages.length) * 100);

  const selectedIndex = activeIndex ?? (allDone ? stages.length - 1 : currentIndex);
  const stage = stages[selectedIndex];
  const isCurrent = selectedIndex === currentIndex;
  const done = isStageComplete(stage, project);
  const locked = lockable && isLocked(stages, selectedIndex, project);
  // A stage waiting for the other team (Installation until production dispatches) can't be filled yet
  const waitsFor = waitingFor(stage, project);
  // A stage filled by the system (Production, from the planning system) is never edited by hand
  const canEditThis = editable && !stage.auto && !waitsFor && (!locked || canBypassLocks);

  // A stage's date cannot be earlier than the previous stage's, nor than the day the project was
  // created (StageRules); the calendar greys out everything before the later of the two
  const prevDateField = selectedIndex > 0 && stages[selectedIndex - 1].fields.find((f) => f.type === 'date');
  const prevStageDate = prevDateField ? toDateInput(project[prevDateField.key]) : '';
  const createdDate = toDateInput(project.created_at);
  // …and not before the stage it waits for (Installation not before Dispatch)
  const requiredDateField = stage.requires && ALL_STAGES.find((s) => s.key === stage.requires).fields.find((f) => f.type === 'date');
  const requiredDate = requiredDateField ? toDateInput(project[requiredDateField.key]) : '';
  const previousDate = [prevStageDate, createdDate, requiredDate].filter(Boolean).sort().at(-1); // YYYY-MM-DD sorts as dates

  // Revisable stages are revised (a new version, earlier ones kept) instead of edited in place
  const revisions = stage.revisable ? (project.stage_revisions ?? []).filter((r) => r.stage === stage.key) : [];

  function select(index) {
    if (index < 0 || index >= stages.length) return;
    if (!isStageComplete(stages[index], project) && index !== currentIndex && !hasSyncedData(stages[index], project)) return; // not reached yet
    mutation.reset();
    setEditing(false);
    setRevising(false);
    setActiveIndex(index);
  }

  function reset() {
    mutation.reset();
    setEditing(false);
    setRevising(false);
    setActiveIndex(null);
  }

  // After a revision, move on to the next step (it may need revising too)
  function revised() {
    setRevising(false);
    if (selectedIndex + 1 < stages.length) setActiveIndex(selectedIndex + 1);
  }

  // The current step opens straight into its form; completed steps need "Edit"
  const showForm = canEditThis && (editing || (isCurrent && !done));

  return (
    <Card className="overflow-hidden">
      <CardHeader
        icon={icon}
        title={title}
        description={description}
        actions={
          <div className="text-right">
            <p className="tabular text-sm font-semibold text-fg">{completedCount}/{stages.length}</p>
            <p className="text-[11px] text-fg-subtle">steps done</p>
          </div>
        }
      />

      <div className="h-1 bg-surface-sunken">
        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <Stepper stages={stages} project={project} currentIndex={currentIndex} selectedIndex={selectedIndex} onSelect={select} />

      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium text-fg-subtle">Step {selectedIndex + 1} of {stages.length}</p>
              {done ? <Badge tone="success">Completed</Badge> : isCurrent && <Badge tone="primary">Current</Badge>}
              {locked && <Badge tone="neutral"><Lock className="size-3" />Locked</Badge>}
            </div>
            <h4 className="mt-1 text-base font-semibold text-fg">{stage.title}</h4>
            {stage.hint && <p className="mt-0.5 text-[13px] text-fg-muted">{stage.hint}</p>}
          </div>
          <div className="flex shrink-0 gap-1">
            <Button variant="secondary" size="icon-sm" icon={ChevronLeft} onClick={() => select(selectedIndex - 1)} disabled={selectedIndex === 0} aria-label="Previous step" />
            <Button variant="secondary" size="icon-sm" icon={ChevronRight} onClick={() => select(selectedIndex + 1)} disabled={selectedIndex === stages.length - 1} aria-label="Next step" />
          </div>
        </div>

        {stage.closing ? (
          <ClosingStep project={project} />
        ) : stage.itemized && !waitsFor ? (
          // Installation: a date per dispatched item instead of one date for the step
          <InstallationPanel project={project} editable={editable && !project.lost_at} />
        ) : showForm ? (
          <StageForm
            // Remount (fresh values, cleared errors) when the step or the saved project changes
            key={`${stage.key}-${project.updated_at}`}
            project={project}
            stage={stage}
            previousDate={previousDate}
            showMoney={showMoney}
            mutation={mutation}
            overrideNotice={locked ? overrideText : null}
            isCurrent={isCurrent}
            isLast={selectedIndex === stages.length - 1}
            onCancel={editing || activeIndex !== null ? reset : undefined}
            onSaved={reset}
          />
        ) : done || ((isCurrent || stage.auto) && stage.fields.some((f) => f.type !== 'status' && isFilled(project[f.key]))) ? (
          <div className="space-y-4">
          {/* A new version opens above the current one, blank */}
          {revising && (
            <div className="rounded-xl border border-primary/40 bg-primary-soft/30 p-4">
              <p className="mb-3 text-sm font-semibold text-fg">New version · Version {revisions.length + 2}</p>
              <StageForm
                key={`${stage.key}-revise`}
                project={project}
                stage={stage}
                previousDate={previousDate}
                showMoney={showMoney}
                mutation={mutation}
                isLast={selectedIndex === stages.length - 1}
                revision
                onCancel={() => { mutation.reset(); setRevising(false); }}
                onSaved={revised}
              />
            </div>
          )}
          <div className="rounded-xl border border-border bg-surface-muted/50 p-4">
            {stage.revisable && revisions.length > 0 && (
              <div className="mb-3 flex items-center gap-2">
                <Badge tone="success">Version {revisions.length + 1} · current</Badge>
              </div>
            )}
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stage.fields.filter((f) => !['stages', 'items'].includes(f.type) && f.key !== 'production_commitment_date' && (showMoney || !f.money) && isFilled(project[f.key])).map((f) => (
                <div key={f.key} className="min-w-0">
                  <dt className="text-xs font-medium text-fg-subtle">{f.label}</dt>
                  <dd className="tabular mt-1 truncate text-sm font-medium text-fg">{formatValue(f, project[f.key])}</dd>
                </div>
              ))}
            </dl>
            {/* The factory's promised date, shown even before the factory sets it */}
            {stage.key === 'production' && (
              <div className={cn('mt-4 flex items-center gap-3 rounded-lg border px-3 py-2.5',
                project.production_commitment_date ? 'border-success/25 bg-success-soft/50' : 'border-dashed border-border-strong')}>
                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full',
                  project.production_commitment_date ? 'bg-success text-on-color' : 'bg-surface-sunken text-fg-subtle')}>
                  <CalendarCheck className="size-4" />
                </span>
                <div>
                  <p className="text-xs text-fg-subtle">Committed completion date</p>
                  {project.production_commitment_date
                    ? <p className="tabular text-sm font-semibold text-success-soft-fg">On track for {formatDate(project.production_commitment_date)}</p>
                    : <p className="text-sm text-fg-muted">The factory will confirm a date soon</p>}
                </div>
              </div>
            )}
            {stage.fields.filter((f) => ['stages', 'items'].includes(f.type) && isFilled(project[f.key])).map((f) => (
              <div key={f.key} className="mt-4 border-t border-border pt-4">
                <p className="mb-2 text-xs font-medium text-fg-subtle">{f.label}</p>
                {f.type === 'stages' ? <FactoryStages stages={project[f.key]} plans={project.production_plans ?? []} /> : <DispatchProgress items={project[f.key]} />}
              </div>
            ))}
            {canEditThis && stage.revisable ? (
              !revising && (
                <div className="mt-4 flex justify-end">
                  <Button variant="secondary" size="sm" icon={History} onClick={() => { mutation.reset(); setActiveIndex(selectedIndex); setRevising(true); }}>
                    Revise
                  </Button>
                </div>
              )
            ) : canEditThis ? (
              <div className="mt-4 flex justify-end">
                <Button variant="secondary" size="sm" icon={locked ? ShieldAlert : undefined} onClick={() => { setActiveIndex(selectedIndex); setEditing(true); }}>
                  {locked ? 'Correct this step' : 'Edit this step'}
                </Button>
              </div>
            ) : editable && locked && (
              <p className="mt-4 flex items-center gap-1.5 text-xs text-fg-subtle"><Lock className="size-3" />{lockedText}</p>
            )}
          </div>
          <RevisionHistory stage={stage} revisions={revisions} showMoney={showMoney} />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border-strong p-6 text-center text-[13px] text-fg-muted">
            {waitsFor ? (
              <>
                <p className="font-medium text-fg">Waiting for the first {waitsFor.title.toLowerCase()}.</p>
                <p className="mt-1">{stage.title} opens here as soon as items are dispatched.</p>
              </>
            ) : stage.auto ? stage.waiting : waitingText}
          </div>
        )}

        {done && !showForm && !revising && currentIndex === selectedIndex + 1 && editable && !waitingFor(stages[selectedIndex + 1], project) && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-primary-soft px-4 py-3">
            <div>
              <p className="text-[13px] font-semibold text-primary-soft-fg">Next: {stages[selectedIndex + 1].title}</p>
              <p className="text-xs text-primary-soft-fg/80">Complete it to continue.</p>
            </div>
            <Button size="sm" onClick={() => select(selectedIndex + 1)}>Continue<ArrowRight className="size-3.5" /></Button>
          </div>
        )}
      </div>
    </Card>
  );
}
