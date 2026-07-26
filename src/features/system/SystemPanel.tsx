import { DashboardPanel } from '../dashboard';
import type { NeronHealth, ServiceRegistration } from '../../lib/neronApi';

type SystemPanelProps = {
  health: NeronHealth | null;
  healthError: boolean;
  services: ServiceRegistration[] | null;
};

export function SystemPanel(props: SystemPanelProps) {
  return <DashboardPanel {...props} />;
}
