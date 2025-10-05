import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Pill, AlertTriangle, Package, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function PharmacyDashboard() {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [stats, setStats] = useState({ pendingPrescriptions: 0, lowStock: 0, totalMedications: 0 });
  const [loading, setLoading] = useState(true);

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

  const handleUpdateStock = async (medicationId: string, newQuantity: number) => {
    const { error } = await supabase
      .from('medications')
      .update({ quantity_in_stock: newQuantity })
      .eq('id', medicationId);

    if (error) {
      toast.error('Failed to update stock');
    } else {
      toast.success('Stock updated successfully');
      fetchData();
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
              <CardHeader>
                <CardTitle>Medication Inventory</CardTitle>
                <CardDescription>Track and manage medication stock levels</CardDescription>
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
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
