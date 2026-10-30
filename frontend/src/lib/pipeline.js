/**
 * Every stage of an order, in order. Mirrors Project::STAGES and
 * Project::STAGE_OPTIONAL_FIELDS in Backend/app/Models/Project.php — the API
 * enforces the same order, dates and locks. Keep the two in sync.
 *
 * Each stage: key, title, short (stepper label), owner, fields, and optionally requires
 * (a stage of the other owner that must be complete first — Project::STAGE_REQUIRES).
 * A field: key, label, type (date | select | text | number | status), required (counts for
 * completeness), mandatory (must be chosen when saving, but older projects without it stay
 * complete — Project::SUPERVISOR_FIELDS), money (hidden from roles that can't see money),
 * optionsFrom (select source).
 * revisable: the designer revises the stage instead of editing it; earlier versions are kept
 * (Project::REVISABLE_STAGES).
 */
export const STAGES = [
  {
    key: 'token', title: 'Token', short: 'Token', owner: 'designer',
    fields: [
      { key: 'token_date', label: 'Date', type: 'date', required: true },
      { key: 'token_amount', label: 'Token amount (₹)', type: 'number', money: true, placeholder: 'e.g. 5000 (optional)' },
      { key: 'product_name', label: 'Product', type: 'select', optionsFrom: 'products', required: true, placeholder: 'Select product' },
      { key: 'site_supervisor_token', label: 'Site supervisor', type: 'select', optionsFrom: 'supervisors', mandatory: true, placeholder: 'Select site supervisor' },
    ],
  },
  {
    key: 'initial_measurement', title: 'Initial measurement', short: 'Measure', owner: 'designer',
    fields: [{ key: 'initial_measurement_date', label: 'Date', type: 'date', required: true }],
  },
  {
    key: 'design_finalization', title: 'Design finalisation', short: 'Design', owner: 'designer', revisable: true,
    fields: [
      { key: 'design_finalization_date', label: 'Date', type: 'date', required: true },
      { key: 'site_supervisor_design', label: 'Site supervisor', type: 'select', optionsFrom: 'supervisors', mandatory: true, placeholder: 'Select site supervisor' },
    ],
  },
  {
    key: 'quotation', title: 'Quotation submission', short: 'Quotation', owner: 'designer', revisable: true,
    fields: [
      { key: 'quotation_submission_date', label: 'Date', type: 'date', required: true },
      // Final measurement's project value starts from it, but changing that never changes this
      { key: 'quotation_value', label: 'Quotation value (₹)', type: 'number', mandatory: true, money: true, placeholder: 'e.g. 350000' },
    ],
  },
  {
    key: 'advance_payment', title: 'Advance payment', short: 'Advance', owner: 'designer', revisable: true,
    fields: [
      { key: 'advance_payment_received_date', label: 'Date', type: 'date', required: true },
      { key: 'advance_payment_received', label: 'Amount (₹)', type: 'number', required: true, money: true, placeholder: 'e.g. 50000' },
    ],
  },
  {
    key: 'final_measurement', title: 'Final measurement', short: 'Final', owner: 'designer', revisable: true,
    hint: 'The project value starts from the quotation value; change it here if the final value differs.',
    fields: [
      { key: 'final_measurement_date', label: 'Date', type: 'date', required: true },
      { key: 'project_value', label: 'Project value (₹)', type: 'number', required: true, money: true, placeholder: 'e.g. 350000' },
    ],
  },
  {
    key: 'erp_order', title: 'ERP order', short: 'ERP order', owner: 'designer',
    hint: 'Create the order in the ERP first, then enter its order number. The order date is fetched from the ERP.',
    fields: [
      { key: 'erp_order_number', label: 'ERP order number', type: 'erp', required: true, placeholder: 'e.g. SO-10234' },
      { key: 'erp_order_date', label: 'Order date', type: 'date', required: true },
      { key: 'erp_party_name', label: 'Party name', type: 'erp_info' },
      { key: 'erp_order_amount', label: 'Order amount (before GST)', type: 'erp_info', money: true, format: 'currency' },
      { key: 'erp_gst_rate', label: 'GST', type: 'erp_info', format: 'percent' },
      { key: 'erp_order_total', label: 'Order total (incl. GST)', type: 'erp_info', money: true, format: 'currency' },
    ],
  },
  {
    // Filled by the backend from the factory planning system (production:sync-plans): the plan date
    key: 'factory_production', title: 'Factory production login', short: 'Factory login', owner: 'designer', auto: true,
    waiting: 'Waiting for the factory to plan this order. This step updates automatically.',
    hint: 'Filled automatically with the plan date once the factory plans this order. The production team sees it from then on.',
    fields: [{ key: 'factory_production_login_date', label: 'Plan date', type: 'date', required: true }],
  },
  {
    // Filled by the backend from the factory planning system (production:sync-plans), never by hand
    key: 'production', title: 'Production', short: 'Production', owner: 'production', auto: true,
    waiting: 'Waiting for the factory to plan this order. This step updates automatically.',
    hint: 'Updated automatically from the factory planning system every 15 minutes. Completed when packing is done.',
    fields: [
      { key: 'production_status', label: 'Status', type: 'status', required: true },
      // First date field: Dispatch can't be dated before it
      { key: 'production_date', label: 'Completed on', type: 'date', required: true },
      { key: 'production_plan_number', label: 'Plan number', type: 'text' },
      { key: 'production_commitment_date', label: 'Committed completion date', type: 'date' },
      { key: 'production_stages', label: 'Factory stages', type: 'stages' },
    ],
  },
  {
    // Filled by the backend from ERP sales invoices (dispatch:sync); can be partial
    key: 'dispatch', title: 'Dispatch', short: 'Dispatch', owner: 'production', auto: true,
    hint: 'Updated automatically from ERP invoices every 15 minutes. Completed when every item is dispatched.',
    waiting: 'Nothing dispatched yet. This step updates automatically from ERP invoices.',
    fields: [
      { key: 'dispatch_status', label: 'Status', type: 'dispatch_status' },
      { key: 'dispatch_date', label: 'Fully dispatched on', type: 'date', required: true },
      { key: 'dispatch_items', label: 'Items', type: 'items' },
    ],
  },
  {
    // The designer's last step: opens with the first dispatch; a date per dispatched quantity (InstallationPanel).
    // installation_date is set by the backend once everything is dispatched and installed; then the order can be closed.
    key: 'installation', title: 'Installation', short: 'Install', owner: 'designer', requires: 'dispatch', itemized: true,
    hint: 'Enter when each dispatched item was installed. Once everything is dispatched and installed, close the order.',
    fields: [{ key: 'installation_date', label: 'Installed on', type: 'date', required: true }],
  },
];

