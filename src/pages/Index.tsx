import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, primaryRole, roles, loading } = useAuth();
  const navigate = useNavigate();
  const [redirectAttempted, setRedirectAttempted] = useState(false);

  useEffect(() => {
    // Don't redirect if still loading
    if (loading) return;

    // Don't redirect if already attempted
    if (redirectAttempted) return;

    if (!user) {
      navigate('/auth');
      setRedirectAttempted(true);
      return;
    }

    // Wait for roles to be loaded
    if (roles.length === 0) {
      setTimeout(() => {
        if (roles.length === 0) {
          console.log('Roles still empty, retrying...');
          setRedirectAttempted(false);
        }
      }, 100);
      return;
    }

    // Use primary role if available, otherwise use priority order
    if (primaryRole) {
      const roleRoutes: Record<string, string> = {
        admin: '/admin',
        doctor: '/doctor',
        nurse: '/nurse',
        receptionist: '/receptionist',
        lab_tech: '/lab',
        pharmacist: '/pharmacy',
        billing: '/billing',
        patient: '/patient'
      };
      navigate(roleRoutes[primaryRole] || '/patient');
    } else {
      // Fallback to priority order if no primary role set
      if (roles.includes('admin')) {
        navigate('/admin');
      } else if (roles.includes('doctor')) {
        navigate('/doctor');
      } else if (roles.includes('nurse')) {
        navigate('/nurse');
      } else if (roles.includes('receptionist')) {
        navigate('/receptionist');
      } else if (roles.includes('lab_tech')) {
        navigate('/lab');
      } else if (roles.includes('pharmacist')) {
        navigate('/pharmacy');
      } else if (roles.includes('billing')) {
        navigate('/billing');
      } else {
        navigate('/patient');
      }
    }

    setRedirectAttempted(true);
  }, [user, primaryRole, roles, loading, navigate, redirectAttempted]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
};

export default Index;
