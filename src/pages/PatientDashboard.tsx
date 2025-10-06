import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Calendar, FileText, Activity, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function PatientDashboard() {
  const { user } = useAuth();
  const [patientData, setPatientData] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [user]);
  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch patient's own data
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 rows

      if (patientError && patientError.code !== 'PGRST116') {
        console.error('Patient fetch error:', patientError);
        toast.error('Error loading patient data');
        setLoading(false);
        return;
      }

      if (!patient) {
        console.log('No patient record found for user');
        toast.error('Patient record not found. Please contact the hospital administration to set up your profile.');
        setLoading(false);
        return;
      }

      if (patient) {
        // Fetch patient's appointments (simplified query)
        const { data: appointmentsData, error: appointmentsError } = await supabase
          .from('appointments')
          .select(`
            *,
            department:departments(name)
          `)
          .eq('patient_id', patient.id)
          .order('appointment_date', { ascending: true });

        if (appointmentsError) {
          console.error('Appointments fetch error:', appointmentsError);
          toast.error('Failed to load appointments');
        }

        setPatientData(patient);
        setAppointments(appointmentsData || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (!patientData) {
    return (
      <DashboardLayout title="Patient Dashboard">
        <Card className="shadow-lg">
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              No patient record found. Please contact the hospital administration.
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Patient Dashboard">
      <div className="space-y-8">
        {/* Patient Info Card */}
        <Card className="shadow-lg border-primary/20">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Your medical profile</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                <p className="text-lg font-semibold">{patientData.full_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Date of Birth</p>
                <p className="text-lg font-semibold">
                  {format(new Date(patientData.date_of_birth), 'MMM dd, yyyy')}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Gender</p>
                <p className="text-lg font-semibold">{patientData.gender}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Blood Group</p>
                <p className="text-lg font-semibold">{patientData.blood_group || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Phone</p>
                <p className="text-lg font-semibold">{patientData.phone}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge variant={patientData.status === 'Active' ? 'default' : 'secondary'}>
                  {patientData.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-primary/20 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Appointments</CardTitle>
              <Calendar className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{appointments.length}</div>
            </CardContent>
          </Card>

          <Card className="border-secondary/20 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
              <Activity className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-secondary">
                {appointments.filter(a => ['Scheduled', 'Confirmed'].includes(a.status)).length}
              </div>
            </CardContent>
          </Card>

          <Card className="border-accent/20 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Medical Records</CardTitle>
              <FileText className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">
                {patientData.medical_history ? 1 : 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Appointments */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Your Appointments</CardTitle>
            <CardDescription>View your scheduled and past appointments</CardDescription>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No appointments found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell>
                        {format(new Date(appointment.appointment_date), 'MMM dd, yyyy')} {appointment.appointment_time}
                      </TableCell>
                      <TableCell className="font-medium">
                        {appointment.doctor?.full_name || 'Unknown'}
                      </TableCell>
                      <TableCell>{appointment.department?.name || 'N/A'}</TableCell>
                      <TableCell className="max-w-xs truncate">{appointment.reason}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            appointment.status === 'Confirmed' ? 'default' :
                            appointment.status === 'Scheduled' ? 'secondary' :
                            appointment.status === 'Completed' ? 'outline' :
                            'destructive'
                          }
                        >
                          {appointment.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Medical History */}
        {patientData.medical_history && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Medical History</CardTitle>
              <CardDescription>Your recorded medical history</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{patientData.medical_history}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
