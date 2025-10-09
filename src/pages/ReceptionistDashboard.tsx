'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/StatCard';
import { AppointmentsCard } from '@/components/AppointmentsCard';
import { PatientsCard } from '@/components/PatientsCard';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
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

  const [doctors, setDoctors] = useState<any[]>([]);

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

      // Fetch doctors
      const { data: doctorsData, error: doctorsError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .limit(50);

      if (doctorsError) throw doctorsError;

      const todayAppointments = appointmentsData?.filter(a => a.appointment_date === today).length || 0;
      const pendingAppointments = appointmentsData?.filter(a => a.status === 'Scheduled').length || 0;
      const completedCheckins = appointmentsData?.filter(a => a.status === 'Confirmed').length || 0;

      setAppointments(appointmentsData || []);
      setPatients(patientsData || []);
      setDepartments(departmentsData || []);
      setDoctors(doctorsData || []);
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
      // Insert patient
      const { data: newPatient, error: patientError } = await supabase
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
          status: 'Active',
        })
        .select()
        .single();

      if (patientError) throw patientError;

      // Create patient visit workflow
      const { error: visitError } = await supabase
        .from('patient_visits')
        .insert({
          patient_id: newPatient.id,
          reception_status: 'Checked In',
          reception_completed_at: new Date().toISOString(),
          current_stage: 'nurse'
        });

      if (visitError) throw visitError;

      toast.success('Patient registered and ready for nurse');
      setShowRegisterDialog(false);
      fetchData();
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Failed to register patient');
    }
  };

  const submitBookAppointment = async () => {
    try {
      const { data: newAppointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          patient_id: appointmentForm.patient_id,
          doctor_id: appointmentForm.doctor_id,
          appointment_date: appointmentForm.appointment_date,
          appointment_time: appointmentForm.appointment_time,
          reason: appointmentForm.reason,
          department_id: appointmentForm.department_id || null,
          status: 'Scheduled',
        })
        .select()
        .single();

      if (appointmentError) throw appointmentError;

      // Create patient visit workflow
      const { error: visitError } = await supabase
        .from('patient_visits')
        .insert({
          patient_id: appointmentForm.patient_id,
          appointment_id: newAppointment.id,
          reception_status: 'Pending',
          current_stage: 'reception'
        });

      if (visitError) throw visitError;

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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register New Patient</DialogTitle>
            <DialogDescription>Enter patient information to register them</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input id="full_name" required value={registerForm.full_name} onChange={(e) => setRegisterForm({ ...registerForm, full_name: e.target.value })} placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_of_birth">Date of Birth *</Label>
                <Input type="date" id="date_of_birth" required value={registerForm.date_of_birth} onChange={(e) => setRegisterForm({ ...registerForm, date_of_birth: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender *</Label>
                <Input id="gender" required value={registerForm.gender} onChange={(e) => setRegisterForm({ ...registerForm, gender: e.target.value })} placeholder="Male/Female" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input id="phone" required value={registerForm.phone} onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })} placeholder="+255 700 000 000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input type="email" id="email" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} placeholder="john@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blood_group">Blood Group</Label>
                <Input id="blood_group" value={registerForm.blood_group} onChange={(e) => setRegisterForm({ ...registerForm, blood_group: e.target.value })} placeholder="A+" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={registerForm.address} onChange={(e) => setRegisterForm({ ...registerForm, address: e.target.value })} placeholder="Street, City" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
                <Input id="emergency_contact_name" value={registerForm.emergency_contact_name} onChange={(e) => setRegisterForm({ ...registerForm, emergency_contact_name: e.target.value })} placeholder="Jane Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergency_contact_phone">Emergency Contact Phone</Label>
                <Input id="emergency_contact_phone" value={registerForm.emergency_contact_phone} onChange={(e) => setRegisterForm({ ...registerForm, emergency_contact_phone: e.target.value })} placeholder="+255 700 000 000" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowRegisterDialog(false)}>Cancel</Button>
            <Button onClick={submitPatientRegistration}>Register Patient</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Book Appointment Dialog */}
      <Dialog open={showBookAppointmentDialog} onOpenChange={setShowBookAppointmentDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Book Appointment</DialogTitle>
            <DialogDescription>Schedule a new appointment for a patient</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="appt_patient">Patient *</Label>
              <select
                id="appt_patient"
                className="w-full p-2 border rounded-md"
                value={appointmentForm.patient_id}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, patient_id: e.target.value })}
              >
                <option value="">Select Patient</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name} - {p.phone}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="appt_doctor">Doctor *</Label>
              <select
                id="appt_doctor"
                className="w-full p-2 border rounded-md"
                value={appointmentForm.doctor_id}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, doctor_id: e.target.value })}
              >
                <option value="">Select Doctor</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>{d.full_name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="appt_date">Date *</Label>
                <Input
                  type="date"
                  id="appt_date"
                  value={appointmentForm.appointment_date}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, appointment_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appt_time">Time *</Label>
                <Input
                  type="time"
                  id="appt_time"
                  value={appointmentForm.appointment_time}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, appointment_time: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="appt_department">Department</Label>
              <select
                id="appt_department"
                className="w-full p-2 border rounded-md"
                value={appointmentForm.department_id}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, department_id: e.target.value })}
              >
                <option value="">Select Department</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="appt_reason">Reason for Visit *</Label>
              <Input
                id="appt_reason"
                value={appointmentForm.reason}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, reason: e.target.value })}
                placeholder="e.g., Regular checkup, Follow-up"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowBookAppointmentDialog(false)}>Cancel</Button>
            <Button onClick={submitBookAppointment}>Book Appointment</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Patient Search Dialog */}
      <Dialog open={showPatientSearch} onOpenChange={setShowPatientSearch}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Patient Search</DialogTitle>
            <DialogDescription>Search for patients by name or phone number</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchPatients()}
              />
              <Button onClick={searchPatients}>Search</Button>
            </div>
            {searchResults.length > 0 && (
              <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
                {searchResults.map((patient) => (
                  <div key={patient.id} className="p-3 border-b last:border-b-0 hover:bg-gray-50">
                    <div className="font-medium">{patient.full_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {patient.phone} • DOB: {format(new Date(patient.date_of_birth), 'MMM dd, yyyy')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Gender: {patient.gender} • Blood Group: {patient.blood_group || 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Today's Schedule</DialogTitle>
            <DialogDescription>All appointments for today</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {appointments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No appointments for today</p>
            ) : (
              <div className="space-y-2">
                {appointments.map((apt) => (
                  <div key={apt.id} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{apt.patient?.full_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {apt.appointment_time} • Dr. {apt.doctor?.full_name}
                        </div>
                        <div className="text-sm text-muted-foreground">{apt.reason}</div>
                      </div>
                      <Badge variant={apt.status === 'Confirmed' ? 'default' : 'secondary'}>
                        {apt.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
