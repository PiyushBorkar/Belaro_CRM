/**
 * Demo API: answers the same requests, with the same JSON, as the real API (API.md).
 * services/api.js sends requests here instead of the network when VITE_USE_MOCK is not "false".
 */
import { findOrder, FOUND, syncStep } from './erp';
import { getDb, nextId, saveDb } from './db';
import {
  MONEY_FIELDS, PROJECT_FIELDS, REVISABLE_STAGES, STAGES, STAGE_KEYS, SUPERVISOR_FIELDS,
  canSeeMoney, differs, display, fieldsOf, filled, hasPermission, hasRole, inHand, isStale, money, nowIso,
  reportableFor, stageComplete, stageErrors, stageOf, statusOf, stripMoney, today, visibleTo,
} from './model';

const MAX_AMOUNT = 9999999999.99;
const ROLES = ['admin', 'manager', 'designer', 'production', 'supervisor'];
const DELEGABLE = ['manage products', 'delete projects', 'fix production entries'];

class HttpError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

const fail = (status, message) => { throw new HttpError(status, message); };
const invalid = (errors) => {
  const first = Object.values(errors)[0];
  throw new HttpError(422, first, Object.fromEntries(Object.entries(errors).map(([f, m]) => [f, [m]])));
};

// ─── Presenters ──────────────────────────────────────────────────────────────

function userBrief(id) {
  const u = getDb().users.find((x) => x.id === id);
  return u ? { id: u.id, name: u.name } : null;
}

function authUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, is_active: u.is_active, roles: [u.role],
    permissions: u.role === 'manager' ? [...new Set(['manage products', 'delete projects', ...u.permissions])] : u.permissions,
    created_at: u.created_at,
  };
}

function presentProject(p, viewer, { detail = false } = {}) {
  const db = getDb();
  const data = { ...p, status: statusOf(p), stage: stageOf(p), in_hand: inHand(p), assigned_designer: userBrief(p.assigned_designer_id) };
  if (detail) {
    data.creator = userBrief(p.created_by);
    data.installations = db.installations.filter((i) => i.project_id === p.id).map(({ id, project_id, erp_sale_id, installed_on }) => ({ id, project_id, erp_sale_id, installed_on }));
    data.stage_revisions = db.revisions.filter((r) => r.project_id === p.id)
      .sort((a, b) => a.stage.localeCompare(b.stage) || a.version - b.version)
      .map((r) => ({ ...r, replaced_by: userBrief(r.replaced_by) }));
  }
  if (!canSeeMoney(viewer)) {
    MONEY_FIELDS.forEach((f) => delete data[f]);
    data.stage_revisions = data.stage_revisions?.map((r) => ({ ...r, values: stripMoney(r.values) }));
  }
  return data;
}

function presentTracking(t, viewer) {
  const changes = t.changes && !canSeeMoney(viewer) ? stripMoney(t.changes) : t.changes;
  return { ...t, changes, updated_at: t.created_at, changed_by_user: t.changed_by ? userBrief(t.changed_by) : null };
}

// ─── Shared actions ──────────────────────────────────────────────────────────

function track(p, user, note, changes = null) {
  getDb().trackings.push({
    id: nextId('trackings'), project_id: p.id, changed_by: user?.id ?? null, role: user?.role ?? 'system',
    note, changes: changes && Object.keys(changes).length ? changes : null, created_at: nowIso(),
  });
}

function notify(userId, type, p, title, body) {
  getDb().notifications.push({ id: crypto.randomUUID(), user_id: userId, type, project_id: p.id, title, body, read_at: null, created_at: nowIso() });
}

function update(p, values) {
  Object.assign(p, values, { updated_at: nowIso() });
}

function diff(p, values) {
  return Object.fromEntries(Object.entries(values)
    .filter(([f, v]) => differs(p[f], v))
    .map(([f, v]) => [f, { old: display(p[f]), new: display(v) }]));
}

const fieldList = (changes) => Object.keys(changes).map((f) => f.replaceAll('_', ' ')).join(', ');

/** Every dispatched quantity of the order, by sale_id. */
const dispatchedRows = (p) => new Map((p.dispatch_items ?? []).flatMap((item) =>
  (item.dispatches ?? []).map((row) => [row.sale_id, { ...row, line_id: item.line_id, product: item.product }])));

/** Installed once everything is dispatched and installed; a closed order that no longer is opens again. */
function refreshInstallationDate(p) {
  const rows = dispatchedRows(p);
  const dates = new Map(getDb().installations.filter((i) => i.project_id === p.id).map((i) => [i.erp_sale_id, i.installed_on]));
  const complete = p.dispatch_status === 'dispatched' && rows.size > 0 && [...rows.keys()].every((id) => dates.has(id));
  p.installation_date = complete ? [...dates.values()].sort().at(-1) : null;
  if (!complete) Object.assign(p, { closed_on: null, closed_by: null });
}

/** One factory / ERP sync step for every ordered project (the real API runs this every 15 minutes). */
export function runSync() {
  const db = getDb();
  let changed = false;
  db.projects.forEach((p) => {
    const result = syncStep(p, () => nextId('sale'));
    if (!result) return;
    const changes = diff(p, result.changes);
    update(p, result.changes);
    refreshInstallationDate(p);
    // Factory stage details are long; the timeline shows the note instead
    delete changes.production_stages;
    delete changes.production_plans;
    delete changes.dispatch_items;
    track(p, null, result.note, changes);
    if (result.events.includes('planned')) {
      db.users.filter((u) => u.role === 'production' && u.is_active).forEach((u) =>
        notify(u.id, 'ready_for_production', p, `New order for production: ${p.customer_name}`,
          `${p.product_name ? `${p.product_name}. ` : ''}Planned in the factory on ${today()}.`));
    }
    if (result.events.includes('dispatched') && p.assigned_designer_id) {
      notify(p.assigned_designer_id, 'ready_for_installation', p, `Dispatched: ${p.customer_name}`,
        'Items are on their way (ERP invoice). Enter installation dates as they are installed.');
    }
    changed = true;
  });
  if (changed) saveDb();
  return changed;
}

