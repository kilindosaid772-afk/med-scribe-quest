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
import { Pill, FlaskConical } from 'lucide-react';

interface EnhancedDoctorFeaturesProps {
  patients: any[];
  onSuccess: () => void;
}

export const EnhancedDoctorFeatures = ({ patients, onSuccess }: EnhancedDoctorFeaturesProps) => {
  const { user } = useAuth();
  const [prescriptionDialogOpen, setPrescriptionDialogOpen] = useState(false);
  const [labTestDialogOpen, setLabTestDialogOpen] = useState(false);
  const [medications, setMedications] = useState<any[]>([]);

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
      instructions: formData.get('instructions') as string,
    };

    const { error } = await supabase.from('prescriptions').insert([prescriptionData]);

    if (error) {
      toast.error('Failed to create prescription');
    } else {
      toast.success('Prescription created successfully');
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
      description: formData.get('description') as string,
      priority: formData.get('priority') as string,
      notes: formData.get('notes') as string,
    };

    const { error } = await supabase.from('lab_tests').insert([labTestData]);

    if (error) {
      toast.error('Failed to order lab test');
    } else {
      toast.success('Lab test ordered successfully');
      setLabTestDialogOpen(false);
      onSuccess();
    }
  };

  return (
    <div className="flex gap-2">
      <Dialog open={prescriptionDialogOpen} onOpenChange={(open) => {
        setPrescriptionDialogOpen(open);
        if (open) fetchMedications();
      }}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Pill className="mr-2 h-4 w-4" />
            Write Prescription
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Write Prescription</DialogTitle>
            <DialogDescription>Create a new prescription for a patient</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePrescribe} className="space-y-4">
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
            <Button type="submit" className="w-full">Create Prescription</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={labTestDialogOpen} onOpenChange={setLabTestDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <FlaskConical className="mr-2 h-4 w-4" />
            Order Lab Test
          </Button>
        </DialogTrigger>
        <DialogContent>
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
            <div className="space-y-2">
              <Label htmlFor="testName">Test Name</Label>
              <Input id="testName" name="testName" placeholder="e.g., Complete Blood Count" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="testType">Test Type</Label>
              <Select name="testType" required>
                <SelectTrigger>
                  <SelectValue />
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
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select name="priority" defaultValue="Normal">
                <SelectTrigger>
                  <SelectValue />
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
              <Textarea id="description" name="description" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" />
            </div>
            <Button type="submit" className="w-full">Order Test</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
