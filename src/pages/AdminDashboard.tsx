import React, { useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import { cn } from "@/lib/utils";
import 'highlight.js/styles/github.css'; // For JSON syntax highlighting
import { Search, X, Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, UserPlus, Activity, Loader2, Stethoscope, DollarSign, Edit, Trash2, Plus, RefreshCw } from 'lucide-react';
import { logActivity } from '@/lib/utils';
// Using dynamic import for code splitting
const EnhancedAppointmentBooking = React.lazy(() => import('@/components/EnhancedAppointmentBooking'));

// Define the Patient interface at the top level
type Patient = {
  id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  date_of_birth: string;
  gender: string;
  phone: string;
  email?: string;
  address?: string;
  blood_group?: string | null;
  status: 'Active' | 'Inactive' | 'Pending' | string;
  created_at: string;
  updated_at: string;
};

// Patient View Component
const PatientView = ({ 
  patients, 
  view, 
  onViewChange,
  loading 
}: { 
  patients: Patient[];
  view: 'day' | 'week' | 'all';
  onViewChange: (view: 'day' | 'week' | 'all') => void;
  loading: boolean;
}) => {
  const filteredPatients = useMemo(() => {
    const now = new Date();
    return patients.filter(patient => {
      const patientDate = new Date(patient.created_at);
      
      switch (view) {
        case 'day':
          return patientDate.toDateString() === now.toDateString();
        case 'week': {
          const weekAgo = new Date();
          weekAgo.setDate(now.getDate() - 7);
          return patientDate >= weekAgo;
        }
        case 'all':
        default:
          return true;
      }
    });
  }, [patients, view]);

  const viewLabels = {
    day: 'Today',
    week: 'This Week',
    all: 'All Patients'
  };

  return (
    <DashboardLayout title="Admin Dashboard">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Patient View */}
        <div className="flex items-center justify-between">
          <CardTitle>Patients Overview</CardTitle>
          <div className="flex items-center gap-2">
            {(['all', 'week', 'day'] as const).map((tab) => (
              <Button
                key={tab}
                variant={view === tab ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewChange(tab)}
                className="h-8"
              >
                {viewLabels[tab]}
              </Button>
            ))}
          </div>
        </div>
        <CardDescription>
          Viewing {filteredPatients.length} {view !== 'all' ? viewLabels[view].toLowerCase() : 'total'} patients
        </CardDescription>
      </div>
    </DashboardLayout>
  );
};

