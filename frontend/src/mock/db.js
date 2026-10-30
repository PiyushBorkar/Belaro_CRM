/**
 * The demo API's database: plain objects kept in localStorage, seeded with demo data on first use.
 * resetDemo() throws everything away and seeds again.
 */
import { syncStep } from './erp';
import { PROJECT_FIELDS, money, nowIso, today } from './model';

const KEY = 'belaro_demo_db_v1';

export const DEMO_PASSWORD = 'password';

export const DEMO_ACCOUNTS = [
  { email: 'admin@belaro.test', role: 'admin' },
  { email: 'manager@belaro.test', role: 'manager' },
  { email: 'designer@belaro.test', role: 'designer' },
  { email: 'production@belaro.test', role: 'production' },
  { email: 'supervisor@belaro.test', role: 'supervisor' },
];

let db = null;

export function getDb() {
  if (!db) {
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
    if (!db?.users) db = seed();
  }
  return db;
}

export function saveDb() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* private mode: keeps working in memory */ }
}

export function resetDemo() {
  db = seed();
  saveDb();
}

export function nextId(table) {
  db.ids[table] = (db.ids[table] ?? 0) + 1;
  return db.ids[table];
}

// ─── Seed ────────────────────────────────────────────────────────────────────

function seed() {
  db = {
    ids: {},
    tokens: {},
    users: [], projects: [], trackings: [], notifications: [], revisions: [], installations: [], products: [],
    settings: {
      company_name: 'Belaro Interiors (demo)', company_address: '12 MG Road, Pune', company_phone: '+91 98765 43210',
      company_email: 'hello@belaro.test', company_gstin: '27ABCDE1234F1Z5',
      erp_base_url: 'https://erp.demo.belaro.test', erp_order_path: '/orders/{number}', erp_date_field: 'order_date', erp_api_key_set: false,
    },
  };

  const user = (name, email, role, permissions = []) => {
    const u = { id: nextId('users'), name, email, password: DEMO_PASSWORD, role, permissions, is_active: true, created_at: nowIso(-60) };
    db.users.push(u);
    return u;
  };
  user('Admin', 'admin@belaro.test', 'admin');
  const manager = user('Meera Manager', 'manager@belaro.test', 'manager', ['manage products', 'delete projects']);
  const aarav = user('Aarav Designer', 'designer@belaro.test', 'designer');
  const diya = user('Diya Designer', 'designer2@belaro.test', 'designer');
  user('Prakash Production', 'production@belaro.test', 'production');
  const rohan = user('Rohan Supervisor', 'supervisor@belaro.test', 'supervisor');
  user('Kabir Supervisor', 'supervisor2@belaro.test', 'supervisor');

  ['Modular Kitchen', 'Wardrobe', 'TV Unit', 'Bedroom Set', 'Study Table', 'Vanity', 'Shoe Rack'].forEach((name, i) =>
    db.products.push({ id: nextId('products'), name, sort_order: i, is_deleted: '0' }));

  // [customer, designer, product, how many designer stages are filled, days ago created, factory steps, extra]
  const rows = [
    ['Ananya Kulkarni', aarav, null, 0, 1, 0],
    ['Vikram Shah', aarav, 'Modular Kitchen', 2, 9, 0, { stale: 5 }],
    ['Neha Joshi', diya, 'Wardrobe', 3, 14, 0],
    ['Rahul Verma', aarav, 'TV Unit', 4, 20, 0, { revise: true }],
    ['Pooja Iyer', diya, 'Bedroom Set', 6, 25, 0, { stale: 6 }],
    ['Sanjay Patil', aarav, 'Modular Kitchen', 7, 35, 4],
    ['Kavita Nair', diya, 'Vanity', 7, 40, 8],
    ['Arjun Malhotra', aarav, 'Wardrobe', 7, 50, 9, { install: 'all' }],
    ['Ritu Desai', aarav, 'Study Table', 7, 60, 9, { install: 'all', close: true }],
    ['Farhan Sheikh', diya, 'Shoe Rack', 3, 30, 0, { lost: 'Went with a cheaper local carpenter.' }],
  ];

  rows.forEach(([customer, designer, product, filledStages, daysAgo, factorySteps, extra = {}], i) => {
    const created = -daysAgo;
    const p = Object.fromEntries(PROJECT_FIELDS.map((f) => [f, null]));
    Object.assign(p, {
      id: nextId('projects'), customer_name: customer, assigned_designer_id: designer.id, assigned_by: manager.id,
      assigned_at: nowIso(created), created_by: manager.id, created_at: nowIso(created), updated_at: nowIso(created),
      production_status: 'not_started',
    });
    const step = (n) => today(created + n * 2);
    const values = [
      { token_date: step(0), product_name: product, token_amount: money(10000), site_supervisor_token: rohan.name },
      { initial_measurement_date: step(1) },
      { design_finalization_date: step(2), site_supervisor_design: rohan.name },
      { quotation_submission_date: step(3), quotation_value: money(240000 + i * 15000) },
      { advance_payment_received_date: step(4), advance_payment_received: money(60000) },
      { final_measurement_date: step(5), project_value: money(250000 + i * 15000) },
      { erp_order_number: `SO-${10200 + i}`, erp_order_date: step(6), erp_order_id: String(10200 + i) },
    ];
    values.slice(0, filledStages).forEach((v) => Object.assign(p, v));
    if (filledStages >= 7) {
      Object.assign(p, { erp_party_name: customer, erp_order_amount: p.project_value, erp_gst_rate: '18.00', erp_order_total: money(p.project_value * 1.18) });
    }
    db.projects.push(p);

    track(p, manager, `Project created, assigned to ${designer.name}.`, null, created);
    if (filledStages) {
      const changes = Object.fromEntries(values.slice(0, filledStages).flatMap(Object.entries).map(([f, v]) => [f, { old: null, new: v }]));
      track(p, designer, `Updated ${Object.keys(changes).map((f) => f.replaceAll('_', ' ')).join(', ')}.`, changes, created + filledStages * 2);
    }

    if (extra.revise) {
      db.revisions.push({ id: nextId('revisions'), project_id: p.id, stage: 'quotation', version: 1,
        values: { quotation_submission_date: today(created + 5), quotation_value: money(310000) }, replaced_by: designer.id, created_at: nowIso(created + 6) });
      track(p, designer, 'Revised Quotation Submission (version 2).', { quotation_value: { old: '310000.00', new: p.quotation_value } }, created + 6);
    }

    for (let s = 0; s < factorySteps; s++) {
      const result = syncStep(p, () => nextId('sale'));
      if (!result) break;
      Object.assign(p, result.changes);
      track(p, null, result.note, null, Math.min(created + 14 + s, 0));
    }

    if (extra.install === 'all') {
      p.dispatch_items.flatMap((item) => item.dispatches).forEach((row) => db.installations.push({
        id: nextId('installations'), project_id: p.id, erp_sale_id: row.sale_id, installed_on: row.date, installed_by: designer.id,
      }));
      p.installation_date = today();
      track(p, designer, 'Installation complete: every item is installed.', { installation_date: { old: null, new: today() } }, 0);
    }
    if (extra.close) {
      Object.assign(p, { closed_on: today(), closed_by: designer.id });
      track(p, designer, 'Order closed.', { closed_on: { old: null, new: today() } }, 0);
    }
    if (extra.lost) {
      Object.assign(p, { lost_at: nowIso(-2), lost_reason: extra.lost, lost_by: designer.id });
      track(p, designer, 'Marked as lost.', { lost_reason: { old: null, new: extra.lost } }, -2);
    }

    p.updated_at = extra.stale ? nowIso(-extra.stale) : db.trackings.filter((t) => t.project_id === p.id).at(-1).created_at;
  });

  db.notifications.push({
    id: crypto.randomUUID(), user_id: aarav.id, type: 'project_assigned', project_id: 1,
    title: 'New project: Ananya Kulkarni', body: `Assigned to you by ${manager.name}.`, read_at: null, created_at: nowIso(-1),
  });

  return db;
}

function track(p, user, note, changes, daysAgo) {
  db.trackings.push({
    id: nextId('trackings'), project_id: p.id, changed_by: user?.id ?? null, role: user?.role ?? 'system',
    note, changes: changes && Object.keys(changes).length ? changes : null, created_at: nowIso(daysAgo),
  });
}
