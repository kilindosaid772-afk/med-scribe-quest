'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import {
  Loader2,
  Building,
  Calendar,
  Clock,
  CheckCircle,
  Users,
  UserPlus,
  Phone,
  ClipboardList
} from 'lucide-react';

export default function ReceptionistDashboard() {
  const { user } = useAuth();

  // State management
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [stats, setStats] = useState<{
    todayAppointments: number;
    pendingAppointments: number;
    completedCheckins: number;
    totalPatients: number;
  }>({
    todayAppointments: 0,
    pendingAppointments: 0,
    completedCheckins: 0,
    totalPatients: 0,
  });

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
    emergency_contact_phone: '',
  });

  const [appointmentForm, setAppointmentForm] = useState({
    patient_id: '',
    doctor_id: '',
    appointment_date: '',
    appointment_time: '',
    reason: '',
    department_id: '',
  });

  // ---------------- FETCH DATA ----------------
  const fetchData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(full_name, phone, date_of_birth),
          doctor:profiles!appointments_doctor_id_fkey(full_name),
          department:departments(id, name)
        `)
        .gte('appointment_date', today)
        .order('appointment_time', { ascending: true });

      if (appointmentsError) throw appointmentsError;

      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (patientsError) throw patientsError;

      const { data: departmentsData, error: departmentsError } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (departmentsError) throw departmentsError;

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
        totalPatients: patientsData?.length || 0,
      });
    } catch (error) {
      console.error('Error fetching receptionist data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // ---------------- HANDLERS ----------------
  const handleCheckIn = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'Confirmed' })
        .eq('id', appointmentId);

      if (error) throw error;
      toast.success('Patient checked in successfully');
      fetchData();
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
      fetchData();
    } catch (error) {
      console.error('Cancel error:', error);
      toast.error('Failed to cancel appointment');
    }
  };

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
      emergency_contact_phone: '',
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
      department_id: '',
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
      const { error } = await supabase.from('patients').insert({
        full_name: registerForm.full_name,
        date_of_birth: registerForm.date_of_birth,
        gender: registerForm.gender,
        phone: registerForm.phone,
        email: registerForm.email,
        blood_group: registerForm.blood_group,
        address: registerForm.address,
        emergency_contact_name: registerForm.emergency_contact_name,
        emergency_contact_phone: registerForm.emergency_contact_phone,
        status: 'Active',
      });

      if (error) throw error;

      toast.success('Patient registered successfully');
      setShowRegisterDialog(false);
      fetchData();
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Failed to register patient');
    }
  };

  const submitBookAppointment = async () => {
    try {
      const { error } = await supabase.from('appointments').insert({
        patient_id: appointmentForm.patient_id,
        doctor_id: appointmentForm.doctor_id,
        appointment_date: appointmentForm.appointment_date,
        appointment_time: appointmentForm.appointment_time,
        reason: appointmentForm.reason,
        department_id: appointmentForm.department_id || null,
        status: 'Scheduled',
      });

      if (error) throw error;

      toast.success('Appointment booked successfully');
      setShowBookAppointmentDialog(false);
      fetchData();
    } catch (error) {
      console.error('Booking error:', error);
      toast.error('Failed to book appointment');
    }
  };

  // ---------------- LOADING SCREEN ----------------
  if (loading) {
    return (
      <DashboardLayout title="Receptionist Dashboard">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // ---------------- MAIN RENDER ----------------
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
              <h2 className="text-xl font-semibold text-gray-900">
                Welcome back, Receptionist!
              </h2>
              <p className="text-gray-600">
                Here's your front desk overview for today
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Today's Schedule" value={stats.todayAppointments} icon={Calendar} color="green" sub="Appointments today" />
          <StatCard title="Pending" value={stats.pendingAppointments} icon={Clock} color="blue" sub="Awaiting check-in" />
          <StatCard title="Checked In" value={stats.completedCheckins} icon={CheckCircle} color="purple" sub="Patients checked in" />
          <StatCard title="Total Patients" value={stats.totalPatients} icon={Users} color="orange" sub="Registered patients" />
        </div>

        {/* Today's Appointments & Recent Patients */}
        <div className="grid gap-8 lg:grid-cols-2">
          <AppointmentsCard appointments={appointments} onCheckIn={handleCheckIn} onCancel={handleCancelAppointment} />
          <PatientsCard patients={patients} />
        </div>

        {/* Quick Actions */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common receptionist tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Button variant="outline" className="h-20 flex-col gap-2" onClick={handleRegisterPatient}>
                <UserPlus className="h-6 w-6" />
                <span>Register Patient</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col gap-2" onClick={handleBookAppointment}>
                <Calendar className="h-6 w-6" />
                <span>Book Appointment</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col gap-2" onClick={handlePatientSearch}>
                <Phone className="h-6 w-6" />
                <span>Patient Search</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col gap-2" onClick={handleViewSchedule}>
                <ClipboardList className="h-6 w-6" />
                <span>View Schedule</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Departments */}
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

      {/* Register Patient Dialog */}
      <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Register New Patient</DialogTitle>
            <DialogDescription>Enter patient information to register them</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input id="full_name" value={registerForm.full_name} onChange={(e) => setRegisterForm({ ...registerForm, full_name: e.target.value })} placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={registerForm.phone} onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })} placeholder="+255 700 000 000" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowRegisterDialog(false)}>Cancel</Button>
            <Button onClick={submitPatientRegistration}>Register Patient</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
