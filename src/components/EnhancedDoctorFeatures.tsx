import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Pill, FlaskConical, AlertTriangle, CheckCircle } from 'lucide-react';

interface EnhancedDoctorFeaturesProps {
  patients: any[];
  onSuccess: () => void;
  labResults?: any[];
}

export const EnhancedDoctorFeatures = ({ patients, onSuccess, labResults = [] }: EnhancedDoctorFeaturesProps) => {
  const { user } = useAuth();
  const [prescriptionDialogOpen, setPrescriptionDialogOpen] = useState(false);
  const [labTestDialogOpen, setLabTestDialogOpen] = useState(false);
  const [medications, setMedications] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);

  const fetchMedications = async () => {
    const { data } = await supabase.from('medications').select('*').order('name');
    setMedications(data || []);
  };

  const handlePrescribe = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    const formData = new FormData(e.currentTarget);

    const prescriptionData = {
      patient_id: formData.get('patientId') as string,
      doctor_id: user.id,
      medication_id: formData.get('medicationId') as string || null,
      medication_name: formData.get('medicationName') as string,
      dosage: formData.get('dosage') as string,
      frequency: formData.get('frequency') as string,
      duration: formData.get('duration') as string,
      quantity: Number(formData.get('quantity')),
      instructions: formData.get('instructions') as string || null,
      notes: formData.get('clinicalNotes') as string || null,
      // Link to lab results if this prescription is based on lab findings
      lab_result_id: formData.get('labResultId') as string || null,
    };

    const { data: insertedPrescription, error: prescriptionError } = await supabase
      .from('prescriptions')
      .insert([prescriptionData])
      .select();

    if (prescriptionError) {
      console.error('Error creating prescription:', prescriptionError);
      console.error('Prescription data that failed:', prescriptionData);
      toast.error(`Failed to create prescription: ${prescriptionError.message}`);
    } else {
      console.log('Prescription created successfully:', insertedPrescription);

      // Update patient visit workflow to move to pharmacy
      const { data: visits } = await supabase
        .from('patient_visits')
        .select('*')
        .eq('patient_id', prescriptionData.patient_id)
        .eq('current_stage', 'doctor')
        .eq('overall_status', 'Active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (visits && visits.length > 0) {
        const { error: workflowError } = await supabase
          .from('patient_visits')
          .update({
            doctor_status: 'Completed',
            doctor_completed_at: new Date().toISOString(),
            current_stage: 'pharmacy',
            pharmacy_status: 'Pending',
          })
          .eq('id', visits[0].id);

        if (workflowError) {
          console.error('Failed to update patient visit workflow:', workflowError);
          toast.error('Prescription created but failed to update workflow');
        } else {
          toast.success('Prescription created successfully and sent to pharmacy');
        }
      } else {
        toast.success('Prescription created successfully');
      }

      setPrescriptionDialogOpen(false);
      onSuccess();
    }
  };

  const handleOrderLabTest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    const formData = new FormData(e.currentTarget);

    const labTestData = {
      patient_id: formData.get('patientId') as string,
      ordered_by_doctor_id: user.id,
      test_name: formData.get('testName') as string,
      test_type: formData.get('testType') as string,
      description: formData.get('description') as string || null,
      priority: formData.get('priority') as string || 'Normal',
      notes: formData.get('notes') as string || null,
      status: 'Pending',
      ordered_date: new Date().toISOString(),
    };

    console.log('Inserting lab test:', labTestData);

    const { data, error } = await supabase.from('lab_tests').insert([labTestData]).select();

    if (error) {
      console.error('Lab test error:', error);
      toast.error(`Failed to order lab test: ${error.message}`);
    } else {
      console.log('Lab test created:', data);
      toast.success('Lab test ordered successfully');
      setLabTestDialogOpen(false);
      e.currentTarget.reset();
      onSuccess();
    }
  };

  // Get lab results for the selected patient
  const getPatientLabResults = (patientId: string) => {
    return labResults.filter(result => result.patient_id === patientId);
  };

  const handleCompleteConsultation = async (patientId: string) => {
    try {
      // Update patient visit workflow to mark doctor consultation as completed
      const { data: visits } = await supabase
        .from('patient_visits')
        .select('*')
        .eq('patient_id', patientId)
        .eq('current_stage', 'doctor')
        .eq('overall_status', 'Active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (visits && visits.length > 0) {
        const { error: workflowError } = await supabase
          .from('patient_visits')
          .update({
            doctor_status: 'Completed',
            doctor_completed_at: new Date().toISOString(),
            current_stage: 'pharmacy',
            pharmacy_status: 'Pending',
          })
          .eq('id', visits[0].id);

        if (workflowError) {
          console.error('Failed to complete consultation:', workflowError);
          toast.error('Failed to complete consultation');
        } else {
          toast.success('Consultation completed successfully');
          onSuccess();
        }
      } else {
        toast.error('No active consultation found for this patient');
      }
    } catch (error) {
      console.error('Error completing consultation:', error);
      toast.error('Failed to complete consultation');
    }
  };

  return (
    <div className="flex gap-2">
      {/* Complete Consultation Button */}
      <Button
        variant="default"
        size="sm"
        onClick={() => patients.length > 0 && handleCompleteConsultation(patients[0].id)}
        className="bg-green-600 hover:bg-green-700"
      >
        <CheckCircle className="mr-2 h-4 w-4" />
        Complete Consultation
      </Button>

      {/* Prescription Dialog */}
      <Dialog
        open={prescriptionDialogOpen}
        onOpenChange={(open) => {
          setPrescriptionDialogOpen(open);
          if (open) fetchMedications();
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline">
            <Pill className="mr-2 h-4 w-4" />
            Write Prescription
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Write Prescription</DialogTitle>
            <DialogDescription>Create a new prescription for a patient</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePrescribe} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="patientId">Patient</Label>
              <Select name="patientId" required onValueChange={setSelectedPatient}>
                <SelectTrigger>
                  <SelectValue placeholder="Select patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lab Results Section */}
            {selectedPatient && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <FlaskConical className="h-4 w-4" />
                  Recent Lab Results
                </h4>
                {getPatientLabResults(selectedPatient.id).length > 0 ? (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {getPatientLabResults(selectedPatient.id).map((result: any, index: number) => (
                      <div key={index} className="bg-white p-3 rounded border text-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">{result.test_name}</div>
                            <div className="text-muted-foreground">
                              Result: {result.result_value} {result.unit}
                              {result.reference_range && ` (Ref: ${result.reference_range})`}
                            </div>
                            {result.abnormal_flag && (
                              <span className="text-red-600 font-medium text-xs flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Abnormal
                              </span>
                            )}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // Pre-fill prescription based on lab results
                              const form = document.querySelector('form') as HTMLFormElement;
                              if (form) {
                                const medicationField = form.querySelector('[name="medicationName"]') as HTMLInputElement;
                                const notesField = form.querySelector('[name="clinicalNotes"]') as HTMLTextAreaElement;
                                const labResultField = form.querySelector('[name="labResultId"]') as HTMLInputElement;

                                if (medicationField) medicationField.value = `Based on ${result.test_name} results`;
                                if (notesField) notesField.value = `Prescribed based on abnormal ${result.test_name} results: ${result.result_value} ${result.unit}`;
                                if (labResultField) labResultField.value = result.id || '';

                                toast.success('Prescription form pre-filled based on lab results');
                              }
                            }}
                          >
                            Use for Prescription
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-blue-600 text-sm">No lab results available for this patient</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="medicationId">Medication (from inventory)</Label>
                <Select name="medicationId">
                  <SelectTrigger>
                    <SelectValue placeholder="Select medication" />
                  </SelectTrigger>
                  <SelectContent>
                    {medications.map((med) => (
                      <SelectItem key={med.id} value={med.id}>
                        {med.name} - {med.strength}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="medicationName">Or enter medication name</Label>
                <Input id="medicationName" name="medicationName" required />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dosage">Dosage</Label>
                <Input id="dosage" name="dosage" placeholder="e.g., 500mg" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency</Label>
                <Input id="frequency" name="frequency" placeholder="e.g., Twice daily" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duration</Label>
                <Input id="duration" name="duration" placeholder="e.g., 7 days" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input id="quantity" name="quantity" type="number" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea id="instructions" name="instructions" placeholder="Take with food, etc." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clinicalNotes">Clinical Notes</Label>
              <Textarea id="clinicalNotes" name="clinicalNotes" placeholder="Notes about why this prescription was written..." />
            </div>

            {/* Hidden field to track lab result association */}
            <input type="hidden" name="labResultId" />

            <Button type="submit" className="w-full">
              Create Prescription
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Lab Test Dialog */}
      <Dialog open={labTestDialogOpen} onOpenChange={setLabTestDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <FlaskConical className="mr-2 h-4 w-4" />
            Order Lab Test
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Lab Test</DialogTitle>
            <DialogDescription>Request a laboratory test for a patient</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleOrderLabTest} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="patientId">Patient</Label>
              <Select name="patientId" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="testName">Test Name</Label>
                <Input id="testName" name="testName" placeholder="e.g., Complete Blood Count" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="testType">Test Type</Label>
                <Select name="testType" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Blood Test">Blood Test</SelectItem>
                    <SelectItem value="Urine Test">Urine Test</SelectItem>
                    <SelectItem value="Imaging">Imaging</SelectItem>
                    <SelectItem value="Culture">Culture</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select name="priority" defaultValue="Normal">
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                  <SelectItem value="STAT">STAT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" placeholder="Detailed description of the test required..." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" placeholder="Additional notes or special instructions..." />
            </div>

            <Button type="submit" className="w-full">
              Order Test
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ✅ Final export to fix EOF / syntax issue
export default EnhancedDoctorFeatures;
