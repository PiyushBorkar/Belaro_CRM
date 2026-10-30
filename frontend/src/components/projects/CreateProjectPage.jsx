import { useState } from 'react';
import { useNavigate } from 'react-router';
import { FolderPlus } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { can } from '../../lib/permissions';
import { useCreateProject, useDesigners } from '../../services/queries';
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Page, PageHeader, Select } from '../ui';

export function CreateProjectPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const choosesDesigner = can.chooseDesigner(user); // designers' projects are always their own
  const [customerName, setCustomerName] = useState('');
  const [designerId, setDesignerId] = useState('');
  const { data: designers = [], isPending: loadingDesigners } = useDesigners(choosesDesigner);
  const create = useCreateProject();

  function handleSubmit(e) {
    e.preventDefault();
    create.mutate(
      choosesDesigner ? { customer_name: customerName, assigned_designer_id: Number(designerId) } : { customer_name: customerName },
      { onSuccess: (res) => navigate(`/projects/${res.data.id}`) },
    );
  }

  return (
    <Page className="max-w-2xl">
      <PageHeader
        title="New project"
        description={choosesDesigner ? 'Add the customer and assign a designer to start the pipeline.' : 'Add a customer. The project is assigned to you.'}
        back={{ to: '/projects', label: 'Projects' }}
      />

      <Card>
        <CardHeader icon={FolderPlus} title="Project details" />
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-5">
            {create.error && <Alert>{create.error.message}</Alert>}

            <Field label="Customer name" required>
              {(id) => <Input id={id} value={customerName} onChange={(e) => setCustomerName(e.target.value)} required autoFocus placeholder="e.g. Rahul Mehta" />}
            </Field>

            {choosesDesigner && (
              <Field
                label="Assign designer"
                required
                hint={!loadingDesigners && designers.length === 0 ? 'No active designers yet. Add one under Team members first.' : undefined}
              >
                {(id) => (
                  <Select id={id} value={designerId} onChange={(e) => setDesignerId(e.target.value)} required disabled={loadingDesigners}>
                    <option value="">{loadingDesigners ? 'Loading…' : 'Select a designer'}</option>
                    {designers.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.email})</option>)}
                  </Select>
                )}
              </Field>
            )}

            <div className="flex justify-end gap-2 border-t border-border pt-5">
              <Button variant="secondary" onClick={() => navigate('/projects')}>Cancel</Button>
              <Button type="submit" loading={create.isPending} disabled={choosesDesigner && !designerId}>Create project</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </Page>
  );
}
