import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, roles, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/auth');
      } else if (roles.includes('admin')) {
        navigate('/admin');
      } else if (roles.includes('doctor')) {
        navigate('/doctor');
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
  }, [user, roles, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
};

export default Index;
