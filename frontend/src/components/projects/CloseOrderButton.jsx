import { useState } from 'react';
import { CheckCircle2, Lock } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { can } from '../../lib/permissions';
import { formatDate, today } from '../../lib/format';
import { useCloseProject } from '../../services/queries';
import { Alert, Button, Field, Input, Modal } from '../ui';

// "Order closed": the last step after installation, with the date it was closed
function CloseOrderModal({ project, onClose }) {
  const [closedOn, setClosedOn] = useState(today());
  const close = useCloseProject(project.id);

  return (
    <Modal
      title="Close this order?"
      description={`Confirms ${project.customer_name}'s order is finished. After this only a manager can change it.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="close-form" icon={CheckCircle2} loading={close.isPending} disabled={!closedOn}>Close order</Button>
        </>
      }
    >
      <form id="close-form" onSubmit={(e) => { e.preventDefault(); close.mutate(closedOn, { onSuccess: onClose }); }} className="space-y-4">
        {close.error && <Alert>{close.error.message}</Alert>}
        <Field label="Order closed on" required>
          {(id) => <Input id={id} type="date" className="tabular" value={closedOn} onChange={(e) => setClosedOn(e.target.value)} autoFocus required />}
        </Field>
      </form>
    </Modal>
  );
}

/** The "Order closed" step of the designer's bar: closed, ready to close, or waiting for installation. */
export function ClosingStep({ project }) {
  if (project.closed_on) {
    return (
      <div className="rounded-xl border border-success/25 bg-success-soft/50 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-success-soft-fg"><CheckCircle2 className="size-4" />Order closed on {formatDate(project.closed_on)}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-fg-muted"><Lock className="size-3" />Only a manager can change this order now.</p>
      </div>
    );
  }

  if (project.status === 'installed') {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary-soft/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-fg">Everything is installed</p>
          <p className="mt-0.5 text-xs text-fg-muted">Installation completed on {formatDate(project.installation_date)}. Close the order to finish it.</p>
        </div>
        <CloseOrderButton project={project} size="sm" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-border-strong p-6 text-center text-[13px] text-fg-muted">
      <p className="font-medium text-fg">Waiting for installation.</p>
      <p className="mt-1">The order can be closed once every dispatched item is installed.</p>
    </div>
  );
}

/** Shown once everything is installed (status "installed") to the manager or the project's designer. */
export function CloseOrderButton({ project, size }) {
  const { user } = useAuth();
  const [asking, setAsking] = useState(false);

  if (project.status !== 'installed' || project.deleted_at || !can.closeOrder(user, project)) return null;

  return (
    <>
      <Button size={size} icon={CheckCircle2} onClick={() => setAsking(true)}>Close order</Button>
      {asking && <CloseOrderModal project={project} onClose={() => setAsking(false)} />}
    </>
  );
}