// ─── Policies ────────────────────────────────────────────────────────────────

const isOwnDesigner = (user, p) => hasRole(user, 'designer') && p.assigned_designer_id === user.id;
const notLost = (p) => p.lost_at && fail(403, 'This order is marked as lost. Reopen it to make changes.');

function canEditDesigner(user, p) {
  notLost(p);
  if (hasRole(user, 'manager')) return;
  if (!hasRole(user, 'designer')) fail(403, 'This action is unauthorized.');
  if (p.assigned_designer_id !== user.id) fail(403, 'This project is not assigned to you.');
  if (p.closed_on) fail(403, 'This order is closed. Only a manager can change it.');
}

// ─── Validation helpers ──────────────────────────────────────────────────────

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function readDate(body, field, errors, required = false) {
  const v = body[field];
  if (!filled(v)) {
    if (required) errors[field] = `The ${field.replaceAll('_', ' ')} field is required.`;
    return null;
  }
  if (!DATE.test(v) || isNaN(new Date(v))) errors[field] = `The ${field.replaceAll('_', ' ')} field must be a valid date.`;
  return v;
}

function readAmount(body, field, errors, label) {
  const v = body[field];
  if (!filled(v)) return null;
  const n = Number(v);
  if (isNaN(n)) errors[field] = `The ${field.replaceAll('_', ' ')} field must be a number.`;
  else if (n < 0) errors[field] = `The ${field.replaceAll('_', ' ')} field must be at least 0.`;
  else if (n > MAX_AMOUNT) errors[field] = `The ${label} is too large. Check the amount (₹999 crore at most).`;
  return money(n);
}

function readText(body, field, errors, max = 255, required = false) {
  const v = typeof body[field] === 'string' ? body[field].trim() : body[field];
  if (!filled(v)) {
    if (required) errors[field] = `The ${field.replaceAll('_', ' ')} field is required.`;
    return null;
  }
  if (String(v).length > max) errors[field] = `The ${field.replaceAll('_', ' ')} field must not be greater than ${max} characters.`;
  return String(v);
}

const DESIGNER_DATES = ['token_date', 'initial_measurement_date', 'design_finalization_date', 'quotation_submission_date', 'advance_payment_received_date', 'final_measurement_date'];
const DESIGNER_AMOUNTS = { token_amount: 'token amount', quotation_value: 'quotation value', advance_payment_received: 'advance', project_value: 'project value' };
const DESIGNER_TEXT = { product_name: 255, site_supervisor_token: 255, site_supervisor_design: 255, erp_order_number: 100, remark: 5000 };

// ─── Handlers ────────────────────────────────────────────────────────────────

function findProject(id, user, { trashed = false } = {}) {
  const p = getDb().projects.find((x) => x.id === Number(id));
  if (!p || (p.deleted_at && !trashed)) fail(404, 'Not found.');
  if (!visibleTo(user, p)) fail(403, 'This project is not assigned to you.');
  return p;
}

