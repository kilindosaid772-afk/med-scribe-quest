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
      // First create a user account for the patient
      const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: patientData.email,
        password: randomPassword,
        options: {
          data: {
            full_name: patientData.full_name,
            phone: patientData.phone,
          },
          emailRedirectTo: undefined, // Disable email confirmation for admin-created accounts
        },
      });

      if (authError) {
        // If email already exists, try to find the existing user
        if (authError.message.includes('already registered')) {
          toast.error('A user with this email already exists. Please use a different email or contact support.');
          return;
        }
        toast.error('Failed to create patient account: ' + authError.message);
        return;
      }

      // If user creation succeeded but email confirmation is required,
      // we need to handle this differently for admin-created patients
      if (authData.user && !authData.session) {
        // Email confirmation required - for admin-created patients, we'll create
        // the patient record anyway and link it to the unconfirmed user
        console.log('User created but email confirmation required:', authData.user.id);
      }

      // Create the patient record
      const { error: patientError } = await supabase.from('patients').insert([{
        ...patientData,
        user_id: authData.user?.id || null,
      }]);

      if (patientError) {
        toast.error('Failed to add patient: ' + patientError.message);
      } else {
        // Assign the patient role if we have a user ID
        if (authData.user?.id) {
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert([{
              user_id: authData.user.id,
              role: 'patient',
              is_primary: true,
            }]);

          if (roleError) {
            toast.error('Patient created but failed to assign role: ' + roleError.message);
          } else {
            toast.success('Patient added successfully with user account');
            setDialogOpen(false);
            fetchData();
          }
        } else {
          toast.success('Patient created successfully (no user account created)');
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
      // @ts-expect-error Supabase error type
      const message = error?.message || 'Failed to assign role';
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

  // Helper function to create sample data for testing
  const createSampleData = async () => {
    try {
      // Create sample departments if none exist
      const { data: existingDepts } = await supabase.from('departments').select('id').limit(1);
      if (!existingDepts || existingDepts.length === 0) {
        await supabase.from('departments').insert([
          { name: 'General Medicine', description: 'General medical care' },
          { name: 'Cardiology', description: 'Heart and cardiovascular system' },
          { name: 'Pediatrics', description: 'Children and infants' }
        ]);
      }

      // Create sample patients if none exist
      const { data: existingPatients } = await supabase.from('patients').select('id').limit(1);
      if (!existingPatients || existingPatients.length === 0) {
        await supabase.from('patients').insert([
          {
            full_name: 'John Doe',
            date_of_birth: '1990-01-01',
            gender: 'Male',
            phone: '+255700000001',
            email: 'john@example.com',
            blood_group: 'O+',
            status: 'Active'
          },
          {
            full_name: 'Jane Smith',
            date_of_birth: '1985-05-15',
            gender: 'Female',
            phone: '+255700000002',
            email: 'jane@example.com',
            blood_group: 'A+',
            status: 'Active'
          }
        ]);
      }

      // Create sample appointments if none exist
      const { data: existingAppointments } = await supabase.from('appointments').select('id').limit(1);
      if (!existingAppointments || existingAppointments.length === 0) {
        const { data: patients } = await supabase.from('patients').select('id').limit(2);
        const { data: departments } = await supabase.from('departments').select('id').limit(1);

        if (patients && patients.length > 0 && departments && departments.length > 0) {
          await supabase.from('appointments').insert([
            {
              patient_id: patients[0].id,
              doctor_id: '00000000-0000-0000-0000-000000000000', // Placeholder doctor ID
              department_id: departments[0].id,
              appointment_date: new Date().toISOString().split('T')[0],
              appointment_time: '10:00',
              reason: 'Regular checkup',
              status: 'Scheduled'
            }
          ]);
        }
      }

      toast.success('Sample data created');
      fetchData();
    } catch (error) {
      console.error('Error creating sample data:', error);
      toast.error('Failed to create sample data');
    }
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetServiceForm();
                  setServiceDialogOpen(true);
                }}
                className="mt-2 text-green-600 border-green-200 hover:bg-green-50"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Service
              </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportDialogOpen(true)}
              className="mt-2 ml-2 text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              Import CSV
            </Button>
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
              <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => {
                resetServiceForm();
                setServiceDialogOpen(true);
              }}>
                <Stethoscope className="h-6 w-6" />
                <span>Add Medical Service</span>
                <span className="text-xs text-muted-foreground">Tests, procedures, pricing</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => setDialogOpen(true)}>
                <UserPlus className="h-6 w-6" />
                <span>Add Patient</span>
                <span className="text-xs text-muted-foreground">Register new patient</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col gap-2" onClick={createSampleData}>
                <Activity className="h-6 w-6" />
                <span>Create Sample Data</span>
                <span className="text-xs text-muted-foreground">For testing</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => window.location.href = '/debug'}>
                <Activity className="h-6 w-6" />
                <span>Debug Tools</span>
                <span className="text-xs text-muted-foreground">Troubleshooting</span>
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

        {/* Medical Services Management */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5" />
                  Medical Services Management
                </CardTitle>
                <CardDescription>Manage hospital services, tests, and pricing</CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="text-sm text-muted-foreground">
                  {medicalServices.length} services
                </div>
                <Button onClick={() => {
                  resetServiceForm();
                  setServiceDialogOpen(true);
                }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Service
                </Button>
                <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                  Import CSV
                </Button>
                <Button variant="ghost" onClick={downloadServicesTemplate}>
                  Download Template
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service Code</TableHead>
                    <TableHead>Service Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {medicalServices.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="font-mono text-sm">{service.service_code}</TableCell>
                      <TableCell className="font-medium">{service.service_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{service.service_type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {service.description || 'No description'}
                      </TableCell>
                      <TableCell className="font-semibold">
                        TSh{service.base_price?.toLocaleString() || '0'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={service.is_active ? 'default' : 'secondary'}>
                          {service.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditService(service)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteService(service.id, service.service_name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {medicalServices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No medical services found. Click "Add Service" to create your first service.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
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

        {/* Medical Services Dialog */}
        <Dialog open={serviceDialogOpen} onOpenChange={(open) => {
          setServiceDialogOpen(open);
          if (!open) resetServiceForm();
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingService ? 'Edit Medical Service' : 'Add New Medical Service'}
              </DialogTitle>
              <DialogDescription>
                {editingService ? 'Update service details and pricing' : 'Add a new medical service with pricing'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="service_type">Service Type *</Label>
                  <Select
                    value={serviceForm.service_type}
                    onValueChange={(value) => {
                      setServiceForm(prev => ({ ...prev, service_type: value }));
                      setTimeout(generateServiceCode, 100);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Consultation">Consultation</SelectItem>
                      <SelectItem value="Procedure">Procedure</SelectItem>
                      <SelectItem value="Surgery">Surgery</SelectItem>
                      <SelectItem value="Emergency">Emergency</SelectItem>
                      <SelectItem value="Ward Stay">Ward Stay</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service_code">Service Code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="service_code"
                      value={serviceForm.service_code}
                      onChange={(e) => setServiceForm(prev => ({ ...prev, service_code: e.target.value }))}
                      placeholder="CONS-001"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={generateServiceCode}>
                      Auto
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="service_name">Service Name *</Label>
                <Input
                  id="service_name"
                  value={serviceForm.service_name}
                  onChange={(e) => setServiceForm(prev => ({ ...prev, service_name: e.target.value }))}
                  placeholder="General Consultation"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the service"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="base_price">Base Price (TSh) *</Label>
                  <Input
                    id="base_price"
                    type="number"
                    value={serviceForm.base_price}
                    onChange={(e) => setServiceForm(prev => ({ ...prev, base_price: parseFloat(e.target.value) || 0 }))}
                    placeholder="50000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={serviceForm.currency}
                    onValueChange={(value) => setServiceForm(prev => ({ ...prev, currency: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TSh">TSh (Tanzanian Shilling)</SelectItem>
                      <SelectItem value="USD">USD (US Dollar)</SelectItem>
                      <SelectItem value="EUR">EUR (Euro)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={serviceForm.is_active}
                  onChange={(e) => setServiceForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="is_active" className="text-sm">
                  Service is active and available for booking
                </Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setServiceDialogOpen(false);
                  resetServiceForm();
                }}>
                  Cancel
                </Button>
                <Button onClick={editingService ? handleUpdateService : handleAddService}>
                  {editingService ? 'Update Service' : 'Add Service'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
