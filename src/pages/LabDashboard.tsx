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
  const [loading, setLoading] = useState(true);
  const [selectedTest, setSelectedTest] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: testsData } = await supabase
        .from('lab_tests')
        .select(`
          *,
          patient:patients(full_name, phone),
          doctor:profiles!lab_tests_ordered_by_doctor_id_fkey(full_name)
        `)
        .order('ordered_date', { ascending: false })
        .limit(50);

      setLabTests(testsData || []);

      const pending = testsData?.filter(t => t.status === 'Pending').length || 0;
      const inProgress = testsData?.filter(t => t.status === 'In Progress').length || 0;
      const completed = testsData?.filter(t => t.status === 'Completed').length || 0;

      setStats({ pending, inProgress, completed });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load lab tests');
    } finally {
      setLoading(false);
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
      const { data: visits } = await supabase
        .from('patient_visits')
        .select('*')
        .eq('patient_id', patientId)
        .eq('current_stage', 'lab')
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
    }

    toast.success('Test status updated');
    fetchData();
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

    const { error } = await supabase.from('lab_results').insert([resultData]);

    if (error) {
      toast.error('Failed to submit result');
    } else {
      await handleUpdateStatus(selectedTest.id, 'Completed', selectedTest.patient_id);
      toast.success('Lab result submitted and sent back to doctor');
      setDialogOpen(false);
      setSelectedTest(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Laboratory Dashboard">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
            <CardTitle>Lab Tests</CardTitle>
            <CardDescription>Manage and process laboratory tests</CardDescription>
          </CardHeader>
          <CardContent>
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
