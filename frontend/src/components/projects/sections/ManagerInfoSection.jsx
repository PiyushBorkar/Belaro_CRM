import { useState } from 'react';
import { Pencil, UserRoundCog } from 'lucide-react';
import { useAssignProject, useDesigners } from '../../../services/queries';
import { Alert, Avatar, Button, Card, CardBody, CardHeader, DataItem, Field, Input, Select } from '../../ui';

function EditForm({ project, onDone }) {
  const [customerName, setCustomerName] = useState(project.customer_name);
  const [designerId, setDesignerId] = useState(String(project.assigned_designer_id));
  const { data: designers = [] } = useDesigners();
  const assign = useAssignProject(project.id);

  // Keep the current designer selectable even if they are no longer active
  const currentMissing = project.assigned_designer && !designers.some((d) => d.id === project.assigned_designer_id);

  function handleSubmit(e) {
    e.preventDefault();
    assign.mutate(
      { customer_name: customerName, assigned_designer_id: Number(designerId) },
      { onSuccess: onDone },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {assign.error && <Alert>{assign.error.message}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Customer name" required>
          {(id) => <Input id={id} value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />}
        </Field>
        <Field label="Assigned designer" required>
          {(id) => (
            <Select id={id} value={designerId} onChange={(e) => setDesignerId(e.target.value)}>
              {currentMissing && <option value={project.assigned_designer_id}>{project.assigned_designer.name}</option>}
              {designers.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.email})</option>)}
            </Select>
          )}
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone} disabled={assign.isPending}>Cancel</Button>
        <Button type="submit" loading={assign.isPending}>Save changes</Button>
      </div>
    </form>
  );
}

export function ManagerInfoSection({ project, editable }) {
  const [editing, setEditing] = useState(false);

  return (
    <Card>
      <CardHeader
        icon={UserRoundCog}
        title="Customer & assignment"
        actions={editable && !editing && <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>}
      />
      <CardBody>
        {editing ? (
          <EditForm project={project} onDone={() => setEditing(false)} />
        ) : (
          <dl className="grid gap-5 sm:grid-cols-2">
            <DataItem label="Customer name">{project.customer_name}</DataItem>
            <DataItem label="Assigned designer">
              {project.assigned_designer && (
                <span className="flex items-center gap-2">
                  <Avatar name={project.assigned_designer.name} className="size-6 text-[10px]" />
                  {project.assigned_designer.name}
                </span>
              )}
            </DataItem>
          </dl>
        )}
      </CardBody>
    </Card>
  );
}
