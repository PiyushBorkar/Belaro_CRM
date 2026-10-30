# Belaro CRM: API contract

This is what the React UI (`frontend/`) expects from the backend. The demo API in
`frontend/src/mock/` implements all of it in the browser. Build the Spring Boot API to match it, then
set `VITE_USE_MOCK=false` and the UI talks to your server instead.

The mock is the reference implementation: when this document and the mock differ, the mock shows exactly
what the UI was tested against. Read `frontend/src/mock/server.js` for the request handlers,
`frontend/src/mock/model.js` for the stage rules and `frontend/src/mock/erp.js` for the factory and
dispatch sync.

## Conventions

| Topic | Rule |
| --- | --- |
| Base path | `/api` (the Vite dev server proxies `/api` to `http://127.0.0.1:8080`) |
| JSON field names | `snake_case` (Spring: `spring.jackson.property-naming-strategy=SNAKE_CASE`) |
| Auth | `POST /api/login` returns a token; every other call sends `Authorization: Bearer <token>` |
| Dates | `"2026-10-30"` (`LocalDate`); timestamps are ISO-8601 (`"2026-10-30T11:37:00Z"`) |
| Money | Decimal, e.g. `"350000.00"` or `350000`. Columns are `decimal(12,2)`; max `9999999999.99` |
| 401 | `{"message": "Unauthenticated."}`: the UI logs the user out |
| 403 | `{"message": "This project is not assigned to you."}`: the message is shown to the user |
| 404 | `{"message": "Not found."}` |
| 422 | `{"message": "<first error>", "errors": {"field_name": ["message"]}}`: the UI shows each message under its field |

## Roles

`admin`, `manager`, `designer`, `production`, `supervisor`. Each user has one role.

| Role | Sees | Can do |
| --- | --- | --- |
| admin | all projects | read everything, manage users (including admins) |
| manager | all projects | create and assign projects, edit designer steps (also on closed orders), reopen closed orders, settings, activity log, users (not admins) |
| designer | own projects, plus the ones where they are named site supervisor (read-only) | create projects for themselves, edit their own projects until the order is closed, mark lost or reopen, close the order |
| production | projects the factory has planned (`factory_production_login_date` set) | read only (production and dispatch are synced) |
| supervisor | projects where `site_supervisor_token` or `site_supervisor_design` equals their **name** | read only |

**Money fields** (`token_amount`, `quotation_value`, `advance_payment_received`, `project_value`,
`erp_order_amount`, `erp_order_total`) are **removed** from every response for `production` and
`supervisor`. That covers projects, revision values, tracking `changes`, the ERP lookup and dashboard
values.

**Delegable permissions** (strings in `permissions`): `manage products`, `delete projects`,
`fix production entries`. A manager always has the first two.

## The order pipeline

Stages in order: `key` → owner → **required** fields (+ optional fields). The first required field is the stage's date.

| key | owner | required | optional |
| --- | --- | --- | --- |
| token | designer | token_date, product_name | token_amount, site_supervisor_token |
| initial_measurement | designer | initial_measurement_date | |
| design_finalization | designer | design_finalization_date | site_supervisor_design |
| quotation | designer | quotation_submission_date | quotation_value |
| advance_payment | designer | advance_payment_received_date, advance_payment_received | |
| final_measurement | designer | final_measurement_date, project_value | |
| erp_order | designer | erp_order_date, erp_order_number | |
| factory_production | designer (synced) | factory_production_login_date | |
| production | production (synced) | production_date | production_status |
| dispatch | production (synced) | dispatch_date | |
| installation | designer | installation_date (set by the server from per-item dates) | |

A stage is **complete** when all its required fields are filled; Production also needs `production_status = "completed"`.

Computed on every project response:

- `stage`: the first incomplete stage key, or `"installed"`.
- `status`: one of these, checked in order:
  1. `lost` if `lost_at` is set
  2. `closed` if `closed_on` is set
  3. `installed` if `installation_date` is set
  4. `in_progress` if any stage field or `remark` is filled (other than `production_status`), or `production_status` is not `not_started`
  5. `not_started` otherwise
- `in_hand`: `advance_payment_received_date` is set, `installation_date` is empty, and the order isn't lost.

### Validation when the designer saves (`PATCH /projects/{id}/designer`)

These checks run in this order; the first failure returns 422 on the named field:

