/**
 * The demo API's project rules: stages, status, visibility, money hiding, stage validation.
 * This is what the real (Spring Boot) API must do too; see API.md at the project root.
 */

/** key: [label, owner, required fields]. The first required field of each stage is its date. */
export const STAGES = {
  token:               ['Token', 'designer', ['token_date', 'product_name']],
  initial_measurement: ['Initial Measurement', 'designer', ['initial_measurement_date']],
  design_finalization: ['Design Finalization', 'designer', ['design_finalization_date']],
  quotation:           ['Quotation Submission', 'designer', ['quotation_submission_date']],
  advance_payment:     ['Advance Payment', 'designer', ['advance_payment_received_date', 'advance_payment_received']],
  final_measurement:   ['Final Measurement', 'designer', ['final_measurement_date', 'project_value']],
  erp_order:           ['ERP Order', 'designer', ['erp_order_date', 'erp_order_number']],
  factory_production:  ['Factory Production Login', 'designer', ['factory_production_login_date']],
  production:          ['Production', 'production', ['production_date']],
  dispatch:            ['Dispatch', 'production', ['dispatch_date']],
  installation:        ['Installation', 'designer', ['installation_date']],
};
export const STAGE_KEYS = Object.keys(STAGES);

export const STAGE_REQUIRES = { installation: 'dispatch' };

export const STAGE_OPTIONAL_FIELDS = {
  token: ['token_amount', 'site_supervisor_token'],
  design_finalization: ['site_supervisor_design'],
  quotation: ['quotation_value'],
  production: ['production_status'],
};

export const SUPERVISOR_FIELDS = { token: 'site_supervisor_token', design_finalization: 'site_supervisor_design' };

export const REVISABLE_STAGES = ['design_finalization', 'quotation', 'advance_payment', 'final_measurement'];

export const MONEY_FIELDS = ['token_amount', 'quotation_value', 'advance_payment_received', 'project_value', 'erp_order_amount', 'erp_order_total'];

export const STALE_DAYS = 3;

/** Every project column the API returns. */
export const PROJECT_FIELDS = [
  'id', 'customer_name', 'assigned_designer_id', 'assigned_by', 'assigned_at',
  'product_name', 'token_date', 'token_amount', 'site_supervisor_token', 'initial_measurement_date',
  'design_finalization_date', 'site_supervisor_design', 'quotation_submission_date', 'quotation_value',
  'advance_payment_received', 'advance_payment_received_date', 'final_measurement_date', 'project_value',
  'erp_order_number', 'erp_order_id', 'erp_order_date', 'erp_party_name', 'erp_order_amount', 'erp_gst_rate', 'erp_order_total',
  'production_login_date', 'factory_production_login_date', 'dispatch_date', 'dispatch_status', 'dispatch_items',
  'installation_date', 'closed_on', 'closed_by', 'remark', 'lost_at', 'lost_reason', 'lost_by',
  'designer_updated_by', 'designer_updated_at', 'production_status', 'production_date', 'production_plan_number',
  'production_commitment_date', 'production_stages', 'production_plans', 'production_updated_by', 'production_updated_at',
  'created_by', 'created_at', 'updated_at', 'deleted_at',
];

// ─── Values ──────────────────────────────────────────────────────────────────

export const filled = (v) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);

/** True when $next differs from the stored $old (numbers compared by value). */
export function differs(old, next) {
  if (!filled(old) && !filled(next)) return false;
  if (!filled(old) || !filled(next)) return true;
  if (!isNaN(old) && !isNaN(next) && typeof old !== 'object') return Number(old) !== Number(next);
  return String(old) !== String(next);
}

export const display = (v) => (filled(v) ? String(v) : null);

/** Today (local) as YYYY-MM-DD; offset in days. */
export function today(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const nowIso = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86_400_000).toISOString();

export const dateOf = (iso) => (iso ? today(Math.round((new Date(iso.slice(0, 10)) - new Date(today())) / 86_400_000)) : null);

export const money = (n) => (n === null || n === undefined || n === '' ? null : Number(n).toFixed(2));

// ─── Stages ──────────────────────────────────────────────────────────────────

export const stagesOf = (owner) => STAGE_KEYS.filter((k) => STAGES[k][1] === owner);

export const fieldsOf = (keys) => keys.flatMap((k) => [...STAGES[k][2], ...(STAGE_OPTIONAL_FIELDS[k] ?? [])]);

export function stageComplete(key, value) {
  if (!STAGES[key][2].every((f) => filled(value(f)))) return false;
  return key !== 'production' || value('production_status') === 'completed';
}

export const stageOf = (p) => STAGE_KEYS.find((k) => !stageComplete(k, (f) => p[f])) ?? 'installed';