/**
 * "Order closed": the designer's bar ends with it, after Installation. Not an API stage (Project::STAGES):
 * it is set with POST /projects/{id}/close once everything is installed, and shown by ClosingStep.
 */
export const CLOSING_STAGE = {
  key: 'closing', title: 'Order closed', short: 'Closed', owner: 'designer', closing: true,
  hint: 'Close the order once everything is installed. After that only a manager can change it.',
  fields: [{ key: 'closed_on', label: 'Closed on', type: 'date', required: true }],
};

export const STAGE_LABELS =Object.fromEntries([...STAGES.map((s) => [s.key, s.title]), ['installed', 'Installed']]);

export const stagesOf = (owner) => STAGES.filter((s) => s.owner === owner);

export const PRODUCTION_STATUS = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
};

export const DISPATCH_STATUS = {
  partial: 'Partly dispatched',
  dispatched: 'Dispatched',
};

/** Factory stages from the planning system (ProductionPlanClient::STAGES), in order. */
export const FACTORY_STAGES = [
  ['cutting', 'Cutting'], ['binding', 'Binding'], ['painting', 'Painting'],
  ['cnc', 'CNC'], ['assembly', 'Assembly'], ['packing', 'Packing'],
];

export const isFilled = (v) => v !== null && v !== undefined && v !== '';

// Money fields are left out of the API response for roles that can't see money
// (production, supervisor); those steps are judged on the fields they can see.
const counts = (f, project) => f.required && f.type !== 'status' && !(f.money && !(f.key in project));

export function isStageComplete(stage, project) {
  const done = stage.fields.filter((f) => counts(f, project)).every((f) => isFilled(project[f.key]));
  return stage.key === 'production' ? done && project.production_status === 'completed' : done;
}

/** Any of the stage's required data entered (status alone doesn't count). */
export function hasData(stage, project) {
  return stage.fields.some((f) => counts(f, project) && isFilled(project[f.key]));
}

/**
 * A stage locks once the next stage of the same owner has data, or a stage that waits for it
 * (Dispatch once Installation is entered). Backend: StageRules.
 */
export function isLocked(stages, index, project) {
  const next = stages[index + 1];
  const dependents = STAGES.filter((s) => s.requires === stages[index].key);
  return [next, ...dependents].some((s) => s && hasData(s, project));
}

/** Any data in the stage yet, entered or synced (status alone doesn't count). */
const hasStarted = (stage, project) =>
  isStageComplete(stage, project) || stage.fields.some((f) => f.type !== 'status' && isFilled(project[f.key]));

/** The other owner's stage this one waits for, until it has started (Installation opens with the first dispatch). */
export function waitingFor(stage, project) {
  const required = stage.requires && STAGES.find((s) => s.key === stage.requires);
  return required && !hasStarted(required, project) ? required : null;
}
