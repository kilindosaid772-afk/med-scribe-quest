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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Upload, File, CheckCircle, AlertCircle, Pill, AlertTriangle, Package, Plus, Edit, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { generateInvoiceNumber, logActivity } from '@/lib/utils';
import { DispenseDialog } from '@/components/DispenseDialog';

interface Medication {
  id: string;
  name: string;
  quantity_in_stock: number;
  reorder_level: number;
  [key: string]: any;
}

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  email?: string;
  [key: string]: any;
}

interface MedicationInfo {
  id: string;
  name: string;
  dosage_form?: string;
  strength?: string;
  manufacturer?: string;
  [key: string]: any;
}

interface Prescription {
  id: string;
  patient_id: string;
  patient?: UserProfile;
  medication_id: string;
  medication_name?: string;
  medications?: MedicationInfo;
  doctor_id?: string;
  doctor_profile?: UserProfile;
  quantity: number;
  dosage: string;
  status: 'Pending' | 'Dispensed' | 'Cancelled' | string;
  lab_result_id?: string;
  prescribed_date: string;
  [key: string]: any;
}

export default function PharmacyDashboard() {
  const { user } = useAuth() || {} as { user: UserProfile | null };
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);

  const [medications, setMedications] = useState<Medication[]>([]);
  const [stats, setStats] = useState({ pendingPrescriptions: 0, lowStock: 0, totalMedications: 0 });
  const [loading, setLoading] = useState(false);
  const [medicationDialogOpen, setMedicationDialogOpen] = useState<boolean>(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [stockDialogOpen, setStockDialogOpen] = useState<boolean>(false);
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [loadingStates, setLoadingStates] = useState<{[key: string]: boolean}>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [prescriptionFilter, setPrescriptionFilter] = useState<'pending' | 'all'>('pending');
  const [dispenseDialogOpen, setDispenseDialogOpen] = useState(false);
  const [selectedPrescriptionForDispense, setSelectedPrescriptionForDispense] = useState<any>(null);
  
  // Type for the combined prescription data
  interface PrescriptionWithRelations extends Prescription {
    patient: UserProfile | null;
    doctor_profile: UserProfile | null;
    medications: MedicationInfo | null;
  }

  const loadPharmacyData = async (showToast = true) => {
    if (!user) {
      const errorMsg = 'User not authenticated';
      setLoadError(errorMsg);
      if (showToast) toast.error(errorMsg);
      return;
    }

    try {
      setLoading(true);
      setLoadError(null);

      // First, fetch all the data we need
      const [
        { data: prescriptionsData, error: prescriptionsError },
        { data: medicationsData, error: medicationsError },
        { data: patientsData, error: patientsError },
        { data: doctorsData, error: doctorsError }
      ] = await Promise.all([
        supabase
          .from('prescriptions')
          .select('*')
          .order('prescribed_date', { ascending: false })
          .limit(50),
        
        supabase
          .from('medications')
          .select('*')
          .order('name', { ascending: true }),
          
        supabase
          .from('patients')
          .select('id, full_name, date_of_birth'),
          
        supabase
          .from('profiles')
          .select('id, full_name, email')
      ]);
      
      if (prescriptionsError) throw prescriptionsError;
      if (medicationsError) throw medicationsError;
      if (patientsError) throw patientsError;
      if (doctorsError) throw doctorsError;
      
      // Combine the data manually
      const combinedPrescriptions: PrescriptionWithRelations[] = (prescriptionsData || []).map(prescription => ({
        ...prescription,
        patient: (patientsData || []).find((p: any) => p.id === prescription.patient_id) || null,
        doctor_profile: (doctorsData || []).find((d: any) => d.id === prescription.doctor_id) || null,
        medications: (medicationsData || []).find((m: any) => m.id === prescription.medication_id) || null
      }));

      setPrescriptions(combinedPrescriptions);
      setMedications(medicationsData || []);

      const pending = (prescriptionsData || []).filter(p => p.status === 'Pending').length;
      const lowStock = (medicationsData || []).filter(m => m.quantity_in_stock <= m.reorder_level).length;

      setStats({
        pendingPrescriptions: pending,
        lowStock,
        totalMedications: (medicationsData || []).length
      });
      
      if (showToast) {
        toast.success('Pharmacy data loaded successfully');
      }
    } catch (error) {
      console.error('Error loading pharmacy data:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to load pharmacy data';
      setLoadError(errorMsg);
      
      if (showToast) {
        toast.error(errorMsg, {
          action: {
            label: 'Retry',
            onClick: () => loadPharmacyData()
          }
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Initial data load and real-time subscriptions
  useEffect(() => {
    if (!user) return;
    
    loadPharmacyData();

    // Set up real-time subscription for prescriptions
    const prescriptionsChannel = supabase
      .channel('pharmacy_prescriptions_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'prescriptions' },
        (payload) => {
          console.log('Prescription change detected:', payload);
          loadPharmacyData(false); // Refresh without toast
        }
      )
      .subscribe();

    // Set up real-time subscription for patient visits at pharmacy stage
    const visitsChannel = supabase
      .channel('pharmacy_visits_changes')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patient_visits',
          filter: 'current_stage=eq.pharmacy'
        },
        (payload) => {
          console.log('Patient visit change detected:', payload);
          loadPharmacyData(false); // Refresh without toast
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(prescriptionsChannel);
      supabase.removeChannel(visitsChannel);
    };
  }, [user]);

  const handleOpenDispenseDialog = (prescription: any) => {
    setSelectedPrescriptionForDispense(prescription);
    setDispenseDialogOpen(true);
  };

  const handleDispenseWithDetails = async (dispenseData: any) => {
    if (!selectedPrescriptionForDispense || !user?.id) {
      toast.error('Missing prescription or user information');
      return;
    }

    const prescriptionId = selectedPrescriptionForDispense.id;
    const patientId = selectedPrescriptionForDispense.patient_id;

    setLoadingStates(prev => ({ ...prev, [prescriptionId]: true }));

    try {
      // If medication is not in stock, mark prescription as pending with notes
      if (!dispenseData.in_stock) {
        const { error } = await supabase
          .from('prescriptions')
          .update({
            status: 'Pending',
            pharmacist_notes: `OUT OF STOCK: ${dispenseData.out_of_stock_reason}. Alternative: ${dispenseData.alternative_medication || 'None suggested'}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', prescriptionId);

        if (error) throw error;

        toast.warning('Medication marked as out of stock. Prescription remains pending.');
        setDispenseDialogOpen(false);
        setSelectedPrescriptionForDispense(null);
        loadPharmacyData(false);
        return;
      }

      // Continue with normal dispensing
      await handleDispensePrescription(prescriptionId, patientId, dispenseData);
      setDispenseDialogOpen(false);
      setSelectedPrescriptionForDispense(null);
    } catch (error) {
      console.error('Dispense error:', error);
      toast.error('Failed to process dispensing');
    } finally {
      setLoadingStates(prev => ({ ...prev, [prescriptionId]: false }));
    }
  };

  const handleDispensePrescription = async (prescriptionId: string, patientId: string, dispenseData?: any) => {
    if (!user?.id) {
      toast.error('User not authenticated');
      return;
    }
    
    setLoadingStates(prev => ({ ...prev, [prescriptionId]: true }));

    try {
      await logActivity('pharmacy.dispense.start', { 
        user_id: user.id,
        prescription_id: prescriptionId,
        patient_id: patientId,
        timestamp: new Date().toISOString()
      });

      // First, get the prescription details
      const { data: prescription, error: fetchError } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('id', prescriptionId)
        .single();

      if (fetchError) {
        console.error('Error fetching prescription:', fetchError);
        await logActivity('pharmacy.dispense.error', { 
          error: 'Failed to fetch prescription',
          details: fetchError.message 
        });
        toast.error('Failed to fetch prescription details');
        return;
      }

      if (!prescription) {
        await logActivity('pharmacy.dispense.error', { 
          error: 'Prescription not found',
          prescription_id: prescriptionId 
        });
        toast.error('Prescription not found');
        return;
      }

      if (!prescription.medication_id) {
        await logActivity('pharmacy.dispense.error', { 
          error: 'Invalid medication ID',
          prescription_id: prescriptionId
        });
        toast.error('Prescription does not have a valid medication ID');
        return;
      }

      // Get medication details for stock update
      const { data: medicationData, error: medError } = await supabase
        .from('medications')
        .select('*')
        .eq('id', prescription.medication_id)
        .single();

      if (medError || !medicationData) {
        console.error('Error fetching medication:', medError);
        toast.error('Failed to fetch medication details');
        return;
      }

      // Update prescription status with dispense details
      const updateData: any = {
        status: 'Dispensed',
        dispensed_date: new Date().toISOString(),
        dispensed_by: user.id,
        updated_at: new Date().toISOString()
      };

      if (dispenseData) {
        updateData.actual_dosage = dispenseData.actual_dosage;
        updateData.dosage_mg = dispenseData.dosage_mg;
        updateData.quantity_dispensed = dispenseData.quantity_dispensed;
        updateData.pharmacist_notes = dispenseData.pharmacist_notes;
      }

      const { error: updateError } = await supabase
        .from('prescriptions')
        .update(updateData)
        .eq('id', prescriptionId);

      if (updateError) {
        console.error('Error updating prescription:', updateError);
        toast.error('Failed to update prescription status');
        return;
      }

      // Update patient visit status if applicable
      const { data: visits, error: visitsError } = await supabase
        .from('patient_visits')
        .select('*')
        .eq('patient_id', patientId)
        .eq('current_stage', 'pharmacy')
        .eq('overall_status', 'Active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!visitsError && visits && visits.length > 0) {
        await supabase
          .from('patient_visits')
          .update({
            pharmacy_status: 'Completed',
            pharmacy_completed_at: new Date().toISOString(),
            pharmacy_completed_by: user.id,
            current_stage: 'billing',
            billing_status: 'Pending',
            overall_status: 'Active',
            updated_at: new Date().toISOString()
          })
          .eq('id', visits[0].id);
      }

      // Update medication stock
      const newStock = medicationData.quantity_in_stock - prescription.quantity;
      
      const { error: updateStockError } = await supabase
        .from('medications')
        .update({
          quantity_in_stock: newStock,
          updated_at: new Date().toISOString()
        })
        .eq('id', prescription.medication_id);

      if (updateStockError) throw updateStockError;

      // Create invoice for billing
      const invoiceNumber = generateInvoiceNumber();
      const unitPrice = medicationData.unit_price || 0;
      const invoiceAmount = unitPrice * prescription.quantity;
      
      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([
          {
            invoice_number: invoiceNumber,
            patient_id: patientId,
            total_amount: invoiceAmount,
            paid_amount: 0,
            status: 'Unpaid',
            invoice_date: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (invoiceError) {
        console.error('Error creating invoice:', invoiceError);
        throw invoiceError;
      }

      // Create invoice item for the medication
      if (newInvoice) {
        await supabase
          .from('invoice_items')
          .insert([
            {
              invoice_id: newInvoice.id,
              description: `${prescription.medication_name} - ${prescription.dosage}`,
              item_type: 'Medication',
              quantity: prescription.quantity,
              unit_price: unitPrice,
              total_price: invoiceAmount
            }
          ]);
      }

      // Log successful dispense
      await logActivity('pharmacy.dispense.success', {
        user_id: user.id,
        prescription_id: prescriptionId,
        patient_id: patientId,
        medication_id: prescription.medication_id,
        quantity: prescription.quantity,
        invoice_number: invoiceNumber,
        timestamp: new Date().toISOString()
      });

      
      toast.success('Prescription dispensed successfully');
      
      // Update local state
      setPrescriptions(prev => prev.filter(p => p.id !== prescriptionId));
    } catch (error) {
      console.error('Error dispensing prescription:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to dispense prescription';
      
      await logActivity('pharmacy.dispense.error', {
        error: errorMsg,
        prescription_id: prescriptionId,
        user_id: user?.id,
        timestamp: new Date().toISOString()
      });
      
      toast.error(errorMsg);
    } finally {
      setLoadingStates(prev => ({ ...prev, [prescriptionId]: false }));
    }
  };

  const handleUpdateStock = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedMedication) return;

    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const quantity = formData.get('quantity');
    const newQuantity = quantity ? Number(quantity) : 0;
    
    if (isNaN(newQuantity)) {
      toast.error('Please enter a valid quantity');
      return;
    }
    
    if (isNaN(newQuantity)) {
      toast.error('Please enter a valid quantity');
      return;
    }

    const { error } = await supabase
      .from('medications')
      .update({ quantity_in_stock: newQuantity })
      .eq('id', selectedMedication.id);

    if (error) {
      toast.error('Failed to update stock');
    } else {
      toast.success('Stock updated successfully');
      setStockDialogOpen(false);
      setSelectedMedication(null);
      loadPharmacyData();
    }
  };

  const handleSaveMedication = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const quantity = formData.get('quantity');
    const reorderLevel = formData.get('reorderLevel');
    const unitPrice = formData.get('unitPrice');
    
    if (!name || !quantity || !reorderLevel || !unitPrice) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    const quantityNum = Number(quantity);
    const reorderLevelNum = Number(reorderLevel);
    const unitPriceNum = Number(unitPrice);
    
    if (isNaN(quantityNum) || isNaN(reorderLevelNum) || isNaN(unitPriceNum)) {
      toast.error('Please enter valid numbers for quantity, reorder level, and unit price');
      return;
    }

    const medicationData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string || '',
      quantity_in_stock: Number(quantity),
      reorder_level: Number(reorderLevel),
      unit_price: Number(unitPrice),
      manufacturer: formData.get('manufacturer') as string || '',
      dosage_form: formData.get('dosageForm') as string || '',
      strength: formData.get('strength') as string || '',
      expiry_date: formData.get('expiryDate') as string || null,
    };

    let error;
    if (editingMedication) {
      ({ error } = await supabase
        .from('medications')
        .update(medicationData)
        .eq('id', editingMedication.id));
    } else {
      ({ error } = await supabase
        .from('medications')
        .insert([medicationData]));
    }

    if (error) {
      toast.error(`Failed to ${editingMedication ? 'update' : 'add'} medication`);
    } else {
      toast.success(`Medication ${editingMedication ? 'updated' : 'added'} successfully`);
      setMedicationDialogOpen(false);
      setEditingMedication(null);
      loadPharmacyData();
    }
  };

  const openStockDialog = (medication: any) => {
    setSelectedMedication(medication);
    setStockDialogOpen(true);
  };

  const openEditDialog = (medication: any) => {
    setEditingMedication(medication);
    setMedicationDialogOpen(true);
  };

  const downloadCSVTemplate = () => {
    const headers = ['name', 'description', 'quantity_in_stock', 'reorder_level', 'unit_price', 'manufacturer', 'dosage_form', 'strength', 'expiry_date'];
    const csvContent = [
      headers.join(','),
      'Paracetamol 500mg,For pain relief,100,20,5000,ABC Pharma,Tablet,500mg,2025-12-31',
      'Amoxicillin 500mg,Antibiotic,50,10,8000,XYZ Pharma,Capsule,500mg,2024-06-30'
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'medications_template.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    return lines.slice(1).map((line, index) => {
      if (!line.trim()) return null;

      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const medication: any = {};

      headers.forEach((header, i) => {
        const value = values[i] || '';
        switch (header.toLowerCase()) {
          case 'name':
            medication.name = value;
            break;
          case 'generic_name':
          case 'generic name':
            medication.generic_name = value || null;
            break;
          case 'strength':
            medication.strength = value;
            break;
          case 'dosage_form':
          case 'dosage form':
            medication.dosage_form = value || 'Tablet';
            break;
          case 'manufacturer':
            medication.manufacturer = value || null;
            break;
          case 'quantity_in_stock':
          case 'quantity':
          case 'stock':
            medication.quantity_in_stock = parseInt(value) || 0;
            break;
          case 'reorder_level':
          case 'reorder level':
            medication.reorder_level = parseInt(value) || 10;
            break;
          case 'unit_price':
          case 'unit price':
          case 'price':
            medication.unit_price = parseFloat(value) || 0;
            break;
          case 'expiry_date':
          case 'expiry date':
            medication.expiry_date = value || null;
            break;
        }
      });

      // Validate required fields
      if (!medication.name || !medication.strength) {
        medication.error = 'Missing required fields: name or strength';
      }

      return medication;
    }).filter(Boolean);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    setImportFile(file);

    const text = await file.text();
    const medications = parseCSV(text);

    const validMedications = medications.filter(med => !med.error);
    const invalidMedications = medications.filter(med => med.error);

    setImportPreview(validMedications);

    if (invalidMedications.length > 0) {
      toast.warning(`${invalidMedications.length} rows have errors and will be skipped`);
    }

    if (validMedications.length === 0) {
      toast.error('No valid medications found in the file');
      return;
    }

    toast.success(`Found ${validMedications.length} valid medications to import`);
  };

  const handleBulkImport = async () => {
    if (importPreview.length === 0) {
      toast.error('No medications to import');
      return;
    }

    setImportLoading(true);
    setImportProgress(0);

    const medicationsToImport = importPreview.map(med => ({
      name: med.name,
      generic_name: med.generic_name,
      strength: med.strength,
      dosage_form: med.dosage_form,
      manufacturer: med.manufacturer,
      quantity_in_stock: med.quantity_in_stock,
      reorder_level: med.reorder_level,
      unit_price: med.unit_price,
      expiry_date: med.expiry_date,
    }));

    try {
      const { error } = await supabase
        .from('medications')
        .insert(medicationsToImport);

      if (error) {
        console.error('Bulk import error:', error);
        toast.error(`Failed to import medications: ${error.message}`);
      } else {
        toast.success(`Successfully imported ${medicationsToImport.length} medications`);
        setImportDialogOpen(false);
        setImportFile(null);
        setImportPreview([]);
        loadPharmacyData();
      }
    } catch (error) {
      console.error('Unexpected error during import:', error);
      toast.error('An unexpected error occurred during import');
    } finally {
      setImportLoading(false);
      setImportProgress(0);
    }
  };

  const createInvoiceFromPrescription = async (prescription: {
    id: string;
    medication_id: string;
    patient_id: string;
    quantity: number;
    dosage: string;
    [key: string]: any;
  }) => {
    try {
      console.log('Starting invoice creation for prescription:', prescription.id);

      if (!prescription.medication_id) {
        throw new Error('Prescription does not have a valid medication ID');
      }

      // Get medication details to calculate pricing
      console.log('Fetching medication details for ID:', prescription.medication_id);
      const { data: medicationData, error: medError } = await supabase
        .from('medications')
        .select('*')
        .eq('id', prescription.medication_id)
        .single();

      if (medError) {
        console.error('Error fetching medication:', medError);
        throw new Error(`Failed to fetch medication details: ${medError.message}`);
      }

      if (!medicationData) {
        throw new Error('Medication not found');
      }

      console.log('Medication found:', medicationData.name);

      // Calculate total amount (medication price * quantity + 10% tax)
      const subtotal = medicationData.unit_price * prescription.quantity;
      const tax = subtotal * 0.1;
      const totalAmount = subtotal + tax;

      console.log(`Calculated amounts - Subtotal: ${subtotal}, Tax: ${tax}, Total: ${totalAmount}`);

      // Create invoice with retry logic for duplicate invoice numbers
      let invoice = null;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          const invoiceNumber = await generateInvoiceNumber();
          const invoiceData = {
            invoice_number: invoiceNumber,
            patient_id: prescription.patient_id,
            total_amount: totalAmount,
            tax: tax,
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            notes: `Auto-generated invoice for prescription: ${medicationData.name} (${prescription.dosage})`,
            status: 'unpaid' // Using 'unpaid' as it's a standard invoice status
          };

          console.log(`Attempt ${attempts + 1}: Creating invoice with number:`, invoiceNumber);
          
          const { data, error: invoiceError } = await supabase
            .from('invoices')
            .insert([invoiceData])
            .select()
            .single();

          if (invoiceError) {
            console.error(`Invoice creation attempt ${attempts + 1} failed:`, invoiceError);
            
            // If it's a duplicate key error and we have retries left, try again
            if (invoiceError.code === '23505' || (invoiceError as any).code === '23505') {
              if (attempts < maxAttempts - 1) {
              console.warn(`Duplicate invoice number ${invoiceNumber}, retrying...`);
                attempts++;
                console.warn(`Duplicate invoice number detected, retrying (${attempts}/${maxAttempts})...`);
                // Add an increasing delay between retries
                await new Promise(resolve => setTimeout(resolve, 200 * attempts));
                continue;
              } else {
                // If we're out of retries, try one last time with a timestamp-based number
                console.warn('Max retries reached, trying with timestamp-based invoice number');
                const timestamp = Date.now().toString().slice(-6);
                const fallbackInvoiceNumber = `INV-${timestamp}`;
                
                const { data: fallbackData, error: fallbackError } = await supabase
                  .from('invoices')
                  .insert([{
                    ...invoiceData,
                    invoice_number: fallbackInvoiceNumber,
                    status: 'unpaid' // Ensure status is set for fallback as well
                  }])
                  .select()
                  .single();
                  
                if (fallbackError) {
                  console.error('Fallback invoice creation failed:', fallbackError);
                  throw new Error(`Failed to create invoice after ${maxAttempts} attempts and fallback: ${fallbackError.message}`);
                }
                
                invoice = fallbackData;
                break;
              }
            }
            // If it's a different error, throw it
            throw new Error(`Failed to create invoice: ${invoiceError.message}`);
          }
          
          invoice = data;
          break; // Success, exit the retry loop
          
        } catch (error) {
          if (attempts >= maxAttempts - 1) {
            console.error(`Failed to create invoice after ${maxAttempts} attempts:`, error);
            throw error;
          }
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      if (!invoice) {
        throw new Error('Failed to create invoice after multiple attempts');
      }

      console.log('Invoice created:', invoice);

      // Create invoice item
      const invoiceItemData = {
        invoice_id: invoice.id,
        description: `${medicationData.name} ${prescription.dosage}`,
        item_type: 'medication',
        quantity: prescription.quantity,
        unit_price: medicationData.unit_price,
        total_price: subtotal,
        medication_id: prescription.medication_id
      };

      console.log('Creating invoice item:', invoiceItemData);
      const { error: itemError } = await supabase
        .from('invoice_items')
        .insert([invoiceItemData]);

      if (itemError) {
        console.error('Error creating invoice item:', itemError);
        throw new Error(`Failed to create invoice item: ${itemError.message}`);
      }

      console.log('Invoice item created successfully');
      return invoice;
    } catch (error) {
      console.error('Error in createInvoiceFromPrescription:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Pharmacy Dashboard">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-200 animate-pulse rounded-lg"></div>)}
          </div>
          <div className="h-96 bg-gray-200 animate-pulse rounded-lg"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Pharmacy Dashboard">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Prescriptions</CardTitle>
              <Pill className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingPrescriptions}</div>
              <p className="text-xs text-muted-foreground">
                {stats.pendingPrescriptions === 0 ? 'All caught up!' : 'Awaiting fulfillment'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.lowStock}</div>
              <p className="text-xs text-muted-foreground">
                {stats.lowStock === 0 ? 'Stock levels good' : 'Below reorder level'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Medications</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalMedications}</div>
              <p className="text-xs text-muted-foreground">In inventory</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="prescriptions" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
          </TabsList>

          <TabsContent value="prescriptions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Prescriptions</CardTitle>
                  <CardDescription>
                    {prescriptionFilter === 'pending' 
                      ? (prescriptions.filter(p => p.status === 'Pending').length > 0 
                          ? `Showing ${Math.min(prescriptions.filter(p => p.status === 'Pending').length, 10)} of ${prescriptions.filter(p => p.status === 'Pending').length} pending`
                          : 'No pending prescriptions')
                      : (prescriptions.length > 0 
                          ? `Showing ${Math.min(prescriptions.length, 10)} of ${prescriptions.length} prescriptions`
                          : 'No prescriptions found')}
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                    <Button
                      variant={prescriptionFilter === 'pending' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setPrescriptionFilter('pending')}
                    >
                      Pending
                    </Button>
                    <Button
                      variant={prescriptionFilter === 'all' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setPrescriptionFilter('all')}
                    >
                      All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {(prescriptionFilter === 'pending' 
                    ? prescriptions.filter(p => p.status === 'Pending') 
                    : prescriptions
                  ).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Package className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">
                      {prescriptionFilter === 'pending' ? 'No pending prescriptions' : 'No prescriptions found'}
                    </h3>
                    <p className="text-muted-foreground text-sm mt-1">
                      When prescriptions are created, they will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Patient</TableHead>
                          <TableHead>Medication</TableHead>
                          <TableHead>Prescribed By</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(prescriptionFilter === 'pending' 
                          ? prescriptions.filter(p => p.status === 'Pending') 
                          : prescriptions
                        ).slice(0, 10).map((prescription) => (
                          <TableRow 
                            key={prescription.id}
                            className={loadingStates[prescription.id] ? 'opacity-50' : ''}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center">
                                {loadingStates[prescription.id] && (
                                  <Loader2 className="h-3 w-3 animate-spin mr-2 text-muted-foreground" />
                                )}
                                <span>
                                  {prescription.patient?.full_name || '-'}
                                </span>
                              </div>
                              {prescription.patient?.date_of_birth && (
                                <div className="text-xs text-muted-foreground">
                                  DOB: {format(new Date(prescription.patient.date_of_birth), 'MM/dd/yyyy')}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">
                                {prescription.medications?.name || prescription.medication_name}
                              </div>
                              {prescription.medications?.strength && (
                                <div className="text-xs text-muted-foreground">
                                  {prescription.medications.strength}
                                  {prescription.medications.dosage_form && ` • ${prescription.medications.dosage_form}`}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {prescription.doctor_profile ? (
                                <>
                                  <div>{prescription.doctor_profile.full_name}</div>
                                  {prescription.doctor_profile.department && (
                                    <div className="text-xs text-muted-foreground">
                                      {prescription.doctor_profile.department}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div>{format(new Date(prescription.prescribed_date), 'MMM d, yyyy')}</div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(prescription.prescribed_date), 'h:mm a')}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  prescription.status === 'Dispensed'
                                    ? 'default'
                                    : prescription.status === 'Cancelled'
                                    ? 'destructive'
                                    : 'secondary'
                                }
                                className="capitalize"
                              >
                                {prescription.status.toLowerCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {prescription.status === 'Pending' ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenDispenseDialog(prescription)}
                                  disabled={loadingStates[prescription.id]}
                                >
                                  {loadingStates[prescription.id] ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  ) : (
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                  )}
                                  Dispense
                                </Button>
                              ) : (
                                <span className="text-muted-foreground text-sm">
                                  Dispensed
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory">
            <Card className="shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Medication Inventory</CardTitle>
                  <CardDescription>Track and manage medication stock levels</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Import Medications
                  </Button>
                  <Button onClick={() => setMedicationDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Medication
                  </Button>
                  <Button variant="outline" onClick={() => setStockDialogOpen(true)}>
                    Update Stock
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Generic Name</TableHead>
                        <TableHead>Strength</TableHead>
                        <TableHead>Form</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Reorder Level</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {medications.map((med) => {
                        const isLowStock = med.quantity_in_stock <= med.reorder_level;
                        return (
                          <TableRow key={med.id}>
                            <TableCell className="font-medium">{med.name}</TableCell>
                            <TableCell>{med.generic_name}</TableCell>
                            <TableCell>{med.strength}</TableCell>
                            <TableCell>{med.dosage_form}</TableCell>
                            <TableCell>{med.quantity_in_stock}</TableCell>
                            <TableCell>{med.reorder_level}</TableCell>
                            <TableCell>TSh{Number(med.unit_price).toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant={isLowStock ? 'destructive' : 'default'}>
                                {isLowStock ? 'Low Stock' : 'In Stock'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => openEditDialog(med)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button size="sm" onClick={() => openStockDialog(med)}>
                                  Update Stock
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>

              {/* Import Medications Dialog */}
              <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Bulk Import Medications</DialogTitle>
                    <DialogDescription>
                      Upload a CSV file to import multiple medications at once
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="csvFile">CSV File</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={downloadCSVTemplate}
                          className="text-xs"
                        >
                          <File className="mr-1 h-3 w-3" />
                          Download Template
                        </Button>
                      </div>
                      <Input
                        id="csvFile"
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        disabled={importLoading}
                      />
                      <p className="text-sm text-muted-foreground">
                        Upload a CSV file with columns: name, generic_name, strength, dosage_form, manufacturer, quantity_in_stock, reorder_level, unit_price, expiry_date
                      </p>
                    </div>

                    {importPreview.length > 0 && (
                      <div className="space-y-2">
                        <Label>Preview ({importPreview.length} medications)</Label>
                        <div className="border rounded-lg max-h-60 overflow-y-auto">
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Strength</TableHead>
                                  <TableHead>Stock</TableHead>
                                  <TableHead>Price</TableHead>
                                  <TableHead>Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {importPreview.slice(0, 10).map((med, index) => (
                                  <TableRow key={med.name + med.strength || index}>
                                    <TableCell className="font-medium">{med.name}</TableCell>
                                    <TableCell>{med.strength}</TableCell>
                                    <TableCell>{med.quantity_in_stock}</TableCell>
                                    <TableCell>TSh{Number(med.unit_price).toFixed(2)}</TableCell>
                                    <TableCell>
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {importPreview.length > 10 && (
                                  <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                                      ... and {importPreview.length - 10} more medications
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setImportDialogOpen(false);
                          setImportFile(null);
                          setImportPreview([]);
                        }}
                        disabled={importLoading}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleBulkImport}
                        disabled={importPreview.length === 0 || importLoading}
                      >
                        {importLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Import {importPreview.length} Medications
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Add/Edit Medication Dialog */}
              <Dialog open={medicationDialogOpen} onOpenChange={(open) => {
                setMedicationDialogOpen(open);
                if (!open) setEditingMedication(null);
              }}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{editingMedication ? 'Edit' : 'Add'} Medication</DialogTitle>
                    <DialogDescription>
                      {editingMedication ? 'Update' : 'Enter'} medication details
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSaveMedication} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Medication Name *</Label>
                        <Input id="name" name="name" defaultValue={editingMedication?.name} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="genericName">Generic Name</Label>
                        <Input id="genericName" name="genericName" defaultValue={editingMedication?.generic_name} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="strength">Strength *</Label>
                        <Input id="strength" name="strength" placeholder="e.g., 500mg" defaultValue={editingMedication?.strength} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dosageForm">Dosage Form *</Label>
                        <Select name="dosageForm" defaultValue={editingMedication?.dosage_form || "Tablet"}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Tablet">Tablet</SelectItem>
                            <SelectItem value="Capsule">Capsule</SelectItem>
                            <SelectItem value="Syrup">Syrup</SelectItem>
                            <SelectItem value="Injection">Injection</SelectItem>
                            <SelectItem value="Cream">Cream</SelectItem>
                            <SelectItem value="Drops">Drops</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manufacturer">Manufacturer</Label>
                      <Input id="manufacturer" name="manufacturer" defaultValue={editingMedication?.manufacturer} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="quantity">Quantity in Stock *</Label>
                        <Input id="quantity" name="quantity" type="number" defaultValue={editingMedication?.quantity_in_stock} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reorderLevel">Reorder Level *</Label>
                        <Input id="reorderLevel" name="reorderLevel" type="number" defaultValue={editingMedication?.reorder_level || 10} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="unitPrice">Unit Price *</Label>
                        <Input id="unitPrice" name="unitPrice" type="number" step="0.01" defaultValue={editingMedication?.unit_price} required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expiryDate">Expiry Date</Label>
                      <Input id="expiryDate" name="expiryDate" type="date" defaultValue={editingMedication?.expiry_date} />
                    </div>
                    <Button type="submit" className="w-full">
                      {editingMedication ? 'Update' : 'Add'} Medication
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Update Stock Dialog */}
              <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Update Stock</DialogTitle>
                    <DialogDescription>
                      Update stock quantity for {selectedMedication?.name}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleUpdateStock} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentStock">Current Stock</Label>
                      <Input
                        id="currentStock"
                        value={selectedMedication?.quantity_in_stock || 0}
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quantity">New Stock Quantity *</Label>
                      <Input
                        id="quantity"
                        name="quantity"
                        type="number"
                        defaultValue={selectedMedication?.quantity_in_stock || 0}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full">Update Stock</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dispense Dialog */}
        {selectedPrescriptionForDispense && (
          <DispenseDialog
            open={dispenseDialogOpen}
            onOpenChange={setDispenseDialogOpen}
            prescription={selectedPrescriptionForDispense}
            medication={medications.find(m => m.id === selectedPrescriptionForDispense.medication_id)}
            onDispense={handleDispenseWithDetails}
            loading={loadingStates[selectedPrescriptionForDispense.id]}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
