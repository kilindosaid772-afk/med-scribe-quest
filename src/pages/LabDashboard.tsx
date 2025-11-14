import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FlaskConical, AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function LabDashboard() {
  const [labTests, setLabTests] = useState<any[]>([]);
  const [stats, setStats] = useState({ pending: 0, inProgress: 0, completed: 0 });
  const [loading, setLoading] = useState(false);
  const [selectedPatientTests, setSelectedPatientTests] = useState<any[]>([]);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchResults, setBatchResults] = useState<Record<string, any>>({});
  const [groupedTests, setGroupedTests] = useState<Record<string, any[]>>({});

  useEffect(() => {
    fetchData();

    // Set up real-time subscription for lab tests
    const labTestsChannel = supabase
      .channel('lab_tests_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'lab_tests' },
        () => {
          console.log('Lab tests updated');
          fetchData();
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      supabase.removeChannel(labTestsChannel);
    };
  }, []);

  const fetchData = async () => {
    try {
      const { data: testsData } = await supabase
        .from('lab_tests')
        .select(`
          *,
          patient:patients(full_name, phone)
        `)
        .order('ordered_date', { ascending: false })
        .limit(50);

      // Remove duplicates based on ID
      const uniqueTests = testsData?.filter((test, index, self) =>
        index === self.findIndex(t => t.id === test.id)
      ) || [];

      console.log('Lab tests data:', {
        raw: testsData?.length || 0,
        unique: uniqueTests.length,
        duplicates: (testsData?.length || 0) - uniqueTests.length,
        timestamp: new Date().toISOString(),
        sample: uniqueTests.slice(0, 3).map(t => ({ id: t.id, name: t.test_name, patient: t.patient?.full_name }))
      });

      setLabTests(uniqueTests);

      // Group tests by patient
      const grouped = uniqueTests.reduce((acc: Record<string, any[]>, test) => {
        const patientId = test.patient_id;
        if (!acc[patientId]) {
          acc[patientId] = [];
        }
        acc[patientId].push(test);
        return acc;
      }, {});
      setGroupedTests(grouped);

      const pending = uniqueTests.filter(t => t.status === 'Pending').length;
      const inProgress = uniqueTests.filter(t => t.status === 'In Progress').length;
      const completed = uniqueTests.filter(t => t.status === 'Completed').length;

      setStats({ pending, inProgress, completed });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load lab tests');
    } finally {
      setLoading(false);
    }
  };



  const handleBatchTestSubmit = async (patientId: string) => {
    // Get all tests for this patient that are pending or in progress
    const patientTests = labTests.filter(
      test => test.patient_id === patientId && (test.status === 'Pending' || test.status === 'In Progress')
    );
    
    if (patientTests.length === 0) {
      toast.error('No pending tests for this patient');
      return;
    }

    // Auto-start all pending tests
    const pendingTests = patientTests.filter(t => t.status === 'Pending');
    if (pendingTests.length > 0) {
      await Promise.all(
        pendingTests.map(test => 
          supabase
            .from('lab_tests')
            .update({ status: 'In Progress' })
            .eq('id', test.id)
        )
      );
      toast.info(`Started ${pendingTests.length} pending test(s)`);
    }

    setSelectedPatientTests(patientTests);
    // Initialize batch results with empty values
    const initialResults: Record<string, any> = {};
    patientTests.forEach(test => {
      initialResults[test.id] = {
        result_value: '',
        reference_range: '',
        unit: '',
        abnormal_flag: false,
        notes: ''
      };
    });
    setBatchResults(initialResults);
    setBatchDialogOpen(true);
  };

  const handleBatchResultChange = (testId: string, field: string, value: any) => {
    setBatchResults(prev => ({
      ...prev,
      [testId]: {
        ...prev[testId],
        [field]: value
      }
    }));
  };

  const handleSubmitBatchResults = async () => {
    try {
      const resultsToInsert = [];
      const testsToUpdate = [];

      for (const test of selectedPatientTests) {
        const result = batchResults[test.id];
        if (result && result.result_value) {
          resultsToInsert.push({
            lab_test_id: test.id,
            ...result
          });
          testsToUpdate.push(test.id);
        }
      }

      if (resultsToInsert.length === 0) {
        toast.error('Please fill in at least one test result');
        return;
      }

      // Insert all results
      const { error: resultError } = await supabase
        .from('lab_results')
        .insert(resultsToInsert);

      if (resultError) throw resultError;

      // Update all test statuses
      const { error: updateError } = await supabase
        .from('lab_tests')
        .update({
          status: 'Completed',
          completed_date: new Date().toISOString()
        })
        .in('id', testsToUpdate);

      if (updateError) throw updateError;

      // Update patient workflow
      if (selectedPatientTests.length > 0) {
        const patientId = selectedPatientTests[0].patient_id;
        await updatePatientWorkflow(patientId);
      }

      toast.success(`${resultsToInsert.length} test results submitted successfully`);
      setBatchDialogOpen(false);
      setSelectedPatientTests([]);
      setBatchResults({});
      fetchData();
    } catch (error) {
      console.error('Error submitting batch results:', error);
      toast.error('Failed to submit batch results');
    }
  };

  const updatePatientWorkflow = async (patientId: string) => {
    const { data: visits } = await supabase
      .from('patient_visits')
      .select('*')
      .eq('patient_id', patientId)
      .eq('overall_status', 'Active')
      .order('created_at', { ascending: false })
      .limit(1);

    if (visits && visits.length > 0) {
      await supabase
        .from('patient_visits')
        .update({
          lab_status: 'Completed',
          lab_completed_at: new Date().toISOString(),
          current_stage: 'doctor',
          doctor_status: 'Pending'
        })
        .eq('id', visits[0].id);
    }
  };

  const handleUpdateStatus = async (testId: string, newStatus: string, patientId?: string) => {
    const { error } = await supabase
      .from('lab_tests')
      .update({
        status: newStatus,
        completed_date: newStatus === 'Completed' ? new Date().toISOString() : null
      })
      .eq('id', testId);

    if (error) {
      toast.error('Failed to update test status');
      return;
    }

    // If test is completed and we have patient ID, update workflow
    if (newStatus === 'Completed' && patientId) {
      console.log('Updating patient visit workflow for lab completion:', {
        patientId,
        testId,
        newStatus,
        currentTime: new Date().toISOString()
      });

      // Check if patient already has active prescriptions before proceeding
      const { data: existingPrescriptions } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('patient_id', patientId)
        .in('status', ['Pending', 'Active'])
        .limit(1);

      if (existingPrescriptions && existingPrescriptions.length > 0) {
        console.log('Patient already has active prescriptions:', existingPrescriptions.length);
        toast.success('Lab test completed - patient already has prescriptions assigned');
        fetchData();
        return;
      }

      // First, let's find the correct patient visit for this patient
      const { data: visits, error: visitError } = await supabase
        .from('patient_visits')
        .select('*')
        .eq('patient_id', patientId)
        .eq('overall_status', 'Active')
        .order('created_at', { ascending: false })
        .limit(5);

      console.log('Found patient visits for workflow update:', {
        patientId,
        visitsFound: visits?.length || 0,
        visits: visits?.map(v => ({
          id: v.id,
          current_stage: v.current_stage,
          overall_status: v.overall_status,
          lab_status: v.lab_status
        }))
      });

      if (visitError) {
        console.error('Error finding patient visits:', visitError);
      }

      if (visits && visits.length > 0) {
        // Find the most appropriate visit to update (prefer one in lab stage)
        let visitToUpdate = visits.find(v => v.current_stage === 'lab') || visits[0];

        console.log('Updating visit:', visitToUpdate.id, 'from stage:', visitToUpdate.current_stage);

        const { error: workflowError } = await supabase
          .from('patient_visits')
          .update({
            lab_status: 'Completed',
            lab_completed_at: new Date().toISOString(),
            current_stage: 'doctor',
            doctor_status: 'Pending'
          })
          .eq('id', visitToUpdate.id);

        if (workflowError) {
          console.error('Failed to update patient visit workflow:', workflowError);
          toast.error('Test completed but failed to update workflow');
        } else {
          console.log('Successfully updated patient visit workflow');
          toast.success('Lab result submitted and patient moved to doctor consultation');
        }
      } else {
        console.log('No active patient visits found for lab workflow update');
        console.log('Creating a new patient visit for lab workflow...');

        // Create a patient visit if none exists
        const { error: createError } = await supabase
          .from('patient_visits')
          .insert([{
            patient_id: patientId,
            visit_date: new Date().toISOString().split('T')[0],
            current_stage: 'doctor',
            overall_status: 'Active',
            reception_status: 'Checked In',
            nurse_status: 'Completed',
            lab_status: 'Completed',
            doctor_status: 'Pending',
            lab_completed_at: new Date().toISOString()
          }]);

        if (createError) {
          console.error('Failed to create patient visit:', createError);
          toast.error('Test completed but failed to create patient visit');
        } else {
          console.log('Created patient visit for lab workflow');
          toast.success('Lab result submitted and patient moved to doctor consultation');
        }
      }
    }

    toast.success('Test status updated');
    fetchData();
};

  const ensureAllPatientsHaveVisits = async () => {
    try {
      console.log('Ensuring all patients with completed lab tests have proper visits...');

      // Get all completed lab tests
      const { data: completedTests } = await supabase
        .from('lab_tests')
        .select(`
          *,
          patient:patients(id, full_name)
        `)
        .eq('status', 'Completed');

      if (!completedTests || completedTests.length === 0) {
        toast.info('No completed lab tests found');
        return;
      }

      console.log('Found completed lab tests:', completedTests.length);

      // For each completed test, ensure the patient has a visit in doctor stage
      for (const test of completedTests) {
        const patientId = test.patient_id;

        // Check if patient already has active prescriptions
        const { data: existingPrescriptions } = await supabase
          .from('prescriptions')
          .select('*')
          .eq('patient_id', patientId)
          .in('status', ['Pending', 'Active'])
          .limit(1);

        if (existingPrescriptions && existingPrescriptions.length > 0) {
          console.log('Patient', test.patient?.full_name, 'already has active prescriptions, skipping workflow update');
          continue;
        }

        // Check if patient already has an active visit in doctor stage
        const { data: existingVisits } = await supabase
          .from('patient_visits')
          .select('*')
          .eq('patient_id', patientId)
          .eq('current_stage', 'doctor')
          .eq('overall_status', 'Active')
          .eq('doctor_status', 'Pending')
          .limit(1);

        if (existingVisits && existingVisits.length > 0) {
          console.log('Patient', test.patient?.full_name, 'already has doctor visit');
          continue;
        }

        // Check if patient has any active visits at all
        const { data: anyActiveVisits } = await supabase
          .from('patient_visits')
          .select('*')
          .eq('patient_id', patientId)
          .eq('overall_status', 'Active')
          .limit(1);

        if (anyActiveVisits && anyActiveVisits.length > 0) {
          // Update existing visit to doctor stage
          const { error } = await supabase
            .from('patient_visits')
            .update({
              current_stage: 'doctor',
              doctor_status: 'Pending',
              lab_status: 'Completed',
              lab_completed_at: new Date().toISOString()
            })
            .eq('id', anyActiveVisits[0].id);

          if (error) {
            console.error('Error updating visit for patient', test.patient?.full_name, error);
          } else {
            console.log('Updated visit for patient', test.patient?.full_name);
          }
        } else {
          // Create new visit for patient
          const { error } = await supabase
            .from('patient_visits')
            .insert([{
              patient_id: patientId,
              visit_date: new Date().toISOString().split('T')[0],
              current_stage: 'doctor',
              overall_status: 'Active',
              reception_status: 'Checked In',
              nurse_status: 'Completed',
              lab_status: 'Completed',
              doctor_status: 'Pending',
              lab_completed_at: new Date().toISOString()
            }]);

          if (error) {
            console.error('Error creating visit for patient', test.patient?.full_name, error);
          } else {
            console.log('Created visit for patient', test.patient?.full_name);
          }
        }
      }

      toast.success('Ensured all patients have proper visits - check doctor dashboard');
    } catch (error) {
      console.error('Error ensuring patient visits:', error);
      toast.error('Failed to ensure patient visits');
    }
  };
  const testLabWorkflow = async () => {
    try {
      // Find a test patient and create/update a visit for testing
      const testPatientId = '550e8400-e29b-41d4-a716-446655440001'; // John Doe

      console.log('Testing lab workflow for patient:', testPatientId);

      // Check if patient already has active prescriptions
      const { data: existingPrescriptions } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('patient_id', testPatientId)
        .in('status', ['Pending', 'Active'])
        .limit(1);

      if (existingPrescriptions && existingPrescriptions.length > 0) {
        console.log('Patient already has active prescriptions:', existingPrescriptions.length);
        toast.info('Patient already has active prescriptions - no need to push to doctor again');
        return;
      }

      // First check if there's already a patient visit in doctor stage
      const { data: existingVisits } = await supabase
        .from('patient_visits')
        .select('*')
        .eq('patient_id', testPatientId)
        .eq('overall_status', 'Active')
        .limit(1);

      if (existingVisits && existingVisits.length > 0) {
        const visit = existingVisits[0];

        // Check if visit is already in doctor stage and pending
        if (visit.current_stage === 'doctor' && visit.doctor_status === 'Pending') {
          console.log('Patient already has active doctor consultation');
          toast.info('Patient already waiting for doctor consultation');
          return;
        }

        // Check if visit has already been completed by doctor (has prescriptions)
        if (visit.current_stage === 'pharmacy' || visit.doctor_status === 'Completed') {
          console.log('Patient visit already completed by doctor');
          toast.info('Patient visit already completed by doctor - has prescriptions assigned');
          return;
        }

        console.log('Found existing visit:', existingVisits[0]);

        // Update it to doctor stage only if appropriate
        const { error } = await supabase
          .from('patient_visits')
          .update({
            current_stage: 'doctor',
            doctor_status: 'Pending',
            lab_status: 'Completed',
            lab_completed_at: new Date().toISOString()
          })
          .eq('id', existingVisits[0].id);

        if (error) {
          console.error('Error updating test visit:', error);
          toast.error('Failed to create test workflow');
        } else {
          toast.success('Test workflow updated - patient moved to doctor consultation');
        }
      } else {
        // Create a new test visit
        const { error } = await supabase
          .from('patient_visits')
          .insert([{
            patient_id: testPatientId,
            visit_date: new Date().toISOString().split('T')[0],
            current_stage: 'doctor',
            overall_status: 'Active',
            reception_status: 'Checked In',
            nurse_status: 'Completed',
            lab_status: 'Completed',
            doctor_status: 'Pending',
            lab_completed_at: new Date().toISOString()
          }]);

        if (error) {
          console.error('Error creating test visit:', error);
          toast.error('Failed to create test workflow');
        } else {
          toast.success('Test workflow created - patient moved to doctor consultation');
        }
      }
    } catch (error) {
      console.error('Error in test workflow:', error);
      toast.error('Test workflow failed');
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Laboratory Dashboard">
        <div className="space-y-8">
          <div className="grid gap-4 md:grid-cols-3">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-200 animate-pulse rounded-lg"></div>)}
          </div>
          <div className="h-96 bg-gray-200 animate-pulse rounded-lg"></div>
        </div>
      </DashboardLayout>
    );
  }
  return (
    <DashboardLayout title="Laboratory Dashboard">
      <div className="space-y-8">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-yellow-200 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Tests</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <FlaskConical className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
            </CardContent>
          </Card>

          <Card className="border-green-200 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            </CardContent>
          </Card>
        </div>

        {/* Lab Tests Table */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5" />
                  Lab Tests Queue
                  <Badge variant="default" className="bg-blue-600">
                    {Object.entries(groupedTests).filter(([_, tests]) => 
                      tests.some(t => t.status === 'Pending' || t.status === 'In Progress')
                    ).length} patient{Object.entries(groupedTests).filter(([_, tests]) => 
                      tests.some(t => t.status === 'Pending' || t.status === 'In Progress')
                    ).length !== 1 ? 's' : ''}
                  </Badge>
                </CardTitle>
                <CardDescription>Manage and process laboratory tests</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testLabWorkflow}
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  Test Lab Workflow
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={ensureAllPatientsHaveVisits}
                  className="text-green-600 border-green-200 hover:bg-green-50"
                >
                  Fix All Patient Visits
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Total Tests</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ordered</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(groupedTests)
                    .filter(([_, tests]) => tests.some(t => t.status === 'Pending' || t.status === 'In Progress'))
                    .map(([patientId, tests]) => {
                      const pendingCount = tests.filter(t => t.status === 'Pending').length;
                      const inProgressCount = tests.filter(t => t.status === 'In Progress').length;
                      const completedCount = tests.filter(t => t.status === 'Completed').length;
                      const hasSTAT = tests.some(t => t.priority === 'STAT');
                      const hasUrgent = tests.some(t => t.priority === 'Urgent');
                      const latestTest = tests.sort((a, b) => 
                        new Date(b.ordered_date).getTime() - new Date(a.ordered_date).getTime()
                      )[0];

                      return (
                        <TableRow key={patientId} className="hover:bg-blue-50/50">
                          <TableCell>
                            <div>
                              <div className="font-medium">{latestTest.patient?.full_name || 'Unknown'}</div>
                              <div className="text-xs text-muted-foreground">{latestTest.patient?.phone}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-blue-50">
                                {tests.length} test{tests.length !== 1 ? 's' : ''}
                              </Badge>
                              {pendingCount > 0 && (
                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 text-xs">
                                  {pendingCount} pending
                                </Badge>
                              )}
                              {inProgressCount > 0 && (
                                <Badge variant="outline" className="bg-blue-100 text-blue-700 text-xs">
                                  {inProgressCount} in progress
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {hasSTAT ? (
                              <Badge variant="destructive" className="text-xs">
                                STAT
                              </Badge>
                            ) : hasUrgent ? (
                              <Badge variant="warning" className="text-xs">
                                Urgent
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Normal
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {inProgressCount > 0 ? (
                              <Badge variant="info" className="bg-blue-100 text-blue-800">
                                In Progress
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-800">
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {format(new Date(latestTest.ordered_date), 'MMM dd, HH:mm')}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedPatientTests(tests);
                                  // Initialize batch results with empty values
                                  const initialResults: Record<string, any> = {};
                                  tests.forEach(test => {
                                    initialResults[test.id] = {
                                      result_value: '',
                                      reference_range: '',
                                      unit: '',
                                      abnormal_flag: false,
                                      notes: ''
                                    };
                                  });
                                  setBatchResults(initialResults);
                                  setBatchDialogOpen(true);
                                }}
                                className="flex items-center gap-1"
                              >
                                <FlaskConical className="h-3 w-3" />
                                View Tests
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleBatchTestSubmit(patientId)}
                                className="flex items-center gap-1"
                              >
                                <CheckCircle className="h-3 w-3" />
                                Submit Results
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  {Object.entries(groupedTests).filter(([_, tests]) => 
                    tests.some(t => t.status === 'Pending' || t.status === 'In Progress')
                  ).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        <FlaskConical className="h-12 w-12 mx-auto mb-2 opacity-30" />
                        <p>No pending lab tests</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Batch Test Submission Dialog */}
        <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5" />
                Lab Tests for {selectedPatientTests[0]?.patient?.full_name}
              </DialogTitle>
              <DialogDescription>
                {selectedPatientTests.filter(t => t.status === 'Pending' || t.status === 'In Progress').length > 0 
                  ? `Submit results for ${selectedPatientTests.length} test(s)`
                  : `Viewing ${selectedPatientTests.length} test(s)`
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedPatientTests.map((test, index) => (
                <Card key={test.id} className="border-2">
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold">
                          {index + 1}
                        </div>
                        <div>
                          <h4 className="font-semibold text-lg">{test.test_name}</h4>
                          <p className="text-sm text-muted-foreground">{test.test_type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={
                            test.priority === 'STAT' ? 'destructive' : 
                            test.priority === 'Urgent' ? 'warning' : 
                            'secondary'
                          }
                        >
                          {test.priority}
                        </Badge>
                        <Badge 
                          variant={
                            test.status === 'Completed' ? 'success' :
                            test.status === 'In Progress' ? 'info' :
                            'outline'
                          }
                        >
                          {test.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`result_${test.id}`}>Result Value *</Label>
                        <Input
                          id={`result_${test.id}`}
                          value={batchResults[test.id]?.result_value || ''}
                          onChange={(e) => handleBatchResultChange(test.id, 'result_value', e.target.value)}
                          placeholder="Enter result"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`unit_${test.id}`}>Unit</Label>
                        <Input
                          id={`unit_${test.id}`}
                          value={batchResults[test.id]?.unit || ''}
                          onChange={(e) => handleBatchResultChange(test.id, 'unit', e.target.value)}
                          placeholder="mg/dL, mmol/L, etc."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`range_${test.id}`}>Reference Range</Label>
                        <Input
                          id={`range_${test.id}`}
                          value={batchResults[test.id]?.reference_range || ''}
                          onChange={(e) => handleBatchResultChange(test.id, 'reference_range', e.target.value)}
                          placeholder="e.g., 70-100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`abnormal_${test.id}`}>Status</Label>
                        <Select
                          value={batchResults[test.id]?.abnormal_flag ? 'true' : 'false'}
                          onValueChange={(value) => handleBatchResultChange(test.id, 'abnormal_flag', value === 'true')}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="false">Normal</SelectItem>
                            <SelectItem value="true">Abnormal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`notes_${test.id}`}>Notes</Label>
                      <Textarea
                        id={`notes_${test.id}`}
                        value={batchResults[test.id]?.notes || ''}
                        onChange={(e) => handleBatchResultChange(test.id, 'notes', e.target.value)}
                        placeholder="Additional notes..."
                        rows={2}
                      />
                    </div>
                  </div>
                </Card>
              ))}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setBatchDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmitBatchResults}>
                  Submit All Results
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
