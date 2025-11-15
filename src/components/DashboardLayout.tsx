import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Stethoscope, LogOut, User, Menu, X } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useState, useEffect } from 'react';
import Logo from '@/components/Logo';
import { supabase } from '@/integrations/supabase/client';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
}

export const DashboardLayout = ({ children, title }: DashboardLayoutProps) => {
  const { user, signOut, hasRole, primaryRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userFullName, setUserFullName] = useState<string>('');

  // Fetch user's full name from profiles table
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.id) {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        
        if (data && !error) {
          setUserFullName(data.full_name || '');
        }
      }
    };
    
    fetchUserProfile();
  }, [user?.id]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const navigationItems = [
    {
      label: 'Dashboard',
      path: primaryRole === 'admin' ? '/admin' :
             primaryRole === 'doctor' ? '/doctor' :
             primaryRole === 'nurse' ? '/nurse' :
             primaryRole === 'receptionist' ? '/receptionist' :
             primaryRole === 'lab_tech' ? '/lab' :
             primaryRole === 'pharmacist' ? '/pharmacy' :
             primaryRole === 'billing' ? '/billing' : '/patient',
      roles: ['admin', 'doctor', 'nurse', 'receptionist', 'lab_tech', 'pharmacist', 'billing', 'patient']
    },
    {
      label: 'Medical Services',
      path: '/services',
      roles: ['admin']
    }
  ];

  const filteredNavigation = navigationItems.filter(item =>
    item.roles.some(role => hasRole(role as any))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/5">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Logo size="sm" showText={false} />
            <div>
              <h1 className="text-xl font-bold text-foreground" style={{ contentVisibility: 'auto' }}>{title}</h1>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            <nav className="flex items-center gap-2 mr-4">
              {filteredNavigation.map((item) => (
                <Button
                  key={item.path}
                  variant={location.pathname === item.path ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => navigate(item.path)}
                >
                  {item.label}
                </Button>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {userFullName || user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>

          {/* Mobile Navigation Toggle */}
          <div className="md:hidden">
            <Button variant="ghost" size="sm" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-card/95 backdrop-blur-sm">
            <div className="container mx-auto px-4 py-4 space-y-2">
              <nav className="flex flex-col gap-2">
                {filteredNavigation.map((item) => (
                  <Button
                    key={item.path}
                    variant={location.pathname === item.path ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      navigate(item.path);
                      setMobileMenuOpen(false);
                    }}
                    className="justify-start"
                  >
                    {item.label}
                  </Button>
                ))}
              </nav>

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-gray-900">
                    {userFullName || user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="container mx-auto py-8 px-4">
        {children}
      </main>
    </div>
  );
};
