import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Calendar, File, Activity, Loader2, Search } from 'lucide-react';
import { format } from 'date-fns';

export default function PatientDashboard() {
  const { user, hasRole } = useAuth();
  const [patientData, setPatientData] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // For now, show a patient lookup interface for staff
      // In a real system, you might want to fetch all patients or implement search
      setLoading(false);
    } catch (error) {
      console.error('Error fetching patient dashboard data:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      toast.error(`Failed to load dashboard data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePatientSearch = async () => {
    if (!searchTerm.trim()) return;

    try {
      // Search for patient by name or phone
      const { data: patients, error } = await supabase
        .from('patients')
        .select('*')
        .or(`full_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
        .limit(1);

      if (error) {
        toast.error('Error searching for patient');
        return;
      }

      if (patients && patients.length > 0) {
        const patient = patients[0];
        setPatientData(patient);

        // Fetch patient's appointments
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

        setAppointments(appointmentsData || []);
      } else {
        toast.error('Patient not found');
        setPatientData(null);
        setAppointments([]);
      }
    } catch (error) {
      console.error('Error searching patient:', error);
      toast.error('Error searching for patient');
    }
  };

  // Helper function to create sample data for testing
  const createSampleData = async () => {
    try {
      // Create sample patients if none exist
      const { data: existingPatients } = await supabase.from('patients').select('id').limit(1);
      if (!existingPatients || existingPatients.length === 0) {
        await supabase.from('patients').insert([
          {
            full_name: 'Sarah Johnson',
            date_of_birth: '1995-06-10',
            gender: 'Female',
            phone: '+255700000007',
            email: 'sarah@example.com',
            blood_group: 'A-',
            status: 'Active',
            medical_history: 'No significant medical history'
          },
          {
            full_name: 'David Wilson',
            date_of_birth: '1983-09-22',
            gender: 'Male',
            phone: '+255700000008',
            email: 'david@example.com',
            blood_group: 'B-',
            status: 'Active',
            medical_history: 'Hypertension, Diabetes Type 2'
          }
        ]);
      }

      toast.success('Sample data created');
    } catch (error) {
      console.error('Error creating sample data:', error);
      toast.error('Failed to create sample data');
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Patient Dashboard">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Patient Dashboard">
      <div className="space-y-8">
        {/* Patient Search */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Patient Lookup</CardTitle>
                <CardDescription>Search for patient records</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={createSampleData}
                className="text-primary border-primary/20 hover:bg-primary/5"
              >
                Create Sample Data
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search by name or phone number"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handlePatientSearch()}
                />
              </div>
              <Button onClick={handlePatientSearch}>
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
            </div>
          </CardContent>
        </Card>

        {!patientData ? (
          <Card className="shadow-lg">
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">
                Search for a patient to view their records
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Patient Info Card */}
            <Card className="shadow-lg border-primary/20">
              <CardHeader>
                <CardTitle>Patient Information</CardTitle>
                <CardDescription>Patient medical profile</CardDescription>
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
                  <File className="h-4 w-4 text-accent" />
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
                <CardTitle>Patient Appointments</CardTitle>
                <CardDescription>View scheduled and past appointments</CardDescription>
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
                  <CardDescription>Patient's recorded medical history</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{patientData.medical_history}</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
