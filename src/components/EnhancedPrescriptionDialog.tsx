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

interface EnhancedPrescriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patients: any[];
  onSuccess: () => void;
  userId: string;
}

export function EnhancedPrescriptionDialog({
  open,
  onOpenChange,
  patients,
  onSuccess,
  userId
}: EnhancedPrescriptionDialogProps) {
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

    // If medication is selected, update price and name
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
      // Insert all prescriptions
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

      const { data: insertedPrescriptions, error: prescriptionError } = await supabase
        .from('prescriptions')
        .insert(prescriptionsToInsert)
        .select();

      if (prescriptionError) throw prescriptionError;

      // Update patient visit workflow to move to pharmacy
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
   