const handlers = {
  // Auth
  'POST /login': ({ body }) => {
    const db = getDb();
    const errors = {};
    readText(body, 'email', errors, 255, true);
    readText(body, 'password', errors, 255, true);
    if (Object.keys(errors).length) invalid(errors);
    const u = db.users.find((x) => x.email.toLowerCase() === String(body.email).trim().toLowerCase());
    if (!u || u.password !== body.password) fail(401, 'Invalid credentials.');
    if (!u.is_active) fail(403, 'Your account has been deactivated. Please contact your manager.');
    Object.keys(db.tokens).forEach((t) => db.tokens[t] === u.id && delete db.tokens[t]);
    const token = `${u.id}|${crypto.randomUUID().replaceAll('-', '')}`;
    db.tokens[token] = u.id;
    return { message: 'Login successful.', user: authUser(u), token, roles: [u.role] };
  },
  'POST /logout': ({ token }) => {
    delete getDb().tokens[token];
    return { message: 'Logged out successfully.' };
  },
  'GET /me': ({ user }) => ({ user: authUser(user), roles: [user.role] }),
  'POST /change-password': ({ user, body }) => {
    const errors = {};
    if (body.current_password !== user.password) errors.current_password = 'Current password is incorrect.';
    if (!filled(body.password) || String(body.password).length < 8) errors.password = 'The password field must be at least 8 characters.';
    else if (body.password !== body.password_confirmation) errors.password = 'The password field confirmation does not match.';
    if (Object.keys(errors).length) invalid(errors);
    user.password = body.password;
    return { message: 'Password updated successfully.' };
  },

  // Projects
  'GET /projects': ({ user, query }) => {
    const view = query.view || 'all';
    if (view === 'trashed' && !hasPermission(authUser(user), 'delete projects')) fail(403, 'This action is unauthorized.');
    const q = (query.q ?? '').toLowerCase();
    const dateField = query.date_field || 'created_at';
    let rows = getDb().projects
      .filter((p) => visibleTo(user, p))
      .filter((p) => (view === 'trashed' ? p.deleted_at : !p.deleted_at))
      .filter((p) => view !== 'stale' || isStale(p))
      .filter((p) => !q || p.customer_name.toLowerCase().includes(q) || (p.erp_order_number ?? '').toLowerCase().includes(q))
      .filter((p) => !query.designer_id || p.assigned_designer_id === Number(query.designer_id))
      .filter((p) => !query.product || p.product_name === query.product)
      .filter((p) => !query.production_status || p.production_status === query.production_status)
      .filter((p) => !query.from || (p[dateField] && p[dateField].slice(0, 10) >= query.from))
      .filter((p) => !query.to || (p[dateField] && p[dateField].slice(0, 10) <= query.to))
      .filter((p) => !query.status || (query.status === 'in_hand' ? inHand(p)
        : query.status === 'open' ? ['not_started', 'in_progress'].includes(statusOf(p)) : statusOf(p) === query.status))
      .filter((p) => !query.stage || stageOf(p) === query.stage);
    rows = view === 'stale'
      ? rows.sort((a, b) => a.updated_at.localeCompare(b.updated_at))
      : rows.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
    const staleCount = getDb().projects.filter((p) => !p.deleted_at && visibleTo(user, p) && isStale(p)).length;
    return { data: rows.map((p) => presentProject(p, user)), meta: { stale_count: staleCount } };
  },

  'POST /projects': ({ user, body }) => {
    if (!hasRole(user, 'manager', 'designer')) fail(403, 'This action is unauthorized.');
    const db = getDb();
    const errors = {};
    const name = readText(body, 'customer_name', errors, 255, true);
    let designer = user;
    if (hasRole(user, 'manager')) {
      designer = db.users.find((u) => u.id === Number(body.assigned_designer_id) && u.role === 'designer');
      if (!designer) errors.assigned_designer_id = 'Choose a designer.';
    }
    if (Object.keys(errors).length) invalid(errors);
    const p = Object.fromEntries(PROJECT_FIELDS.map((f) => [f, null]));
    Object.assign(p, {
      id: nextId('projects'), customer_name: name, assigned_designer_id: designer.id, assigned_by: user.id, assigned_at: nowIso(),
      created_by: user.id, created_at: nowIso(), updated_at: nowIso(), production_status: 'not_started',
    });
    db.projects.push(p);
    track(p, user, `Project created, assigned to ${designer.name}.`);
    if (designer.id !== user.id) notify(designer.id, 'project_assigned', p, `New project: ${p.customer_name}`, `Assigned to you by ${user.name}.`);
    return [201, { message: 'Project created.', data: presentProject(p, user) }];
  },

  'GET /projects/:id': ({ user, params }) => ({ data: presentProject(findProject(params.id, user, { trashed: true }), user, { detail: true }) }),

  'GET /projects/:id/tracking': ({ user, params }) => {
    const p = findProject(params.id, user, { trashed: true });
    return { data: getDb().trackings.filter((t) => t.project_id === p.id).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id).map((t) => presentTracking(t, user)) };
  },

  'PATCH /projects/:id/assign': ({ user, params, body }) => {
    const p = findProject(params.id, user);
    if (!hasRole(user, 'manager')) fail(403, 'This action is unauthorized.');
    notLost(p);
    const errors = {};
    const values = {};
    if ('customer_name' in body) values.customer_name = readText(body, 'customer_name', errors, 255, true);
    if ('assigned_designer_id' in body) {
      const designer = getDb().users.find((u) => u.id === Number(body.assigned_designer_id) && u.role === 'designer');
      if (!designer) errors.assigned_designer_id = 'Choose a designer.';
      else values.assigned_designer_id = designer.id;
    }
    if (Object.keys(errors).length) invalid(errors);
    const changes = diff(p, values);
    if (changes.assigned_designer_id) Object.assign(values, { assigned_by: user.id, assigned_at: nowIso() });
    update(p, values);
    if (changes.assigned_designer_id) {
      const designer = getDb().users.find((u) => u.id === p.assigned_designer_id);
      track(p, user, `Reassigned to ${designer.name}.`, changes);
      notify(designer.id, 'project_assigned', p, `New project: ${p.customer_name}`, `Assigned to you by ${user.name}.`);
    } else if (Object.keys(changes).length) {
      track(p, user, 'Customer name updated.', changes);
    }
    return { message: 'Project updated.', data: presentProject(p, user, { detail: true }) };
  },

  'PATCH /projects/:id/designer': ({ user, params, body }) => {
    const db = getDb();
    const p = findProject(params.id, user);
    canEditDesigner(user, p);

    // Field rules
    const errors = {};
    const values = {};
    DESIGNER_DATES.forEach((f) => f in body && (values[f] = readDate(body, f, errors)));
    Object.entries(DESIGNER_AMOUNTS).forEach(([f, label]) => f in body && (values[f] = readAmount(body, f, errors, label)));
    Object.entries(DESIGNER_TEXT).forEach(([f, max]) => f in body && (values[f] = readText(body, f, errors, max)));
    const revise = body.revise ?? null;
    if (revise !== null && !REVISABLE_STAGES.includes(revise)) errors.revise = 'This step cannot be revised.';
    if (values.erp_order_number && db.projects.some((x) => x.id !== p.id && x.erp_order_number === values.erp_order_number)) {
      errors.erp_order_number = 'This ERP order number is already used by another project.';
    }
    if (Object.keys(errors).length) invalid(errors);

    // Project value above the advance
    if ('project_value' in values || 'advance_payment_received' in values) {
      const value = 'project_value' in values ? values.project_value : p.project_value;
      const advance = 'advance_payment_received' in values ? values.advance_payment_received : p.advance_payment_received;
      if (filled(value) && filled(advance) && Number(value) <= Number(advance)) {
        invalid('project_value' in values
          ? { project_value: `The project value must be more than the advance received (₹${Number(advance).toLocaleString('en-IN')}).` }
          : { advance_payment_received: `The advance must be less than the project value (₹${Number(value).toLocaleString('en-IN')}).` });
      }
    }

    // ERP order: look the number up; the ERP supplies the date, party and amounts
    const orderChanged = 'erp_order_number' in values && differs(p.erp_order_number, values.erp_order_number);
    if (orderChanged) {
      const erp = { erp_order_id: null, erp_order_date: null, erp_party_name: null, erp_order_amount: null, erp_gst_rate: null, erp_order_total: null };
      if (filled(values.erp_order_number)) {
        const order = findOrder(values.erp_order_number);
        if (order.status !== FOUND) invalid({ erp_order_number: order.message });
        Object.assign(erp, {
          erp_order_id: order.order_id, erp_order_date: order.order_date, erp_party_name: order.party_name,
          erp_order_amount: order.order_amount, erp_gst_rate: order.gst_rate, erp_order_total: order.order_total,
        });
      }
      Object.assign(values, erp);
    }

    // A revision replaces one stage that already has values, and changes nothing else
    if (revise) {
      const label = STAGES[revise][0];
      if (!stageComplete(revise, (f) => p[f])) invalid({ revise: `${label} has not been filled yet, so there is nothing to revise.` });
      if (Object.keys(values).some((f) => !fieldsOf([revise]).includes(f))) invalid({ revise: `A revision can only change the ${label} step.` });
    }

    const ruleErrors = stageErrors(p, values, { revision: !!revise });
    if (Object.keys(ruleErrors).length) invalid(ruleErrors.erp_order_date ? { erp_order_number: ruleErrors.erp_order_date } : ruleErrors);

    // Site supervisor and quotation value are needed whenever their stage is saved with a change
    const after = (f) => (f in values ? values[f] : p[f]);
    const stageChanged = (key) => fieldsOf([key]).some((f) => f in values && differs(p[f], values[f]));
    for (const [stage, field] of Object.entries(SUPERVISOR_FIELDS)) {
      if (stageChanged(stage) && !filled(after(field))) invalid({ [field]: 'Choose the site supervisor.' });
    }
    if (stageChanged('quotation') && !filled(after('quotation_value'))) invalid({ quotation_value: 'Enter the quotation value.' });

    const changes = diff(p, values);
    if (!Object.keys(changes).length) return { message: 'No changes.', data: presentProject(p, user, { detail: true }) };

    let version = null;
    if (revise) {
      const count = db.revisions.filter((r) => r.project_id === p.id && r.stage === revise).length;
      db.revisions.push({
        id: nextId('revisions'), project_id: p.id, stage: revise, version: count + 1,
        values: Object.fromEntries(fieldsOf([revise]).map((f) => [f, display(p[f])])), replaced_by: user.id, created_at: nowIso(),
      });
      version = count + 2;
    }

    // A new order number replaces everything synced for the old order
    const reset = orderChanged ? {
      factory_production_login_date: null, production_plan_number: null, production_commitment_date: null, production_stages: null,
      production_plans: null, production_status: 'not_started', production_date: null, dispatch_status: null, dispatch_items: null,
      dispatch_date: null, installation_date: null, closed_on: null, closed_by: null,
    } : {};
    if (orderChanged) db.installations = db.installations.filter((i) => i.project_id !== p.id);
    update(p, { ...values, ...reset, designer_updated_by: user.id, designer_updated_at: nowIso() });
    track(p, user, revise ? `Revised ${STAGES[revise][0]} (version ${version}).` : `Updated ${fieldList(changes)}.`, changes);

    if (p.assigned_designer_id && p.assigned_designer_id !== user.id) {
      notify(p.assigned_designer_id, 'designer_fields_corrected', p, `${user.name} changed ${p.customer_name}`, `Updated: ${fieldList(changes)}.`);
    }
    return { message: 'Project updated.', data: presentProject(p, user, { detail: true }) };
  },

  // Production and dispatch are synced, never entered by hand
  'PATCH /projects/:id/production': ({ user, params }) => {
    const p = findProject(params.id, user);
    if (!hasRole(user, 'production')) fail(403, 'This action is unauthorized.');
    return { message: 'No changes.', data: presentProject(p, user, { detail: true }) };
  },

  'PUT /projects/:id/installations': ({ user, params, body }) => {
    const db = getDb();
    const p = findProject(params.id, user);
    canEditDesigner(user, p);
    const rows = dispatchedRows(p);
    const entries = Array.isArray(body.entries) ? body.entries : [];
    const errors = {};
    entries.forEach((e, i) => {
      if (!rows.has(Number(e.sale_id))) errors[`entries.${i}.sale_id`] = 'This item has not been dispatched.';
      if (e.installed_on !== null && !DATE.test(e.installed_on ?? '')) errors[`entries.${i}.installed_on`] = 'Enter a valid date.';
    });
    if (Object.keys(errors).length) invalid(errors);

    const existing = new Map(db.installations.filter((i) => i.project_id === p.id).map((i) => [i.erp_sale_id, i]));
    const changed = entries.filter((e) => (e.installed_on === null ? existing.has(Number(e.sale_id)) : existing.get(Number(e.sale_id))?.installed_on !== e.installed_on));
    if (!changed.length) return { message: 'No changes.', data: presentProject(p, user, { detail: true }) };

    const summary = (n) => `${n} of ${rows.size} dispatched quantities installed`;
    const before = summary(existing.size);
    const wasInstalledOn = p.installation_date;
    const cleared = changed.filter((e) => e.installed_on === null);
    const saved = changed.filter((e) => e.installed_on !== null);
    db.installations = db.installations.filter((i) => !(i.project_id === p.id && changed.some((e) => Number(e.sale_id) === i.erp_sale_id)));
    saved.forEach((e) => db.installations.push({ id: nextId('installations'), project_id: p.id, erp_sale_id: Number(e.sale_id), installed_on: e.installed_on, installed_by: user.id }));
    refreshInstallationDate(p);
    update(p, {});

    const items = (n) => `${n} item${n === 1 ? '' : 's'}`;
    const nowInstalled = p.installation_date && !wasInstalledOn;
    const note = nowInstalled ? 'Installation complete: every item is installed.'
      : `Installation date ${[saved.length && `entered for ${items(saved.length)}`, cleared.length && `cleared for ${items(cleared.length)}`].filter(Boolean).join(', ')}.`;
    const after = summary(db.installations.filter((i) => i.project_id === p.id).length);
    track(p, user, note, {
      installation: { old: before, new: after },
      ...(p.installation_date !== wasInstalledOn ? { installation_date: { old: wasInstalledOn, new: p.installation_date } } : {}),
    });
    if (p.assigned_designer_id && p.assigned_designer_id !== user.id) {
      notify(p.assigned_designer_id, 'designer_fields_corrected', p, `${user.name} changed ${p.customer_name}`, 'Updated: installation.');
    }
    return { message: 'Installation updated.', data: presentProject(p, user, { detail: true }) };
  },

  'DELETE /projects/:id': ({ user, params }) => {
    const p = findProject(params.id, user);
    if (!hasPermission(authUser(user), 'delete projects')) fail(403, 'This action is unauthorized.');
    track(p, user, 'Project moved to the bin.');
    update(p, { deleted_at: nowIso() });
    return { message: 'Project moved to the bin.' };
  },

  'POST /projects/:id/restore': ({ user, params }) => {
    const p = findProject(params.id, user, { trashed: true });
    if (!hasPermission(authUser(user), 'delete projects')) fail(403, 'This action is unauthorized.');
    update(p, { deleted_at: null });
    track(p, user, 'Project restored from the bin.');
    return { message: 'Project restored.', data: presentProject(p, user, { detail: true }) };
  },

  'POST /projects/:id/lost': ({ user, params, body }) => {
    const p = findProject(params.id, user);
    if (!hasRole(user, 'manager') && !isOwnDesigner(user, p)) fail(403, 'This action is unauthorized.');
    const errors = {};
    const reason = readText(body, 'reason', errors, 500, true);
    if (Object.keys(errors).length) invalid(errors);
    if (p.lost_at) fail(422, 'This order is already marked as lost.');
    if (p.installation_date) fail(422, 'This order is installed (closed) and cannot be marked as lost.');
    update(p, { lost_at: nowIso(), lost_reason: reason, lost_by: user.id });
    track(p, user, 'Marked as lost.', { lost_reason: { old: null, new: reason } });
    return { message: 'Order marked as lost.', data: presentProject(p, user, { detail: true }) };
  },

  'POST /projects/:id/reopen': ({ user, params }) => {
    const p = findProject(params.id, user);
    if (!hasRole(user, 'manager') && !isOwnDesigner(user, p)) fail(403, 'This action is unauthorized.');
    if (!p.lost_at) fail(422, 'This order is not marked as lost.');
    const reason = p.lost_reason;
    update(p, { lost_at: null, lost_reason: null, lost_by: null });
    track(p, user, 'Reopened (was marked lost).', { lost_reason: { old: reason, new: null } });
    return { message: 'Order reopened.', data: presentProject(p, user, { detail: true }) };
  },

  'POST /projects/:id/close': ({ user, params, body }) => {
    const p = findProject(params.id, user);
    if (!hasRole(user, 'manager') && !isOwnDesigner(user, p)) fail(403, 'This action is unauthorized.');
    notLost(p);
    const errors = {};
    const closedOn = readDate(body, 'closed_on', errors, true);
    if (Object.keys(errors).length) invalid(errors);
    if (p.closed_on) fail(422, 'This order is already closed.');
    if (!p.installation_date) fail(422, 'The order can be closed once everything is dispatched and installed.');
    update(p, { closed_on: closedOn, closed_by: user.id });
    track(p, user, 'Order closed.', { closed_on: { old: null, new: closedOn } });
    return { message: 'Order closed.', data: presentProject(p, user, { detail: true }) };
  },

  'DELETE /projects/:id/close': ({ user, params }) => {
    const p = findProject(params.id, user);
    if (!hasRole(user, 'manager')) fail(403, 'This action is unauthorized.');
    if (!p.closed_on) fail(422, 'This order is not closed.');
    const closedOn = p.closed_on;
    update(p, { closed_on: null, closed_by: null });
    track(p, user, 'Reopened (was closed).', { closed_on: { old: closedOn, new: null } });
    return { message: 'Order reopened.', data: presentProject(p, user, { detail: true }) };
  },

  'GET /erp/orders/:number': ({ user, params }) => {
    if (!hasRole(user, 'manager', 'designer')) fail(403, 'This action is unauthorized.');
    const result = erpResult(params.number);
    if (!canSeeMoney(user)) { delete result.order_amount; delete result.order_total; }
    return result;
  },

  'GET /dashboard/stats': ({ user, query }) => dashboard(user, query),

  // Dropdown lists
  'GET /products': () => getDb().products.filter((p) => p.is_deleted === '0')
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)).map(({ id, name }) => ({ id, name })),
  'GET /supervisors': () => getDb().users.filter((u) => u.is_active && ['supervisor', 'designer'].includes(u.role))
    .sort((a, b) => a.name.localeCompare(b.name)).map((u) => ({ id: u.id, name: u.name, role: u.role })),
  'GET /designers': ({ user }) => {
    if (!hasRole(user, 'admin', 'manager')) fail(403, 'This action is unauthorized.');
    return getDb().users.filter((u) => u.is_active && u.role === 'designer')
      .sort((a, b) => a.name.localeCompare(b.name)).map((u) => ({ id: u.id, name: u.name, email: u.email }));
  },

  // Products
  'GET /products/manage': ({ user }) => {
    requireProducts(user);
    return getDb().products.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .map((p) => ({ id: p.id, name: p.name, sort_order: p.sort_order, active: p.is_deleted === '0' }));
  },
  'POST /products': ({ user, body }) => {
    requireProducts(user);
    const errors = {};
    const name = readText(body, 'name', errors, 255, true);
    if (name && getDb().products.some((p) => p.name.toLowerCase() === name.toLowerCase())) errors.name = 'The name has already been taken.';
    if (Object.keys(errors).length) invalid(errors);
    const product = { id: nextId('products'), name, sort_order: Number(body.sort_order ?? 0), is_deleted: '0' };
    getDb().products.push(product);
    return [201, { message: 'Product added.', data: product }];
  },
  'PATCH /products/:id': ({ user, params, body }) => {
    requireProducts(user);
    const product = getDb().products.find((p) => p.id === Number(params.id)) ?? fail(404, 'Not found.');
    const errors = {};
    if ('name' in body) {
      const name = readText(body, 'name', errors, 255, true);
      if (name && getDb().products.some((p) => p.id !== product.id && p.name.toLowerCase() === name.toLowerCase())) errors.name = 'The name has already been taken.';
      if (!Object.keys(errors).length) product.name = name;
    }
    if (Object.keys(errors).length) invalid(errors);
    if ('sort_order' in body) product.sort_order = Number(body.sort_order);
    if ('active' in body) product.is_deleted = body.active ? '0' : '1';
    return { message: 'Product updated.', data: product };
  },

  // Settings (manager)
  'GET /settings': ({ user }) => {
    if (!hasRole(user, 'manager')) fail(403, 'This action is unauthorized.');
    return getDb().settings;
  },
  'PATCH /settings': ({ user, body }) => {
    if (!hasRole(user, 'manager')) fail(403, 'This action is unauthorized.');
    const settings = getDb().settings;
    ['company_name', 'company_address', 'company_phone', 'company_email', 'company_gstin', 'erp_base_url', 'erp_order_path', 'erp_date_field']
      .forEach((k) => k in body && (settings[k] = body[k] || null));
    if (filled(body.erp_api_key)) settings.erp_api_key_set = true;
    if (body.erp_api_key_clear) settings.erp_api_key_set = false;
    return { message: 'Settings saved.', data: settings };
  },
  'POST /settings/erp-test': ({ user, body }) => {
    if (!hasRole(user, 'manager')) fail(403, 'This action is unauthorized.');
    return erpResult(body.number);
  },

  // Activity (manager)
  'GET /activity': ({ user, query }) => {
    if (!hasRole(user, 'manager')) fail(403, 'This action is unauthorized.');
    const db = getDb();
    const term = (query.q ?? '').toLowerCase().replace(/^#/, '');
    const rows = db.trackings
      .map((t) => ({ t, p: db.projects.find((x) => x.id === t.project_id) }))
      .filter(({ p }) => !term || (p && (p.customer_name.toLowerCase().includes(term) || (p.erp_order_number ?? '').toLowerCase().includes(term) || String(p.id) === term)))
      .filter(({ t }) => !query.user_id || t.changed_by === Number(query.user_id))
      .filter(({ t }) => !query.from || t.created_at.slice(0, 10) >= query.from)
      .filter(({ t }) => !query.to || t.created_at.slice(0, 10) <= query.to)
      .sort((a, b) => b.t.created_at.localeCompare(a.t.created_at) || b.t.id - a.t.id);
    const perPage = 50;
    const page = Math.max(1, Number(query.page) || 1);
    const lastPage = Math.max(1, Math.ceil(rows.length / perPage));
    return {
      data: rows.slice((page - 1) * perPage, page * perPage).map(({ t, p }) => ({
        ...presentTracking(t, user),
        project: p ? { id: p.id, customer_name: p.customer_name, product_name: p.product_name, erp_order_number: p.erp_order_number, deleted_at: p.deleted_at } : null,
      })),
      current_page: page, last_page: lastPage, per_page: perPage, total: rows.length,
    };
  },

  // Notifications (own)
  'GET /notifications': ({ user }) => {
    const mine = getDb().notifications.filter((n) => n.user_id === user.id);
    return {
      data: [...mine].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30)
        .map(({ id, read_at, created_at, type, project_id, title, body }) => ({ id, read: read_at !== null, created_at, type, project_id, title, body })),
      unread: mine.filter((n) => !n.read_at).length,
    };
  },
  'POST /notifications/read-all': ({ user }) => {
    getDb().notifications.forEach((n) => n.user_id === user.id && !n.read_at && (n.read_at = nowIso()));
    return { message: 'All marked as read.' };
  },
  'POST /notifications/:id/read': ({ user, params }) => {
    const n = getDb().notifications.find((x) => x.id === params.id && x.user_id === user.id) ?? fail(404, 'Not found.');
    n.read_at = n.read_at ?? nowIso();
    return { message: 'Marked as read.' };
  },

  // Users
  'GET /users': ({ user }) => {
    requireUserAdmin(user);
    return [...getDb().users].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id).map((u) => presentUser(u, user));
  },
  'POST /users': ({ user, body }) => {
    requireUserAdmin(user);
    const db = getDb();
    const errors = {};
    const name = readText(body, 'name', errors, 255, true);
    const email = readText(body, 'email', errors, 255, true);
    if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.email = 'The email field must be a valid email address.';
    else if (email && db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) errors.email = 'The email has already been taken.';
    if (!filled(body.password) || String(body.password).length < 8) errors.password = 'The password field must be at least 8 characters.';
    if (!ROLES.includes(body.role)) errors.role = 'The selected role is invalid.';
    else if (body.role === 'admin' && !hasRole(user, 'admin')) errors.role = 'Only an admin can create another admin.';
    if (Object.keys(errors).length) invalid(errors);
    const u = { id: nextId('users'), name, email, password: body.password, role: body.role, permissions: permissionsOf(body), is_active: true, created_at: nowIso() };
    db.users.push(u);
    return [201, { message: 'User created successfully.', user: presentUser(u, user) }];
  },
  'PATCH /users/:id': ({ user, params, body }) => {
    const target = getDb().users.find((u) => u.id === Number(params.id)) ?? fail(404, 'Not found.');
    if (!canManageUser(user, target)) fail(403, 'This action is unauthorized.');
    const self = target.id === user.id;
    const errors = {};
    if ('name' in body) readText(body, 'name', errors, 255, true);
    if ('password' in body && (!filled(body.password) || String(body.password).length < 8)) errors.password = 'The password field must be at least 8 characters.';
    if (self && 'is_active' in body && !body.is_active) errors.is_active = 'You cannot deactivate your own account.';
    if (filled(body.role) && body.role !== target.role) {
      if (!ROLES.includes(body.role)) errors.role = 'The selected role is invalid.';
      else if (self) errors.role = 'You cannot change your own role.';
      else if (body.role === 'admin' && !hasRole(user, 'admin')) errors.role = 'Only an admin can make someone an admin.';
    }
    if (Object.keys(errors).length) invalid(errors);
    if ('name' in body) target.name = body.name.trim();
    if ('password' in body) target.password = body.password;
    if ('is_active' in body) target.is_active = !!body.is_active;
    if (filled(body.role)) target.role = body.role;
    if ('permissions' in body) target.permissions = permissionsOf(body);
    if (!target.is_active) signOut(target);
    return { message: 'User updated.', user: presentUser(target, user) };
  },
  'DELETE /users/:id': ({ user, params }) => {
    const target = getDb().users.find((u) => u.id === Number(params.id)) ?? fail(404, 'Not found.');
    if (!canManageUser(user, target)) fail(403, 'This action is unauthorized.');
    if (target.id === user.id) fail(422, 'You cannot deactivate your own account.');
    target.is_active = false;
    signOut(target);
    return { message: 'User deactivated successfully.' };
  },
};

