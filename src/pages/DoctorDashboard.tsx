import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Calendar, Users, Activity, Loader2, FlaskConical, Pill } from 'lucide-react';
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

  // Helper function to create sample data for testing
  const createSampleData = async () => {
    if (!user) return;

    try {
      // Create sample patients if none exist
      const { data: existingPatients } = await supabase.from('patients').select('id').limit(1);
      if (!existingPatients || existingPatients.length === 0) {
        const { data: newPatients } = await supabase.from('patients').insert([
          {
            full_name: 'Alice Johnson',
            date_of_birth: '1988-03-20',
            gender: 'Female',
            phone: '+255700000003',
            email: 'alice@example.com',
            blood_group: 'B+',
            status: 'Active'
          },
          {
            full_name: 'Bob Wilson',
            date_of_birth: '1975-11-10',
            gender: 'Male',
            phone: '+255700000004',
            email: 'bob@example.com',
            blood_group: 'AB+',
            status: 'Active'
          }
        ]).select();

        if (newPatients && newPatients.length > 0) {
          // Create sample appointments for today
          const today = new Date().toISOString().split('T')[0];
          await supabase.from('appointments').insert([
            {
              patient_id: newPatients[0].id,
              doctor_id: user.id,
              appointment_date: today,
              appointment_time: '09:00',
              reason: 'Follow-up consultation',
              status: 'Scheduled'
            },
            {
              patient_id: newPatients[1].id,
              doctor_id: user.id,
              appointment_date: today,
              appointment_time: '14:30',
              reason: 'Regular checkup',
              status: 'Confirmed'
            }
          ]);

          // Create sample patient visits
          await supabase.from('patient_visits').insert([
            {
              patient_id: newPatients[0].id,
              current_stage: 'doctor',
              overall_status: 'Active',
              reception_status: 'Checked In',
              nurse_status: 'Completed',
              doctor_status: 'Pending'
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
              <Button
                variant="outline"
                size="sm"
                onClick={createSampleData}
                className="mt-2 text-green-600 border-green-200 hover:bg-green-50"
              >
                Create Sample Data
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common doctor tasks and tools</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => window.location.href = '/services'}>
                <Activity className="h-6 w-6" />
                <span>Medical Services</span>
                <span className="text-xs text-muted-foreground">Add problems & tests</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => window.location.href = '/lab'}>
                <FlaskConical className="h-6 w-6" />
                <span>View Lab Results</span>
                <span className="text-xs text-muted-foreground">Check patient tests</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => window.location.href = '/pharmacy'}>
                <Pill className="h-6 w-6" />
                <span>Check Prescriptions</span>
                <span className="text-xs text-muted-foreground">Review medications</span>
              </Button>
            </div>
          </CardContent>
        </Card>

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
                      <EnhancedDoctorFeatures
                        patients={[visit.patient]}
                        onSuccess={() => {
                          fetchData();
                          toast.success('Consultation completed successfully');
                        }}
                        labResults={[
                          ...(visit.labTests.flatMap((test: any) => test.lab_results || [])),
                          ...(visit.allCompletedLabTests.flatMap((test: any) => test.lab_results || []))
                        ].filter((result: any, index: number, self: any[]) => 
                          index === self.findIndex((r: any) => r.id === result.id)
                        )}
                      />
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
                      <EnhancedDoctorFeatures
                        patients={[visit.patient]}
                        onSuccess={() => {
                          fetchData();
                          toast.success('Consultation completed successfully');
                        }}
                        labResults={[
                          ...(visit.labTests.flatMap((test: any) => test.lab_results || [])),
                          ...(visit.allCompletedLabTests.flatMap((test: any) => test.lab_results || []))
                        ].filter((result: any, index: number, self: any[]) => 
                          index === self.findIndex((r: any) => r.id === result.id)
                        )}
                      />
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
              <div className="overflow-x-auto">
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
              </div>
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
            <div className="overflow-x-auto">
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
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
