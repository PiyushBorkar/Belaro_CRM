import { useState } from 'react';
import { Building2, Eye, EyeOff, Package, Plug, Plus, SearchCheck } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { can } from '../../lib/permissions';
import { cn } from '../../lib/cn';
import { formatDate } from '../../lib/format';
import { useAllProducts, useCreateProduct, useSettings, useTestErp, useUpdateProduct, useUpdateSettings } from '../../services/queries';
import { Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, Page, PageHeader, PageSpinner, Table, TBody, TD, TH, THead, TR, Textarea } from '../ui';

// ─── Company ──────────────────────────────────────────────────────────────────

const COMPANY_FIELDS = ['company_name', 'company_address', 'company_phone', 'company_email', 'company_gstin'];

function CompanyForm({ settings }) {
  const [form, setForm] = useState(() => Object.fromEntries(COMPANY_FIELDS.map((k) => [k, settings[k] ?? ''])));
  const save = useUpdateSettings();
  const set = (k) => (e) => { save.reset(); setForm((f) => ({ ...f, [k]: e.target.value })); };

  return (
    <Card>
      <CardHeader icon={Building2} title="Company details" description="Shown on documents and used across the app." />
      <CardBody>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(form); }} className="space-y-4">
          {save.error && <Alert>{save.error.message}</Alert>}
          {save.isSuccess && <Alert tone="success">Company details saved.</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name" className="sm:col-span-2">{(id) => <Input id={id} value={form.company_name} onChange={set('company_name')} />}</Field>
            <Field label="Address" className="sm:col-span-2">{(id) => <Textarea id={id} value={form.company_address} onChange={set('company_address')} />}</Field>
            <Field label="Phone">{(id) => <Input id={id} value={form.company_phone} onChange={set('company_phone')} />}</Field>
            <Field label="Email">{(id) => <Input id={id} type="email" value={form.company_email} onChange={set('company_email')} />}</Field>
            <Field label="GSTIN">{(id) => <Input id={id} value={form.company_gstin} onChange={set('company_gstin')} className="uppercase" />}</Field>
          </div>
          <div className="flex justify-end border-t border-border pt-4">
            <Button type="submit" loading={save.isPending}>Save details</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

// ─── ERP connection ───────────────────────────────────────────────────────────

function ErpForm({ settings }) {
  const [form, setForm] = useState({
    erp_base_url: settings.erp_base_url ?? '',
    erp_order_path: settings.erp_order_path ?? '/orders/{number}',
    erp_date_field: settings.erp_date_field ?? 'order_date',
    erp_api_key: '',
  });
  const [showKey, setShowKey] = useState(false);
  const [testNumber, setTestNumber] = useState('');
  const save = useUpdateSettings();
  const test = useTestErp();
  const set = (k) => (e) => { save.reset(); setForm((f) => ({ ...f, [k]: e.target.value })); };
  const fieldErrors = save.error?.errors ?? {};

  function handleSubmit(e) {
    e.preventDefault();
    save.mutate(form, { onSuccess: () => setForm((f) => ({ ...f, erp_api_key: '' })) });
  }

  const example = form.erp_base_url ? `${form.erp_base_url.replace(/\/$/, '')}${(form.erp_order_path || '').replace('{number}', 'SO-10234')}` : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          icon={Plug}
          title="ERP connection"
          description="When a designer enters an ERP order number, Belaro looks it up here and takes the order date."
          actions={settings.erp_base_url ? <Badge tone="success" dot>Connected</Badge> : <Badge dot>Not set up</Badge>}
        />
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            {save.error && !Object.keys(fieldErrors).length && <Alert>{save.error.message}</Alert>}
            {save.isSuccess && <Alert tone="success">ERP connection saved.</Alert>}

            <Field label="ERP API address" error={fieldErrors.erp_base_url?.[0]} hint="The base URL of your ERP's API, e.g. https://erp.yourcompany.com/api">
              {(id) => <Input id={id} type="url" value={form.erp_base_url} onChange={set('erp_base_url')} placeholder="https://" />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Order lookup path" error={fieldErrors.erp_order_path?.[0]} hint="{number} is replaced by the order number.">
                {(id) => <Input id={id} value={form.erp_order_path} onChange={set('erp_order_path')} className="font-mono text-[13px]" />}
              </Field>
              <Field label="Order date field" error={fieldErrors.erp_date_field?.[0]} hint="Where the date is in the response, e.g. data.order_date">
                {(id) => <Input id={id} value={form.erp_date_field} onChange={set('erp_date_field')} className="font-mono text-[13px]" />}
              </Field>
            </div>
            <Field label="API key" hint={settings.erp_api_key_set ? 'A key is saved. Leave blank to keep it.' : 'Sent as a Bearer token. Stored encrypted.'}>
              {(id) => (
                <div className="relative">
                  <Input id={id} type={showKey ? 'text' : 'password'} value={form.erp_api_key} onChange={set('erp_api_key')}
                    placeholder={settings.erp_api_key_set ? '••••••••••••' : ''} autoComplete="off" className="pr-9 font-mono text-[13px]" />
                  <button type="button" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? 'Hide key' : 'Show key'}
                    className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-fg-subtle hover:text-fg">
                    {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              )}
            </Field>

            {example && <p className="rounded-lg bg-surface-muted px-3 py-2 font-mono text-xs break-all text-fg-muted">GET {example}</p>}

            <div className="flex justify-end border-t border-border pt-4">
              <Button type="submit" loading={save.isPending}>Save connection</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader icon={SearchCheck} title="Test the connection" description="Looks up a real order number with the saved settings." />
        <CardBody className="space-y-3">
          <form onSubmit={(e) => { e.preventDefault(); test.mutate(testNumber.trim()); }} className="flex gap-2">
            <Input value={testNumber} onChange={(e) => setTestNumber(e.target.value)} placeholder="Order number, e.g. SO-10234" aria-label="Order number" />
            <Button type="submit" variant="secondary" loading={test.isPending} disabled={!testNumber.trim()}>Test</Button>
          </form>
          {test.data && (
            <Alert tone={test.data.status === 'found' ? 'success' : test.data.status === 'not_found' ? 'warning' : 'danger'}>
              {test.data.status === 'found' ? `Found. Order date: ${formatDate(test.data.order_date)}.` : test.data.message}
            </Alert>
          )}
          {test.error && <Alert>{test.error.message}</Alert>}
        </CardBody>
      </Card>
    </div>
  );
}

// ─── Products ─────────────────────────────────────────────────────────────────

function ProductRow({ product }) {
  const [name, setName] = useState(product.name);
  const update = useUpdateProduct();
  const dirty = name.trim() && name.trim() !== product.name;

  return (
    <TR>
      <TD>
        <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Product name" className={cn('h-8 max-w-xs', !product.active && 'text-fg-subtle')} />
        {update.error && <p className="mt-1 text-xs text-danger">{update.error.message}</p>}
      </TD>
      <TD>{product.active ? <Badge tone="success" dot>In use</Badge> : <Badge dot>Hidden</Badge>}</TD>
      <TD className="text-right">
        <div className="flex justify-end gap-1">
          {dirty && <Button size="sm" loading={update.isPending} onClick={() => update.mutate({ id: product.id, name: name.trim() })}>Save</Button>}
          <Button variant="ghost" size="sm" onClick={() => update.mutate({ id: product.id, active: !product.active })} disabled={update.isPending}>
            {product.active ? 'Hide' : 'Show'}
          </Button>
        </div>
      </TD>
    </TR>
  );
}

function ProductsPanel() {
  const { data: products = [], isPending } = useAllProducts();
  const [name, setName] = useState('');
  const create = useCreateProduct();

  function handleAdd(e) {
    e.preventDefault();
    create.mutate({ name: name.trim(), sort_order: products.length + 1 }, { onSuccess: () => setName('') });
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader icon={Package} title="Products" description="The product list designers pick from. Hidden products stay on old projects but can't be chosen." />
      <form onSubmit={handleAdd} className="flex gap-2 border-b border-border p-4">
        <Input value={name} onChange={(e) => { create.reset(); setName(e.target.value); }} placeholder="New product, e.g. Modular kitchen" aria-label="New product name" />
        <Button type="submit" icon={Plus} loading={create.isPending} disabled={!name.trim()}>Add</Button>
      </form>
      {create.error && <Alert className="m-4">{create.error.message}</Alert>}
      {isPending ? <PageSpinner /> : products.length === 0 ? (
        <EmptyState icon={Package} title="No products yet" description="Add the products you sell so designers can choose them." />
      ) : (
        <Table>
          <THead><TH>Name</TH><TH>Status</TH><TH className="text-right">Actions</TH></THead>
          <TBody>{products.map((p) => <ProductRow key={`${p.id}-${p.name}`} product={p} />)}</TBody>
        </Table>
      )}
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { user } = useAuth();
  const tabs = [
    can.manageSettings(user) && { id: 'company', label: 'Company', icon: Building2 },
    can.manageSettings(user) && { id: 'erp', label: 'ERP connection', icon: Plug },
    can.manageProducts(user) && { id: 'products', label: 'Products', icon: Package },
  ].filter(Boolean);
  const [tab, setTab] = useState(tabs[0]?.id);
  const { data: settings, isPending, error } = useSettingsIf(can.manageSettings(user));

  return (
    <Page className="max-w-4xl">
      <PageHeader title="Settings" description="Company details, the ERP connection and the product list." />

      <div className="flex gap-1 rounded-xl border border-border bg-surface p-1 shadow-xs sm:w-fit" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={cn('flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors sm:flex-none',
              tab === t.id ? 'bg-primary-soft text-primary-soft-fg' : 'text-fg-muted hover:text-fg')}>
            <t.icon className="size-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'products' ? <ProductsPanel /> : error ? <Alert>{error.message}</Alert> : isPending ? <PageSpinner /> : (
        tab === 'erp' ? <ErpForm settings={settings} /> : <CompanyForm settings={settings} />
      )}
    </Page>
  );
}

// Settings are only loaded for managers (product managers may not read them)
function useSettingsIf(enabled) {
  const query = useSettings(enabled);
  return enabled ? query : { data: null, isPending: false, error: null };
}
