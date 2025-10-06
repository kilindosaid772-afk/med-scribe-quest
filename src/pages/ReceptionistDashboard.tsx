import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Users, Phone, Clock, UserPlus, CheckCircle, XCircle, Loader2, Building, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';

export default function ReceptionistDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [stats, setStats] = useState({
    todayAppointments: 0,
    pendingAppointments: 0,
    completedCheckins: 0,
    totalPatients: 0
  });
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [showBookAppointmentDialog, setShowBookAppointmentDialog] = useState(false);
  const [showPatientSearch, setShowPatientSearch] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    full_name: '',
    date_of_birth: '',
    gender: '',
    phone: '',
    email: '',
    blood_group: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: ''
  });
  const [appointmentForm, setAppointmentForm] = useState({
    patient_id: '',
    doctor_id: '',
    appointment_date: '',
    appointment_time: '',
    reason: '',
    department_id: ''
  });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch today's appointments
      const today = new Date().toISOString().split('T')[0];
      const { data: appointmentsData } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(full_name, phone, date_of_birth),
          doctor:profiles!appointments_doctor_id_fkey(full_name),
          department:departments(name)
        `)
        .gte('appointment_date', today)
        .order('appointment_time', { ascending: true });

      // Fetch recent patients
      const { data: patientsData } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch departments
      const { data: departmentsData } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      // Calculate stats
      const todayAppointments = appointmentsData?.filter(a => a.appointment_date === today).length || 0;
      const pendingAppointments = appointmentsData?.filter(a => a.status === 'Scheduled').length || 0;
      const completedCheckins = appointmentsData?.filter(a => a.status === 'Confirmed').length || 0;

      setAppointments(appointmentsData || []);
      setPatients(patientsData || []);
      setDepartments(departmentsData || []);
      setStats({
        todayAppointments,
        pendingAppointments,
        completedCheckins,
        totalPatients: patientsData?.length || 0
      });

    } catch (error) {
      console.error('Error fetching receptionist data:', error);
      toast.error('Failed to load dashboard data');
    }
  };

  const handleCheckIn = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'Confirmed' })
        .eq('id', appointmentId);

      if (error) throw error;

      toast.success('Patient checked in successfully');
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Check-in error:', error);
      toast.error('Failed to check in patient');
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'Cancelled' })
        .eq('id', appointmentId);

      if (error) throw error;

      toast.success('Appointment cancelled');
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Cancel error:', error);
      toast.error('Failed to cancel appointment');
    }
  };

  // Handler functions
  const handleRegisterPatient = () => {
    setRegisterForm({
      full_name: '',
      date_of_birth: '',
      gender: '',
      phone: '',
      email: '',
      blood_group: '',
      address: '',
      emergency_contact_name: '',
      emergency_contact_phone: ''
    });
    setShowRegisterDialog(true);
  };

  const handleBookAppointment = () => {
    setAppointmentForm({
      patient_id: '',
      doctor_id: '',
      appointment_date: '',
      appointment_time: '',
      reason: '',
      department_id: ''
    });
    setShowBookAppointmentDialog(true);
  };

  const handlePatientSearch = () => {
    setShowPatientSearch(true);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleViewSchedule = () => {
    setShowScheduleDialog(true);
  };

  const searchPatients = async () => {
    if (!searchQuery.trim()) return;

    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .or(`full_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search patients');
    }
  };

  const submitPatientRegistration = async () => {
    try {
      const { error } = await supabase
        .from('patients')
        .insert({
          full_name: registerForm.full_name,
          date_of_birth: registerForm.date_of_birth,
          gender: registerForm.gender,
          phone: registerForm.phone,
          email: registerForm.email,
          blood_group: registerForm.blood_group,
          address: registerForm.address,
          emergency_contact_name: registerForm.emergency_contact_name,
          emergency_contact_phone: registerForm.emergency_contact_phone,
          status: 'Active'
        });

      if (error) throw error;

      toast.success('Patient registered successfully');
      setShowRegisterDialog(false);
      fetchData(); // Refresh patients list
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Failed to register patient');
    }
  };

  const submitBookAppointment = async () => {
    try {
      const { error } = await supabase
        .from('appointments')
        .insert({
          patient_id: appointmentForm.patient_id,
          doctor_id: appointmentForm.doctor_id,
          appointment_date: appointmentForm.appointment_date,
          appointment_time: appointmentForm.appointment_time,
          reason: appointmentForm.reason,
          department_id: appointmentForm.department_id || null,
          status: 'Scheduled'
        });

      if (error) throw error;

      toast.success('Appointment booked successfully');
      setShowBookAppointmentDialog(false);
      fetchData(); // Refresh appointments
    } catch (error) {
      console.error('Booking error:', error);
      toast.error('Failed to book appointment');
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Receptionist Dashboard">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Receptionist Dashboard">
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-full">
              <Building className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Welcome back, Receptionist!</h2>
              <p className="text-gray-600">Here's your front desk overview for today</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-green-200 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Schedule</CardTitle>
              <Calendar className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.todayAppointments}</div>
              <p className="text-xs text-muted-foreground">Appointments today</p>
            </CardContent>
          </Card>

          <Card className="border-blue-200 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.pendingAppointments}</div>
              <p className="text-xs text-muted-foreground">Awaiting check-in</p>
            </CardContent>
          </Card>

          <Card className="border-purple-200 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Checked In</CardTitle>
              <CheckCircle className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.completedCheckins}</div>
              <p className="text-xs text-muted-foreground">Patients checked in</p>
            </CardContent>
          </Card>

          <Card className="border-orange-200 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
              <Users className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.totalPatients}</div>
              <p className="text-xs text-muted-foreground">Registered patients</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Today's Appointments */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Today's Appointments
              </CardTitle>
              <CardDescription>Manage today's patient schedule</CardDescription>
            </CardHeader>
            <CardContent>
              {appointments.filter(a => a.appointment_date === new Date().toISOString().split('T')[0]).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No appointments scheduled for today</p>
              ) : (
                <div className="space-y-3">
                  {appointments
                    .filter(a => a.appointment_date === new Date().toISOString().split('T')[0])
                    .slice(0, 6)
                    .map((appointment) => (
                      <div key={appointment.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <p className="font-medium">{appointment.patient?.full_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {appointment.appointment_time} • Dr. {appointment.doctor?.full_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {appointment.department?.name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            appointment.status === 'Confirmed' ? 'default' :
                            appointment.status === 'Scheduled' ? 'secondary' : 'outline'
                          }>
                            {appointment.status}
                          </Badge>
                          {appointment.status === 'Scheduled' && (
                            <Button
                              size="sm"
                              onClick={() => handleCheckIn(appointment.id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Check In
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancelAppointment(appointment.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Patients */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Recent Patients
              </CardTitle>
              <CardDescription>Recently registered patients</CardDescription>
            </CardHeader>
            <CardContent>
              {patients.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No patients found</p>
              ) : (
                <div className="space-y-3">
                  {patients.slice(0, 5).map((patient) => (
                    <div key={patient.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <UserPlus className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">{patient.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {patient.phone} • DOB: {format(new Date(patient.date_of_birth), 'MMM dd, yyyy')}
                          </p>
                        </div>
                      </div>
                      <Badge variant={patient.status === 'Active' ? 'default' : 'secondary'}>
                        {patient.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common receptionist tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Button
                variant="outline"
                className="h-20 flex-col gap-2"
                onClick={handleRegisterPatient}
              >
                <UserPlus className="h-6 w-6" />
                <span>Register Patient</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex-col gap-2"
                onClick={handleBookAppointment}
              >
                <Calendar className="h-6 w-6" />
                <span>Book Appointment</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex-col gap-2"
                onClick={handlePatientSearch}
              >
                <Phone className="h-6 w-6" />
                <span>Patient Search</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex-col gap-2"
                onClick={handleViewSchedule}
              >
                <ClipboardList className="h-6 w-6" />
                <span>View Schedule</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Departments Overview */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Departments
            </CardTitle>
            <CardDescription>Available departments and services</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {departments.map((dept) => (
                <div key={dept.id} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <h4 className="font-medium">{dept.name}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{dept.description}</p>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {appointments.filter(a => a.department?.id === dept.id).length} appointments today
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      {/* Patient Registration Dialog */}
      <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Register New Patient</DialogTitle>
            <DialogDescription>
              Enter patient information to register them in the system
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={registerForm.full_name}
                  onChange={(e) => setRegisterForm({...registerForm, full_name: e.target.value})}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={registerForm.phone}
                  onChange={(e) => setRegisterForm({...registerForm, phone: e.target.value})}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowRegisterDialog(false)}>
              Cancel
            </Button>
            <Button onClick={submitPatientRegistration}>Register Patient</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
