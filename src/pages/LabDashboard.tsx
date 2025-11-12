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
  const [selectedTest, setSelectedTest] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  const handleSubmitResult = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const resultData = {
      lab_test_id: selectedTest.id,
      result_value: formData.get('resultValue') as string,
      reference_range: formData.get('referenceRange') as string,
      unit: formData.get('unit') as string,
      abnormal_flag: formData.get('abnormalFlag') === 'true',
      notes: formData.get('notes') as string,
    };

    // First, insert the lab result
    const { error: resultError } = await supabase.from('lab_results').insert([resultData]);

    if (resultError) {
      toast.error('Failed to submit result');
      return;
    }

    // Then update the test status and trigger workflow
    await handleUpdateStatus(selectedTest.id, 'Completed', selectedTest.patient_id);

    toast.success('Lab result submitted and sent back to doctor');
    setDialogOpen(false);
    setSelectedTest(null);
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
                <CardTitle>Lab Tests</CardTitle>
                <CardDescription>Manage and process laboratory tests</CardDescription>
              </div>
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
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Test Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Ordered Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {labTests.map((test) => (
                    <TableRow key={test.id}>
                      <TableCell className="font-medium">
                        {test.patient?.full_name || 'Unknown'}
                      </TableCell>
                      <TableCell>{test.test_name}</TableCell>
                      <TableCell>{test.test_type}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            test.priority === 'STAT' ? 'destructive' :
                            test.priority === 'Urgent' ? 'default' :
                            'secondary'
                          }
                        >
                          {test.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(test.ordered_date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            test.status === 'Completed' ? 'default' :
                            test.status === 'In Progress' ? 'secondary' :
                            'outline'
                          }
                        >
                          {test.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {test.status === 'Pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateStatus(test.id, 'In Progress')}
                            >
                              Start
                            </Button>
                          )}
                          {test.status === 'In Progress' && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedTest(test);
                                setDialogOpen(true);
                              }}
                            >
                              Submit Result
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Submit Result Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Lab Result</DialogTitle>
              <DialogDescription>
                Enter test results for {selectedTest?.test_name}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitResult} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resultValue">Result Value</Label>
                <Input id="resultValue" name="resultValue" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Input id="unit" name="unit" placeholder="mg/dL, mmol/L, etc." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="referenceRange">Reference Range</Label>
                  <Input id="referenceRange" name="referenceRange" placeholder="e.g., 70-100" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="abnormalFlag">Abnormal Result?</Label>
                <Select name="abnormalFlag" defaultValue="false">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">Normal</SelectItem>
                    <SelectItem value="true">Abnormal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" />
              </div>
              <Button type="submit" className="w-full">Submit Result</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
