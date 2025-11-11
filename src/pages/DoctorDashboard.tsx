import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Users, Activity, Loader2, FlaskConical, Pill, Clock, CheckCircle, X } from 'lucide-react';
import { format, isAfter, isToday, parseISO, isBefore, addMinutes, addDays } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatInTimeZone } from 'date-fns-tz';

interface LabTestResult {
  id: string;
  test_name: string;
  status: string;
  lab_results: Array<{
    id: string;
    result_value: string;
    unit: string;
    abnormal_flag: boolean;
    reference_range?: string;
  }>;
  notes?: string;
  test_type?: string;
}

interface Prescription {
  id: string;
  medication_name: string;
  status: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: string;
  instructions?: string;
  prescribed_date: string;
  medications?: {
    strength: string;
    dosage_form: string;
  };
}

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [pendingVisits, setPendingVisits] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalAppointments: 0, todayAppointments: 0, totalPatients: 0, pendingConsultations: 0 });
  const [loading, setLoading] = useState(true);
  const [showLabResults, setShowLabResults] = useState(false);
  const [showPrescriptions, setShowPrescriptions] = useState(false);
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date>();
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [selectedLabTests, setSelectedLabTests] = useState<LabTestResult[]>([]);
  const [selectedPrescriptions, setSelectedPrescriptions] = useState<Prescription[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Generate time slots for the time selector
  const generateTimeSlots = useCallback(() => {
    const times = [];
    for (let hour = 9; hour <= 17; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        times.push(timeString);
      }
    }
    return times;
  }, []);

  // Helper functions for appointment display
  // Standardize status values
  const normalizeStatus = (status: string) => {
    if (!status) return 'Scheduled'; // Default status
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  };

  const getAppointmentBadgeVariant = (status: string) => {
    const normalizedStatus = normalizeStatus(status);
    switch (normalizedStatus) {
      case 'In Progress':
        return 'default';
      case 'Completed':
        return 'secondary';
      case 'Scheduled':
        return 'outline';
      case 'Cancelled':
        return 'destructive';
      default:
        return 'default';
    }
  };

    // Handle different appointment actions
  const handleStartAppointment = async (appointment: any) => {
    try {
      setLoading(true);
      // Update appointment status to 'In Progress' to match database constraint
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'In Progress' })
        .eq('id', appointment.id);

      if (error) throw error;

      // Update local state with the correct status value
      setAppointments(prev => 
        prev.map(a => 
          a.id === appointment.id 
            ? { ...a, status: 'In Progress' } 
            : a
        )
      );
      
      toast.success('Appointment started successfully');
    } catch (error) {
      console.error('Error starting appointment:', error);
      toast.error('Failed to start appointment');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteAppointment = async (appointment: any) => {
    try {
      setLoading(true);
      // Update appointment status to 'completed' to match database enum
      const { error } = await supabase
        .from('appointments')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', appointment.id);

      if (error) throw error;

      // Update local state with the correct status value
      setAppointments(prev => 
        prev.map(a => 
          a.id === appointment.id 
            ? { ...a, status: 'completed' } 
            : a
        )
      );
      
      toast.success('Appointment marked as completed');
    } catch (error) {
      console.error('Error completing appointment:', error);
      toast.error('Failed to complete appointment');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async (appointment: any) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) {
      return;
    }

    try {
      setLoading(true);
      // Update appointment status to 'cancelled' to match database enum
      const { error } = await supabase
        .from('appointments')
        .update({ 
          status: 'cancelled',
          cancelled_at: new Date().toISOString()
        })
        .eq('id', appointment.id);

      if (error) throw error;

      // Update local state with the correct status value
      setAppointments(prev => 
        prev.map(a => 
          a.id === appointment.id 
            ? { ...a, status: 'cancelled' } 
            : a
        )
      );
      
      toast.success('Appointment cancelled successfully');
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      toast.error('Failed to cancel appointment');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (appointment: any) => {
    setSelectedAppointment(appointment);
    // You can add more logic here to show a modal or navigate to a details page
    console.log('Viewing details for appointment:', appointment.id);
  };

  const handleAppointmentAction = (appointment: any) => {
    const status = normalizeStatus(appointment.status);
    
    // Show loading state for the specific appointment being processed
    const isProcessing = loading && selectedAppointment?.id === appointment.id;

    switch (status) {
      case 'Scheduled':
        return (
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="default" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedAppointment(appointment);
                handleStartAppointment(appointment);
              }}
              disabled={isProcessing}
              className="min-w-[80px]"
            >
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Start'}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedAppointment(appointment);
                handleCancelAppointment(appointment);
              }}
              disabled={isProcessing}
              className="min-w-[80px]"
            >
              Cancel
            </Button>
          </div>
        );
      case 'In Progress':
        return (
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="default" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedAppointment(appointment);
                handleCompleteAppointment(appointment);
              }}
              disabled={isProcessing}
              className="min-w-[100px]"
            >
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Complete'}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedAppointment(appointment);
                handleViewDetails(appointment);
              }}
            >
              View
            </Button>
          </div>
        );
      case 'Completed':
      case 'Cancelled':
        return (
          <Button 
            variant="outline" 
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedAppointment(appointment);
              handleViewDetails(appointment);
            }}
            className="w-full"
          >
            View Details
          </Button>
        );
      default:
        return null;
    }
  };

  const getAppointmentDotClass = (appointment: any) => {
    const apptTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
    const now = new Date();
    
    if (appointment.status === 'Completed') return 'bg-gray-400';
    if (appointment.status === 'In Progress') return 'bg-green-500 animate-pulse';
    if (isBefore(now, apptTime)) return 'bg-blue-500';
    return 'bg-amber-500';
  };

  const getAppointmentRowClass = (appointment: any) => {
    if (appointment.status === 'Completed') return 'opacity-60';
    if (appointment.status === 'In Progress') return 'bg-blue-50';
    return '';
  };

  const getCurrentWeekRange = () => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate start of week (Monday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - (currentDay === 0 ? 6 : currentDay - 1)); // If Sunday, go back 6 days to Monday
    startOfWeek.setHours(0, 0, 0, 0);
    
    // Calculate end of week (Sunday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return { start: startOfWeek, end: endOfWeek };
  };

  const getAppointmentStatusBadge = (appointment: any) => {
    const apptTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
    const now = new Date();
    
    if (appointment.status === 'Completed') return null;
    
    if (isBefore(now, apptTime)) {
      const minsToAppt = Math.ceil((apptTime.getTime() - now.getTime()) / (1000 * 60));
      if (minsToAppt <= 30) {
        return (
          <span className="text-xs text-amber-600">
            Starts in {minsToAppt} min
          </span>
        );
      }
      return (
        <span className="text-xs text-muted-foreground">
          {format(apptTime, 'h:mm a')}
        </span>
      );
    }
    
    if (isBefore(now, addMinutes(apptTime, 30))) {
      return (
        <span className="text-xs font-medium text-green-600">
          In progress
        </span>
      );
    }
    
    return (
      <span className="text-xs text-muted-foreground">
        {format(apptTime, 'h:mm a')}
      </span>
    );
  };

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      
      // Check if any appointment time has been reached
      appointments.forEach(appointment => {
        const appointmentDateTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
        const appointmentEndTime = addMinutes(appointmentDateTime, 30); // Assuming 30 min appointments
        
        // If current time is within the appointment window and status is not 'Completed' or 'In Progress'
        if (
          isAfter(currentTime, appointmentDateTime) && 
          isBefore(currentTime, appointmentEndTime) &&
          !['Completed', 'In Progress'].includes(appointment.status)
        ) {
          updateAppointmentStatus(appointment.id, 'In Progress');
        }
      });
    }, 60000); // Check every minute
    
    return () => clearInterval(timer);
  }, [appointments, currentTime]);

  // Fetch appointments with retry logic
  const fetchAppointments = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      // First, fetch only the essential appointment data
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select('*')
        .eq('doctor_id', user.id)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });
      
      if (appointmentsError) throw appointmentsError;
      if (!appointmentsData) return;

      // Get unique patient IDs
      const patientIds = [...new Set(appointmentsData.map(appt => appt.patient_id))];
      
      // Fetch patient data in a separate query
      let patientsData: any[] = [];
      if (patientIds.length > 0) {
        const { data: patients, error: patientsError } = await supabase
          .from('patients')
          .select('*')
          .in('id', patientIds);
          
        if (patientsError) throw patientsError;
        patientsData = patients || [];
      }
      
      // Combine the data
      const processedAppointments = appointmentsData.map(appt => {
        const patient = patientsData.find(p => p.id === appt.patient_id) || {};
        return {
          ...appt,
          status: normalizeStatus(appt.status),
          patient
        };
      });
      
      setAppointments(processedAppointments);
      
      // Update stats
      const today = new Date().toISOString().split('T')[0];
      const todayApps = processedAppointments.filter(
        appt => appt.appointment_date === today && 
        !['Completed', 'Cancelled'].includes(appt.status)
      ).length;
      
      setStats(prev => ({
        ...prev,
        totalAppointments: processedAppointments.length,
        todayAppointments: todayApps,
        pendingConsultations: processedAppointments.filter(
          appt => appt.status === 'Scheduled' || appt.status === 'In Progress'
        ).length
      }));
      
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast.error('Failed to load appointments. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Set up real-time subscription for appointments with error handling
  useEffect(() => {
    if (!user?.id) return;
    
    let isMounted = true;
    let channel: any = null;
    let debounceTimer: NodeJS.Timeout;
    
    const setupSubscription = async () => {
      try {
        // Initial data fetch
        if (isMounted) {
          await fetchAppointments();
        }
        
        // Only set up subscription if not already done
        if (!channel) {
          channel = supabase.channel('appointments_changes')
            .on('postgres_changes', 
              { 
                event: '*', 
                schema: 'public', 
                table: 'appointments',
                filter: `doctor_id=eq.${user.id}`
              }, 
              (payload: any) => {
                console.log('Appointment change received:', payload);
                // Debounce rapid updates
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                  if (isMounted) {
                    fetchAppointments();
                  }
                }, 1000);
              }
            )
            // @ts-ignore - Supabase realtime types are not fully compatible
            .on('error', (error: any) => {
              console.error('Realtime subscription error:', error);
              toast.error('Connection error. Attempting to reconnect...');
              // Attempt to resubscribe after a delay
              setTimeout(() => {
                if (channel && isMounted) {
                  channel.unsubscribe().then(() => {
                    if (isMounted) setupSubscription();
                  });
                }
              }, 5000);
              return error;
            })
            .subscribe((status: string) => {
              if (status === 'SUBSCRIBED' && isMounted) {
                console.log('Successfully subscribed to real-time updates');
              }
            });
        }
      } catch (error) {
        console.error('Error setting up subscription:', error);
        if (isMounted) {
          toast.error('Failed to set up real-time updates');
        }
      }
    };
    
    setupSubscription();
    
    // Cleanup function
    return () => {
      isMounted = false;
      clearTimeout(debounceTimer);
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [user?.id]); // Only depend on user.id to prevent unnecessary re-renders

  const updateAppointmentStatus = async (appointmentId: string, newStatus: string) => {
    try {
      // Input validation
      if (!appointmentId) {
        console.error('No appointment ID provided');
        toast.error('Error: No appointment ID provided');
        return;
      }

      const validStatuses = ['Scheduled', 'In Progress', 'Completed', 'No Show', 'Cancelled'];
      if (!validStatuses.includes(newStatus)) {
        console.error('Invalid status provided:', newStatus);
        toast.error(`Error: Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        return;
      }

      console.log('Updating appointment status:', { appointmentId, newStatus });

      const updateData: any = { 
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      // Only set completed_at when marking as completed
      if (newStatus === 'Completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', appointmentId)
        .select('*, patient:patient_id(full_name, id)');

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error('No data returned from update - appointment may not exist');
      }

      console.log('Update successful, response data:', data);

      // Update local state
      setAppointments(prev => {
        const updated = prev.map(appt =>
          appt.id === appointmentId ? { 
            ...appt, 
            ...data[0],
            patient: data[0].patient || appt.patient // Preserve patient data if not in response
          } : appt
        );
        console.log('Updated appointments state:', updated);
        return updated;
      });

      // Show appropriate toast message
      const appointment = data[0];
      const patientName = appointment?.patient?.full_name || 'the patient';
      
      const statusMessages = {
        'Scheduled': `Appointment with ${patientName} has been rescheduled`,
        'In Progress': `Started consultation with ${patientName}`,
        'Completed': `Completed appointment with ${patientName}`,
        'No Show': `Marked appointment with ${patientName} as No Show`,
        'Cancelled': `Cancelled appointment with ${patientName}`
      };

      const message = statusMessages[newStatus as keyof typeof statusMessages] || 'Appointment updated';
      console.log('Showing success message:', message);
      toast.success(message);
      
      // If completing an appointment, check if there are pending lab tests or prescriptions
      if (newStatus === 'Completed') {
        console.log('Appointment completed, check for pending tests/prescriptions');
        // You could add logic here to check for pending tests/prescriptions
        // and prompt the doctor if they want to order any
      }
    } catch (error) {
      console.error('Error in updateAppointmentStatus:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Full error details:', error);
      toast.error(`Failed to update appointment status: ${errorMessage}`);
    }
  };

  // Get appointment actions based on status and time
  const getAppointmentActions = (appointment: any) => {
    const now = new Date();
    const apptTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
    const apptEndTime = addMinutes(apptTime, 30);
    
    // If appointment is in the future
    if (isBefore(now, apptTime)) {
      return (
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-xs"
            onClick={() => updateAppointmentStatus(appointment.id, 'Cancelled')}
          >
            Cancel
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-xs"
            onClick={() => {
              setSelectedAppointment(appointment);
              setRescheduleDate(new Date(appointment.appointment_date));
              setRescheduleTime(appointment.appointment_time);
              setShowRescheduleForm(true);
            }}
          >
            Reschedule
          </Button>
        </div>
      );
    }
    
    // If appointment time has arrived but not yet marked in progress
    if (isBefore(now, apptEndTime) && appointment.status !== 'In Progress') {
      return (
        <Button 
          variant="default" 
          size="sm" 
          className="h-7 text-xs"
          onClick={() => updateAppointmentStatus(appointment.id, 'In Progress')}
        >
          Start Consultation
        </Button>
      );
    }
    
    // If appointment is in progress
    if (appointment.status === 'In Progress') {
      return (
        <div className="flex gap-2">
          <Button 
            variant="default" 
            size="sm" 
            className="h-7 text-xs"
            onClick={() => {
              // This would open a form to add consultation notes
              toast.info('Would open consultation notes form');
            }}
          >
            Add Notes
          </Button>
          <Button 
            variant="secondary" 
            size="sm" 
            className="h-7 text-xs"
            onClick={() => updateAppointmentStatus(appointment.id, 'Completed')}
          >
            Complete
          </Button>
        </div>
      );
    }
    
    // For completed appointments
    if (appointment.status === 'Completed') {
      return (
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-xs"
            onClick={() => {
              // This would open the patient's record
              if (appointment.patient_id) {
                window.open(`/patients/${appointment.patient_id}`, '_blank');
              }
            }}
          >
            View Record
          </Button>
        </div>
      );
    }
    
    // For no show or cancelled appointments
    return (
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-7 text-xs"
        onClick={() => {
          // Option to reschedule
          toast.info('Would open reschedule form');
        }}
      >
        Reschedule
      </Button>
    );
  };
  
  const handleViewLabResults = (tests: any[]) => {
    setSelectedLabTests(tests);
    setShowLabResults(true);
  };
  
  const handleViewPrescriptions = (prescriptions: any[]) => {
    setSelectedPrescriptions(prescriptions);
    setShowPrescriptions(true);
  };

  const handleRescheduleAppointment = async () => {
    // Input validation
    if (!rescheduleDate || !rescheduleTime || !selectedAppointment) {
      console.error('Missing required fields for rescheduling:', { 
        rescheduleDate, 
        rescheduleTime, 
        selectedAppointment 
      });
      toast.error('Please fill in all required fields');
      return;
    }
    
    console.log('Starting reschedule with data:', {
      appointmentId: selectedAppointment.id,
      newDate: rescheduleDate,
      newTime: rescheduleTime,
      reason: rescheduleReason
    });

    setIsRescheduling(true);
    try {
      const newDate = format(rescheduleDate, 'yyyy-MM-dd');
      console.log('Formatted date for DB:', newDate);

      const updateData = { 
        appointment_date: newDate,
        appointment_time: rescheduleTime,
        status: 'Scheduled',
        rescheduled_at: new Date().toISOString(),
        reschedule_reason: rescheduleReason || 'No reason provided',
        updated_at: new Date().toISOString()
      };

      console.log('Sending update to database:', updateData);

      const { data, error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', selectedAppointment.id)
        .select('*');

      if (error) {
        console.error('Supabase error:', error);
        throw new Error(error.message || 'Failed to update appointment in database');
      }

      if (!data || data.length === 0) {
        throw new Error('No data returned from update - appointment may not exist');
      }

      console.log('Database update successful, response:', data);

      // Update local state with the complete appointment data from the server
      setAppointments(prev => {
        const updated = prev.map(appt =>
          appt.id === selectedAppointment.id 
            ? { 
                ...appt,
                ...data[0],
                patient: appt.patient // Preserve patient data
              } 
            : appt
        );
        console.log('Updated appointments state:', updated);
        return updated;
      });

      const successMessage = `Appointment rescheduled to ${format(rescheduleDate, 'PPP')} at ${rescheduleTime}`;
      console.log('Success:', successMessage);
      toast.success(successMessage);
      
      // Reset form
      setShowRescheduleForm(false);
      setRescheduleDate(undefined);
      setRescheduleTime('');
      setRescheduleReason('');
      setSelectedAppointment(null);
      
    } catch (error) {
      console.error('Error in handleRescheduleAppointment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error details:', error);
      toast.error(`Failed to reschedule appointment: ${errorMessage}`);
    } finally {
      setIsRescheduling(false);
    }
  };

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch visits waiting for doctor (including those from lab workflow)
      const { data: visitsData } = await supabase
        .from('patient_visits')
        .select(`
          *,
          patient:patients(id, full_name, phone, blood_group, date_of_birth, gender, allergies, medical_history)
        `)
        .eq('current_stage', 'doctor')
        .eq('overall_status', 'Active')
        .eq('doctor_status', 'Pending')
        .order('lab_completed_at', { ascending: true, nullsFirst: false });

      console.log('Doctor Dashboard Debug:', {
        visitsQuery: {
          current_stage_doctor: visitsData?.length || 0,
          total_visits: 'N/A'
        },
        labWorkflowCheck: 'Check if visits are created when lab tests are completed',
        samplePatients: visitsData?.map(v => ({
          id: v.id,
          patient: v.patient?.full_name,
          current_stage: v.current_stage,
          doctor_status: v.doctor_status,
          lab_status: v.lab_status,
          lab_completed_at: v.lab_completed_at,
          created_at: v.created_at
        })) || []
      });

      // Also check all patient visits to see what's in the database
      const { data: allVisits } = await supabase
        .from('patient_visits')
        .select('*')
        .eq('current_stage', 'doctor')
        .limit(20);

      console.log('All doctor-stage patient visits in DB:', allVisits?.map(v => ({
        id: v.id,
        patient_id: v.patient_id,
        current_stage: v.current_stage,
        doctor_status: v.doctor_status,
        lab_status: v.lab_status,
        lab_completed_at: v.lab_completed_at,
        created_at: v.created_at
      })));

      // Fetch doctor's appointments
      const { data: appointmentsData } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(full_name, phone, blood_group),
          department:departments(name)
        `)
        .eq('doctor_id', user.id)
        .order('appointment_date', { ascending: true })
        .limit(10);

      // Fetch patients
      const { data: patientsData } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch lab tests and results for patients in visits
      const visitsWithLabTests = await Promise.all(
        (visitsData || []).map(async (visit) => {
          let labTests = [];
          let allCompletedTests = [];
          let prescriptions = [];

          try {
            console.log('Fetching lab tests for patient:', visit.patient.id, visit.patient.full_name);

            const { data: labTestsData, error: labError } = await supabase
              .from('lab_tests')
              .select(`
                *,
                lab_results(*)
              `)
              .eq('patient_id', visit.patient.id)
              .order('completed_date', { ascending: false });

            if (labError) {
              console.error('Error fetching lab tests for patient:', visit.patient.id, labError);
            } else {
              labTests = labTestsData || [];
            }

            console.log('Lab tests found for patient:', visit.patient.id, labTests.length);

            // Also get any completed lab tests regardless of completion date
            const { data: allCompletedTestsData } = await supabase
              .from('lab_tests')
              .select(`
                *,
                lab_results(*)
              `)
              .eq('patient_id', visit.patient.id)
              .eq('status', 'Completed');

            allCompletedTests = allCompletedTestsData || [];
            console.log('All completed lab tests for patient:', visit.patient.id, allCompletedTests.length);

            console.log('Fetching prescriptions for patient:', visit.patient.id, visit.patient.full_name);

            const { data: prescriptionsData, error: presError } = await supabase
              .from('prescriptions')
              .select(`
                *,
                medications(name, strength, dosage_form)
              `)
              .eq('patient_id', visit.patient.id)
              .order('prescribed_date', { ascending: false });

            if (presError) {
              console.error('Error fetching prescriptions for patient:', visit.patient.id, presError);
            } else {
              prescriptions = prescriptionsData || [];
            }

            console.log('Prescriptions found for patient:', visit.patient.id, prescriptions.length);

          } catch (error) {
            console.error('Error fetching data for patient:', visit.patient.id, error);
          }

          return {
            ...visit,
            labTests,
            allCompletedLabTests: allCompletedTests,
            prescriptions
          };
        })
      );

      // Calculate stats
      const today = new Date().toISOString().split('T')[0];
      const todayAppointments = appointmentsData?.filter(a => a.appointment_date === today).length || 0;

      setPendingVisits(visitsWithLabTests);
      setAppointments(appointmentsData || []);
      setPatients(patientsData || []);
      setStats({
        totalAppointments: appointmentsData?.length || 0,
        todayAppointments,
        totalPatients: patientsData?.length || 0,
        pendingConsultations: visitsWithLabTests.length
      });
    } catch (error) {
      console.error('Error fetching doctor data:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });

      // Set empty data to prevent crashes
      setPendingVisits([]);
      setAppointments([]);
      setPatients([]);
      setStats({
        totalAppointments: 0,
        todayAppointments: 0,
        totalPatients: 0,
        pendingConsultations: 0,
      });

      toast.error(`Failed to load dashboard data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <DashboardLayout title="Doctor Dashboard">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Doctor Dashboard">
      <div className="space-y-8">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-primary/20 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Appointments</CardTitle>
              <CalendarIcon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.todayAppointments}</div>
            </CardContent>
          </Card>

          <Card className="border-secondary/20 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Appointments</CardTitle>
              <Activity className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-secondary">{stats.totalAppointments}</div>
            </CardContent>
          </Card>

          <Card className="border-accent/20 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Consultations</CardTitle>
              <Users className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{stats.pendingConsultations}</div>
              <p className="text-xs text-muted-foreground">Waiting for doctor</p>
            </CardContent>
          </Card>

          <Card className="border-green-200 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
              <Users className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.totalPatients}</div>
              <p className="text-xs text-muted-foreground mt-1">Total registered patients</p>
            </CardContent>
          </Card>
        </div>


        {/* Lab Results Modal */}
        <Dialog open={showLabResults} onOpenChange={setShowLabResults}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Lab Test Results</DialogTitle>
              <DialogDescription>
                Review all lab test results for your patients
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="all">All Tests</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
              </TabsList>
              
              <TabsContent value="all" className="space-y-4">
                {selectedLabTests.length > 0 ? (
                  selectedLabTests.map((test) => (
                    <div key={test.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{test.test_name}</h4>
                          <p className="text-sm text-muted-foreground">{test.test_type}</p>
                        </div>
                        <Badge variant={test.status === 'Completed' ? 'default' : 'secondary'}>
                          {test.status}
                        </Badge>
                      </div>
                      
                      {test.lab_results?.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <h5 className="text-sm font-medium">Results:</h5>
                          <div className="space-y-2">
                            {test.lab_results.map((result: any) => (
                              <div key={result.id} className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded">
                                <span className="font-medium">{result.result_value} {result.unit}</span>
                                <div className="flex items-center gap-2">
                                  {result.reference_range && (
                                    <span className="text-muted-foreground text-xs">
                                      Ref: {result.reference_range}
                                    </span>
                                  )}
                                  {result.abnormal_flag && (
                                    <Badge variant="destructive" className="text-xs">
                                      Abnormal
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {test.notes && (
                        <div className="mt-3 p-3 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 text-sm">
                          <strong>Notes:</strong> {test.notes}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No lab test results available
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="completed" className="space-y-4">
                {selectedLabTests.filter(t => t.status === 'Completed').length > 0 ? (
                  selectedLabTests
                    .filter(t => t.status === 'Completed')
                    .map((test) => (
                      <div key={test.id} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{test.test_name}</h4>
                            <p className="text-sm text-muted-foreground">{test.test_type}</p>
                          </div>
                          <Badge>Completed</Badge>
                        </div>
                        {/* Results display same as above */}
                      </div>
                    ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No completed lab tests
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="pending" className="space-y-4">
                {selectedLabTests.filter(t => t.status !== 'Completed').length > 0 ? (
                  selectedLabTests
                    .filter(t => t.status !== 'Completed')
                    .map((test) => (
                      <div key={test.id} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{test.test_name}</h4>
                            <p className="text-sm text-muted-foreground">{test.test_type}</p>
                          </div>
                          <Badge variant="secondary">{test.status}</Badge>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No pending lab tests
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {/* Prescriptions Modal */}
        <Dialog open={showPrescriptions} onOpenChange={setShowPrescriptions}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Patient Prescriptions</DialogTitle>
              <DialogDescription>
                Review all prescriptions for your patients
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="all">All Prescriptions</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
              </TabsList>
              
              <TabsContent value="all" className="space-y-4">
                {selectedPrescriptions.length > 0 ? (
                  selectedPrescriptions.map((prescription) => (
                    <div key={prescription.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{prescription.medication_name}</h4>
                          <div className="text-sm text-muted-foreground">
                            {prescription.medications && (
                              <span>{prescription.medications.strength} {prescription.medications.dosage_form} • </span>
                            )}
                            <span>Prescribed: {format(new Date(prescription.prescribed_date), 'MMM dd, yyyy')}</span>
                          </div>
                        </div>
                        <Badge variant={prescription.status === 'Active' ? 'default' : 'secondary'}>
                          {prescription.status}
                        </Badge>
                      </div>
                      
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div><strong>Dosage:</strong> {prescription.dosage}</div>
                        <div><strong>Frequency:</strong> {prescription.frequency}</div>
                        <div><strong>Duration:</strong> {prescription.duration}</div>
                        <div><strong>Quantity:</strong> {prescription.quantity}</div>
                      </div>
                      
                      {prescription.instructions && (
                        <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-400 text-sm">
                          <strong>Instructions:</strong> {prescription.instructions}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No prescriptions found
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="active" className="space-y-4">
                {selectedPrescriptions.filter(p => p.status === 'Active').length > 0 ? (
                  selectedPrescriptions
                    .filter(p => p.status === 'Active')
                    .map((prescription) => (
                      <div key={prescription.id} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{prescription.medication_name}</h4>
                            <div className="text-sm text-muted-foreground">
                              {prescription.medications && (
                                <span>{prescription.medications.strength} {prescription.medications.dosage_form} • </span>
                              )}
                              <span>Prescribed: {format(new Date(prescription.prescribed_date), 'MMM dd, yyyy')}</span>
                            </div>
                          </div>
                          <Badge>Active</Badge>
                        </div>
                        {/* Prescription details same as above */}
                      </div>
                    ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No active prescriptions
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="completed" className="space-y-4">
                {selectedPrescriptions.filter(p => p.status === 'Completed').length > 0 ? (
                  selectedPrescriptions
                    .filter(p => p.status === 'Completed')
                    .map((prescription) => (
                      <div key={prescription.id} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{prescription.medication_name}</h4>
                            <div className="text-sm text-muted-foreground">
                              {prescription.medications && (
                                <span>{prescription.medications.strength} {prescription.medications.dosage_form} • </span>
                              )}
                              <span>Prescribed: {format(new Date(prescription.prescribed_date), 'MMM dd, yyyy')}</span>
                            </div>
                          </div>
                          <Badge variant="secondary">Completed</Badge>
                        </div>
                        {/* Prescription details same as above */}
                      </div>
                    ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No completed prescriptions
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {/* Lab Workflow Queue - Highlighted Section */}
        {pendingVisits.some(v => v.lab_completed_at) && (
          <Card className="shadow-lg border-green-300 bg-green-50/30">
            <CardHeader className="bg-green-100/50">
              <CardTitle className="flex items-center gap-2 text-green-800">
                <FlaskConical className="h-5 w-5" />
                Lab Results Queue
                <Badge variant="default" className="bg-green-600">
                  {pendingVisits.filter(v => v.lab_completed_at).length} patient{pendingVisits.filter(v => v.lab_completed_at).length !== 1 ? 's' : ''}
                </Badge>
              </CardTitle>
              <CardDescription className="text-green-700">
                Patients who have completed lab work and are waiting for doctor consultation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingVisits
                  .filter(visit => visit.lab_completed_at)
                  .map((visit) => (
                  <div key={visit.id} className="p-4 border rounded-lg bg-white border-green-200">
                    <div className="flex items-start justify-between mb-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-lg text-green-800">{visit.patient?.full_name}</h4>
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            Lab → Doctor
                          </Badge>
                          {visit.prescriptions && visit.prescriptions.length > 0 && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              <Pill className="h-3 w-3 mr-1" />
                              Has Rx ({visit.prescriptions.length})
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          DOB: {format(new Date(visit.patient?.date_of_birth), 'MMM dd, yyyy')} •
                          Gender: {visit.patient?.gender} •
                          Blood: {visit.patient?.blood_group || 'N/A'}
                        </p>

                        <div className="text-sm bg-green-50 p-2 rounded border border-green-200">
                          <strong className="text-green-800">Lab Work Completed:</strong>{' '}
                          {format(new Date(visit.lab_completed_at), 'MMM dd, yyyy HH:mm')}
                        </div>

                        {visit.patient?.medical_history && (
                          <p className="text-sm"><strong>History:</strong> {visit.patient.medical_history}</p>
                        )}
                        {visit.patient?.allergies && (
                          <p className="text-sm text-red-600"><strong>Allergies:</strong> {visit.patient.allergies}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="outline" className="flex items-center gap-1 bg-blue-50">
                          <Clock className="h-3 w-3" />
                          {format(new Date(visit.arrival_time || visit.created_at), 'HH:mm')}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          Waiting
                        </Badge>
                      </div>
                    </div>

                    {/* Lab Results for this patient */}
                    {(visit.labTests && visit.labTests.length > 0) || (visit.allCompletedLabTests && visit.allCompletedLabTests.length > 0) ? (
                      <div className="text-sm bg-green-50 p-3 rounded border border-green-200">
                        <strong className="text-green-800 block mb-2">Available Lab Results:</strong>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {visit.labTests.concat(visit.allCompletedLabTests)
                            .filter((test: any, index: number, self: any[]) => 
                              index === self.findIndex((t: any) => t.id === test.id)
                            )
                            .map((test: any) => (
                            <div key={test.id} className="bg-white p-2 rounded border shadow-sm">
                              <div className="font-medium text-sm flex items-center justify-between">
                                <span>{test.test_name}</span>
                                <Badge variant={test.status === 'Completed' ? 'default' : 'outline'} className="text-xs">
                                  {test.status}
                                </Badge>
                              </div>
                              {test.lab_results && test.lab_results.length > 0 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {test.lab_results.map((result: any) => (
                                    <span key={result.id} className="mr-2">
                                      {result.result_value} {result.unit}
                                      {result.abnormal_flag && <span className="text-red-600 ml-1">⚠</span>}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Prescriptions for this patient */}
                    {visit.prescriptions && visit.prescriptions.length > 0 ? (
                      <div className="text-sm bg-blue-50 p-3 rounded border border-blue-200">
                        <strong className="text-blue-800 block mb-2 flex items-center gap-2">
                          <Pill className="h-4 w-4" />
                          Active Prescriptions:
                        </strong>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {visit.prescriptions.map((prescription: any) => (
                            <div key={prescription.id} className="bg-white p-3 rounded border shadow-sm">
                              <div className="flex justify-between items-start mb-2">
                                <div className="font-medium text-sm text-blue-800">
                                  {prescription.medication_name}
                                  {prescription.medications && (
                                    <span className="text-xs text-muted-foreground ml-1">
                                      ({prescription.medications.strength} {prescription.medications.dosage_form})
                                    </span>
                                  )}
                                </div>
                                <Badge
                                  variant={prescription.status === 'Active' ? 'default' : 'secondary'}
                                  className="text-xs"
                                >
                                  {prescription.status || 'Pending'}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground space-y-1">
                                <div><strong>Dosage:</strong> {prescription.dosage}</div>
                                <div><strong>Frequency:</strong> {prescription.frequency}</div>
                                <div><strong>Duration:</strong> {prescription.duration}</div>
                                <div><strong>Quantity:</strong> {prescription.quantity}</div>
                                {prescription.instructions && (
                                  <div><strong>Instructions:</strong> {prescription.instructions}</div>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                                Prescribed: {format(new Date(prescription.prescribed_date), 'MMM dd, yyyy HH:mm')}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Regular Pending Consultations (non-lab) */}
        {pendingVisits.filter(v => !v.lab_completed_at).length > 0 && (
          <Card className="shadow-lg border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Patients Waiting for Consultation
                <Badge variant="secondary" className="ml-auto">
                  {pendingVisits.filter(v => !v.lab_completed_at).length} patient{pendingVisits.filter(v => !v.lab_completed_at).length !== 1 ? 's' : ''}
                </Badge>
              </CardTitle>
              <CardDescription>Patients ready for doctor consultation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingVisits
                  .filter(visit => !visit.lab_completed_at)
                  .map((visit) => (
                  <div key={visit.id} className="p-4 border rounded-lg bg-blue-50/50">
                    <div className="flex items-start justify-between mb-4">
                      <div className="space-y-2 flex-1">
                        <div>
                          <h4 className="font-semibold text-lg">{visit.patient?.full_name}</h4>
                          {visit.prescriptions && visit.prescriptions.length > 0 && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 mt-1">
                              <Pill className="h-3 w-3 mr-1" />
                              Has Prescriptions ({visit.prescriptions.length})
                            </Badge>
                          )}
                          <p className="text-sm text-muted-foreground">
                            DOB: {format(new Date(visit.patient?.date_of_birth), 'MMM dd, yyyy')} •
                            Gender: {visit.patient?.gender} •
                            Blood: {visit.patient?.blood_group || 'N/A'}
                          </p>
                        </div>
                        {visit.nurse_vitals && (
                          <div className="text-sm bg-white p-2 rounded border">
                            <strong>Vitals:</strong> BP: {visit.nurse_vitals.blood_pressure},
                            HR: {visit.nurse_vitals.heart_rate},
                            Temp: {visit.nurse_vitals.temperature},
                            O2: {visit.nurse_vitals.oxygen_saturation}
                          </div>
                        )}
                        {visit.patient?.medical_history && (
                          <p className="text-sm"><strong>History:</strong> {visit.patient.medical_history}</p>
                        )}
                        {visit.patient?.allergies && (
                          <p className="text-sm text-red-600"><strong>Allergies:</strong> {visit.patient.allergies}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="outline" className="flex items-center gap-1 bg-blue-50">
                          <Clock className="h-3 w-3" />
                          {format(new Date(visit.arrival_time || visit.created_at), 'HH:mm')}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          Waiting
                        </Badge>
                      </div>
                    </div>

                    {/* Lab Results - Full Width (for non-lab patients who might still have results) */}
                    {(visit.labTests && visit.labTests.length > 0) || (visit.allCompletedLabTests && visit.allCompletedLabTests.length > 0) ? (
                      <div className="text-sm bg-green-50 p-3 rounded border border-green-200">
                        <strong className="text-green-800 block mb-2">Lab Results:</strong>
                        <div className="space-y-3 max-h-48 overflow-y-auto">
                          {visit.labTests.concat(visit.allCompletedLabTests)
                            .filter((test: any, index: number, self: any[]) => 
                              index === self.findIndex((t: any) => t.id === test.id)
                            )
                            .map((test: any) => (
                            <div key={test.id} className="bg-white p-3 rounded border shadow-sm">
                              <div className="font-medium text-sm mb-2">{test.test_name} ({test.test_type})</div>
                              <div className="text-xs text-muted-foreground mb-2">
                                Status: <Badge variant={test.status === 'Completed' ? 'default' : 'outline'}>{test.status}</Badge>
                              </div>
                              {test.lab_results && test.lab_results.length > 0 && (
                                <div className="space-y-1">
                                  {test.lab_results.map((result: any) => (
                                    <div key={result.id} className="flex justify-between items-center text-xs bg-gray-50 p-2 rounded">
                                      <span className="font-medium">{result.result_value} {result.unit}</span>
                                      <div className="flex items-center gap-2">
                                        {result.reference_range && (
                                          <span className="text-muted-foreground">
                                            (Ref: {result.reference_range})
                                          </span>
                                        )}
                                        {result.abnormal_flag && (
                                          <span className="text-red-600 font-medium text-xs">⚠ Abnormal</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {test.notes && (
                                <p className="text-xs text-muted-foreground mt-2 p-2 bg-yellow-50 rounded">Note: {test.notes}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Prescriptions for this patient */}
                    {visit.prescriptions && visit.prescriptions.length > 0 ? (
                      <div className="text-sm bg-blue-50 p-3 rounded border border-blue-200">
                        <strong className="text-blue-800 block mb-2 flex items-center gap-2">
                          <Pill className="h-4 w-4" />
                          Active Prescriptions:
                        </strong>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {visit.prescriptions.map((prescription: any) => (
                            <div key={prescription.id} className="bg-white p-3 rounded border shadow-sm">
                              <div className="flex justify-between items-start mb-2">
                                <div className="font-medium text-sm text-blue-800">
                                  {prescription.medication_name}
                                  {prescription.medications && (
                                    <span className="text-xs text-muted-foreground ml-1">
                                      ({prescription.medications.strength} {prescription.medications.dosage_form})
                                    </span>
                                  )}
                                </div>
                                <Badge
                                  variant={prescription.status === 'Active' ? 'default' : 'secondary'}
                                  className="text-xs"
                                >
                                  {prescription.status || 'Pending'}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground space-y-1">
                                <div><strong>Dosage:</strong> {prescription.dosage}</div>
                                <div><strong>Frequency:</strong> {prescription.frequency}</div>
                                <div><strong>Duration:</strong> {prescription.duration}</div>
                                <div><strong>Quantity:</strong> {prescription.quantity}</div>
                                {prescription.instructions && (
                                  <div><strong>Instructions:</strong> {prescription.instructions}</div>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                                Prescribed: {format(new Date(prescription.prescribed_date), 'MMM dd, yyyy HH:mm')}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Show message when no patients are waiting */}
        {pendingVisits.length === 0 && !loading && (
          <Card className="shadow-lg">
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No patients waiting for consultation</p>
                <p className="text-sm">Patients will appear here when they complete lab work or are ready for doctor consultation</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Appointments */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Appointments</CardTitle>
            <CardDescription>Your scheduled patient appointments</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="today" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="week">This Week</TabsTrigger>
              </TabsList>
              
              <TabsContent value="today" className="space-y-4">
                {appointments.filter(appt => 
                  isToday(new Date(appt.appointment_date))
                ).length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {appointments
                        .filter(appt => isToday(new Date(appt.appointment_date)))
                        .sort((a, b) => {
                          const timeA = new Date(`${a.appointment_date}T${a.appointment_time}`).getTime();
                          const timeB = new Date(`${b.appointment_date}T${b.appointment_time}`).getTime();
                          return timeA - timeB;
                        })
                        .map((appointment) => (
                          <TableRow key={appointment.id} className={getAppointmentRowClass(appointment)}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${getAppointmentDotClass(appointment)}`}></div>
                                {appointment.patient?.full_name || 'Unknown'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span>{format(new Date(`${appointment.appointment_date}T${appointment.appointment_time}`), 'h:mm a')}</span>
                                {getAppointmentStatusBadge(appointment)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={getAppointmentBadgeVariant(appointment.status)}>
                                {appointment.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {handleAppointmentAction(appointment)}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No appointments scheduled for today
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="week" className="space-y-4">
                {appointments.filter(appt => {
                  const { start, end } = getCurrentWeekRange();
                  const apptDate = new Date(appt.appointment_date);
                  return apptDate >= start && apptDate <= end;
                }).length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {appointments
                        .filter(appt => {
                          const { start, end } = getCurrentWeekRange();
                          const apptDate = new Date(appt.appointment_date);
                          return apptDate >= start && apptDate <= end;
                        })
                        .sort((a, b) => {
                          const timeA = new Date(`${a.appointment_date}T${a.appointment_time}`).getTime();
                          const timeB = new Date(`${b.appointment_date}T${b.appointment_time}`).getTime();
                          return timeA - timeB;
                        })
                        .map((appointment) => (
                          <TableRow key={appointment.id} className={getAppointmentRowClass(appointment)}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${getAppointmentDotClass(appointment)}`}></div>
                                {appointment.patient?.full_name || 'Unknown'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span>{format(new Date(`${appointment.appointment_date}T${appointment.appointment_time}`), 'MMM d, h:mm a')}</span>
                                {getAppointmentStatusBadge(appointment)}
                              </div>
                            </TableCell>
                            <TableCell>
                              {appointment.department?.name || 'N/A'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge variant={getAppointmentBadgeVariant(appointment.status)}>
                                  {appointment.status}
                                </Badge>
                                {appointment.status === 'In Progress' && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-6 text-xs"
                                    onClick={() => updateAppointmentStatus(appointment.id, 'Completed')}
                                  >
                                    Done
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No appointments scheduled for this week
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Recent Patients by Day */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Today's Patients</CardTitle>
                <CardDescription>Patients seen today</CardDescription>
              </div>
              {user?.user_metadata?.role === 'admin' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => window.location.href = '/patients'}
                >
                  View All Patients
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="today" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="yesterday">Yesterday</TabsTrigger>
                <TabsTrigger value="week">This Week</TabsTrigger>
              </TabsList>
              
              <TabsContent value="today" className="space-y-4">
                {patients.filter(patient => 
                  isToday(new Date(patient.last_visit || patient.created_at))
                ).length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Visit Time</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {patients
                        .filter(patient => 
                          isToday(new Date(patient.last_visit || patient.created_at))
                        )
                        .map((patient) => (
                          <TableRow key={patient.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                {patient.full_name}
                              </div>
                            </TableCell>
                            <TableCell>
                              {format(new Date(patient.last_visit || patient.created_at), 'h:mm a')}
                            </TableCell>
                            <TableCell>
                              <Badge variant={patient.status === 'Active' ? 'default' : 'secondary'}>
                                {patient.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No patients visited today
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="yesterday" className="space-y-4">
                {patients.filter(patient => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  return (
                    new Date(patient.last_visit || patient.created_at).toDateString() === yesterday.toDateString()
                  );
                }).length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Visit Time</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {patients
                        .filter(patient => {
                          const yesterday = new Date();
                          yesterday.setDate(yesterday.getDate() - 1);
                          return (
                            new Date(patient.last_visit || patient.created_at).toDateString() === yesterday.toDateString()
                          );
                        })
                        .map((patient) => (
                          <TableRow key={patient.id}>
                            <TableCell className="font-medium">
                              {patient.full_name}
                            </TableCell>
                            <TableCell>
                              {format(new Date(patient.last_visit || patient.created_at), 'h:mm a')}
                            </TableCell>
                            <TableCell>
                              <Badge variant={patient.status === 'Active' ? 'default' : 'secondary'}>
                                {patient.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No patients visited yesterday
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="week" className="space-y-4">
                {patients.filter(patient => {
                  const weekAgo = new Date();
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  return new Date(patient.last_visit || patient.created_at) > weekAgo;
                }).length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Visit Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {patients
                        .filter(patient => {
                          const weekAgo = new Date();
                          weekAgo.setDate(weekAgo.getDate() - 7);
                          return new Date(patient.last_visit || patient.created_at) > weekAgo;
                        })
                        .sort((a, b) => 
                          new Date(b.last_visit || b.created_at).getTime() - 
                          new Date(a.last_visit || a.created_at).getTime()
                        )
                        .map((patient) => (
                          <TableRow key={patient.id}>
                            <TableCell className="font-medium">
                              {patient.full_name}
                            </TableCell>
                            <TableCell>
                              {format(new Date(patient.last_visit || patient.created_at), 'MMM d, h:mm a')}
                            </TableCell>
                            <TableCell>
                              <Badge variant={patient.status === 'Active' ? 'default' : 'secondary'}>
                                {patient.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No patients visited this week
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    

      {/* Reschedule Appointment Dialog */}
      <Dialog open={showRescheduleForm} onOpenChange={setShowRescheduleForm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
            <DialogDescription>
              Select a new date and time for this appointment.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !rescheduleDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {rescheduleDate ? (
                        format(rescheduleDate, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={rescheduleDate}
                      onSelect={(date) => date && setRescheduleDate(date)}
                      defaultMonth={rescheduleDate || new Date()}
                      disabled={(date) => 
                        date < new Date() || date > addDays(new Date(), 30)
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Time</label>
                <Select 
                  value={rescheduleTime} 
                  onValueChange={setRescheduleTime}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a time" />
                  </SelectTrigger>
                  <SelectContent>
                    {generateTimeSlots().map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">
                  Reason for Rescheduling (Optional)
                </label>
                <Textarea
                  placeholder="Enter the reason for rescheduling..."
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowRescheduleForm(false);
                setSelectedAppointment(null);
              }}
              disabled={isRescheduling}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleRescheduleAppointment}
              disabled={!rescheduleDate || !rescheduleTime || isRescheduling}
            >
              {isRescheduling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Reschedule Appointment'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
