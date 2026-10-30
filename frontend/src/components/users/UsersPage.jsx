import { useState } from 'react';
import { Lock, Pencil, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { can, PERMISSIONS } from '../../lib/permissions';
import { useCreateUser, useDeactivateUser, useUpdateUser, useUsers } from '../../services/queries';
import { Alert, Avatar, Badge, Button, Card, EmptyState, Field, Input, Modal, Page, PageHeader, Select, Skeleton, Table, TBody, TD, TH, THead, TR } from '../ui';

const ROLES = {
  admin:      { label: 'Admin',      tone: 'danger',  hint: 'Sees every number and project. Changes no project data.' },
  manager:    { label: 'Manager',    tone: 'primary', hint: 'Creates and assigns projects, corrects designer entries, runs the team.' },
  designer:   { label: 'Designer',   tone: 'info',    hint: 'Creates their own projects and fills the design & order steps.' },
  production: { label: 'Production', tone: 'warning', hint: 'Fills production, dispatch and installation.' },
  supervisor: { label: 'Supervisor', tone: 'neutral', hint: 'Read-only view of the sites they supervise.' },
};

// Extra abilities a manager can hand to one person
const GRANTS = [
  { key: PERMISSIONS.manageProducts, label: 'Manage products', hint: 'Add, rename and hide products.' },
  { key: PERMISSIONS.deleteProjects, label: 'Delete projects', hint: 'Move projects to the bin and restore them.' },
  { key: PERMISSIONS.fixProduction,  label: 'Fix production entries', hint: 'Correct locked production steps (production head).' },
];

function RoleBadge({ role }) {
  const cfg = ROLES[role] ?? { label: role, tone: 'neutral' };
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

function UserModal({ editUser, onClose }) {
  const { user: me } = useAuth();
  const isEdit = !!editUser;
  const isSelf = isEdit && editUser.id === me.id;
  const roleOptions = Object.keys(ROLES).filter((r) => r !== 'admin' || can.grantAdmin(me));

  const [form, setForm] = useState(
    isEdit
      ? { name: editUser.name, password: '', role: editUser.roles?.[0] ?? 'designer', permissions: editUser.direct_permissions ?? [] }
      : { name: '', email: '', password: '', role: 'designer', permissions: [] },
  );
  const create = useCreateUser();
  const update = useUpdateUser();
  const mutation = isEdit ? update : create;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (perm) => setForm((f) => ({
    ...f,
    permissions: f.permissions.includes(perm) ? f.permissions.filter((p) => p !== perm) : [...f.permissions, perm],
  }));

  // Permissions the role already gives (manager holds products + delete)
  const fromRole = form.role === 'manager' ? [PERMISSIONS.manageProducts, PERMISSIONS.deleteProjects] : [];

  function handleSubmit(e) {
    e.preventDefault();
    const permissions = form.permissions.filter((p) => !fromRole.includes(p));
    if (isEdit) {
      const payload = { id: editUser.id, name: form.name, permissions };
      if (!isSelf) payload.role = form.role;
      if (form.password) payload.password = form.password;
      update.mutate(payload, { onSuccess: onClose });
    } else {
      create.mutate({ ...form, permissions }, { onSuccess: onClose });
    }
  }

  return (
    <Modal
      title={isEdit ? 'Edit team member' : 'Add team member'}
      description={isEdit ? editUser.email : 'They can sign in with this email and password.'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="user-form" loading={mutation.isPending}>{isEdit ? 'Save changes' : 'Add member'}</Button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
        {mutation.error && <Alert>{mutation.error.message}</Alert>}

        <Field label="Full name" required>
          {(id) => <Input id={id} value={form.name} onChange={set('name')} required autoFocus />}
        </Field>

        {!isEdit && (
          <Field label="Email" required>
            {(id) => <Input id={id} type="email" value={form.email} onChange={set('email')} required />}
          </Field>
        )}

        <Field label={isEdit ? 'New password' : 'Password'} required={!isEdit} hint={isEdit ? 'Leave blank to keep the current password.' : 'At least 8 characters.'}>
          {(id) => <Input id={id} type="password" value={form.password} onChange={set('password')} required={!isEdit} minLength={8} autoComplete="new-password" />}
        </Field>

        <Field label="Role" required hint={isSelf ? 'You cannot change your own role.' : ROLES[form.role]?.hint}>
          {(id) => (
            <Select id={id} value={form.role} onChange={set('role')} disabled={isSelf}>
              {roleOptions.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
            </Select>
          )}
        </Field>

        {form.role !== 'admin' && (
          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-[13px] font-medium text-fg">Extra permissions</legend>
            {GRANTS.map((g) => {
              const inherited = fromRole.includes(g.key);
              return (
                <label key={g.key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-surface-muted has-disabled:cursor-default">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-(--primary)"
                    checked={inherited || form.permissions.includes(g.key)}
                    disabled={inherited}
                    onChange={() => toggle(g.key)}
                  />
                  <span>
                    <span className="block text-[13px] font-medium text-fg">{g.label}</span>
                    <span className="block text-xs text-fg-subtle">{inherited ? 'Included with the Manager role.' : g.hint}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        )}
      </form>
    </Modal>
  );
}

export function UsersPage() {
  const { user: me } = useAuth();
  const { data: users = [], isPending, error } = useUsers();
  const deactivate = useDeactivateUser();
  const reactivate = useUpdateUser();
  // null = closed, {} = new user, user object = edit
  const [modal, setModal] = useState(null);

  function handleDeactivate(user) {
    if (confirm(`Deactivate ${user.name}? They will be signed out and can no longer log in.`)) {
      deactivate.mutate(user.id);
    }
  }

  return (
    <Page>
      <PageHeader
        title="Team members"
        description="Everyone who can sign in to Belaro, and what they can do."
        actions={<Button icon={UserPlus} onClick={() => setModal({})}>Add member</Button>}
      />

      {(error || deactivate.error || reactivate.error) && <Alert>{(error ?? deactivate.error ?? reactivate.error).message}</Alert>}

      <Card className="overflow-hidden">
        {isPending ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : users.length === 0 ? (
          <EmptyState icon={Users} title="No team members yet" />
        ) : (
          <Table>
            <THead>
              <TH>Name</TH>
              <TH>Role</TH>
              <TH>Extra permissions</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </THead>
            <TBody>
              {users.map((u) => (
                <TR key={u.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-fg">{u.name}{u.id === me.id && <span className="ml-1.5 text-xs font-normal text-fg-subtle">(you)</span>}</p>
                        <p className="truncate text-xs text-fg-subtle">{u.email}</p>
                      </div>
                    </div>
                  </TD>
                  <TD><div className="flex gap-1.5">{(u.roles ?? []).map((r) => <RoleBadge key={r} role={r} />)}</div></TD>
                  <TD>
                    <div className="flex flex-wrap gap-1.5">
                      {(u.direct_permissions ?? []).length
                        ? u.direct_permissions.map((p) => <Badge key={p} className="capitalize">{p}</Badge>)
                        : <span className="text-fg-subtle">—</span>}
                    </div>
                  </TD>
                  <TD>{u.is_active ? <Badge tone="success" dot>Active</Badge> : <Badge dot>Inactive</Badge>}</TD>
                  <TD className="text-right">
                    {u.can_edit ? (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setModal(u)}>Edit</Button>
                        {u.is_active && u.id !== me.id && (
                          <Button variant="danger-ghost" size="sm" onClick={() => handleDeactivate(u)} disabled={deactivate.isPending}>
                            Deactivate
                          </Button>
                        )}
                        {!u.is_active && (
                          <Button variant="ghost" size="sm" onClick={() => reactivate.mutate({ id: u.id, is_active: true })} disabled={reactivate.isPending}>
                            Reactivate
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-fg-subtle" title="Only an admin can change an admin account">
                        <Lock className="size-3" />Admin only
                      </span>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {modal && <UserModal editUser={modal.id ? modal : null} onClose={() => setModal(null)} />}
    </Page>
  );
}
