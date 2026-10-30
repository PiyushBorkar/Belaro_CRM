import { PencilRuler } from 'lucide-react';
import { useAuth } from '../../../features/auth/AuthContext';
import { can } from '../../../lib/permissions';
import { CLOSING_STAGE, stagesOf } from '../../../lib/pipeline';
import { useUpdateDesignerFields } from '../../../services/queries';
import { StagePipeline } from './StagePipeline';

const STAGES = [...stagesOf('designer'), CLOSING_STAGE];

export function DesignerPipelineSection({ project, editable }) {
  const { user } = useAuth();
  const mutation = useUpdateDesignerFields(project.id);

  return (
    <StagePipeline
      title="Design & order"
      description="From the first visit to closing the order. Every step stays editable until the order is closed; Installation opens as soon as items are dispatched."
      icon={PencilRuler}
      stages={STAGES}
      project={project}
      editable={editable}
      lockable={false}
      showMoney={can.seeMoney(user)}
      mutation={mutation}
      waitingText="This step is waiting for the designer."
    />
  );
}
