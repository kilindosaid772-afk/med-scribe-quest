import { useState, useEffect } from 'react';
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
import { Users, UserPlus, Activity, Calendar, Loader2, Stethoscope, DollarSign, Edit, Trash2, Plus } from 'lucide-react';
import { logActivity } from '@/lib/utils';
import { EnhancedAppointmentBooking } from '@/components/EnhancedAppointmentBooking';

export default function AdminDashboard() {
  const [patients, setPatients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalPatients: 0, activeAppointments: 0, totalUsers: 0, totalServices: 0 });
  const [loading, setLoading] = useState(true);
  const [medicalServices, setMedicalServices] = useState<any[]>([]);
  const [serviceForm, setServiceForm] = useState({
    service_code: '',
    service_name: '',
    service_type: '',
    description: '',
    base_price: 0,
    currency: 'TSh',
    is_active: true
  });
  const [editingService, setEditingService] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
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

      // Combine users with their roles
      const usersWithRoles = usersData?.map(user => ({
        ...user,
        roles: rolesData?.filter(r => r.user_id === user.id).map(r => ({
          id: r.id,
          role: r.role,
          is_primary: r.is_primary
        })) || []
      })) || [];

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

  const handleAssignRole = async (e: React.FormEvent<HTMLFormElement>) => {
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
      if (isPrimary) {
        const { error: clearError } = await supabase
          .from('user_roles')
          .update({ is_primary: false })
          .eq('user_id', selectedUserId);
        if (clearError) throw clearError;
      }

      const { error: insertError } = await supabase
        .from('user_roles')
        .insert([{ user_id: selectedUserId, role, is_primary: isPrimary }]);

      if (insertError) throw insertError;

      toast.success('Role assigned successfully');
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
    const headers = ['service_code','service_name','service_type','description','base_price','currency','is_active'];
    const sample = [
      'CONS-0001,General Consultation,Consultation,Initial consultation,50000,TSh,true',
      'PROC-0001,ECG,Procedure,Electrocardiogram,30000,TSh,true'
    ];
    const csv = [headers.join(','), ...sample].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'medical_services_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Sample data creation removed

  if (loading) {
    return (
      <DashboardLayout title="Admin Dashboard">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

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
              <Calendar className="h-4 w-4 text-secondary" />
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
                    <TableHead>Roles (★ = Active)</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {user.roles.map((roleObj: any) => (
                            <Badge 
                              key={roleObj.id}
                              variant={roleObj.is_primary ? "default" : "secondary"} 
                              className="capitalize cursor-pointer"
                              onClick={() => !roleObj.is_primary && handleSetPrimaryRole(user.id, roleObj.id)}
                            >
                              {roleObj.is_primary && '★ '}
                              {roleObj.role.replace('_', ' ')}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUserId(user.id);
                            setRoleDialogOpen(true);
                          }}
                        >
                          Assign Role
                        </Button>
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
                      <TableCell className="font-medium">{patient.full_name}</TableCell>
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

        {/* Medical services management moved to Medical Services page */}
        <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Role</DialogTitle>
              <DialogDescription>Select a role to assign to this user</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAssignRole} className="space-y-4">
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
