import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Stethoscope, LogOut, User, Menu, X } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useState } from 'react';
import Logo from '@/components/Logo';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
}

export const DashboardLayout = ({ children, title }: DashboardLayoutProps) => {
  const { user, signOut, hasRole, primaryRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
              <Avatar className="h-8 w-8 border-2 border-primary/20">
                {user?.user_metadata?.avatar_url ? (
                  <img 
                    src={user.user_metadata.avatar_url} 
                    alt="Profile" 
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                  {user?.user_metadata?.username?.substring(0, 2).toUpperCase() || 
                   user?.user_metadata?.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 
                   user?.email?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium">
                  {user?.user_metadata?.username || 
                   user?.user_metadata?.full_name || 
                   user?.email?.split('@')[0]}
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
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6 border border-primary/20">
                    {user?.user_metadata?.avatar_url ? (
                      <img 
                        src={user.user_metadata.avatar_url} 
                        alt="Profile" 
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-medium">
                      {user?.user_metadata?.username?.substring(0, 2).toUpperCase() || 
                       user?.user_metadata?.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 
                       user?.email?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-sm">
                    <p className="font-medium">
                      {user?.user_metadata?.username || 
                       user?.user_metadata?.full_name || 
                       user?.email?.split('@')[0]}
                    </p>
                  </div>
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
