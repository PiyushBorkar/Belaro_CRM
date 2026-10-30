import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { useChangePassword } from '../../services/queries';
import { Alert, Avatar, Badge, Button, Card, CardBody, CardHeader, Field, Input, Page, PageHeader } from '../ui';

const EMPTY = { current_password: '', password: '', password_confirmation: '' };

export function ProfilePage() {
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const change = useChangePassword();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    change.mutate(form, { onSuccess: () => setForm(EMPTY) });
  }

  return (
    <Page className="max-w-3xl">
      <PageHeader title="My profile" description="Your account details and password." />

      <Card>
        <CardBody className="flex items-center gap-4 py-5">
          <Avatar name={user?.name} className="size-12 text-base" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-fg">{user?.name}</p>
            <p className="truncate text-sm text-fg-muted">{user?.email}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(user?.roles ?? []).map((r) => <Badge key={r} tone="primary" className="capitalize">{r}</Badge>)}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader icon={KeyRound} title="Change password" description="Use at least 8 characters." />
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            {change.error && <Alert>{change.error.message}</Alert>}
            {change.isSuccess && <Alert tone="success">Password updated successfully.</Alert>}

            <Field label="Current password" required>
              {(id) => <Input id={id} type="password" value={form.current_password} onChange={set('current_password')} required autoComplete="current-password" />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="New password" required>
                {(id) => <Input id={id} type="password" value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" />}
              </Field>
              <Field label="Confirm new password" required>
                {(id) => <Input id={id} type="password" value={form.password_confirmation} onChange={set('password_confirmation')} required minLength={8} autoComplete="new-password" />}
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={change.isPending}>Update password</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </Page>
  );
}
