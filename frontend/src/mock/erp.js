/**
 * Demo stand-ins for the company's systems:
 *  - ERP: any order number like SO-10234 (SO- and 4–6 digits) exists, with made-up but stable data.
 *  - Factory planning + ERP invoices: each sync tick moves every ordered project one step
 *    (planned → cutting … packing → part dispatched → fully dispatched).
 * The real API reads these from the ERP and planning databases instead.
 */
import { money, today } from './model';

const PARTIES = ['Sharma Residency', 'Kapoor Interiors', 'Green Valley Villas', 'Mehra & Sons', 'Skyline Apartments', 'Rao Family', 'Bansal Homes', 'Oberoi Heights'];
const ITEMS = ['Kitchen base unit', 'Kitchen wall unit', 'Wardrobe 3-door', 'TV unit', 'Bed with storage', 'Study table', 'Shoe rack', 'Vanity unit'];

// Small seeded random generator, so one order number always gives the same order
function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export const FOUND = 'found';
export const NOT_FOUND = 'not_found';

/** The ERP order: same shape as the real ErpClient::findOrder result, plus its lines for dispatch. */
export function findOrder(number) {
  const match = /^SO-(\d{4,6})$/i.exec((number ?? '').trim());
  if (!match) {
    return {
      status: NOT_FOUND, order_id: null, order_date: null, party_name: null, order_amount: null, gst_rate: null, order_total: null,
      message: `Order ${number} was not found in the ERP. (Demo ERP: any number like SO-10234 exists.)`,
    };
  }
  const digits = Number(match[1]);
  const rand = seeded(digits);
  const lines = Array.from({ length: 1 + Math.floor(rand() * 3) }, (_, i) => ({
    line_id: digits * 10 + i,
    product: ITEMS[Math.floor(rand() * ITEMS.length)],
    ordered: 1 + Math.floor(rand() * 4),
  }));
  const amount = Math.round((150_000 + rand() * 650_000) / 100) * 100;
  return {
    status: FOUND,
    order_id: String(digits),
    order_date: today(),
    party_name: PARTIES[Math.floor(rand() * PARTIES.length)],
    order_amount: money(amount),
    gst_rate: '18.00',
    order_total: money(amount * 1.18),
    message: 'Order found in the ERP.',
    lines,
  };
}

export const FACTORY_STAGES = ['cutting', 'binding', 'painting', 'cnc', 'assembly', 'packing'];
const FACTORY_LABELS = { cutting: 'Cutting', binding: 'Binding', painting: 'Painting', cnc: 'CNC', assembly: 'Assembly', packing: 'Packing' };

function planStages(done, current) {
  return Object.fromEntries(FACTORY_STAGES.map((key, i) => [key, {
    status: i < done ? 'done' : i === done && current ? 'in_progress' : 'not_started',
    completed_on: i < done ? today() : null,
  }]));
}

/**
 * One sync step for one project. Returns { changes, note, events } or null when there is nothing to do.
 * events: 'planned' (tell production) and 'dispatched' (first dispatch: tell the designer).
 */
export function syncStep(p, nextSaleId) {
  if (!p.erp_order_id || p.lost_at || p.deleted_at) return null;

  // 1. The factory plans the order
  if (!p.factory_production_login_date) {
    const plan = `PL-${1000 + p.id}`;
    const stages = planStages(0, true);
    return {
      note: `Planned in the factory (plan ${plan}).`,
      events: ['planned'],
      changes: {
        factory_production_login_date: today(),
        production_plan_number: plan,
        production_commitment_date: today(12),
        production_status: 'in_progress',
        production_stages: orderStages(stages),
        production_plans: [{ plan_number: plan, plan_date: today(), commitment_date: today(12), assigned: true, completed_on: null, stages }],
      },
    };
  }

  // 2. One factory stage a step, until packing is done
  if (p.production_status !== 'completed') {
    const done = FACTORY_STAGES.filter((k) => p.production_stages?.[k]?.status === 'done').length + 1;
    const finished = done === FACTORY_STAGES.length;
    const stages = planStages(done, !finished);
    const plan = { ...(p.production_plans?.[0] ?? {}), stages, completed_on: finished ? today() : null };
    return {
      note: finished ? 'Production completed (packing done).' : `Factory: ${FACTORY_LABELS[FACTORY_STAGES[done - 1]]} done.`,
      events: [],
      changes: {
        production_stages: orderStages(stages),
        production_plans: [plan],
        ...(finished ? { production_status: 'completed', production_date: today() } : {}),
      },
    };
  }

  // 3. ERP invoices: half of each line first, the rest on the next step
  if (p.dispatch_status !== 'dispatched') {
    const order = findOrder(p.erp_order_number);
    if (order.status !== FOUND) return null;
    const first = !p.dispatch_items?.length;
    const invoice = `INV/${new Date().getFullYear() % 100}-${String(p.id).padStart(3, '0')}/${first ? 1 : 2}`;
    const items = order.lines.map((line) => {
      const previous = p.dispatch_items?.find((i) => i.line_id === line.line_id);
      const sent = previous?.dispatched ?? 0;
      const quantity = first ? Math.ceil(line.ordered / 2) : line.ordered - sent;
      const dispatches = [...(previous?.dispatches ?? [])];
      if (quantity > 0) dispatches.push({ sale_id: nextSaleId(), invoice, date: today(), quantity });
      const dispatched = dispatches.reduce((sum, d) => sum + d.quantity, 0);
      return { line_id: line.line_id, product: line.product, ordered: line.ordered, dispatched, dispatched_on: dispatches.at(-1)?.date ?? null, dispatches };
    });
    const complete = items.every((i) => i.dispatched >= i.ordered);
    return {
      note: complete ? 'Fully dispatched (ERP invoice).' : 'Partly dispatched (ERP invoice).',
      events: first ? ['dispatched'] : [],
      changes: { dispatch_items: items, dispatch_status: complete ? 'dispatched' : 'partial', dispatch_date: complete ? today() : null },
    };
  }

  return null;
}

/** The order's stage summary across its plans (one plan in the demo). */
function orderStages(stages) {
  return Object.fromEntries(Object.entries(stages).map(([k, s]) => [k, { ...s, done_plans: s.status === 'done' ? 1 : 0, total_plans: 1 }]));
}