/** The ERP lookup as the API returns it (the order lines are only for the dispatch sync). */
function erpResult(number) {
  const result = findOrder(number);
  delete result.lines;
  return result;
}

function requireProducts(user) {
  if (!hasPermission(authUser(user), 'manage products')) fail(403, 'This action is unauthorized.');
}

function requireUserAdmin(user) {
  if (!hasRole(user, 'admin', 'manager')) fail(403, 'This action is unauthorized.');
}

const canManageUser = (user, target) => hasRole(user, 'admin') || (hasRole(user, 'manager') && target.role !== 'admin');

const permissionsOf = (body) => (Array.isArray(body.permissions) ? body.permissions.filter((p) => DELEGABLE.includes(p)) : []);

function signOut(target) {
  const tokens = getDb().tokens;
  Object.keys(tokens).forEach((t) => tokens[t] === target.id && delete tokens[t]);
}

function presentUser(u, viewer) {
  return { ...authUser(u), direct_permissions: u.permissions, can_edit: canManageUser(viewer, u) };
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

const FUNNEL = [
  ['customers', 'Customers', 'created_at'], ['token', 'Token received', 'token_date'],
  ['measurement', 'Measurement', 'initial_measurement_date'], ['design', 'Design finalised', 'design_finalization_date'],
  ['quotation', 'Quotation sent', 'quotation_submission_date'], ['order', 'Order placed', 'erp_order_number'],
  ['production', 'In production', 'factory_production_login_date'], ['dispatched', 'Dispatched', 'dispatch_date'],
  ['installed', 'Installed', 'installation_date'],
];

const sum = (rows, f) => Math.round(rows.reduce((s, p) => s + Number(p[f] ?? 0), 0) * 100) / 100;
const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 86_400_000);
const shift = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function dashboard(user, query) {
  const money = canSeeMoney(user);
  const team = hasRole(user, 'admin', 'manager');
  const projects = getDb().projects
    .filter((p) => !p.deleted_at && reportableFor(user, p))
    .filter((p) => !(query.designer_id && team) || p.assigned_designer_id === Number(query.designer_id));

  const allTime = !query.from && !query.to;
  const from = query.from || projects.map((p) => p.created_at.slice(0, 10)).sort()[0] || today();
  const to = query.to || today();
  const length = days(from, to) + 1;
  const prevTo = shift(from, -1);
  const prevFrom = shift(prevTo, -(length - 1));
  const between = (date, a, b) => !!date && date.slice(0, 10) >= a && date.slice(0, 10) <= b;

  const status = (p) => statusOf(p);
  const cohort = projects.filter((p) => between(p.created_at, from, to));
  const stale = projects.filter(isStale);

  const outcomes = Object.fromEntries(Object.entries({
    total: cohort,
    in_progress: cohort.filter((p) => ['not_started', 'in_progress'].includes(status(p))),
    in_hand: cohort.filter(inHand),
    closed: cohort.filter((p) => status(p) === 'closed'),
    lost: cohort.filter((p) => status(p) === 'lost'),
  }).map(([key, rows]) => [key, {
    count: rows.length,
    ...(money ? { value: sum(rows, 'project_value') } : {}),
    ...(money && key === 'in_hand' ? { advance: sum(rows, 'advance_payment_received') } : {}),
  }]));

  const kpis = (a, b) => {
    const inRange = (f) => projects.filter((p) => between(p[f], a, b));
    const orders = inRange('erp_order_date');
    const result = { customers: inRange('created_at').length, orders: orders.length, installed: inRange('installation_date').length, dispatched: inRange('dispatch_date').length };
    if (money) {
      const value = sum(orders, 'project_value');
      Object.assign(result, {
        order_value: value,
        advance_collected: sum(inRange('advance_payment_received_date'), 'advance_payment_received'),
        balance_due: Math.max(value - sum(orders, 'advance_payment_received'), 0),
        avg_order_value: orders.length ? Math.round((value / orders.length) * 100) / 100 : 0,
      });
    }
    return result;
  };

  let previous = null;
  const funnel = FUNNEL.map(([key, label, field]) => {
    const count = cohort.filter((p) => filled(p[field])).length;
    const row = {
      key, label, count,
      pct_of_total: cohort.length ? Math.round((count / cohort.length) * 1000) / 10 : 0,
      pct_of_prev: previous ? Math.round((count / previous) * 1000) / 10 : previous === 0 ? 0 : 100,
    };
    previous = count;
    return row;
  });

  const avgDays = (rows, a, b) => (rows.length ? Math.round((rows.reduce((s, p) => s + days(p[a], p[b]), 0) / rows.length) * 10) / 10 : null);
  const counts = projects.filter((p) => !p.lost_at).reduce((c, p) => ({ ...c, [stageOf(p)]: (c[stageOf(p)] ?? 0) + 1 }), {});

  const response = {
    range: { from, to, all_time: allTime },
    previous: allTime ? null : { from: prevFrom, to: prevTo },
    total: projects.length,
    not_started: projects.filter((p) => status(p) === 'not_started').length,
    in_progress: projects.filter((p) => status(p) === 'in_progress').length,
    installed: projects.filter((p) => ['installed', 'closed'].includes(status(p))).length,
    lost: projects.filter((p) => status(p) === 'lost').length,
    stale: stale.length,
    by_stage: [
      ...STAGE_KEYS.map((key) => ({ key, label: STAGES[key][0], owner: STAGES[key][1], count: counts[key] ?? 0 })),
      { key: 'installed', label: 'Installed', owner: 'production', count: counts.installed ?? 0 },
    ],
    stuck: [...stale].sort((a, b) => a.updated_at.localeCompare(b.updated_at)).slice(0, 10).map((p) => ({
      id: p.id, customer_name: p.customer_name, designer_name: userBrief(p.assigned_designer_id)?.name,
      product_name: p.product_name ?? undefined, days: days(p.updated_at, nowIso()), status: status(p), stage: stageOf(p),
      ...(money && p.project_value ? { project_value: p.project_value } : {}),
    })),
    outcomes,
    kpis: kpis(from, to),
    kpis_previous: allTime ? null : kpis(prevFrom, prevTo),
    funnel,
    cycle: {
      token_to_order_days: avgDays(projects.filter((p) => p.token_date && between(p.erp_order_date, from, to)), 'token_date', 'erp_order_date'),
      order_to_installation_days: avgDays(projects.filter((p) => p.erp_order_date && between(p.installation_date, from, to)), 'erp_order_date', 'installation_date'),
    },
  };

  if (hasRole(user, 'production')) {
    response.production = {
      in_production: projects.filter((p) => p.production_status !== 'completed' && !p.dispatch_date).length,
      awaiting_dispatch: projects.filter((p) => p.production_status === 'completed' && !p.dispatch_date).length,
      awaiting_install: projects.filter((p) => p.dispatch_date && !p.installation_date).length,
      completed_in_range: projects.filter((p) => p.production_status === 'completed' && between(p.production_date, from, to)).length,
      dispatched_in_range: projects.filter((p) => between(p.dispatch_date, from, to)).length,
      installed_in_range: projects.filter((p) => between(p.installation_date, from, to)).length,
    };
  }

  if (team) {
    const groups = Map.groupBy(projects, (p) => p.assigned_designer_id);
    response.by_designer = [...groups].map(([designerId, group]) => {
      const groupCohort = group.filter((p) => between(p.created_at, from, to));
      const orders = group.filter((p) => between(p.erp_order_date, from, to));
      return {
        designer_id: designerId, designer_name: userBrief(designerId)?.name ?? null, total: group.length,
        active: group.filter((p) => ['not_started', 'in_progress'].includes(status(p))).length,
        installed: group.filter((p) => ['installed', 'closed'].includes(status(p))).length,
        lost: group.filter((p) => status(p) === 'lost').length,
        customers: groupCohort.length, orders: orders.length,
        conversion: groupCohort.length ? Math.round((groupCohort.filter((p) => filled(p.erp_order_number)).length / groupCohort.length) * 1000) / 10 : null,
        ...(money ? { order_value: sum(orders, 'project_value') } : {}),
      };
    }).sort((a, b) => b.total - a.total);
  }

  return response;
}