export function statusOf(p) {
  if (p.lost_at) return 'lost';
  if (p.closed_on) return 'closed';
  if (p.installation_date) return 'installed';
  const started = [...fieldsOf(STAGE_KEYS), 'remark'].some((f) => f !== 'production_status' && filled(p[f]));
  return started || p.production_status !== 'not_started' ? 'in_progress' : 'not_started';
}

export const inHand = (p) => !!p.advance_payment_received_date && !p.installation_date && !p.lost_at;

export const isStale = (p) => !p.installation_date && !p.lost_at && new Date(p.updated_at) < new Date(Date.now() - STALE_DAYS * 86_400_000);

// ─── Users ───────────────────────────────────────────────────────────────────

export const hasRole = (user, ...roles) => roles.includes(user.role);
export const canSeeMoney = (user) => hasRole(user, 'admin', 'manager', 'designer');
export const hasPermission = (user, perm) => (user.permissions ?? []).includes(perm);

export function visibleTo(user, p) {
  if (hasRole(user, 'admin', 'manager')) return true;
  const supervises = p.site_supervisor_token === user.name || p.site_supervisor_design === user.name;
  if (hasRole(user, 'designer')) return p.assigned_designer_id === user.id || supervises;
  if (hasRole(user, 'production')) return !!p.factory_production_login_date;
  if (hasRole(user, 'supervisor')) return supervises;
  return false;
}

/** Dashboard figures: a designer counts only their own projects, not the ones they supervise. */
export const reportableFor = (user, p) => (hasRole(user, 'designer') ? p.assigned_designer_id === user.id : visibleTo(user, p));

export const stripMoney = (obj) => Object.fromEntries(Object.entries(obj).filter(([k]) => !MONEY_FIELDS.includes(k)));

// ─── Stage rules (designer saves; designer stages never lock) ────────────────

/**
 * Returns { field: message } for the first problem, or {}:
 *  - a stage that gets data needs every earlier stage of the same owner complete;
 *  - a stage is either empty or has all its required fields;
 *  - a stage's date is not before the previous stage's, nor after the next one's
 *    (a revision may be dated after later stages);
 *  - a stage cannot be cleared while a later stage has data.
 */
export function stageErrors(project, changes, { revision = false } = {}) {
  const after = (f) => (f in changes ? changes[f] : project[f]);
  const label = (k) => STAGES[k][0];
  const hasData = (k, value) => STAGES[k][2].some((f) => filled(value(f)));
  const touched = STAGE_KEYS.filter((k) => fieldsOf([k]).some((f) => f in changes && differs(project[f], changes[f])));

  const neighbour = (keys) => {
    for (const k of keys) {
      const field = STAGES[k][2][0];
      if (filled(after(field))) return [k, after(field)];
    }
    return null;
  };

  for (const key of touched) {
    const index = STAGE_KEYS.indexOf(key);
    const required = STAGES[key][2];

    if (!hasData(key, after)) {
      const later = STAGE_KEYS.slice(index + 1).find((k) => hasData(k, after));
      if (later) return { [required[0]]: `${label(key)} cannot be cleared while ${label(later)} is filled.` };
      continue;
    }

    const missing = required.filter((f) => !filled(after(f)));
    if (missing.length) return { [missing[0]]: `${label(key)}: please fill ${missing.map((f) => f.replaceAll('_', ' ')).join(', ')}.` };

    const owner = STAGES[key][1];
    const incomplete = STAGE_KEYS.slice(0, index).find((k) => STAGES[k][1] === owner && !stageComplete(k, after));
    if (incomplete) return { [required[0]]: `Complete the ${label(incomplete)} step before ${label(key)}.` };

    const waitsFor = STAGE_REQUIRES[key];
    if (waitsFor && !stageComplete(waitsFor, after)) {
      return { [required[0]]: `${label(key)} can be entered once production has filled ${label(waitsFor)}.` };
    }

    // The ERP order date comes from the ERP as-is
    if (key === 'erp_order') continue;

    const date = after(required[0]);
    const created = dateOf(project.created_at);
    if (created && date < created) {
      return { [required[0]]: `${label(key)} date cannot be before the project was created (${created}).` };
    }

    const previous = neighbour(STAGE_KEYS.slice(0, index).reverse());
    if (previous && date < previous[1]) return { [required[0]]: `${label(key)} date cannot be before the ${label(previous[0])} date.` };

    const next = revision ? null : neighbour(STAGE_KEYS.slice(index + 1));
    if (next && date > next[1]) return { [required[0]]: `${label(key)} date cannot be after the ${label(next[0])} date.` };
  }

  return {};
}
