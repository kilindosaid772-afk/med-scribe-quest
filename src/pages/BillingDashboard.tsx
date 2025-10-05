import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DollarSign, CreditCard, AlertCircle, Loader2, Plus } from 'lucide-react';
import { format } from 'date-fns';

export default function BillingDashboard() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [stats, setStats] = useState({ unpaid: 0, partiallyPaid: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch invoices
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select(`
          *,
          patient:patients(full_name, phone)
        `)
        .order('invoice_date', { ascending: false })
        .limit(50);

      // Fetch patients for invoice creation
      const { data: patientsData } = await supabase
        .from('patients')
        .select('id, full_name')
        .eq('status', 'Active');

      setInvoices(invoicesData || []);
      setPatients(patientsData || []);

      const unpaid = invoicesData?.filter(i => i.status === 'Unpaid').length || 0;
      const partiallyPaid = invoicesData?.filter(i => i.status === 'Partially Paid').length || 0;
      const totalRevenue = invoicesData
        ?.filter(i => i.status === 'Paid')
        .reduce((sum, i) => sum + Number(i.total_amount), 0) || 0;

      setStats({ unpaid, partiallyPaid, totalRevenue });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  const generateInvoiceNumber = () => {
    return `INV-${Date.now().toString().slice(-8)}`;
  };

  const handleCreateInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const totalAmount = Number(formData.get('totalAmount'));
    const invoiceData = {
      invoice_number: generateInvoiceNumber(),
      patient_id: formData.get('patientId') as string,
      total_amount: totalAmount,
      tax: totalAmount * 0.1, // 10% tax
      due_date: formData.get('dueDate') as string,
      notes: formData.get('notes') as string,
    };

    const { error } = await supabase.from('invoices').insert([invoiceData]);

    if (error) {
      toast.error('Failed to create invoice');
    } else {
      toast.success('Invoice created successfully');
      setDialogOpen(false);
      fetchData();
    }
  };

  const handleRecordPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));

    const paymentData = {
      invoice_id: selectedInvoice.id,
      amount,
      payment_method: formData.get('paymentMethod') as string,
      reference_number: formData.get('referenceNumber') as string,
      notes: formData.get('notes') as string,
    };

    const { error } = await supabase.from('payments').insert([paymentData]);

    if (error) {
      toast.error('Failed to record payment');
      return;
    }

    // Update invoice status
    const newPaidAmount = Number(selectedInvoice.paid_amount) + amount;
    const totalAmount = Number(selectedInvoice.total_amount);
    let newStatus = 'Unpaid';
    
    if (newPaidAmount >= totalAmount) {
      newStatus = 'Paid';
    } else if (newPaidAmount > 0) {
      newStatus = 'Partially Paid';
    }

    await supabase
      .from('invoices')
      .update({
        paid_amount: newPaidAmount,
        status: newStatus
      })
      .eq('id', selectedInvoice.id);

    toast.success('Payment recorded successfully');
    setPaymentDialogOpen(false);
    setSelectedInvoice(null);
    fetchData();
  };

  if (loading) {
    return (
      <DashboardLayout title="Billing Dashboard">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Billing Dashboard">
      <div className="space-y-8">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-destructive/20 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unpaid Invoices</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.unpaid}</div>
            </CardContent>
          </Card>

          <Card className="border-yellow-200 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Partially Paid</CardTitle>
              <CreditCard className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.partiallyPaid}</div>
            </CardContent>
          </Card>

          <Card className="border-green-200 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${stats.totalRevenue.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invoices Table */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Invoices</CardTitle>
                <CardDescription>Manage patient invoices and payments</CardDescription>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Invoice
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Invoice</DialogTitle>
                    <DialogDescription>Generate a new invoice for a patient</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateInvoice} className="space-y-4">
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
                      <Label htmlFor="totalAmount">Total Amount ($)</Label>
                      <Input
                        id="totalAmount"
                        name="totalAmount"
                        type="number"
                        step="0.01"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dueDate">Due Date</Label>
                      <Input id="dueDate" name="dueDate" type="date" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Input id="notes" name="notes" />
                    </div>
                    <Button type="submit" className="w-full">Create Invoice</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Paid Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>{invoice.patient?.full_name || 'Unknown'}</TableCell>
                    <TableCell>${Number(invoice.total_amount).toFixed(2)}</TableCell>
                    <TableCell>${Number(invoice.paid_amount).toFixed(2)}</TableCell>
                    <TableCell>
                      {format(new Date(invoice.invoice_date), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          invoice.status === 'Paid' ? 'default' :
                          invoice.status === 'Partially Paid' ? 'secondary' :
                          'destructive'
                        }
                      >
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {invoice.status !== 'Paid' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setPaymentDialogOpen(true);
                          }}
                        >
                          Record Payment
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Payment Dialog */}
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>
                Record payment for invoice {selectedInvoice?.invoice_number}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Payment Amount ($)</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  max={selectedInvoice ? Number(selectedInvoice.total_amount) - Number(selectedInvoice.paid_amount) : undefined}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select name="paymentMethod" required>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Card">Card</SelectItem>
                    <SelectItem value="Insurance">Insurance</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="referenceNumber">Reference Number</Label>
                <Input id="referenceNumber" name="referenceNumber" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" name="notes" />
              </div>
              <Button type="submit" className="w-full">Record Payment</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
