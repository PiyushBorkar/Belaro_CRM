import { Factory } from 'lucide-react';
import { useAuth } from '../../../features/auth/AuthContext';
import { can } from '../../../lib/permissions';
import { stagesOf } from '../../../lib/pipeline';
import { useUpdateProductionFields } from '../../../services/queries';
import { StagePipeline } from './StagePipeline';

const STAGES = stagesOf('production');

export function ProductionSection({ project, editable }) {
  const { user } = useAuth();
  const mutation = useUpdateProductionFields(project.id);

  return (
    <StagePipeline
      title="Production & delivery"
      description={project.factory_production_login_date
        ? 'Production and dispatch update automatically from the factory and the ERP. The designer then enters the installation date.'
        : 'Opens once the factory plans this order.'}
      icon={Factory}
      stages={STAGES}
      project={project}
      editable={editable}
      canBypassLocks={can.bypassProductionLocks(user)}
      showMoney={false}
      mutation={mutation}
      waitingText="This step is waiting for the production team."
      lockedText="Locked — your production head can correct this step."
      overrideText="This step is locked. You can correct it because you have the “fix production entries” permission. The change is logged."
    />
  );
}
