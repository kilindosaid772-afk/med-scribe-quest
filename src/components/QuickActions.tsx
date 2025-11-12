import React from 'react';
import { 
  UserPlus, 
  Activity, 
  Stethoscope, 
  FileText, 
  UserCheck,
  ClipboardList,
  Settings,
  Bell,
  Users,
  Calendar,
  FilePlus,
  UserCog,
  Shield,
  BarChart2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'link';
}

const QuickAction: React.FC<QuickActionProps> = ({ 
  icon, 
  label, 
  description, 
  onClick, 
  variant = 'outline' 
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant={variant}
        className="h-24 w-full flex-col items-center justify-center gap-2 p-2 text-center transition-all hover:shadow-md"
        onClick={onClick}
      >
        <div className="rounded-full bg-primary/10 p-3">
          {React.cloneElement(icon as React.ReactElement, { className: 'h-6 w-6 text-primary' })}
        </div>
        <span className="text-sm font-medium">{label}</span>
      </Button>
    </TooltipTrigger>
    <TooltipContent side="bottom">
      <p>{description}</p>
    </TooltipContent>
  </Tooltip>
);

interface QuickActionsProps {
  onActionClick?: (action: string) => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onActionClick = () => {} }) => {
  const actions = [
    {
      id: 'register-patient',
      icon: <UserPlus />,
      label: 'Register Patient',
      description: 'Add a new patient to the system',
      variant: 'default' as const,
    },
    {
      id: 'activity-logs',
      icon: <Activity />,
      label: 'Activity Logs',
      description: 'View system activity and audit logs',
      variant: 'secondary' as const,
    },
    {
      id: 'appointments',
      icon: <Calendar />,
      label: 'Appointments',
      description: 'View and manage appointments',
      variant: 'outline' as const,
    },
    {
      id: 'medical-records',
      icon: <FileText />,
      label: 'Medical Records',
      description: 'Access patient medical records',
      variant: 'outline' as const,
    },
    {
      id: 'staff-management',
      icon: <Users />,
      label: 'Staff',
      description: 'Manage staff accounts and permissions',
      variant: 'outline' as const,
    },
    {
      id: 'billing',
      icon: <FilePlus />,
      label: 'Billing',
      description: 'Manage patient billing and invoices',
      variant: 'outline' as const,
    },
    {
      id: 'reports',
      icon: <BarChart2 />,
      label: 'Reports',
      description: 'Generate and view system reports',
      variant: 'outline' as const,
    },
    {
      id: 'settings',
      icon: <Settings />,
      label: 'Settings',
      description: 'Configure system settings',
      variant: 'ghost' as const,
    },
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6">
          {actions.map((action) => (
            <QuickAction
              key={action.id}
              icon={action.icon}
              label={action.label}
              description={action.description}
              variant={action.variant}
              onClick={() => onActionClick(action.id)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default QuickActions;
