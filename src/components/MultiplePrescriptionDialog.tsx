import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Pill, Plus, Trash2, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Medication {
  id: string;
  name: string;
  strength: string;
  unit_price: number;
  quantity_in_stock: number;
}

interface PrescriptionItem {
  medication_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions: string;
  unit_price: number;
  include_in_billing: boolean;
}

interface MultiplePrescriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patients: any[];
  onSuccess: () => void;
  userId: string;
}

export function MultiplePrescriptionDialog({
  open,
  onOpenChange,
  patients,
  onSuccess,
  userId
}: MultiplePrescriptionDialogProps) {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItem[]>([
    {
      medication_id: '',
      medication_name: '',
      dosage: '',
      frequency: '',
      duration: '',
      quantity: 1,
      instructions: '',
      unit_price: 0,
      include_in_billing: true
    }
  ]);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchMedications();
    }
  }, [open]);

  const fetchMedications = async () => {
    const { data } = await supabase
      .from('medications')
      .select('*')
      .order('name');
    setMedications(data || []);
  };

  const addPrescriptionItem = () => {
    setPrescriptionItems([
      ...prescriptionItems,
      {
        medication_id: '',
        medication_name: '',
        dosage: '',
        frequency: '',
        duration: '',
        quantity: 1,
        instructions: '',
        unit_price: 0,
        include_in_billing: true
      }
    ]);
  };

  const removePrescriptionItem = (index: number) => {
    setPrescriptionItems(prescriptionItems.filter((_, i) => i !== index));
  };

  const updatePrescriptionItem = (index: number, field: keyof PrescriptionItem, value: any) => {
    const updated = [...prescriptionItems];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'medication_id' && value) {
      const med = medications.find(m => m.id === value);
      if (med) {
        updated[index].medication_name = `${med.name} - ${med.strength}`;
        updated[index].unit_price = med.unit_price;
      }
    }

    setPrescriptionItems(updated);
  };

  const calculateTotalCost = () => {
    return prescriptionItems
      .filter(item => item.include_in_billing)
      .reduce((total, item) => total + (item.unit_price * item.quantity), 0);
  };

  const handleSubmit = async () => {
    if (!selectedPatientId) {
      toast.error('Please select a patient');
      return;
    }

    const validItems = prescriptionItems.filter(
      item => item.medication_name && item.dosage && item.quantity > 0
    );

    if (validItems.length === 0) {
      toast.error('Please add at least one valid medication');
      return;
    }

    setLoading(true);
    try {
      const prescriptionsToInsert = validItems.map(item => ({
        patient_id: selectedPatientId,
        doctor_id: userId,
        medication_id: item.medication_id || null,
        medication_name: item.medication_name,
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.duration,
        quantity: item.quantity,
        instructions: item.instructions || null,
        notes: clinicalNotes || null,
        status: 'Pending',
        prescribed_date: new Date().toISOString(),
        unit_price: item.unit_price,
        include_in_billing: item.include_in_billing
      }));

      const { error: prescriptionError } = await supabase
        .from('prescriptions')
        .insert(prescriptionsToInsert);

      if (prescriptionError) throw prescriptionError;

      const { data: visits } = await supabase
        .from('patient_visits')
        .select('*')
        .eq('patient_id', selectedPatientId)
        .eq('current_stage', 'doctor')
        .eq('overall_status', 'Active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (visits && visits.length > 0) {
        await supabase
          .from('patient_visits')
          .update({
            doctor_status: 'Completed',
            doctor_completed_at: new Date().toISOString(),
            current_stage: 'pharmacy',
            pharmacy_status: 'Pending'
          })
          .eq('id', visits[0].id);
      }

      toast.success(`${validItems.length} prescription(s) created successfully`);
      onOpenChange(false);
      resetForm();
      onSuccess();
    } catch (error: any) {
      console.error('Error creating prescriptions:', error);
      toast.error(`Failed to create prescriptions: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedPatientId('');
    setPrescriptionItems([
      {
        medication_id: '',
        medication_name: '',
        dosage: '',
        frequency: '',
        duration: '',
        quantity: 1,
        instructions: '',
        unit_price: 0,
        include_in_billing: true
      }
    ]);
    setClinicalNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Write Prescription (Multiple Medications)</DialogTitle>
          <DialogDescription>
            Select multiple medications. Check/uncheck to include in billing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Patient *</Label>
            <select
              className="w-full p-2 border rounded-md"
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
            >
              <option value="">Select patient</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-semibold">Medications</Label>
              <Button type="button" size="sm" onClick={addPrescriptionItem}>
                <Plus className="h-4 w-4 mr-2" />
                Add Medication
              </Button>
            </div>

            {prescriptionItems.map((item, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-3 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Medication #{index + 1}</h4>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={item.include_in_billing}
                      onCheckedChange={(checked) =>
                        updatePrescriptionItem(index, 'include_in_billing', checked)
                      }
                    />
                    <Label className="text-sm">Include in billing</Label>
                    {prescriptionItems.length > 1 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removePrescriptionItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Select from Inventory</Label>
                    <select
                      className="w-full p-2 border rounded-md"
                      value={item.medication_id}
                      onChange={(e) => updatePrescriptionItem(index, 'medication_id', e.target.value)}
                    >
                      <option value="">Select medication</option>
                      {medications.map((med) => (
                        <option key={med.id} value={med.id}>
                          {med.name} - {med.strength} (Stock: {med.quantity_in_stock}) - TSh {med.unit_price}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Or Enter Medication Name *</Label>
                    <Input
                      value={item.medication_name}
                      onChange={(e) => updatePrescriptionItem(index, 'medication_name', e.target.value)}
                      placeholder="e.g., Paracetamol 500mg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-2">
                    <Label>Dosage *</Label>
                    <Input
                      value={item.dosage}
                      onChange={(e) => updatePrescriptionItem(index, 'dosage', e.target.value)}
                      placeholder="e.g., 500mg"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Frequency *</Label>
                    <Input
                      value={item.frequency}
                      onChange={(e) => updatePrescriptionItem(index, 'frequency', e.target.value)}
                      placeholder="e.g., Twice daily"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Duration *</Label>
                    <Input
                      value={item.duration}
                      onChange={(e) => updatePrescriptionItem(index, 'duration', e.target.value)}
                      placeholder="e.g., 7 days"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Quantity *</Label>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updatePrescriptionItem(index, 'quantity', Number(e.target.value))}
                      min="1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Instructions</Label>
                  <Input
                    value={item.instructions}
                    onChange={(e) => updatePrescriptionItem(index, 'instructions', e.target.value)}
                    placeholder="e.g., Take with food"
                  />
                </div>

                {item.unit_price > 0 && (
                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded border border-blue-200">
                    <DollarSign className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">
                      Cost: TSh {(item.unit_price * item.quantity).toLocaleString()}
                      {!item.include_in_billing && (
                        <Badge variant="secondary" className="ml-2">Not billed</Badge>
                      )}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-green-800">Total Billable Amount:</span>
              <span className="text-2xl font-bold text-green-600">
                TSh {calculateTotalCost().toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-green-700 mt-1">
              Only medications marked "Include in billing" are counted
            </p>
          </div>

          <div className="space-y-2">
            <Label>Clinical Notes</Label>
            <Textarea
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Notes about why these prescriptions were written..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Creating...' : `Create ${prescriptionItems.length} Prescription(s)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
