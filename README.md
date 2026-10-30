# Belaro CRM1

Furniture order-tracking CRM: one shared timeline per order, from the customer's first visit through
design, quotation, ERP order, factory production, dispatch, installation and order closure.

This repository holds the **React frontend**. It runs on its own with a built-in **demo API**, which
needs no server. The backend (Java Spring Boot) is built separately against [API.md](API.md).

## Run it

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

On the login page, pick a demo account (manager, designer, production, supervisor or admin). The password
for every demo account is `password`. Demo data is stored in your browser; **Reset demo data** on the login
page starts it again.

In demo mode:

- The **ERP** treats any order number like `SO-10234` as an existing order.
- The **factory and dispatch sync** moves each ordered project one step every 20 seconds: planned,
  cutting through packing, partly dispatched, then fully dispatched. Watch it in the project's activity
  panel and the notification bell.

## Connect the Spring Boot API

1. Build the API to match [API.md](API.md), on port 8080 under `/api`.
2. Create `frontend/.env` from `.env.example`:

   ```
   VITE_USE_MOCK=false
   VITE_API_BASE_URL=/api
   ```

3. Run `npm run dev`. Vite proxies `/api` to `http://127.0.0.1:8080` (see `vite.config.js`).

For a production build served from a different host, set `VITE_API_BASE_URL=https://your-api/api` and
allow that origin in Spring's CORS configuration.

## Stack

React 19, React Router 7, TanStack Query 5, Vite 8, Tailwind CSS 4 and lucide-react.

## Where things are

| Path | What it does |
| --- | --- |
| `frontend/src/services/api.js` | Every API call; switches between the demo API and the real one |
| `frontend/src/services/queries.js` | TanStack Query hooks and cache invalidation |
| `frontend/src/lib/pipeline.js` | Order stages and fields as the UI shows them |
| `frontend/src/lib/permissions.js` | What each role sees in the UI (the API enforces the same rules) |
| `frontend/src/components/` | Pages: dashboard, projects, project detail (stage pipeline, revisions, installation, close), activity, users, settings |
| `frontend/src/mock/` | Demo API: `server.js` (endpoints), `model.js` (stage rules), `erp.js` (demo ERP and sync), `db.js` (seed data) |