1. **Field types.** Dates are `YYYY-MM-DD`. Amounts are between 0 and 9999999999.99. The order number is at most 100 characters, `remark` at most 5000, and other text at most 255. The order number must be unique across projects.
2. **Project value > advance.** This is checked when either amount is sent. The error goes on the field that was sent: `"The project value must be more than the advance received (₹50,000)."`
3. **ERP order.** When `erp_order_number` changes, look it up in the ERP. If it isn't found, return 422 on `erp_order_number`. If it is found, also set `erp_order_id`, `erp_order_date`, `erp_party_name`, `erp_order_amount`, `erp_gst_rate` and `erp_order_total`. Clearing the number clears all of them.
4. **Revision.** With `revise` set, the stage must be one of `design_finalization`, `quotation`, `advance_payment` or `final_measurement`. It must already be complete, and the request may only send that stage's fields.
5. **Stage rules.** These apply only to stages whose values actually change:
   - A stage can't be cleared while a later stage has data.
   - A stage with data must have all its required fields.
   - Every earlier stage of the same owner must be complete: `"Complete the Token step before Initial Measurement."`
   - Installation waits for Dispatch.
   - The stage date can't be before the project's creation date, or before the previous stage's date. It also can't be after the next stage's date, except in a revision. The ERP order date is not checked.
6. **Site supervisor.** It is required whenever Token or Design finalisation is saved with a change.
7. **Quotation value.** It is required whenever Quotation is saved with a change.

**Saving:**

- Store only the fields that really change, and log the change in the tracking table (see below).
- For a revision, first store the stage's current values as a `stage_revisions` row (`version` = count + 1). The note is `"Revised Quotation Submission (version N)."`
- A changed ERP number resets everything synced from the old order: production, dispatch, installations and closing.
- When a manager edits a designer's project, send the designer a `designer_fields_corrected` notification.

### Synced steps (scheduled job, every 15 minutes in production)

For each project that has an ERP order and isn't lost:

1. **Factory planning.** Set `factory_production_login_date`, `production_plan_number`, `production_commitment_date`, `production_status = in_progress`, `production_stages` and `production_plans`. Send a `ready_for_production` notification to every production user.
2. **Factory stages:** `cutting → binding → painting → cnc → assembly → packing`. Once packing is done, set `production_status = completed` and set `production_date`.
3. **ERP invoices.** Fill `dispatch_items`, setting `dispatch_status` to `partial` or `dispatched`. Set `dispatch_date` once everything is dispatched. Send the designer a `ready_for_installation` notification on the first dispatch.

Shapes:

```json
"production_stages": {
  "cutting": { "status": "done", "completed_on": "2026-10-20", "done_plans": 1, "total_plans": 1 },
  "binding": { "status": "in_progress", "completed_on": null, "done_plans": 0, "total_plans": 1 }
},
"production_plans": [
  { "plan_number": "PL-1007", "plan_date": "2026-10-18", "commitment_date": "2026-10-30", "assigned": true,
    "completed_on": null, "stages": { "cutting": { "status": "done", "completed_on": "2026-10-20" } } }
],
"dispatch_items": [
  { "line_id": 102070, "product": "Wardrobe 3-door", "ordered": 3, "dispatched": 2, "dispatched_on": "2026-10-25",
    "dispatches": [ { "sale_id": 318005, "invoice": "INV/26-007/1", "date": "2026-10-25", "quantity": 2 } ] }
]
```

Stage `status` values: `done`, `in_progress`, `not_started` or `skipped`.

### Installation and closing

- The designer enters a date for each dispatched quantity (`sale_id`). Once everything is dispatched and every row has a date, `installation_date` is the latest of those dates. If that stops being true, `installation_date` is cleared, and so are `closed_on` and `closed_by`.
- **Close.** The designer or a manager can close the order once it is installed. After that, only a manager can edit it, and only a manager can reopen it.

## Objects

### User (`/me`, `/login`, `/users`)

```json
{ "id": 3, "name": "Aarav Designer", "email": "designer@belaro.test", "is_active": true,
  "roles": ["designer"], "permissions": [], "created_at": "2026-09-01T10:00:00Z" }
```

`/users` rows also include `direct_permissions` (string array) and `can_edit` (boolean).

### Project

All columns, in `snake_case`:

```
id, customer_name, assigned_designer_id, assigned_by, assigned_at,
product_name, token_date, token_amount, site_supervisor_token, initial_measurement_date,
design_finalization_date, site_supervisor_design, quotation_submission_date, quotation_value,
advance_payment_received, advance_payment_received_date, final_measurement_date, project_value,
erp_order_number, erp_order_id, erp_order_date, erp_party_name, erp_order_amount, erp_gst_rate, erp_order_total,
factory_production_login_date, production_status (not_started|in_progress|completed), production_date,
production_plan_number, production_commitment_date, production_stages, production_plans,
dispatch_status (null|partial|dispatched), dispatch_date, dispatch_items,
installation_date, closed_on, closed_by, remark, lost_at, lost_reason, lost_by,
designer_updated_by, designer_updated_at, created_by, created_at, updated_at, deleted_at
```

