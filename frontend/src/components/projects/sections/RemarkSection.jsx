import { useState } from 'react';
import { NotebookPen, Pencil } from 'lucide-react';
import { useUpdateDesignerFields } from '../../../services/queries';
import { Alert, Button, Card, CardBody, CardHeader, Textarea } from '../../ui';

function EditForm({ project, onDone }) {
  const [remark, setRemark] = useState(project.remark ?? '');
  const update = useUpdateDesignerFields(project.id);

  function handleSubmit(e) {
    e.preventDefault();
    update.mutate({ remark: remark.trim() || null }, { onSuccess: onDone });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {update.error && <Alert>{update.error.message}</Alert>}
      <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={4} autoFocus aria-label="Remark"
        placeholder="Customer preferences, site notes, pending items…" />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone} disabled={update.isPending}>Cancel</Button>
        <Button type="submit" loading={update.isPending}>Save note</Button>
      </div>
    </form>
  );
}

// Free-text note on the project. Never locked; designer and manager can edit it.
export function RemarkSection({ project, editable }) {
  const [editing, setEditing] = useState(false);

  return (
    <Card>
      <CardHeader
        icon={NotebookPen}
        title="Remark"
        actions={editable && !editing && <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditing(true)}>{project.remark ? 'Edit' : 'Add'}</Button>}
      />
      <CardBody>
        {editing ? (
          <EditForm key={project.updated_at} project={project} onDone={() => setEditing(false)} />
        ) : project.remark ? (
          <p className="text-sm leading-6 whitespace-pre-line text-fg">{project.remark}</p>
        ) : (
          <p className="text-[13px] text-fg-subtle">No remark yet.</p>
        )}
      </CardBody>
    </Card>
  );
}