// ─── Router ──────────────────────────────────────────────────────────────────

const routes = Object.entries(handlers).map(([key, handler]) => {
  const [method, pattern] = key.split(' ');
  const names = [];
  const regex = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, name) => {
    names.push(name);
    return name === 'number' ? '(.+)' : '([^/]+)';
  })}$`);
  return { method, regex, names, handler, isPublic: key === 'POST /login' };
});

/** Handles one API request; returns a fetch Response like the real server. */
export async function handleRequest(method, url, body, token) {
  await new Promise((r) => setTimeout(r, 120));   // feels like a network call
  const [path, search = ''] = url.split('?');
  const query = Object.fromEntries(new URLSearchParams(search));
  const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  const route = routes.find((r) => r.method === method && r.regex.test(path));
  if (!route) return json(404, { message: `The route ${path} could not be found.` });

  const db = getDb();
  const user = db.users.find((u) => u.id === db.tokens[token] && u.is_active);
  if (!route.isPublic && !user) return json(401, { message: 'Unauthenticated.' });

  const params = Object.fromEntries(route.names.map((n, i) => [n, decodeURIComponent(route.regex.exec(path)[i + 1])]));
  try {
    const result = route.handler({ user, body: body ?? {}, params, query, token });
    if (method !== 'GET') saveDb();
    const [status, data] = Array.isArray(result) && typeof result[0] === 'number' ? result : [200, result];
    return json(status, data);
  } catch (e) {
    if (!(e instanceof HttpError)) {
      console.error(e);
      return json(500, { message: 'Server Error' });
    }
    return json(e.status, { message: e.message, ...(e.errors ? { errors: e.errors } : {}) });
  }
}
