import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, roles, loading } = useAuth();
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

    // Wait for roles to be loaded (add small delay if roles are empty)
    if (roles.length === 0) {
      setTimeout(() => {
        if (roles.length === 0) {
          console.log('Roles still empty, retrying...');
          // Force a re-render to trigger the effect again
          setRedirectAttempted(false);
        }
      }, 100);
      return;
    }

    // Now make the redirect decision based on roles
    if (roles.includes('admin')) {
      navigate('/admin');
    } else if (roles.includes('doctor')) {
      navigate('/doctor');
    } else if (roles.includes('lab_tech')) {
      navigate('/lab');
    } else if (roles.includes('pharmacist')) {
      navigate('/pharmacy');
    } else if (roles.includes('billing')) {
      navigate('/billing');
    } else if (roles.includes('receptionist')) {
      navigate('/patient'); // Temporary - until ReceptionistDashboard is created
    } else if (roles.includes('nurse')) {
      navigate('/patient'); // Temporary - until NurseDashboard is created
    } else {
      navigate('/patient');
    }

    setRedirectAttempted(true);
  }, [user, roles, loading, navigate, redirectAttempted]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
};

export default Index;