export default function AdminDashboard() {
  interface User {
    id: string;
    email: string;
    full_name?: string;
    phone?: string;
    user_metadata?: {
      full_name?: string;
      avatar_url?: string;
    };
    app_metadata?: {
      provider?: string;
    };
    created_at: string;
    last_sign_in_at?: string;
    role?: string;
    roles?: Array<{
      id: string;
      role: string;
      is_primary: boolean;
    }>;
  }
  
  interface ActivityLog {
    id: string;
    action: string;
    user_id: string;
    user_email?: string;
    user_name?: string;
    details: Record<string, any>;
    created_at: string;
  }

  interface Patient {
    id: string;
    first_name: string;
    last_name: string;
    full_name?: string;
    date_of_birth: string;
    gender: string;
    phone: string;
    email?: string;
    address?: string;
    blood_group?: string | null;
    status: 'Active' | 'Inactive' | 'Pending' | string;
    created_at: string;
    updated_at: string;
  }

  interface MedicalService {
    id: string;
    service_code: string;
    service_name: string;
    service_type: string;
    description?: string;
    base_price: number;
    currency: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }

  const [patients, setPatients] = useState<Patient[]>([]);
  const [users, setUsers] = useState<Array<User & { activeRole?: string }>>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [selectedActionType, setSelectedActionType] = useState<string>('all');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    full_name: '',
    email: '',
    phone: ''
  });
  const [stats, setStats] = useState({ 
    totalPatients: 0, 
    activeAppointments: 0, 
    totalUsers: 0, 
    totalServices: 0 
  });
  const [loading, setLoading] = useState(true);
  const [medicalServices, setMedicalServices] = useState<MedicalService[]>([]);
  const [serviceForm, setServiceForm] = useState({
    service_code: '',
    service_name: '',
    service_type: '',
    description: '',
    base_price: 0,
    currency: 'TSh',
    is_active: true
  });
  const [editingService, setEditingService] = useState<MedicalService | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const { user } = useAuth();
  const [patientView, setPatientView] = useState<'day' | 'week' | 'all'>('all');

  useEffect(() => {
    const loadUser = async () => {
      if (user?.id) {
        const { data: userData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (userData) {
          setCurrentUser(userData as User);
        }
      }
    };
    
    loadUser();
    fetchData();
  }, [user]);

  // Filter patients based on selected time period
  const filterPatientsByTime = useCallback((patientsList: Patient[], period: 'day' | 'week' | 'all') => {
    const now = new Date();
    
    return patientsList.filter(patient => {
      const patientDate = new Date(patient.created_at);
      
      switch (period) {
        case 'day':
          return patientDate.toDateString() === now.toDateString();
        case 'week': {
          const weekAgo = new Date();
          weekAgo.setDate(now.getDate() - 7);
          return patientDate >= weekAgo;
        }
        case 'all':
        default:
          return true;
      }
    });
  }, []);

  // Update filtered patients when patients or view changes
  useEffect(() => {
    if (patients.length > 0) {
      // The filtering is now handled in the PatientView component
    }
  }, [patients, patientView]);

  const fetchActivityLogs = async (userId?: string) => {
    try {
      setLogsLoading(true);
      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Filter by user if specified
      if (userId && userId !== 'all') {
        query = query.eq('user_id', userId);
      }

      const { data: logs, error } = await query;
        
      if (error) throw error;
      
      if (!logs) {
        setActivityLogs([]);
        return;
      }
      
      // Get user details for each log
      const logsWithUserInfo = await Promise.all(
        logs.map(async (log: ActivityLog) => {
          if (!log.user_id) return log;
          
          const { data: userData } = await supabase
            .from('profiles')
            .select('full_name, email, avatar_url')
            .eq('id', log.user_id)
            .single();
            
          return {
            ...log,
            user_name: userData?.full_name || 'System',
            user_email: userData?.email || 'system@example.com',
            user_avatar: userData?.avatar_url || ''
          } as ActivityLog;
        })
      );
      
      setActivityLogs(logsWithUserInfo);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      toast.error('Failed to load activity logs');
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchData = async () => {
    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    try {
      // Fetch patients
      const { data: patientsData } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch users with their roles
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .limit(20);

      // Fetch user roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('id, user_id, role, is_primary');

      // Combine users with their roles and active role
      const usersWithRoles = usersData?.map(user => {
        const userRoles = rolesData?.filter(r => r.user_id === user.id) || [];
        const activeRole = userRoles.find(r => r.is_primary)?.role || 
                         (userRoles[0]?.role || 'No role assigned');
                          
        return {
          ...user,
          roles: userRoles.map(r => ({
            id: r.id,
            role: r.role,
            is_primary: r.is_primary
          })),
          activeRole
        };
      }) || [];

      // Fetch stats
      const { count: patientCount } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true });

      const { count: appointmentCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .in('status', ['Scheduled', 'Confirmed']);

      // Fetch medical services
      const { data: servicesData } = await supabase
        .from('medical_services')
        .select('*')
        .order('service_name');

      const { count: servicesCount } = await supabase
        .from('medical_services')
        .select('*', { count: 'exact', head: true });

      setPatients(patientsData || []);
      setUsers(usersWithRoles);
      setMedicalServices(servicesData || []);
      setStats({
        totalPatients: patientCount || 0,
        activeAppointments: appointmentCount || 0,
        totalUsers: usersData?.length || 0,
        totalServices: servicesCount || 0
      });
      
      // Fetch activity logs
      await fetchActivityLogs();
    } catch (error) {
      console.error('Error fetching admin data:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });

      // Set empty data to prevent crashes
      setPatients([]);
      setUsers([]);
      setStats({
        totalPatients: 0,
        activeAppointments: 0,
        totalUsers: 0,
        totalServices: 0
      });

      toast.error(`Failed to load dashboard data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPatient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const patientData = {
      full_name: formData.get('fullName') as string,
      date_of_birth: formData.get('dob') as string,
      gender: formData.get('gender') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      address: formData.get('address') as string,
      blood_group: formData.get('bloodGroup') as string,
    };

    try {
      let newUserId: string | null = null;

      // Only attempt to create an auth user if an email is provided
      if (patientData.email && patientData.email.trim().length > 0) {
        const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: patientData.email,
          password: randomPassword,
          options: {
            data: {
              full_name: patientData.full_name,
              phone: patientData.phone,
            },
            emailRedirectTo: undefined,
          },
        });

        if (authError) {
          // If email already exists, try to find the existing user profile by email
          if (authError.message?.toLowerCase().includes('already')) {
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', patientData.email)
              .maybeSingle();
            if (existingProfile?.id) {
              newUserId = existingProfile.id;
            } else {
              // Proceed without linking if we cannot resolve the user id
              toast.warning('Email already exists. Patient will be created without linking to user account.');
            }
          } else {
            // Other signup errors: proceed without linking
            toast.warning('Could not create user account. Creating patient without account.');
          }
        } else if (authData?.user?.id) {
          // Use newly created auth user id
          newUserId = authData.user.id;
        }
      }

      // If we think a user exists but the profile trigger may be eventual, double-check via profiles when email present
      if (!newUserId && patientData.email) {
        const { data: profileCheck } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', patientData.email)
          .maybeSingle();
        if (profileCheck?.id) {
          newUserId = profileCheck.id;
        }
      }

      // Validate user id via profiles before linking to avoid FK violations
      let finalUserId: string | null = null;
      if (newUserId) {
        const { data: profileById } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', newUserId)
          .maybeSingle();
        if (profileById?.id) {
          finalUserId = profileById.id;
        }
      }

      // Create the patient record (link only if verified)
      const { error: patientError } = await supabase.from('patients').insert([{
        ...patientData,
        user_id: finalUserId,
      }]);

      if (patientError) {
        toast.error('Failed to add patient: ' + patientError.message);
      } else {
        // Assign the patient role if we have a user ID
        if (finalUserId) {
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert([{
              user_id: finalUserId,
              role: 'patient',
              is_primary: true,
            }]);

          if (roleError) {
            toast.error('Patient created but failed to assign role: ' + roleError.message);
          } else {
            toast.success('Patient added successfully with user account');
            logActivity('patient.create', { full_name: patientData.full_name, linked_user: true });
            setDialogOpen(false);
            fetchData();
          }
        } else {
          toast.success('Patient created successfully (no user account created)');
          logActivity('patient.create', { full_name: patientData.full_name, linked_user: false });
          setDialogOpen(false);
          fetchData();
        }
      }
    } catch (error) {
      console.error('Error creating patient:', error);
      toast.error('An unexpected error occurred');
    }
  };

  const handleSetPrimaryRole = async (userId: string, roleId: string) => {
    try {
      // First, set all roles for this user to non-primary
      const { error: clearError } = await supabase
        .from('user_roles')
        .update({ is_primary: false })
        .eq('user_id', userId);

      if (clearError) throw clearError;

      // Then set the selected role as primary
      const { error: setError } = await supabase
        .from('user_roles')
        .update({ is_primary: true })
        .eq('id', roleId);

      if (setError) throw setError;

      toast.success('Primary role updated successfully');
      fetchData();
    } catch (error) {
      console.error('Error updating primary role:', error);
      toast.error('Failed to update primary role');
    }
  };

  const generateServiceCode = () => {
    const type = serviceForm.service_type;
    const prefix = type === 'Consultation' ? 'CONS' :
                   type === 'Procedure' ? 'PROC' :
                   type === 'Surgery' ? 'SURG' :
                   type === 'Emergency' ? 'EMER' :
                   type === 'Ward Stay' ? 'WARD' : 'OTHER';
    const code = `${prefix}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    setServiceForm(prev => ({ ...prev, service_code: code }));
  };

  const handleAddService = async () => {
    if (!serviceForm.service_code || !serviceForm.service_name || !serviceForm.service_type || !serviceForm.base_price) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('medical_services')
        .insert({
          ...serviceForm,
          is_active: true
        });

      if (error) throw error;

      toast.success('Medical service added successfully!');
      setServiceDialogOpen(false);
      setServiceForm({
        service_code: '',
        service_name: '',
        service_type: '',
        description: '',
        base_price: 0,
        currency: 'TSh',
        is_active: true
      });
      fetchData();
    } catch (error) {
      console.error('Error adding service:', error);
      toast.error('Failed to add medical service');
    }
  };

  const handleEditService = (service: any) => {
    setEditingService(service);
    setServiceForm({
      service_code: service.service_code,
      service_name: service.service_name,
      service_type: service.service_type,
      description: service.description || '',
      base_price: service.base_price,
      currency: service.currency || 'TSh',
      is_active: service.is_active
    });
    setServiceDialogOpen(true);
  };

  const handleUpdateService = async () => {
    if (!editingService) return;

    try {
      const { error } = await supabase
        .from('medical_services')
        .update(serviceForm)
        .eq('id', editingService.id);

      if (error) throw error;

      toast.success('Medical service updated successfully!');
      setServiceDialogOpen(false);
      setEditingService(null);
      setServiceForm({
        service_code: '',
        service_name: '',
        service_type: '',
        description: '',
        base_price: 0,
        currency: 'TSh',
        is_active: true
      });
      fetchData();
    } catch (error) {
      console.error('Error updating service:', error);
      toast.error('Failed to update medical service');
    }
  };

  const handleDeleteService = async (serviceId: string, serviceName: string) => {
    if (!confirm(`Are you sure you want to delete "${serviceName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('medical_services')
        .delete()
        .eq('id', serviceId);

      if (error) throw error;

      toast.success('Medical service deleted successfully!');
      fetchData();
    } catch (error) {
      console.error('Error deleting service:', error);
      toast.error('Failed to delete medical service');
    }
  };

  const resetServiceForm = () => {
    setServiceForm({
      service_code: '',
      service_name: '',
      service_type: '',
      description: '',
      base_price: 0,
      currency: 'TSh',
      is_active: true
    });
    setEditingService(null);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setUserForm({
      full_name: user.full_name || '',
      email: user.email || '',
      phone: user.phone || ''
    });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: userForm.full_name,
          phone: userForm.phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingUser.id);
        
      if (error) throw error;
      
      // Update email in auth if changed
      if (userForm.email !== editingUser.email) {
        const { error: emailError } = await supabase.auth.admin.updateUserById(editingUser.id, {
          email: userForm.email
        });
        if (emailError) throw emailError;
      }
      
      toast.success('User updated successfully');
      setEditingUser(null);
      fetchData();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }
    
    try {
      // First delete from auth
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      if (authError) throw authError;
      
      // Then delete from profiles (this should be handled by a trigger in Supabase)
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);
        
      if (error) throw error;
      
      toast.success('User deleted successfully');
      fetchData();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const handleAssignRole = (user: User) => {
    setSelectedUserId(user.id);
    setRoleDialogOpen(true);
  };

  const handleRoleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!selectedUserId) {
      toast.error('No user selected for role assignment');
      return;
    }

    const formData = new FormData(e.currentTarget);
    const role = (formData.get('role') as string | null)?.trim();
    const isPrimary = formData.get('isPrimary') !== null;

    if (!role) {
      toast.error('Please select a role');
      return;
    }

    try {
      // Check if the user already has this role
      const { data: existingRole, error: checkError } = await supabase
        .from('user_roles')
        .select('id, is_primary')
        .eq('user_id', selectedUserId)
        .eq('role', role)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingRole) {
        // If role exists, make it the active role
        const { error: clearError } = await supabase
          .from('user_roles')
          .update({ is_primary: false })
          .eq('user_id', selectedUserId)
          .neq('id', existingRole.id);
        
        if (clearError) throw clearError;

        // Set this role as primary
        const { error: updateError } = await supabase
          .from('user_roles')
          .update({ is_primary: true })
          .eq('id', existingRole.id);
        
        if (updateError) throw updateError;
        
        // Update the user's active role in your auth context or state
        // This part depends on how you're managing user session/state
        if (selectedUserId === user?.id) {
          // If the current user is changing their own role, update the UI/state
          // You might need to implement a context update or refresh the session
          // For example:
          // updateUserSession({ ...user, activeRole: role });
          // or refresh the session to get the updated roles
          await supabase.auth.refreshSession();
        }
        
        toast.success(`Switched to ${role} role`);
      } else {
        // Role doesn't exist, insert new role
        if (isPrimary) {
          // Clear primary flag from other roles if needed
          const { error: clearError } = await supabase
            .from('user_roles')
            .update({ is_primary: false })
            .eq('user_id', selectedUserId);
          if (clearError) throw clearError;
        }

        const { error: insertError } = await supabase
          .from('user_roles')
          .upsert(
            { 
              user_id: selectedUserId, 
              role, 
              is_primary: isPrimary,
              updated_at: new Date().toISOString()
            },
            { 
              onConflict: 'user_id,role',
              ignoreDuplicates: false
            }
          )
          .select()
          .single();

        if (insertError) throw insertError;
        
        toast.success('Role assigned successfully');
      }

      // Log the role assignment
      await logActivity('user.role.assigned', {
        user_id: selectedUserId,
        role,
        is_primary: isPrimary
      });

      setRoleDialogOpen(false);
      setSelectedUserId(null);
      fetchData();
    } catch (error) {
      console.error('Error assigning role:', error);
      const message = (error as { message?: string })?.message || 'Failed to assign role';
      toast.error(message);
    }
  };

  const handleCSVFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0] || null;
    setImportFile(file);
    setImportPreview([]);
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      setImportPreview(rows.slice(0, 10));
    } catch (err: any) {
      setImportError(err?.message || 'Failed to read CSV file');
    }
  };

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];
    const header = lines[0].split(',').map(h => h.trim());
    const required = ['service_code','service_name','service_type','base_price'];
    for (const r of required) {
      if (!header.includes(r)) {
        throw new Error(`Missing required column: ${r}`);
      }
    }
    const idx = (name: string) => header.indexOf(name);
    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length === 1 && cols[0].trim() === '') continue;
      const row = {
        service_code: cols[idx('service_code')]?.trim() || '',
        service_name: cols[idx('service_name')]?.trim() || '',
        service_type: cols[idx('service_type')]?.trim() || '',
        description: header.includes('description') ? (cols[idx('description')]?.trim() || '') : '',
        base_price: parseFloat(cols[idx('base_price')] || '0') || 0,
        currency: header.includes('currency') ? (cols[idx('currency')]?.trim() || 'TSh') : 'TSh',
        is_active: header.includes('is_active') ? ((cols[idx('is_active')]?.trim().toLowerCase() === 'true')) : true,
      };
      if (row.service_code && row.service_name && row.service_type && row.base_price > 0) {
        rows.push(row);
      }
    }
    return rows;
  };

  const handleImportServices = async () => {
    if (!importFile) {
      setImportError('Please choose a CSV file');
      return;
    }
    
    setImporting(true);
    setImportError(null);
    
    try {
      const text = await importFile.text();
      const rows = parseCSV(text);
      
      if (rows.length === 0) {
        setImportError('No valid rows found in CSV');
        setImporting(false);
        return;
      }
      
      const { error } = await supabase.from('medical_services').insert(rows);
      
      if (error) throw error;
      
      toast.success(`Imported ${rows.length} services successfully`);
      setImportDialogOpen(false);
      setImportFile(null);
      setImportPreview([]);
      fetchData();
    } catch (err: any) {
      console.error('CSV import error:', err);
      setImportError(err?.message || 'Failed to import CSV');
    } finally {
      setImporting(false);
    }
  };

  const downloadServicesTemplate = () => {
    const csvContent = [
      'service_code,service_name,service_type,description,base_price,currency,is_active',
      'CONS-001,General Consultation,Consultation,General doctor consultation,50000,TSh,true',
      'PROC-001,Blood Test,Procedure,Complete blood count test,25000,TSh,true',
      'SURG-001,Minor Surgery,Surgery,Minor surgical procedure,150000,TSh,true',
      'EMER-001,Emergency Care,Emergency,Emergency room visit,100000,TSh,true',
      'WARD-001,Ward Admission,Ward Stay,General ward per day,75000,TSh,true'
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'medical_services_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <DashboardLayout title="Admin Dashboard">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

    // Tabs for patient view
  const patientViewTabs = [
    { id: 'all' as const, label: 'All Patients' },
    { id: 'week' as const, label: 'This Week' },
    { id: 'day' as const, label: 'Today' },
  ];

  // Function to format JSON data with syntax highlighting
  const formatJson = (data: unknown): React.ReactNode => {
    try {
      if (!data) return <span className="text-muted-foreground">No data</span>;
      const jsonStr = JSON.stringify(data, null, 2);
      return (
        <pre className="bg-muted/50 p-3 rounded-md text-xs overflow-x-auto">
          <code className="language-json">
            {jsonStr}
          </code>
        </pre>
      );
    } catch (e) {
      return <span className="text-muted-foreground">Invalid data</span>;
    }
  };

  const uniqueUsers = Array.from(new Set(activityLogs.map(log => log.user_id)))
    .filter(Boolean) as string[];

  const actionTypes = Array.from(new Set(activityLogs.map(log => log.action.split('.')[0]))).filter(Boolean) as string[];

  const filteredLogs = activityLogs.filter(log => {
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        log.action.toLowerCase().includes(searchLower) ||
        log.user_name?.toLowerCase().includes(searchLower) ||
        log.user_email?.toLowerCase().includes(searchLower) ||
        JSON.stringify(log.details).toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }
    
    if (selectedUserFilter !== 'all' && log.user_id !== selectedUserFilter) {
      return false;
    }
    
    if (selectedActionType !== 'all' && !log.action.startsWith(selectedActionType)) {
      return false;
    }
    
    if (dateRange.from || dateRange.to) {
      const logDate = new Date(log.created_at);
      if (dateRange.from && logDate < dateRange.from) return false;
      if (dateRange.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999); // End of the day
        if (logDate > toDate) return false;
      }
    }
    
    return true;
  });

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedUserFilter('all');
    setSelectedActionType('all');
    setDateRange({});
  };

  return (
    <DashboardLayout title="Admin Dashboard">
      <div className="space-y-8">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-primary/20 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.totalPatients}</div>
            </CardContent>
          </Card>

          <Card className="border-secondary/20 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Appointments</CardTitle>
              <CalendarIcon className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-secondary">{stats.activeAppointments}</div>
            </CardContent>
          </Card>

          <Card className="border-accent/20 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Users</CardTitle>
              <Activity className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card className="border-green-200 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Medical Services</CardTitle>
              <Stethoscope className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.totalServices}</div>
              <p className="text-xs text-muted-foreground">Available services</p>
              {/* Add Service action is available in Medical Services page only */}
            {/* CSV Import moved to Medical Services page */}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => window.location.href = '/services'}>
                <Stethoscope className="h-6 w-6" />
                <span>Medical Services</span>
                <span className="text-xs text-muted-foreground">Manage catalog & imports</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => setDialogOpen(true)}>
                <UserPlus className="h-6 w-6" />
                <span>Add Patient</span>
                <span className="text-xs text-muted-foreground">Register new patient</span>
              </Button>
              {/* Sample data action removed */}
              <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => window.location.assign('/logs')}>
                <Activity className="h-6 w-6" />
                <span>Activity Logs</span>
                <span className="text-xs text-muted-foreground">Audit recent actions</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* User Management */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage system users and assign roles</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          <span>{user.full_name || 'No name'}</span>
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {user.activeRole || 'No role'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditUser(user)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteUser(user.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleAssignRole(user)}
                            className="h-8 px-3 text-sm"
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            Assign Role
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Patients */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Patients</CardTitle>
                <CardDescription>Latest patient registrations</CardDescription>
              </div>
              <div className="flex gap-2">
                <EnhancedAppointmentBooking patients={patients} onSuccess={fetchData} />
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Add Patient
                    </Button>
                  </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add New Patient</DialogTitle>
                    <DialogDescription>Enter patient details to register</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddPatient} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input id="fullName" name="fullName" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dob">Date of Birth</Label>
                        <Input id="dob" name="dob" type="date" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gender">Gender</Label>
                        <Select name="gender" required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Female">Female</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bloodGroup">Blood Group</Label>
                        <Input id="bloodGroup" name="bloodGroup" placeholder="A+, B-, etc." />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input id="phone" name="phone" type="tel" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" name="email" type="email" />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="address">Address</Label>
                        <Input id="address" name="address" />
                      </div>
                    </div>
                    <Button type="submit" className="w-full">Add Patient</Button>
                  </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Blood Group</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patients.map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell className="font-medium">{patient.full_name || `${patient.first_name} ${patient.last_name}`}</TableCell>
                      <TableCell>{patient.phone}</TableCell>
                      <TableCell>{patient.blood_group || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={patient.status === 'Active' ? 'default' : 'secondary'}>
                          {patient.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Edit User Dialog */}
        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>Update user details</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={userForm.full_name}
                  onChange={(e) => setUserForm({...userForm, full_name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={userForm.phone}
                  onChange={(e) => setUserForm({...userForm, phone: e.target.value})}
                />
              </div>
              <Button type="submit" className="w-full">
                Update User
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Medical services management moved to Medical Services page */}
        <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Role</DialogTitle>
              <DialogDescription>Select a role to assign to this user</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRoleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select name="role" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="nurse">Nurse</SelectItem>
                    <SelectItem value="receptionist">Receptionist</SelectItem>
                    <SelectItem value="lab_tech">Lab Technician</SelectItem>
                    <SelectItem value="pharmacist">Pharmacist</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="isPrimary" name="isPrimary" />
                <Label 
                  htmlFor="isPrimary" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Set as active role (determines login redirect)
                </Label>
              </div>
              <Button type="submit" className="w-full">Assign Role</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Service dialogs and CSV import moved to Medical Services page */}
      </div>
    </DashboardLayout>
  );
}
