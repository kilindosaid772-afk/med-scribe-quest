import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Calendar, Users, Activity, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { EnhancedDoctorFeatures } from '@/components/EnhancedDoctorFeatures';

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [pendingVisits, setPendingVisits] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalAppointments: 0, todayAppointments: 0, totalPatients: 0, pendingConsultations: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [user]);

const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch visits waiting for doctor
      const { data: visitsData } = await supabase
        .from('patient_visits')
        .select(`
          *,
          patient:patients(id, full_name, phone, blood_group, date_of_birth, gender, allergies, medical_history)
        `)
        .eq('current_stage', 'doctor')
        .eq('overall_status', 'Active')
        .order('nurse_completed_at', { ascending: true });

      console.log('Doctor Dashboard Debug:', {
        visitsQuery: {
          current_stage_doctor: visitsData?.length || 0,
          total_visits: 'N/A'
        },
        labWorkflowCheck: 'Check if visits are created when lab tests are completed'
      });

      // Also check all patient visits to see what's in the database
      const { data: allVisits } = await supabase
        .from('patient_visits')
        .select('*')
        .limit(5);

      console.log('All patient visits in DB:', allVisits);

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
          const { data: labTests } = await supabase
            .from('lab_tests')
            .select(`
              *,
              lab_results(*)
            `)
            .eq('patient_id', visit.patient.id)
            .eq('status', 'Completed')
            .order('completed_date', { ascending: false });
          
          return {
            ...visit,
            labTests: labTests || []
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
      console.error('Error fetching data:', error);
      toast.error('Failed to load dashboard data');
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
              <Calendar className="h-4 w-4 text-primary" />
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
            </CardContent>
          </Card>
        </div>

        {/* Pending Consultations */}
        {pendingVisits.length > 0 && (
          <Card className="shadow-lg border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Patients Waiting for Consultation
              </CardTitle>
              <CardDescription>Patients ready for doctor consultation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingVisits.map((visit) => (
                  <div key={visit.id} className="p-4 border rounded-lg bg-blue-50/50">
                    <div className="flex items-start justify-between mb-4">
                      <div className="space-y-2">
                        <div>
                          <h4 className="font-semibold text-lg">{visit.patient?.full_name}</h4>
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
                      <EnhancedDoctorFeatures
                        patients={[visit.patient]}
                        onSuccess={fetchData}
                      />
                    </div>

                    {/* Lab Results - Full Width */}
                    {visit.labTests && visit.labTests.length > 0 && (
                      <div className="text-sm bg-green-50 p-3 rounded border border-green-200">
                        <strong className="text-green-800 block mb-2">Lab Results:</strong>
                        <div className="space-y-3 max-h-48 overflow-y-auto">
                          {visit.labTests.map((test: any) => (
                            <div key={test.id} className="bg-white p-3 rounded border shadow-sm">
                              <div className="font-medium text-sm mb-2">{test.test_name} ({test.test_type})</div>
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
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upcoming Appointments */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Upcoming Appointments</CardTitle>
                <CardDescription>Your scheduled patient appointments</CardDescription>
              </div>
              <EnhancedDoctorFeatures patients={patients} onSuccess={fetchData} />
            </div>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No appointments scheduled</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell className="font-medium">
                        {appointment.patient?.full_name || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(appointment.appointment_date), 'MMM dd, yyyy')} {appointment.appointment_time}
                      </TableCell>
                      <TableCell>{appointment.department?.name || 'N/A'}</TableCell>
                      <TableCell className="max-w-xs truncate">{appointment.reason}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            appointment.status === 'Confirmed' ? 'default' :
                            appointment.status === 'Scheduled' ? 'secondary' :
                            'outline'
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

        {/* Recent Patients */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Recent Patients</CardTitle>
            <CardDescription>Latest patient records in the system</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Blood Group</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell className="font-medium">{patient.full_name}</TableCell>
                    <TableCell>{patient.phone}</TableCell>
                    <TableCell>{patient.blood_group || 'N/A'}</TableCell>
                    <TableCell>{patient.gender}</TableCell>
                    <TableCell>
                      <Badge variant={patient.status === 'Active' ? 'default' : 'secondary'}>
                        {patient.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
