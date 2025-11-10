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
import { format } from 'date-fns';
import { generateInvoiceNumber, logActivity } from '@/lib/utils';

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
  const [loading, setLoading] = useState(true);
  const [medicationDialogOpen, setMedicationDialogOpen] = useState<boolean>(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [stockDialogOpen, setStockDialogOpen] = useState<boolean>(false);
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const loadPharmacyData = async () => {
    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    try {
      setLoading(true);

      // First, let's fetch prescriptions with basic data
      const { data: prescriptionsData, error: prescriptionsError } = await supabase
        .from('prescriptions')
        .select(`
          *,
          patient:patient_id (id, first_name, last_name, date_of_birth),
          doctor_profile:doctor_id (id, first_name, last_name, specialization, email),
          medications:medication_id (id, name, dosage_form, strength, manufacturer)
        `)
        .order('prescribed_date', { ascending: false })
        .limit(50) as { data: Prescription[] | null, error: any };

      if (prescriptionsError) {
        console.error('Error fetching prescriptions:', prescriptionsError);
        toast.error(`Failed to load prescriptions: ${prescriptionsError.message}`);
        return;
      }

      // Fetch medications
      const { data: medicationsData, error: medicationsError } = await supabase
        .from('medications')
        .select('*')
        .order('name', { ascending: true });

      if (medicationsError) throw medicationsError;

      setPrescriptions(prescriptionsData || []);
      setMedications(medicationsData || []);

      const pending = prescriptionsData?.filter(p => p.status === 'Pending').length;
      const lowStock = medicationsData?.filter(m => m.quantity_in_stock <= m.reorder_level).length || 0;

      setStats({
        pendingPrescriptions: pending,
        lowStock,
        totalMedications: medicationsData?.length || 0
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load pharmacy data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPharmacyData();
  }, [user]);

  const handleDispensePrescription = async (prescriptionId: string, patientId: string) => {
    if (!user?.id) {
      toast.error('User not authenticated');
      return;
    }

    try {
      await logActivity('pharmacy.dispense.start', { 
        user_id: user.id,
        prescription_id: prescriptionId,
        patient_id: patientId,
        timestamp: new Date().toISOString()
      });

      // First, get the prescription details to create invoice
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

      // Reduce medication stock based on prescription quantity
      const { data: medicationData, error: medError } = await supabase
        .from('medications')
        .select('*')
        .eq('id', prescription.medication_id)
        .single();

      if (medError) {
        console.error('Error fetching medication:', medError);
        toast.error('Failed to fetch medication details for stock reduction');
        return;
      }

      if (!medicationData) {
        toast.error('Medication not found for stock reduction');
        return;
      }

      if (medicationData.quantity_in_stock < prescription.quantity) {
        toast.error(`Insufficient stock. Available: ${medicationData.quantity_in_stock}, Required: ${prescription.quantity}`);
        return;
      }

      const newStockQuantity = medicationData.quantity_in_stock - prescription.quantity;

      const { error: stockError } = await supabase
        .from('medications')
        .update({ quantity_in_stock: newStockQuantity })
        .eq('id', prescription.medication_id);

      if (stockError) {
        console.error('Error reducing stock:', stockError);
        toast.error('Failed to reduce medication stock');
        return;
      }

      // Update prescription status to dispensed
      const currentUserId = user?.id;
      const updateData: {
        status: string;
        dispensed_date: string;
        dispensed_by: string | null;
        updated_at: string;
        lab_result_id?: string;
      } = {
        status: 'Dispensed',
        dispensed_date: new Date().toISOString(),
        dispensed_by: currentUserId || null,
        updated_at: new Date().toISOString()
      };
      
      // Only add lab_result_id if it exists in the prescription
      if (prescription.lab_result_id) {
        updateData.lab_result_id = prescription.lab_result_id;
      }
      
      const { error } = await supabase
        .from('prescriptions')
        .update(updateData)
        .eq('id', prescriptionId);

      if (error) {
        console.error('Error dispensing prescription:', error);
        toast.error('Failed to dispense prescription');
        return;
      }

      // Update workflow to move to billing
      const { data: visits, error: visitError } = await supabase
        .from('patient_visits')
        .select('*')
        .eq('patient_id', patientId)
        .eq('current_stage', 'pharmacy')
        .eq('overall_status', 'Active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (visitError) {
        console.error('Error fetching patient visits:', visitError);
        toast.error('Failed to fetch patient visit information');
        return;
      }

      if (visits && visits.length > 0) {
        const { error: workflowError } = await supabase
          .from('patient_visits')
          .update({
            pharmacy_status: 'Completed',
            pharmacy_completed_at: new Date().toISOString(),
            current_stage: 'billing',
            billing_status: 'Pending'
          })
          .eq('id', visits[0].id);

        if (workflowError) {
          console.error('Error updating patient visit workflow:', workflowError);
          toast.error('Prescription dispensed but failed to update workflow');
        } else {
        }
      } else {
      }

      toast.success('Prescription dispensed successfully');
      
      // Log successful dispense
      await logActivity('pharmacy.dispense.success', {
        prescription_id: prescriptionId,
        patient_id: patientId,
        medication_id: prescription.medication_id,
        quantity: prescription.quantity
      });
      
      loadPharmacyData();
    } catch (error) {
      console.error('Unexpected error in handleDispensePrescription:', error);
      await logActivity('pharmacy.dispense.error', { 
        error: 'Unexpected error',
        details: error instanceof Error ? error.message : String(error),
        prescription_id: prescriptionId,
        patient_id: patientId
      });
      toast.error('An unexpected error occurred while dispensing the prescription');
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
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Pharmacy Dashboard">
      <div className="space-y-8">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-primary/20 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Prescriptions</CardTitle>
              <Pill className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.pendingPrescriptions}</div>
            </CardContent>
          </Card>

          <Card className="border-destructive/20 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.lowStock}</div>
            </CardContent>
          </Card>

          <Card className="border-secondary/20 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Medications</CardTitle>
              <Package className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-secondary">{stats.totalMedications}</div>
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
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Prescriptions</CardTitle>
                <CardDescription>Manage and dispense prescriptions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient</TableHead>
                        <TableHead>Medication</TableHead>
                        <TableHead>Dosage</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {prescriptions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            {loading ? (
                              <div className="flex items-center justify-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading prescriptions...
                              </div>
                            ) : (
                              'No prescriptions found. Create a prescription from the doctor dashboard first.'
                            )}
                          </TableCell>
                        </TableRow>
                      ) : (
                        prescriptions.map((prescription) => (
                          <TableRow key={prescription.id}>
                            <TableCell className="font-medium">
                              {prescription.patient?.first_name && prescription.patient.last_name 
                                ? `${prescription.patient.first_name} ${prescription.patient.last_name}`
                                : 'Unknown'}
                            </TableCell>
                            <TableCell>{prescription.medications?.name || prescription.medication_name || 'Unknown'}</TableCell>
                            <TableCell>{prescription.dosage || 'N/A'}</TableCell>
                            <TableCell>{prescription.quantity}</TableCell>
                            <TableCell>{
                              prescription.doctor_profile?.first_name && prescription.doctor_profile.last_name
                                ? `${prescription.doctor_profile.first_name} ${prescription.doctor_profile.last_name}`
                                : 'Unknown'
                            }</TableCell>
                            <TableCell>
                              {format(new Date(prescription.prescribed_date), 'MMM dd, yyyy')}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  prescription.status === 'Dispensed' ? 'default' :
                                  prescription.status === 'Pending' ? 'secondary' :
                                  'outline'
                                }
                              >
                                {prescription.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {prescription.status === 'Pending' && (
                                <Button
                                  size="sm"
                                  onClick={() => handleDispensePrescription(prescription.id, prescription.patient_id)}
                                >
                                  Dispense
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
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
      </div>
    </DashboardLayout>
  );
}