Every project response also includes:

- `status`, `stage` and `in_hand`, computed as described above
- `assigned_designer: {id, name}`

`GET /projects/{id}` and every write that returns a project also include:

- `creator: {id, name}`
- `installations: [{id, project_id, erp_sale_id, installed_on}]`
- `stage_revisions: [{id, project_id, stage, version, values: {field: value}, replaced_by: {id, name}, created_at}]`, sorted by stage and then version

### Tracking row (change history)

```json
{ "id": 81, "project_id": 7, "changed_by": 3, "role": "designer", "note": "Updated quotation value.",
  "changes": { "quotation_value": { "old": "300000.00", "new": "280000.00" } },
  "created_at": "2026-10-30T11:37:00Z", "changed_by_user": { "id": 3, "name": "Aarav Designer" } }
```

`changed_by: null` with `role: "system"` means the change came from the sync job.

### Notification

```json
{ "id": "uuid", "read": false, "created_at": "…", "type": "project_assigned", "project_id": 7,
  "title": "New project: Ananya Kulkarni", "body": "Assigned to you by Meera Manager." }
```

`type` is one of `project_assigned`, `ready_for_production`, `ready_for_installation` or `designer_fields_corrected`.

## Endpoints

| Method & path | Who | Body / query | Response |
| --- | --- | --- | --- |
| `POST /login` | public | `{email, password}` | `{message, user, token, roles}`; 401 for bad credentials, 403 for a deactivated account |
| `POST /logout` | any | | `{message}` |
| `GET /me` | any | | `{user, roles}` |
| `POST /change-password` | any | `{current_password, password, password_confirmation}` (min 8) | `{message}` |
| `GET /projects` | any (scoped) | `view` (`all`, `stale` or `trashed`), `q` (customer or ERP number), `designer_id`, `product`, `status` (`open`, `not_started`, `in_progress`, `in_hand`, `installed`, `closed` or `lost`), `stage`, `production_status`, `date_field` (`created_at`, `erp_order_date` or `installation_date`), `from`, `to` | `{data: [project], meta: {stale_count}}`. Newest first; `view=stale` sorts by oldest `updated_at`. Stale means open and not updated for 3 days |
| `POST /projects` | manager, designer | `{customer_name, assigned_designer_id}` (a designer is always assigned to themselves) | 201 `{message, data}`; notifies the designer |
| `GET /projects/{id}` | any who can see it | | `{data: project}` (detail) |
| `GET /projects/{id}/tracking` | same | | `{data: [tracking]}`, newest first |
| `PATCH /projects/{id}/assign` | manager | `{customer_name?, assigned_designer_id?}` | `{message, data}`; reassigning notifies the new designer |
| `PATCH /projects/{id}/designer` | own designer (not closed), manager | any designer fields, `remark`, and optionally `revise: "<stage>"` | `{message, data}`, or `{message: "No changes.", data}` |
| `PATCH /projects/{id}/production` | production | (nothing editable; kept for compatibility) | `{message, data}` |
| `PUT /projects/{id}/installations` | own designer, manager | `{entries: [{sale_id, installed_on: "YYYY-MM-DD" or null}]}` | `{message, data}` |
| `POST /projects/{id}/lost` | own designer, manager | `{reason}` (max 500) | `{message, data}`; 422 if already lost or installed |
| `POST /projects/{id}/reopen` | own designer, manager | | `{message, data}` (undoes lost) |
| `POST /projects/{id}/close` | own designer, manager | `{closed_on}` | `{message, data}`; 422 if not installed or already closed |
| `DELETE /projects/{id}/close` | manager | | `{message, data}` (reopens a closed order) |
| `DELETE /projects/{id}` | `delete projects` permission | | `{message}` (soft delete, sets `deleted_at`) |
| `POST /projects/{id}/restore` | `delete projects` permission | | `{message, data}` |
| `GET /erp/orders/{number}` | manager, designer | the number may contain `/` | `{status: "found" or "not_found" or "unavailable", order_id, order_date, party_name, order_amount, gst_rate, order_total, message}` |
| `GET /dashboard/stats` | any | `from`, `to`, `designer_id` (manager or admin) | see below |
| `GET /products` | any | | `[{id, name}]` (active only) |
| `GET /products/manage` | `manage products` permission | | `[{id, name, sort_order, active}]` |
| `POST /products` | `manage products` permission | `{name, sort_order?}` | 201 `{message, data}` |
| `PATCH /products/{id}` | `manage products` permission | `{name?, sort_order?, active?}` | `{message, data}` |
| `GET /supervisors` | any | | `[{id, name, role}]`: active supervisors and designers |
| `GET /designers` | admin, manager | | `[{id, name, email}]`: active designers |
| `GET /settings` | manager | | `{company_name, company_address, company_phone, company_email, company_gstin, erp_base_url, erp_order_path, erp_date_field, erp_api_key_set}` |
| `PATCH /settings` | manager | the same keys, plus `erp_api_key` and `erp_api_key_clear` | `{message, data}` |
| `POST /settings/erp-test` | manager | `{number}` | same response as the ERP lookup |
| `GET /activity` | manager | `q`, `user_id`, `from`, `to`, `page` | `{data: [tracking + project: {id, customer_name, product_name, erp_order_number, deleted_at}], current_page, last_page, per_page: 50, total}` |
| `GET /notifications` | any | | `{data: [notification] (latest 30), unread}` |
| `POST /notifications/{id}/read` | owner | | `{message}` |
| `POST /notifications/read-all` | any | | `{message}` |
| `GET /users` | admin, manager | | `[user]` |
| `POST /users` | admin, manager | `{name, email, password, role, permissions?}`; only an admin can create an admin | 201 `{message, user}` |
| `PATCH /users/{id}` | admin, or a manager for non-admins | `{name?, is_active?, password?, role?, permissions?}`; no one can change their own role or deactivate themselves | `{message, user}` |
| `DELETE /users/{id}` | same | | `{message}` (deactivates the user and signs them out) |

