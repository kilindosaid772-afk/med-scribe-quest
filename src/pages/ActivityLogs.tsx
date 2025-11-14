import { DashboardLayout } from '@/components/DashboardLayout';
import ActivityLogsView from '@/components/ActivityLogsView';

export default function ActivityLogs() {
  return (
    <DashboardLayout title="Activity Logs">
      <ActivityLogsView />
    </DashboardLayout>
  );
}


