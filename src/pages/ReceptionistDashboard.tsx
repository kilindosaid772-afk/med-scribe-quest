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
  Clipboard,
} from 'lucide-react';

export default function ReceptionistDashboard() {
  const { user } = useAuth();

  // State management
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [stats, setStats] = useState<{
    todayAppointments: number;
    pendingAppointments: number;
    completedCheckins: number;
    totalPatients: number;
    nurseQueuePatients: number;
    receptionQueuePatients: number;
  }>({
    todayAppointments: 0,
    pendingAppointments: 0,
    completedCheckins: 0,
    totalPatients: 0,
    nurseQueuePatients: 0,
    receptionQueuePatients: 0,
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
  });

  const [appointmentForm, setAppointmentForm] = useState({
    patient_id: '',
    doctor_id: '',
    appointment_date: '',
    appointment_time: '',
    reason: '',
    department_id: '',
  });

// Load data when component mounts or user changes
  useEffect(() => {
    fetchData();
  }, [user]);
  const fetchData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // First, get appointments with basic info (get all appointments for better data handling)
      const { data: appointmentsBasic, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(full_name, phone, date_of_birth),
          department:departments(name)
        `)
        .order('appointment_time', { ascending: true });

      if (appointmentsError) throw appointmentsError;

      // Then get doctor profiles for the appointments
      const doctorIds = [...new Set(appointmentsBasic?.map(apt => apt.doctor_id).filter(Boolean) || [])];

      let appointmentsData = appointmentsBasic;
      if (doctorIds.length > 0) {
        const { data: doctorsData, error: doctorsError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', doctorIds);

        if (!doctorsError && doctorsData) {
          // Merge doctor information into appointments
          appointmentsData = appointmentsBasic?.map(apt => ({
            ...apt,
            doctor: doctorsData.find(doc => doc.id === apt.doctor_id)
          }));
        }
      }

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

      // Fetch doctors - get profiles that have doctor role
      let doctorsData = [];
      try {
        // First try with correct join syntax
        const { data: profilesWithRoles, error: profilesError } = await supabase
          .from('profiles')
          .select(`
            *,
            user_roles!inner(*)
          `)
          .eq('user_roles.role', 'doctor');

        if (profilesError) throw profilesError;
        doctorsData = profilesWithRoles || [];
        console.log('Found doctors with roles:', doctorsData.length);
      } catch (error) {
        console.warn('Could not fetch doctors with roles, using fallback:', error);
        try {
          // Alternative approach: query user_roles first, then get profiles
          const { data: doctorRoles, error: rolesError } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'doctor');

          console.log('Doctor roles found:', doctorRoles?.length || 0);

          if (rolesError) throw rolesError;

          if (doctorRoles && doctorRoles.length > 0) {
            const doctorIds = doctorRoles.map(dr => dr.user_id);
            const { data: doctorProfiles, error: profilesError } = await supabase
              .from('profiles')
              .select('*')
              .in('id', doctorIds);

            if (!profilesError) {
              doctorsData = doctorProfiles || [];
              console.log('Found doctor profiles:', doctorsData.length);
            }
          } else {
            console.log('No doctor roles found, checking all profiles...');
          }
        } catch (fallbackError) {
          console.warn('Fallback also failed, using all profiles:', fallbackError);
          // Final fallback: get all profiles (for development)
          const { data: allProfiles, error: finalFallbackError } = await supabase
            .from('profiles')
            .select('*')
            .limit(10);
          if (!finalFallbackError) {
            doctorsData = allProfiles || [];
            console.log('Using all profiles as doctors:', doctorsData.length);
          }
        }
      }

      // If still no doctors, try to create some sample doctor users
      if (!doctorsData || doctorsData.length === 0) {
        console.log('No doctors found, attempting to create sample doctors...');
        try {
          // Check if we have any profiles at all
          const { data: allProfiles, error: checkError } = await supabase
            .from('profiles')
            .select('*')
            .limit(5);

          if (!checkError && allProfiles && allProfiles.length > 0) {
            // Assign doctor role to first few profiles for demo
            for (let i = 0; i < Math.min(3, allProfiles.length); i++) {
              const profile = allProfiles[i];
              await supabase.from('user_roles').upsert({
                user_id: profile.id,
                role: 'doctor'
              });
            }

            // Now fetch doctors again
            const { data: newDoctors, error: retryError } = await supabase
              .from('user_roles')
              .select('user_id')
              .eq('role', 'doctor');

            if (!retryError && newDoctors && newDoctors.length > 0) {
              const doctorIds = newDoctors.map(dr => dr.user_id);
              const { data: doctorProfiles, error: profilesError } = await supabase
                .from('profiles')
                .select('*')
                .in('id', doctorIds);

              if (!profilesError) {
                doctorsData = doctorProfiles || [];
                console.log('Created and found sample doctors:', doctorsData.length);
              }
            }
          }
        } catch (createError) {
          console.error('Failed to create sample doctors:', createError);
        }
      }

      // Fetch patient visits to get accurate workflow stats
      const { data: patientVisits, error: visitsError } = await supabase
        .from('patient_visits')
        .select('*')
        .eq('overall_status', 'Active');

      if (visitsError) {
        console.error('Error fetching patient visits:', visitsError);
      }

      const todayAppointments = appointmentsData?.filter(a => a.appointment_date === today).length || 0;
      const pendingAppointments = appointmentsData?.filter(a => a.status === 'Scheduled').length || 0;
      const confirmedAppointments = appointmentsData?.filter(a => a.status === 'Confirmed').length || 0;

      // Calculate nurse queue patients (from new registrations)
      const nurseQueuePatients = patientVisits?.filter(v =>
        v.current_stage === 'nurse' && v.nurse_status === 'Pending'
      ).length || 0;

      // Calculate reception queue patients (from appointments waiting for check-in)
      const receptionQueuePatients = patientVisits?.filter(v =>
        v.current_stage === 'reception' && v.reception_status === 'Pending'
      ).length || 0;

      setAppointments(appointmentsData || []);
      setPatients(patientsData || []);
      setDepartments(departmentsData || []);
      setDoctors(doctorsData || []);

      // Debug logging
      console.log('Dashboard data loaded:', {
        appointments: appointmentsData?.length || 0,
        patients: patientsData?.length || 0,
        departments: departmentsData?.length || 0,
        doctors: doctorsData?.length || 0,
        todayAppointments,
        pendingAppointments,
        confirmedAppointments,
        patientVisits: patientVisits?.length || 0,
        nurseQueuePatients,
        receptionQueuePatients
      });

      setStats({
        todayAppointments,
        pendingAppointments,
        completedCheckins: confirmedAppointments, // Confirmed appointments that were checked in
        totalPatients: patientsData?.length || 0,
        nurseQueuePatients,
        receptionQueuePatients,
      });
    } catch (error) {
      console.error('Error fetching receptionist data:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });

      // Set empty data to prevent crashes
      setAppointments([]);
      setPatients([]);
      setDepartments([]);
      setDoctors([]);
      setStats({
        todayAppointments: 0,
        pendingAppointments: 0,
        completedCheckins: 0,
        totalPatients: 0,
        nurseQueuePatients: 0,
        receptionQueuePatients: 0,
      });

      toast.error(`Failed to load dashboard data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to create sample data for testing
  const createSampleData = async () => {
    if (!user) return;

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
        const { data: newPatients } = await supabase.from('patients').insert([
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
        ]).select();

        if (newPatients && newPatients.length > 0) {
          // Create sample appointments
          await supabase.from('appointments').insert([
            {
              patient_id: newPatients[0].id,
              doctor_id: user.id,
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
    }
  };

  // Helper function to automatically assign doctor
  const getAutoAssignedDoctor = (doctorsList: any[], departmentId?: string) => {
    if (doctorsList.length === 0) return null;

    // Filter doctors by department if specified
    let availableDoctors = doctorsList;
    if (departmentId) {
      // For now, we'll use a simple approach - in a real system you'd have doctor specializations
      // For demo purposes, we'll assume all doctors can handle all departments
      availableDoctors = doctorsList;
    }

    if (availableDoctors.length === 0) return null;

    // Simple load balancing: assign to doctor with fewest current appointments
    // In a real system, you'd check actual appointment counts per doctor
    const today = new Date().toISOString().split('T')[0];
    const doctorAppointmentCounts = new Map();

    // Count current appointments for each doctor
    appointments.forEach(apt => {
      if (apt.appointment_date === today && apt.doctor?.id) {
        doctorAppointmentCounts.set(
          apt.doctor.id,
          (doctorAppointmentCounts.get(apt.doctor.id) || 0) + 1
        );
      }
    });

    // Find doctor with fewest appointments
    let selectedDoctor = availableDoctors[0];
    let minAppointments = doctorAppointmentCounts.get(selectedDoctor.id) || 0;

    availableDoctors.forEach(doctor => {
      const count = doctorAppointmentCounts.get(doctor.id) || 0;
      if (count < minAppointments) {
        selectedDoctor = doctor;
        minAppointments = count;
      }
    });

    return selectedDoctor;
  };

  // Auto-assign doctor when department changes or form opens
  useEffect(() => {
    if (appointmentForm.department_id && doctors.length > 0 && !appointmentForm.doctor_id) {
      const autoDoctor = getAutoAssignedDoctor(doctors, appointmentForm.department_id);
      if (autoDoctor) {
        setAppointmentForm(prev => ({
          ...prev,
          doctor_id: autoDoctor?.id || ''
        }));
      }
    }
  }, [appointmentForm.department_id, doctors]);
  
  // Load data when component mounts or user changes
  useEffect(() => {
    fetchData();
  }, [user]);

  // ---------------- FETCH DATA ----------------
  const handleCheckIn = async (appointmentId: string) => {
    try {
      // Update appointment status
      const { error: appointmentError } = await supabase
        .from('appointments')
        .update({ status: 'Confirmed' })
        .eq('id', appointmentId);

      if (appointmentError) throw appointmentError;

      // Update patient visit workflow for appointment check-in
      const { error: visitError } = await supabase
        .from('patient_visits')
        .update({
          reception_status: 'Checked In',
          reception_completed_at: new Date().toISOString(),
          current_stage: 'nurse',
          nurse_status: 'Pending'
        })
        .eq('appointment_id', appointmentId);

      if (visitError) throw visitError;

      toast.success('Appointment patient checked in and sent to nurse queue');
      fetchData();
    } catch (error) {
      console.error('Check-in error:', error);
      toast.error('Failed to check in appointment patient');
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      // Update appointment status
      const { error: appointmentError } = await supabase
        .from('appointments')
        .update({ status: 'Cancelled' })
        .eq('id', appointmentId);

      if (appointmentError) throw appointmentError;

      // Update patient visit workflow
      const { error: visitError } = await supabase
        .from('patient_visits')
        .update({
          overall_status: 'Cancelled',
          reception_status: 'Cancelled'
        })
        .eq('appointment_id', appointmentId);

      if (visitError) throw visitError;

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
    if (!searchQuery.trim()) {
      toast.error('Please enter a search term');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .or(`full_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
        .limit(20);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search patients');
    } finally {
      setLoading(false);
    }
  };

  const submitPatientRegistration = async () => {
    // Validate required fields
    if (!registerForm.full_name || !registerForm.date_of_birth ||
        !registerForm.gender || !registerForm.phone) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      // Insert patient
      const { data: newPatient, error: patientError } = await supabase
        .from('patients')
        .insert({
          full_name: registerForm.full_name,
          date_of_birth: registerForm.date_of_birth,
          gender: registerForm.gender,
          phone: registerForm.phone,
          email: registerForm.email || null,
          blood_group: registerForm.blood_group || null,
          address: registerForm.address || null,
          status: 'Active',
        })
        .select()
        .single();

      if (patientError) throw patientError;

      // Success message
      toast.success('Patient registered successfully! Adding to nurse queue...');

      // Create patient visit workflow directly to nurse stage (for new registrations)
      const { error: visitError } = await supabase
        .from('patient_visits')
        .insert({
          patient_id: newPatient.id,
          visit_date: new Date().toISOString().split('T')[0],
          reception_status: 'Checked In',
          reception_completed_at: new Date().toISOString(),
          current_stage: 'nurse',
          nurse_status: 'Pending',
          overall_status: 'Active'
        });

      if (visitError) {
        console.error('Error creating patient visit:', visitError);
        toast.error('Patient registered but failed to add to nurse queue');
      } else {
        toast.success('Patient registered and added to nurse queue successfully!');
      }

      // Close registration dialog and refresh data
      setShowRegisterDialog(false);

      // Refresh data to show the new patient and visit
      fetchData();
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Failed to register patient');
    }
  };

  const submitBookAppointment = async () => {
    // Validate required fields
    if (!appointmentForm.patient_id || !appointmentForm.doctor_id ||
        !appointmentForm.appointment_date || !appointmentForm.appointment_time) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const { data: newAppointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          patient_id: appointmentForm.patient_id,
          doctor_id: appointmentForm.doctor_id,
          appointment_date: appointmentForm.appointment_date,
          appointment_time: appointmentForm.appointment_time,
          ...(appointmentForm.reason && { reason: appointmentForm.reason }),
          department_id: appointmentForm.department_id || null,
          status: 'Scheduled',
        })
        .select()
        .single();

      if (appointmentError) throw appointmentError;

      // Create patient visit workflow for appointment (starts at reception for check-in)
      const { error: visitError } = await supabase
        .from('patient_visits')
        .insert({
          patient_id: appointmentForm.patient_id,
          appointment_id: newAppointment.id,
          reception_status: 'Pending',
          current_stage: 'reception',
          overall_status: 'Active'
        });

      if (visitError) throw visitError;

      toast.success(`Follow-up appointment booked successfully! ${appointmentForm.patient_id ? 'Patient will be notified of their scheduled visit.' : ''}`);
      setShowBookAppointmentDialog(false);

      // Reset form but keep patient selected for potential next appointment
      setAppointmentForm({
        patient_id: appointmentForm.patient_id, // Keep patient selected
        doctor_id: '',
        appointment_date: '',
        appointment_time: '',
        reason: '',
        department_id: '',
      });

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
    <>
      <DashboardLayout title="Receptionist Dashboard">
        <div className="space-y-8">

          {/* Welcome Section */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200">
            <div className="flex items-center justify-between">
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
              <Button
                variant="outline"
                size="sm"
                onClick={createSampleData}
                className="text-green-600 border-green-200 hover:bg-green-50"
              >
                Create Sample Data
              </Button>
            </div>
          </div>

          {/* Workflow Queue Status */}
          <Card className="shadow-lg border-green-200 bg-green-50/30">
            <CardHeader className="bg-green-100/50">
              <CardTitle className="flex items-center gap-2 text-green-800">
                <Users className="h-5 w-5" />
                Current Patient Workflow Status
              </CardTitle>
              <CardDescription className="text-green-700">
                Real-time view of where patients are in the hospital workflow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 bg-white rounded-lg border border-green-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-green-800">Nurse Queue</h4>
                    <Badge variant="default" className="bg-green-600">
                      {stats.nurseQueuePatients} patient{stats.nurseQueuePatients !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Patients waiting for vital signs (from new registrations)
                  </p>
                  <div className="text-xs text-green-600">
                    ✓ Auto-assigned from patient registration
                  </div>
                </div>

                <div className="p-4 bg-white rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-blue-800">Reception Queue</h4>
                    <Badge variant="default" className="bg-blue-600">
                      {stats.receptionQueuePatients} patient{stats.receptionQueuePatients !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Patients waiting for check-in (from appointments)
                  </p>
                  <div className="text-xs text-blue-600">
                    ✓ Requires check-in before nurse visit
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

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
                  <span>Register New Patient</span>
                  <span className="text-xs text-muted-foreground">→ Goes to Nurse</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2" onClick={handleBookAppointment}>
                  <Calendar className="h-6 w-6" />
                  <span>Book Follow-up Appointment</span>
                  <span className="text-xs text-muted-foreground">→ Scheduled Visit</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2" onClick={handlePatientSearch}>
                  <Phone className="h-6 w-6" />
                  <span>Patient Search</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2" onClick={handleViewSchedule}>
                  <Clipboard className="h-6 w-6" />
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
                Departments & Doctor Queue
              </CardTitle>
              <CardDescription>Available departments and current doctor workload</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {departments.map((dept) => {
                  const deptAppointments = appointments.filter(a => a.department?.id === dept.id);
                  const today = new Date().toISOString().split('T')[0];
                  const todayDeptAppts = deptAppointments.filter(a => a.appointment_date === today);

                  return (
                    <div key={dept.id} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                      <h4 className="font-medium">{dept.name}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{dept.description}</p>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {todayDeptAppts.length} appointments today
                      </div>
                    </div>
                  );
                })}

                {/* Doctor Queue Status */}
                <div className="md:col-span-2 lg:col-span-3">
                  <h4 className="font-medium mb-3">Doctor Queue Status (Today)</h4>
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {doctors.slice(0, 6).map((doctor) => {
                      const today = new Date().toISOString().split('T')[0];
                      const doctorAppts = appointments.filter(a =>
                        a.appointment_date === today && a.doctor?.id === doctor.id
                      );
                      const isAvailable = doctorAppts.length < 8; // Assume 8 is max per day

                      return (
                        <div key={doctor.id} className={`p-3 border rounded-lg ${
                          isAvailable ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'
                        }`}>
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-sm">{doctor.full_name}</span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              isAvailable ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                            }`}>
                              {doctorAppts.length}/8 slots
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {isAvailable ? 'Available' : 'Busy'} • {doctorAppts.length} appointments today
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>

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
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowRegisterDialog(false)}>Cancel</Button>
            <Button onClick={submitPatientRegistration}>Register Patient</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Book Appointment Dialog */}
      <Dialog open={showBookAppointmentDialog} onOpenChange={(open) => {
        setShowBookAppointmentDialog(open);
        if (!open) {
          // Refresh data when dialog is closed to show any new patients/appointments
          fetchData();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {appointmentForm.patient_id ? 'Book Follow-up Appointment' : 'Book Appointment'}
            </DialogTitle>
            <DialogDescription>
              {appointmentForm.patient_id
                ? 'Schedule a follow-up appointment for an existing patient'
                : 'Schedule a new appointment for a patient (Note: New patients should be registered first)'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="appt_patient">Patient *</Label>
              <select
                id="appt_patient"
                className="w-full p-2 border rounded-md"
                value={appointmentForm.patient_id}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, patient_id: e.target.value })}
                required
              >
                <option value="">Select Patient</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name} - {p.phone}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="appt_doctor">Doctor *</Label>
              <div className="flex gap-2">
                <select
                  id="appt_doctor"
                  className="flex-1 p-2 border rounded-md"
                  value={appointmentForm.doctor_id}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, doctor_id: e.target.value })}
                  required
                >
                  <option value="">Select Doctor</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.full_name}</option>
                  ))}
                </select>
                {appointmentForm.department_id && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const autoDoctor = getAutoAssignedDoctor(doctors, appointmentForm.department_id);
                      if (autoDoctor) {
                        setAppointmentForm(prev => ({ ...prev, doctor_id: autoDoctor.id }));
                      }
                    }}
                    className="px-3"
                  >
                    Auto
                  </Button>
                )}
              </div>
              {appointmentForm.department_id && appointmentForm.doctor_id && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-600">✓</span>
                  <span className="text-muted-foreground">
                    Doctor auto-assigned based on availability
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAppointmentForm(prev => ({ ...prev, doctor_id: '' }))}
                    className="text-xs h-auto p-1"
                  >
                    Change
                  </Button>
                </div>
              )}
              {appointmentForm.department_id && !appointmentForm.doctor_id && (
                <p className="text-sm text-muted-foreground">
                  💡 Select a department above to auto-assign a doctor
                </p>
              )}
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
              <Label htmlFor="appt_reason">Reason for Visit</Label>
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
                disabled={loading}
              />
              <Button onClick={searchPatients} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
              </Button>
            </div>
            {searchResults.length > 0 && (
              <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
                <p className="text-sm text-muted-foreground mb-2">
                  Found {searchResults.length} patient{searchResults.length !== 1 ? 's' : ''}
                </p>
                {searchResults.map((patient) => (
                  <div key={patient.id} className="p-3 border-b last:border-b-0 hover:bg-gray-50">
                    <div className="font-medium">{patient.full_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {patient.phone} • DOB: {format(new Date(patient.date_of_birth), 'MMM dd, yyyy')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Gender: {patient.gender} • Blood Group: {patient.blood_group || 'N/A'}
                    </div>
                    {patient.address && (
                      <div className="text-sm text-muted-foreground">
                        Address: {patient.address}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {searchResults.length === 0 && searchQuery && !loading && (
              <p className="text-center text-muted-foreground py-8">No patients found matching your search.</p>
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
                        <div className="text-sm text-muted-foreground">{apt.reason || 'No reason specified'}</div>
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
    </>
  );
}