### `GET /dashboard/stats` response

These figures cover the projects the user can report on: everything they can see, except that a designer counts only their own projects.

```json
{
  "range": { "from": "2026-09-01", "to": "2026-10-30", "all_time": true },
  "previous": null,
  "total": 10, "not_started": 1, "in_progress": 7, "installed": 2, "lost": 1, "stale": 3,
  "by_stage": [ { "key": "token", "label": "Token", "owner": "designer", "count": 1 }, "…", { "key": "installed", "label": "Installed", "owner": "production", "count": 1 } ],
  "stuck": [ { "id": 2, "customer_name": "…", "designer_name": "…", "product_name": "…", "days": 5, "status": "in_progress", "stage": "design_finalization", "project_value": "…" } ],
  "outcomes": { "total": { "count": 10, "value": 0 }, "in_progress": {}, "in_hand": { "count": 3, "value": 0, "advance": 180000 }, "closed": {}, "lost": {} },
  "kpis": { "customers": 10, "orders": 4, "installed": 2, "dispatched": 2, "order_value": 0, "advance_collected": 0, "balance_due": 0, "avg_order_value": 0 },
  "kpis_previous": null,
  "funnel": [ { "key": "customers", "label": "Customers", "count": 10, "pct_of_total": 100, "pct_of_prev": 100 } ],
  "cycle": { "token_to_order_days": 12.5, "order_to_installation_days": null },
  "production": { "in_production": 1, "awaiting_dispatch": 0, "awaiting_install": 1, "completed_in_range": 2, "dispatched_in_range": 2, "installed_in_range": 1 },
  "by_designer": [ { "designer_id": 3, "designer_name": "…", "total": 6, "active": 4, "installed": 2, "lost": 0, "customers": 6, "orders": 3, "conversion": 50, "order_value": 0 } ]
}
```

- Money keys (`value`, `advance`, `order_value`, `advance_collected`, `balance_due`, `avg_order_value` and `project_value`) are left out for roles that can't see money.
- `production` is included only for production users.
- `by_designer` is included only for admins and managers.

## Suggested Spring Boot layout

```
com.belaro.crm
├─ config/      SecurityConfig (stateless, Bearer token filter), CORS, Jackson snake_case
├─ domain/      User, ApiToken, Project, ProjectTracking, ProjectStageRevision, ProjectInstallation, Notification, Product, Setting
├─ repository/  Spring Data JPA repositories (+ a Specification for "projects visible to user")
├─ pipeline/    Stages (the table above), StageRules (validation order above)
├─ service/     ProjectService, InstallationService, DashboardService, NotificationService, ErpClient, FactorySyncJob (@Scheduled)
├─ web/         one @RestController per section of the endpoint table, plus @RestControllerAdvice for the 401/403/404/422 JSON
└─ resources/   application.yml (MySQL), Flyway migrations
```
