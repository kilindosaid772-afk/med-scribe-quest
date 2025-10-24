import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  CheckCircle,
  File,
  Calendar,
  Download,
  User,
  Clipboard,
  HeartHandshake,
  Loader2
} from 'lucide-react';

export default function DischargeDashboard() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [stats, setStats] = useState({ readyForDischarge: 0, completedToday: 0, followUps: 0 });
  const [loading, setLoading] = useState(true);
  const [dischargeDialogOpen, setDischargeDialogOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [dischargeForm, setDischargeForm] = useState({
    discharge_date: new Date().toISOString().split('T')[0],
    discharge_time: new Date().toTimeString().slice(0, 5),
    discharge_type: 'Regular',
    follow_up_date: '',
    follow_up_doctor: '',
    follow_up_notes: '',
    discharge_instructions: '',
    medications_summary: '',
    next_appointment_date: '',
    next_appointment_time: '',
    next_appointment_reason: ''
  });

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch visits ready for discharge (completed pharmacy/billing)
      const { data: visitsData, error: visitsError } = await supabase
        .from('patient_visits')
        .select(`
          *,
          patient:patients(*),
          prescriptions(*),
          appointments(*)
        `)
        .in('overall_status', ['Active'])
        .or('current_stage.eq.discharge_ready,billing_status.eq.Paid,pharmacy_status.eq.Completed')
        .order('created_at', { ascending: false });

      if (visitsError) throw visitsError;

      // Fetch completed visits for today
      const today = new Date().toISOString().split('T')[0];
      const { data: completedVisits } = await supabase
        .from('patient_visits')
        .select('*')
        .eq('overall_status', 'Completed')
        .eq('discharge_date', today);

      // Calculate stats
      const readyForDischarge = visitsData?.filter(v =>
        v.current_stage === 'discharge_ready' || v.billing_status === 'Paid' || v.pharmacy_status === 'Completed'
      ).length || 0;

      const completedToday = completedVisits?.length || 0;

      // Get follow-ups for next 7 days
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const { data: followUpVisits } = await supabase
        .from('patient_visits')
        .select('*')
        .eq('overall_status', 'Completed')
        .not('follow_up_date', 'is', null)
        .gte('follow_up_date', today)
        .lte('follow_up_date', nextWeek.toISOString().split('T')[0]);

      const followUps = followUpVisits?.length || 0;

      setVisits(visitsData || []);
      setStats({
        readyForDischarge,
        completedToday,
        followUps
      });

    } catch (error) {
      console.error('Error fetching discharge data:', error);
      toast.error('Failed to load discharge data');
    } finally {
      setLoading(false);
    }
  };

  const handleDischarge = async (visit: any) => {
    setSelectedVisit(visit);
    setDischargeForm({
      discharge_date: new Date().toISOString().split('T')[0],
      discharge_time: new Date().toTimeString().slice(0, 5),
      discharge_type: 'Regular',
      follow_up_date: '',
      follow_up_doctor: '',
      follow_up_notes: '',
      discharge_instructions: '',
      medications_summary: '',
      next_appointment_date: '',
      next_appointment_time: '',
      next_appointment_reason: ''
    });
    setDischargeDialogOpen(true);
  };

  const submitDischarge = async () => {
    if (!selectedVisit) return;

    try {
      // Update patient visit to completed status
      const { error: visitError } = await supabase
        .from('patient_visits')
        .update({
          overall_status: 'Completed',
          current_stage: 'completed',
          discharge_date: dischargeForm.discharge_date,
          discharge_time: dischargeForm.discharge_time,
          discharge_type: dischargeForm.discharge_type,
          discharge_instructions: dischargeForm.discharge_instructions,
          medications_summary: dischargeForm.medications_summary,
          follow_up_date: dischargeForm.follow_up_date || null,
          follow_up_doctor: dischargeForm.follow_up_doctor || null,
          follow_up_notes: dischargeForm.follow_up_notes || null,
          discharge_completed_at: new Date().toISOString()
        })
        .eq('id', selectedVisit.id);

      if (visitError) throw visitError;

      // Create follow-up appointment if scheduled
      if (dischargeForm.next_appointment_date && dischargeForm.next_appointment_time) {
        const { error: appointmentError } = await supabase
          .from('appointments')
          .insert({
            patient_id: selectedVisit.patient_id,
            appointment_date: dischargeForm.next_appointment_date,
            appointment_time: dischargeForm.next_appointment_time,
            reason: dischargeForm.next_appointment_reason || 'Follow-up appointment',
            status: 'Scheduled'
          });

        if (appointmentError) {
          console.error('Error creating follow-up appointment:', appointmentError);
          toast.error('Discharge completed but failed to create follow-up appointment');
        }
      }

      toast.success('Patient discharged successfully!');
      setDischargeDialogOpen(false);
      setSelectedVisit(null);
      fetchData();

    } catch (error) {
      console.error('Error processing discharge:', error);
      toast.error('Failed to process discharge');
    }
  };

  const generateVisitSummary = (visit: any) => {
    const summary = `
🏥 VISIT SUMMARY - ${visit.patient?.full_name}

📅 Visit Date: ${format(new Date(visit.visit_date), 'MMMM dd, yyyy')}
⏰ Discharge: ${format(new Date(visit.discharge_date + 'T' + visit.discharge_time), 'MMM dd, yyyy HH:mm')}

👨‍⚕️ CONSULTATION DETAILS:
• Reception: ${visit.reception_status} (${visit.reception_completed_at ? format(new Date(visit.reception_completed_at), 'HH:mm') : 'N/A'})
• Nurse: ${visit.nurse_status} (${visit.nurse_completed_at ? format(new Date(visit.nurse_completed_at), 'HH:mm') : 'N/A'})
• Doctor: ${visit.doctor_status} (${visit.doctor_completed_at ? format(new Date(visit.doctor_completed_at), 'HH:mm') : 'N/A'})
• Lab: ${visit.lab_status} (${visit.lab_completed_at ? format(new Date(visit.lab_completed_at), 'HH:mm') : 'N/A'})
• Pharmacy: ${visit.pharmacy_status} (${visit.pharmacy_completed_at ? format(new Date(visit.pharmacy_completed_at), 'HH:mm') : 'N/A'})
• Billing: ${visit.billing_status} (${visit.billing_completed_at ? format(new Date(visit.billing_completed_at), 'HH:mm') : 'N/A'})

📋 DIAGNOSIS & NOTES:
${visit.doctor_diagnosis || 'No diagnosis recorded'}
${visit.doctor_notes || 'No doctor notes recorded'}

💊 PRESCRIPTIONS:
${visit.prescriptions?.map((p: any) => `${p.medication_name} - ${p.dosage} ${p.frequency} for ${p.duration}`).join('\n') || 'No prescriptions'}

📝 DISCHARGE INSTRUCTIONS:
${visit.discharge_instructions || 'No specific instructions'}

🔄 FOLLOW-UP:
${visit.follow_up_date ? `Scheduled for ${format(new Date(visit.follow_up_date), 'MMM dd, yyyy')}` : 'No follow-up scheduled'}

✨ Generated on ${format(new Date(), 'MMM dd, yyyy HH:mm')}
    `.trim();

    return summary;
  };
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
          // Create sample patient visits ready for discharge
          await supabase.from('patient_visits').insert([
            {
              patient_id: newPatients[0].id,
              visit_date: new Date().toISOString().split('T')[0],
              current_stage: 'discharge_ready',
              overall_status: 'Active',
              reception_status: 'Checked In',
              nurse_status: 'Completed',
              doctor_status: 'Completed',
              pharmacy_status: 'Completed',
              billing_status: 'Paid',
              discharge_status: 'Pending'
            }
          ]);
        }
      }

      toast.success('Sample discharge data created');
      fetchData();
    } catch (error) {
      console.error('Error creating sample data:', error);
      toast.error('Failed to create sample data');
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Discharge Management">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Discharge Management">
      <div className="space-y-8">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-blue-200 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ready for Discharge</CardTitle>
              <CheckCircle className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.readyForDischarge}</div>
              <p className="text-xs text-muted-foreground">Patients completed all services</p>
            </CardContent>
          </Card>

          <Card className="border-green-200 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Discharged Today</CardTitle>
              <HeartHandshake className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.completedToday}</div>
              <p className="text-xs text-muted-foreground">Successfully discharged</p>
            </CardContent>
          </Card>

          <Card className="border-purple-200 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Follow-ups Scheduled</CardTitle>
              <Calendar className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.followUps}</div>
              <p className="text-xs text-muted-foreground">Next 7 days</p>
              <Button
                variant="outline"
                size="sm"
                onClick={createSampleData}
                className="mt-2 text-purple-600 border-purple-200 hover:bg-purple-50"
              >
                Create Sample Data
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Patients Ready for Discharge */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Patients Ready for Discharge
            </CardTitle>
            <CardDescription>Patients who have completed all required services</CardDescription>
          </CardHeader>
          <CardContent>
            {visits.filter(v => v.current_stage === 'discharge_ready' || v.billing_status === 'Paid' || v.pharmacy_status === 'Completed').length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No patients ready for discharge</p>
            ) : (
              <div className="space-y-3">
                {visits
                  .filter(v => v.current_stage === 'discharge_ready' || v.billing_status === 'Paid' || v.pharmacy_status === 'Completed')
                  .map((visit) => (
                    <div key={visit.id} className="flex items-center justify-between p-4 border rounded-lg bg-green-50">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-green-800">{visit.patient?.full_name}</h4>
                          <Badge variant="default" className="bg-green-600">
                            Ready for Discharge
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Visit Date: {format(new Date(visit.visit_date), 'MMM dd, yyyy')} •
                          Services: Reception ✓ Nurse ✓ Doctor ✓
                          {visit.lab_status === 'Completed' && ' Lab ✓'}
                          {visit.pharmacy_status === 'Completed' && ' Pharmacy ✓'}
                          {visit.billing_status === 'Paid' && ' Billing ✓'}
                        </p>
                        {visit.doctor_diagnosis && (
                          <p className="text-sm text-green-700">
                            <strong>Diagnosis:</strong> {visit.doctor_diagnosis}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const summary = generateVisitSummary(visit);
                            navigator.clipboard.writeText(summary);
                            toast.success('Visit summary copied to clipboard');
                          }}
                        >
                          <Clipboard className="h-4 w-4 mr-1" />
                          Copy Summary
                        </Button>
                        <Button
                          onClick={() => handleDischarge(visit)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <HeartHandshake className="h-4 w-4 mr-2" />
                          Process Discharge
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completed Discharges */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <File className="h-5 w-5" />
              Recent Discharges
            </CardTitle>
            <CardDescription>Patients discharged today and recently</CardDescription>
          </CardHeader>
          <CardContent>
            {visits.filter(v => v.overall_status === 'Completed').length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No completed discharges</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Discharge Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Follow-up</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visits
                      .filter(v => v.overall_status === 'Completed')
                      .slice(0, 10)
                      .map((visit) => (
                        <TableRow key={visit.id}>
                          <TableCell className="font-medium">{visit.patient?.full_name}</TableCell>
                          <TableCell>
                            {visit.discharge_date && visit.discharge_time
                              ? format(new Date(visit.discharge_date + 'T' + visit.discharge_time), 'MMM dd, yyyy HH:mm')
                              : 'N/A'
                            }
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{visit.discharge_type || 'Regular'}</Badge>
                          </TableCell>
                          <TableCell>
                            {visit.follow_up_date ? (
                              <Badge variant="secondary">
                                {format(new Date(visit.follow_up_date), 'MMM dd, yyyy')}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">No follow-up</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const summary = generateVisitSummary(visit);
                                navigator.clipboard.writeText(summary);
                                toast.success('Discharge summary copied to clipboard');
                              }}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Summary
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Discharge Dialog */}
        <Dialog open={dischargeDialogOpen} onOpenChange={setDischargeDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Process Patient Discharge</DialogTitle>
              <DialogDescription>
                Complete discharge process for {selectedVisit?.patient?.full_name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Visit Summary */}
              {selectedVisit && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-2">Visit Summary</h4>
                  <div className="text-sm space-y-1">
                    <div><strong>Patient:</strong> {selectedVisit.patient?.full_name}</div>
                    <div><strong>Visit Date:</strong> {format(new Date(selectedVisit.visit_date), 'MMM dd, yyyy')}</div>
                    <div><strong>Diagnosis:</strong> {selectedVisit.doctor_diagnosis || 'Not recorded'}</div>
                    <div><strong>Prescriptions:</strong> {selectedVisit.prescriptions?.length || 0} items</div>
                    <div><strong>Status:</strong> {selectedVisit.billing_status || selectedVisit.pharmacy_status}</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discharge_date">Discharge Date</Label>
                  <Input
                    id="discharge_date"
                    type="date"
                    value={dischargeForm.discharge_date}
                    onChange={(e) => setDischargeForm({...dischargeForm, discharge_date: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discharge_time">Discharge Time</Label>
                  <Input
                    id="discharge_time"
                    type="time"
                    value={dischargeForm.discharge_time}
                    onChange={(e) => setDischargeForm({...dischargeForm, discharge_time: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discharge_type">Discharge Type</Label>
                <Select value={dischargeForm.discharge_type} onValueChange={(value) => setDischargeForm({...dischargeForm, discharge_type: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Regular">Regular Discharge</SelectItem>
                    <SelectItem value="Emergency">Emergency Discharge</SelectItem>
                    <SelectItem value="Transfer">Transfer to Another Facility</SelectItem>
                    <SelectItem value="Against Medical Advice">Against Medical Advice</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discharge_instructions">Discharge Instructions</Label>
                <Textarea
                  id="discharge_instructions"
                  placeholder="Home care instructions, medication usage, follow-up care..."
                  value={dischargeForm.discharge_instructions}
                  onChange={(e) => setDischargeForm({...dischargeForm, discharge_instructions: e.target.value})}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="medications_summary">Medications Summary</Label>
                <Textarea
                  id="medications_summary"
                  placeholder="Summary of prescribed medications and usage instructions..."
                  value={dischargeForm.medications_summary}
                  onChange={(e) => setDischargeForm({...dischargeForm, medications_summary: e.target.value})}
                  rows={2}
                />
              </div>

              {/* Follow-up Section */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Follow-up Appointment</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="follow_up_date">Follow-up Date</Label>
                    <Input
                      id="follow_up_date"
                      type="date"
                      value={dischargeForm.follow_up_date}
                      onChange={(e) => setDischargeForm({...dischargeForm, follow_up_date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="follow_up_doctor">Follow-up Doctor</Label>
                    <Input
                      id="follow_up_doctor"
                      placeholder="Dr. Smith"
                      value={dischargeForm.follow_up_doctor}
                      onChange={(e) => setDischargeForm({...dischargeForm, follow_up_doctor: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2 mt-3">
                  <Label htmlFor="follow_up_notes">Follow-up Notes</Label>
                  <Textarea
                    id="follow_up_notes"
                    placeholder="Reason for follow-up, specific concerns..."
                    value={dischargeForm.follow_up_notes}
                    onChange={(e) => setDischargeForm({...dischargeForm, follow_up_notes: e.target.value})}
                    rows={2}
                  />
                </div>
              </div>

              {/* Next Appointment Section */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Next Appointment (Optional)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="next_appointment_date">Date</Label>
                    <Input
                      id="next_appointment_date"
                      type="date"
                      value={dischargeForm.next_appointment_date}
                      onChange={(e) => setDischargeForm({...dischargeForm, next_appointment_date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="next_appointment_time">Time</Label>
                    <Input
                      id="next_appointment_time"
                      type="time"
                      value={dischargeForm.next_appointment_time}
                      onChange={(e) => setDischargeForm({...dischargeForm, next_appointment_time: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2 mt-3">
                  <Label htmlFor="next_appointment_reason">Reason</Label>
                  <Input
                    id="next_appointment_reason"
                    placeholder="Regular checkup, test results, etc."
                    value={dischargeForm.next_appointment_reason}
                    onChange={(e) => setDischargeForm({...dischargeForm, next_appointment_reason: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDischargeDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitDischarge} className="bg-green-600 hover:bg-green-700">
                <HeartHandshake className="h-4 w-4 mr-2" />
                Complete Discharge
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
