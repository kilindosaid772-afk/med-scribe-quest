import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Pill, AlertTriangle, Package, Loader2, Plus, Edit } from 'lucide-react';
import { format } from 'date-fns';

export default function PharmacyDashboard() {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [stats, setStats] = useState({ pendingPrescriptions: 0, lowStock: 0, totalMedications: 0 });
  const [loading, setLoading] = useState(true);
  const [medicationDialogOpen, setMedicationDialogOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<any>(null);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch prescriptions
      const { data: prescriptionsData } = await supabase
        .from('prescriptions')
        .select(`
          *,
          patient:patients(full_name, phone),
          doctor:profiles!prescriptions_doctor_id_fkey(full_name)
        `)
        .order('prescribed_date', { ascending: false })
        .limit(50);

      // Fetch medications
      const { data: medicationsData } = await supabase
        .from('medications')
        .select('*')
        .order('name');

      setPrescriptions(prescriptionsData || []);
      setMedications(medicationsData || []);

      const pending = prescriptionsData?.filter(p => p.status === 'Pending').length || 0;
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

  const handleDispensePrescription = async (prescriptionId: string) => {
    const { error } = await supabase
      .from('prescriptions')
      .update({
        status: 'Dispensed',
        dispensed_date: new Date().toISOString(),
        dispensed_by: user?.id
      })
      .eq('id', prescriptionId);

    if (error) {
      toast.error('Failed to dispense prescription');
    } else {
      toast.success('Prescription dispensed successfully');
      fetchData();
    }
  };

  const handleUpdateStock = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedMedication) return;

    const formData = new FormData(e.currentTarget);
    const newQuantity = Number(formData.get('quantity'));

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
      fetchData();
    }
  };

  const handleSaveMedication = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const medicationData = {
      name: formData.get('name') as string,
      generic_name: formData.get('genericName') as string || null,
      strength: formData.get('strength') as string,
      dosage_form: formData.get('dosageForm') as string,
      manufacturer: formData.get('manufacturer') as string || null,
      quantity_in_stock: Number(formData.get('quantity')),
      reorder_level: Number(formData.get('reorderLevel')),
      unit_price: Number(formData.get('unitPrice')),
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
      fetchData();
    }
  };

  const openEditDialog = (medication: any) => {
    setEditingMedication(medication);
    setMedicationDialogOpen(true);
  };

  const openStockDialog = (medication: any) => {
    setSelectedMedication(medication);
    setStockDialogOpen(true);
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
                    {prescriptions.map((prescription) => (
                      <TableRow key={prescription.id}>
                        <TableCell className="font-medium">
                          {prescription.patient?.full_name || 'Unknown'}
                        </TableCell>
                        <TableCell>{prescription.medication_name}</TableCell>
                        <TableCell>{prescription.dosage}</TableCell>
                        <TableCell>{prescription.quantity}</TableCell>
                        <TableCell>{prescription.doctor?.full_name || 'Unknown'}</TableCell>
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
                              onClick={() => handleDispensePrescription(prescription.id)}
                            >
                              Dispense
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                <Dialog open={medicationDialogOpen} onOpenChange={(open) => {
                  setMedicationDialogOpen(open);
                  if (!open) setEditingMedication(null);
                }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Medication
                    </Button>
                  </DialogTrigger>
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
              </CardHeader>
              <CardContent>
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
                          <TableCell>${Number(med.unit_price).toFixed(2)}</TableCell>
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
