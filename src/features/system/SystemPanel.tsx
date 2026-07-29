import type { ComponentProps } from 'react';
import { DashboardPanel } from '../dashboard';

export function SystemPanel(props: ComponentProps<typeof DashboardPanel>) {
  return <DashboardPanel {...props} />;
}
