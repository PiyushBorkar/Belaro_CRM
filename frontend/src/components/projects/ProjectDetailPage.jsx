import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Ban, CheckCircle2, History, Lock, RotateCcw, Trash2 } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { can } from '../../lib/permissions';
import { formatDate, formatDateTime } from '../../lib/format';
import { useDeleteProject, useMarkLost, useProject, useReopenClosedProject, useReopenProject, useRestoreProject } from '../../services/queries';
import { Alert, Badge, Button, ButtonLink, Card, CardBody, CardHeader, Field, Modal, Page, PageHeader, PageSpinner, Textarea } from '../ui';
import { CloseOrderButton } from './CloseOrderButton';
import { InHandBadge, StageBadge, StatusBadge } from './StatusBadge';
import { ManagerInfoSection } from './sections/ManagerInfoSection';
import { DesignerPipelineSection } from './sections/DesignerPipelineSection';
import { ProductionSection } from './sections/ProductionSection';
import { RemarkSection } from './sections/RemarkSection';
import { ProjectTrackingTimeline } from './ProjectTrackingTimeline';

function BinActions({ project }) {
  const navigate = useNavigate();
  const remove = useDeleteProject(project.id);
  const restore = useRestoreProject(project.id);

  if (project.deleted_at) {
    return <Button variant="secondary" icon={RotateCcw} loading={restore.isPending} onClick={() => restore.mutate()}>Restore</Button>;
  }

  function handleDelete() {
    if (confirm(`Move ${project.customer_name} to the bin? You can restore it later from Projects → Bin.`)) {
      remove.mutate(undefined, { onSuccess: () => navigate('/projects') });
    }
  }

  return <Button variant="danger-ghost" icon={Trash2} loading={remove.isPending} onClick={handleDelete}>Delete</Button>;
}

// "Order Lost" from the old sheet: ask why, then freeze the project
function MarkLostModal({ project, onClose }) {
  const [reason, setReason] = useState('');
  const markLost = useMarkLost(project.id);

  return (
    <Modal
      title="Mark this order as lost?"
      description={`${project.customer_name} moves out of the open pipeline and can't be edited until it is reopened.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" type="submit" form="lost-form" loading={markLost.isPending} disabled={!reason.trim()}>Mark as lost</Button>
        </>
      }
    >
      <form id="lost-form" onSubmit={(e) => { e.preventDefault(); markLost.mutate(reason.trim(), { onSuccess: onClose }); }} className="space-y-4">
        {markLost.error && <Alert>{markLost.error.message}</Alert>}
        <Field label="Why was it lost?" required hint="e.g. went with another vendor, budget, project cancelled">
          {(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus required maxLength={500} />}
        </Field>
      </form>
    </Modal>
  );
}

function LostBanner({ project, canReopen }) {
  const reopen = useReopenProject(project.id);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-danger/25 bg-danger-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3 text-danger-soft-fg">
        <Ban className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">Order lost · {formatDateTime(project.lost_at)}</p>
          <p className="mt-0.5 text-[13px]">{project.lost_reason}</p>
          {reopen.error && <p className="mt-1 text-xs">{reopen.error.message}</p>}
        </div>
      </div>
      {canReopen && <Button variant="secondary" size="sm" icon={RotateCcw} loading={reopen.isPending} onClick={() => reopen.mutate()}>Reopen</Button>}
    </div>
  );
}

function ClosedBanner({ project, canReopen }) {
  const reopen = useReopenClosedProject(project.id);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-success/25 bg-success-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3 text-success-soft-fg">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">Order closed · {formatDate(project.closed_on)}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[13px]">
            {canReopen ? 'You can still change it as a manager, or reopen it for the designer.' : <><Lock className="size-3" />Only a manager can change this order now.</>}
          </p>
          {reopen.error && <p className="mt-1 text-xs">{reopen.error.message}</p>}
        </div>
      </div>
      {canReopen && <Button variant="secondary" size="sm" icon={RotateCcw} loading={reopen.isPending} onClick={() => reopen.mutate()}>Reopen</Button>}
    </div>
  );
}

export function ProjectDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: project, isPending, error } = useProject(id);
  const [askLost, setAskLost] = useState(false);

  if (isPending) return <PageSpinner />;

  if (error) {
    return (
      <Page className="max-w-2xl">
        <Alert title="Couldn't open this project">{error.message}</Alert>
        <ButtonLink to="/projects" variant="secondary">Back to projects</ButtonLink>
      </Page>
    );
  }

  const deleted = !!project.deleted_at;
  const lost = project.status === 'lost';
  const frozen = deleted || lost;
  const designerCanEdit = !frozen && can.editDesignerFields(user, project);
  const canMarkLost = !deleted && can.markLost(user, project);
  const closed = project.status === 'closed';

  return (
    <Page>
      <PageHeader
        back={{ to: '/projects', label: 'Projects' }}
        title={project.customer_name}
        meta={
          <>
            <StatusBadge status={project.status} />
            {project.in_hand && <InHandBadge />}
            {!['installed', 'closed', 'lost'].includes(project.status) && <StageBadge stage={project.stage} />}
            {project.erp_order_number && <Badge tone="neutral" className="tabular">ERP {project.erp_order_number}</Badge>}
          </>
        }
        description={`Created ${formatDate(project.created_at)}${project.creator ? ` by ${project.creator.name}` : ''} · Last updated ${formatDate(project.updated_at)}`}
        actions={
          <>
            <CloseOrderButton project={project} />
            {canMarkLost && !lost && !['installed', 'closed'].includes(project.status) && (
              <Button variant="secondary" icon={Ban} onClick={() => setAskLost(true)}>Mark as lost</Button>
            )}
            {can.deleteProjects(user) && <BinActions project={project} />}
          </>
        }
      />

      {can.superviseOnly(user, project) && (
        <Alert tone="info" title="You are the site supervisor on this project">
          It is assigned to another designer, so you can follow it here but not change it.
        </Alert>
      )}
      {deleted && <Alert tone="warning" title="This project is in the bin">It is hidden from lists and reports until it is restored.</Alert>}
      {lost && <LostBanner project={project} canReopen={canMarkLost} />}
      {closed && !deleted && <ClosedBanner project={project} canReopen={can.reopenClosedOrder(user)} />}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <ManagerInfoSection project={project} editable={!frozen && can.assignProject(user)} />
          <DesignerPipelineSection project={project} editable={designerCanEdit} />
          <ProductionSection project={project} editable={!frozen && can.editProductionFields(user, project)} />
          <RemarkSection project={project} editable={designerCanEdit} />
        </div>

        {/* min-w-0: a grid item otherwise grows to its longest line instead of wrapping it */}
        <Card className="h-fit min-w-0 xl:sticky xl:top-6">
          <CardHeader icon={History} title="Activity" description="Every change, newest first." />
          {/* Long histories scroll inside the card: up to the window height on wide screens, 32rem otherwise */}
          <CardBody className="scroll-thin max-h-[32rem] overflow-y-auto xl:max-h-[calc(100vh-var(--header-height)-11rem)]">
            <ProjectTrackingTimeline projectId={project.id} />
          </CardBody>
        </Card>
      </div>

      {askLost && <MarkLostModal project={project} onClose={() => setAskLost(false)} />}
    </Page>
  );
}
