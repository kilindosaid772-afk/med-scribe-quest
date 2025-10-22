import { useState, useEffect, Fragment, useMemo, useCallback, memo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { mobilePaymentService, MobilePaymentRequest } from '@/lib/mobilePaymentService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Smartphone,
  Plus,
  Send,
  AlertCircle,
  CreditCard,
  Shield,
  DollarSign,
  File
} from 'lucide-react';

export default function BillingDashboard() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [insuranceCompanies, setInsuranceCompanies] = useState<any[]>([]);
  const [insuranceClaims, setInsuranceClaims] = useState<any[]>([]);
  const [stats, setStats] = useState({ unpaid: 0, partiallyPaid: 0, totalRevenue: 0, pendingClaims: 0 });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState<string>('');
  const [transactionId, setTransactionId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [mobilePaymentProcessing, setMobilePaymentProcessing] = useState<boolean>(false);

  // Store raw data for memoization
  const [rawInvoicesData, setRawInvoicesData] = useState<any[]>([]);
  const [rawPatientsData, setRawPatientsData] = useState<any[]>([]);
  const [rawInsuranceData, setRawInsuranceData] = useState<any[]>([]);
  const [rawClaimsData, setRawClaimsData] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  // Memoize expensive computations at component level
  const groupedPatients = useMemo(() => {
    if (!rawInvoicesData.length) return {};

    return rawInvoicesData.reduce((acc, invoice) => {
      const patientId = invoice.patient_id;
      if (!acc[patientId]) {
        acc[patientId] = {
          patient: invoice.patient,
          invoices: [],
          totalAmount: 0,
          totalPaid: 0,
          unpaidAmount: 0,
          invoiceCount: 0,
          latestInvoiceDate: invoice.invoice_date,
          status: 'Unpaid'
        };
      }
      acc[patientId].invoices.push(invoice);
      acc[patientId].totalAmount += Number(invoice.total_amount);
      acc[patientId].totalPaid += Number(invoice.paid_amount || 0);
      acc[patientId].invoiceCount += 1;

      if (new Date(invoice.invoice_date) > new Date(acc[patientId].latestInvoiceDate)) {
        acc[patientId].latestInvoiceDate = invoice.invoice_date;
      }

      return acc;
    }, {} as Record<string, any>);
  }, [rawInvoicesData]);

  const processedPatients = useMemo(() => {
    if (!Object.keys(groupedPatients).length) return [];

    const patientsArray = Object.values(groupedPatients);
    patientsArray.forEach((patient: any) => {
      patient.unpaidAmount = patient.totalAmount - patient.totalPaid;

      if (patient.totalPaid === 0) {
        patient.status = 'Unpaid';
      } else if (patient.totalPaid >= patient.totalAmount) {
        patient.status = 'Paid';
      } else {
        patient.status = 'Partially Paid';
      }
    });

    return patientsArray;
  }, [groupedPatients]);

  const calculatedStats = useMemo(() => {
    if (!processedPatients.length) {
      return { unpaid: 0, partiallyPaid: 0, totalRevenue: 0, pendingClaims: 0 };
    }

    const unpaid = processedPatients.filter((p: any) => p.status === 'Unpaid').length;
    const partiallyPaid = processedPatients.filter((p: any) => p.status === 'Partially Paid').length;

    const totalRevenue: number = processedPatients
      .filter((p: any) => p.totalPaid > 0)
      .reduce((sum: number, p: any) => {
        const paidAmount: number = typeof p.totalPaid === 'number' ? p.totalPaid : Number(p.totalPaid) || 0;
        return sum + paidAmount;
      }, 0);

    const pendingClaims: number = rawClaimsData?.filter(c => c.status === 'Pending').length || 0;

    return { unpaid, partiallyPaid, totalRevenue, pendingClaims };
  }, [processedPatients, rawClaimsData]);

  // Update state when memoized values change
  useEffect(() => {
    setInvoices(processedPatients);
    setStats(calculatedStats);
  }, [processedPatients, calculatedStats]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch invoices with patient details
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select(`
          *,
          patient:patients(full_name, phone, insurance_company_id, insurance_policy_number),
          invoice_items(*)
        `)
        .order('invoice_date', { ascending: false })
        .limit(100);

      // Fetch patients for invoice creation
      const { data: patientsData } = await supabase
        .from('patients')
        .select('id, full_name, insurance_company_id, insurance_policy_number')
        .eq('status', 'Active');

      // Fetch insurance companies
      const { data: insuranceData } = await supabase
        .from('insurance_companies')
        .select('*')
        .eq('status', 'Active');

      // Fetch insurance claims
      const { data: claimsData } = await supabase
        .from('insurance_claims')
        .select(`
          *,
          patient:patients(full_name),
          insurance_company:insurance_companies(name, coverage_percentage),
          invoice:invoices(invoice_number)
        `)
        .order('submission_date', { ascending: false });

      // Update raw data state to trigger memoized computations
      setRawInvoicesData(invoicesData || []);
      setRawPatientsData(patientsData || []);
      setRawInsuranceData(insuranceData || []);
      setRawClaimsData(claimsData || []);

      // Update other state with safety checks
      setPatients(patientsData || []);
      setInsuranceCompanies(insuranceData || []);
      setInsuranceClaims(claimsData || []);

      console.log('Billing Dashboard - Data loaded:', {
        invoices: invoicesData?.length || 0,
        patients: patientsData?.length || 0,
        insuranceCompanies: insuranceData?.length || 0,
        claims: claimsData?.length || 0
      });

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

  const handleInitiateMobilePayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const formData = new FormData(e.currentTarget);
    const phoneNumber = formData.get('phoneNumber') as string;
    const amount = Number(formData.get('amount'));

    setMobilePaymentProcessing(true);
    setPaymentStatus('processing');

    try {
      const paymentRequest: MobilePaymentRequest = {
        phoneNumber,
        amount,
        invoiceId: selectedInvoice.id,
        paymentMethod: paymentMethod as 'M-Pesa' | 'Airtel Money' | 'Tigo Pesa' | 'Halopesa',
        description: `Payment for invoice ${selectedInvoice.invoice_number}`
      };

      const response = await mobilePaymentService.initiatePayment(paymentRequest);

      if (response.success && response.transactionId) {
        setTransactionId(response.transactionId);
        setPaymentStatus('pending');

        toast.success(`📱 ${paymentMethod} payment request sent to ${phoneNumber}. Waiting for confirmation...`);

        // Create a pending payment record
        const paymentData = {
          invoice_id: selectedInvoice.id,
          amount,
          payment_method: paymentMethod,
          reference_number: response.transactionId,
          status: 'pending',
          notes: `Mobile payment via ${paymentMethod} from ${phoneNumber} - Transaction ID: ${response.transactionId}`,
        };

        const { error: paymentError } = await supabase.from('payments').insert([paymentData]);
        if (paymentError) {
          console.error('Failed to create pending payment record:', paymentError);
        }

        // Close dialog but keep status visible
        setPaymentDialogOpen(false);

        // Poll for payment status (in a real app, this would be handled via webhooks)
        setTimeout(() => checkPaymentStatus(response.transactionId), 5000);

      } else {
        setPaymentStatus('failed');
        toast.error(response.message || 'Failed to initiate mobile payment');
      }
    } catch (error) {
      console.error('Payment error:', error);
      setPaymentStatus('failed');
      toast.error('Failed to process mobile payment');
    } finally {
      setMobilePaymentProcessing(false);
    }
  };

  const checkPaymentStatus = async (transactionId: string) => {
    try {
      // In a real implementation, this would check the actual payment status
      // For now, we'll simulate checking the status
      const { data: paymentData } = await supabase
        .from('payments')
        .select('*')
        .eq('reference_number', transactionId)
        .single();

      if (paymentData && paymentData.status === 'completed') {
        setPaymentStatus('completed');
        toast.success('✅ Payment confirmed successfully!');

        // Update invoice status
        await updateInvoiceAfterPayment(paymentData.invoice_id, paymentData.amount);

        // Reset state after a delay
        setTimeout(() => {
          setPaymentStatus('');
          setTransactionId('');
          setSelectedInvoice(null);
          setPaymentMethod('');
          fetchData();
        }, 3000);
      } else if (paymentData && paymentData.status === 'failed') {
        setPaymentStatus('failed');
        toast.error('❌ Payment failed');
      } else {
        // Still pending, check again after a delay
        setTimeout(() => checkPaymentStatus(transactionId), 10000);
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
    }
  };

  const updateInvoiceAfterPayment = async (invoiceId: string, amount: number) => {
    try {
      const { data: invoice } = await supabase
        .from('invoices')
        .select('paid_amount, total_amount')
        .eq('id', invoiceId)
        .single();

      if (invoice) {
        const newPaidAmount = Number(invoice.paid_amount) + amount;
        const totalAmount = Number(invoice.total_amount);
        const newStatus = newPaidAmount >= totalAmount ? 'Paid' : newPaidAmount > 0 ? 'Partially Paid' : 'Unpaid';

        await supabase
          .from('invoices')
          .update({ paid_amount: newPaidAmount, status: newStatus })
          .eq('id', invoiceId);

        // If fully paid, move to discharge stage instead of completing
        if (newStatus === 'Paid') {
          const { data: visits } = await supabase
            .from('patient_visits')
            .select('*')
            .eq('patient_id', invoice.patient_id)
            .eq('current_stage', 'billing')
            .eq('overall_status', 'Active')
            .order('created_at', { ascending: false })
            .limit(1);

          if (visits && visits.length > 0) {
            await supabase
              .from('patient_visits')
              .update({
                billing_status: 'Paid',
                billing_completed_at: new Date().toISOString(),
                current_stage: 'discharge_ready',
                discharge_status: 'Pending'
              })
              .eq('id', visits[0].id);

            toast.success('Payment completed! Patient ready for discharge processing');
          }
        }
      }
    } catch (error) {
      console.error('Error updating invoice after payment:', error);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Handle mobile payments separately
    if (['M-Pesa', 'Airtel Money', 'Tigo Pesa', 'Halopesa'].includes(paymentMethod)) {
      return handleInitiateMobilePayment(e);
    }

    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));

    const paymentData = {
      invoice_id: selectedInvoice.id,
      amount,
      payment_method: paymentMethod,
      reference_number: formData.get('referenceNumber') as string || null,
      notes: formData.get('notes') as string || null,
      status: paymentMethod.includes('M-Pesa') || paymentMethod.includes('Airtel Money') || paymentMethod.includes('Tigo Pesa') || paymentMethod.includes('Halopesa') ? 'pending' : 'completed',
    };

    const { error } = await supabase.from('payments').insert([paymentData]);

    if (error) {
      toast.error('Failed to record payment');
      return;
    }

    const newPaidAmount = Number(selectedInvoice.paid_amount) + amount;
    const totalAmount = Number(selectedInvoice.total_amount);
    const newStatus = newPaidAmount >= totalAmount ? 'Paid' : newPaidAmount > 0 ? 'Partially Paid' : 'Unpaid';

    await supabase
      .from('invoices')
      .update({ paid_amount: newPaidAmount, status: newStatus })
      .eq('id', selectedInvoice.id);

    // If fully paid, move to discharge stage instead of completing
    if (newStatus === 'Paid') {
      const { data: visits } = await supabase
        .from('patient_visits')
        .select('*')
        .eq('patient_id', selectedInvoice?.patient_id)
        .eq('current_stage', 'billing')
        .eq('overall_status', 'Active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (visits && visits.length > 0) {
        await supabase
          .from('patient_visits')
          .update({
            billing_status: 'Paid',
            billing_completed_at: new Date().toISOString(),
            current_stage: 'discharge_ready',
            discharge_status: 'Pending'
          })
          .eq('id', visits[0].id);

        toast.success('Payment completed! Patient ready for discharge processing');
      }
    }

    toast.success('Payment recorded successfully');
    setPaymentDialogOpen(false);
    setSelectedInvoice(null);
    setPaymentMethod('');
    fetchData();
  };

  if (loading) {
    return (
      <DashboardLayout title="Billing Dashboard">
        <div className="space-y-8">
          {/* Stats Cards Skeleton */}
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-destructive/20 shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-24" />
                  <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-gray-200 rounded animate-pulse w-16" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tabs Skeleton */}
          <div className="space-y-4">
            <div className="grid w-full grid-cols-2 gap-2">
              <div className="h-10 bg-gray-200 rounded animate-pulse" />
              <div className="h-10 bg-gray-200 rounded animate-pulse" />
            </div>

            {/* Invoices Table Skeleton */}
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-6 bg-gray-200 rounded animate-pulse w-32" />
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-48" />
                  </div>
                  <div className="h-10 bg-gray-200 rounded animate-pulse w-32" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex space-x-4 pb-2 border-b">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="h-4 bg-gray-200 rounded animate-pulse flex-1" />
                    ))}
                  </div>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex space-x-4 py-2">
                      {Array.from({ length: 9 }).map((_, j) => (
                        <div key={j} className="h-4 bg-gray-200 rounded animate-pulse flex-1" />
                      ))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Billing Dashboard">
      <div className="space-y-8">
        {/* Payment Status Notification */}
        {paymentStatus && (
          <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm ${
            paymentStatus === 'completed' ? 'bg-green-100 border border-green-500' :
            paymentStatus === 'failed' ? 'bg-red-100 border border-red-500' :
            'bg-blue-100 border border-blue-500'
          }`}>
            <div className="flex items-center space-x-3">
              {paymentStatus === 'completed' && <CheckCircle className="h-6 w-6 text-green-600" />}
              {paymentStatus === 'failed' && <XCircle className="h-6 w-6 text-red-600" />}
              {paymentStatus === 'pending' && <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />}

              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  paymentStatus === 'completed' ? 'text-green-800' :
                  paymentStatus === 'failed' ? 'text-red-800' :
                  'text-blue-800'
                }`}>
                  {paymentStatus === 'completed' && 'Payment Completed!'}
                  {paymentStatus === 'failed' && 'Payment Failed'}
                  {paymentStatus === 'pending' && 'Payment Pending Confirmation'}
                </p>
                {transactionId && (
                  <p className={`text-xs mt-1 ${
                    paymentStatus === 'completed' ? 'text-green-600' :
                    paymentStatus === 'failed' ? 'text-red-600' :
                    'text-blue-600'
                  }`}>
                    Transaction ID: {transactionId.slice(-8)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
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

          <Card className="border-blue-200 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Claims</CardTitle>
              <Shield className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.pendingClaims}</div>
            </CardContent>
          </Card>

          <Card className="border-green-200 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                TSh{stats.totalRevenue.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content with Tabs */}
        <Tabs defaultValue="invoices" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="invoices">Invoices & Payments</TabsTrigger>
            <TabsTrigger value="insurance">Insurance Claims</TabsTrigger>
          </TabsList>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="space-y-4">
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Invoices</CardTitle>
                    <CardDescription>Manage patient invoices and payments</CardDescription>
                  </div>
                  <div className="flex gap-2">
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
                            <Label htmlFor="totalAmount">Total Amount (TSh)</Label>
                            <Input
                              id="totalAmount"
                              name="totalAmount"
                              type="number"
                              step="0.01"
                              placeholder="Enter amount or leave for default consultation fee"
                              defaultValue="50000"
                              required
                            />
                            <p className="text-xs text-muted-foreground">Default: TSh 50,000 (standard consultation)</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="dueDate">Due Date</Label>
                            <Input
                              id="dueDate"
                              name="dueDate"
                              type="date"
                              defaultValue={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                              required
                            />
                            <p className="text-xs text-muted-foreground">Auto-set to 30 days from today</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Input id="notes" name="notes" />
                          </div>
                          <Button type="submit" className="w-full">Create Invoice</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (patients.length === 0) {
                        toast.error('No patients available');
                        return;
                      }

                      const patientId = patients[0].id; // Use first patient as default
                      const totalAmount = 50000; // Default consultation fee
                      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                      const invoiceData = {
                        invoice_number: generateInvoiceNumber(),
                        patient_id: patientId,
                        total_amount: totalAmount,
                        due_date: dueDate,
                        notes: 'Quick invoice - Standard consultation'
                      };

                      const { error } = await supabase.from('invoices').insert([invoiceData]);

                      if (error) {
                        toast.error('Failed to create quick invoice');
                      } else {
                        toast.success('Quick invoice created successfully');
                        fetchData();
                      }
                    }}
                  >
                  </Button>
                </div>
              </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Paid Amount</TableHead>
                      <TableHead>Unpaid Amount</TableHead>
                      <TableHead>Invoice Count</TableHead>
                      <TableHead>Latest Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((patientData) => (
                      <TableRow key={patientData.patient.id}>
                        <TableCell className="font-medium">{patientData.patient.full_name}</TableCell>
                        <TableCell>{patientData.patient.phone}</TableCell>
                        <TableCell>TSh{Number(patientData.totalAmount as number).toFixed(2)}</TableCell>
                        <TableCell>TSh{Number(patientData.totalPaid as number).toFixed(2)}</TableCell>
                        <TableCell>TSh{Number(patientData.unpaidAmount as number).toFixed(2)}</TableCell>
                        <TableCell>{patientData.invoiceCount}</TableCell>
                        <TableCell>
                          {format(new Date(patientData.latestInvoiceDate), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              patientData.status === 'Paid' ? 'default' :
                              patientData.status === 'Partially Paid' ? 'secondary' :
                              'destructive'
                            }
                          >
                            {patientData.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {patientData.status !== 'Paid' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                // For now, select the first unpaid invoice for payment
                                const unpaidInvoice = patientData.invoices.find(inv => inv.status !== 'Paid');
                                if (unpaidInvoice) {
                                  setSelectedInvoice(unpaidInvoice);
                                  setPaymentDialogOpen(true);
                                }
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
          </TabsContent>

          {/* Insurance Claims Tab */}
          <TabsContent value="insurance" className="space-y-4">
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Insurance Claims</CardTitle>
                    <CardDescription>Manage insurance claims and approvals</CardDescription>
                  </div>
                  <Button onClick={() => setClaimDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Submit Claim
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Claim #</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Insurance</TableHead>
                      <TableHead>Claim Amount</TableHead>
                      <TableHead>Approved Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {insuranceClaims.map((claim) => (
                      <TableRow key={claim.id}>
                        <TableCell className="font-medium">{claim.claim_number}</TableCell>
                        <TableCell>{claim.patient?.full_name || 'Unknown'}</TableCell>
                        <TableCell>{claim.insurance_company?.name || 'N/A'}</TableCell>
                        <TableCell>TSh{Number(claim.claim_amount as number).toFixed(2)}</TableCell>
                        <TableCell>TSh{Number(claim.approved_amount as number).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              claim.status === 'Approved' ? 'default' :
                              claim.status === 'Pending' ? 'secondary' :
                              'destructive'
                            }
                          >
                            {claim.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(claim.submission_date), 'MMM dd, yyyy')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quick Actions */}
        <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common billing and discharge tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-2"
                  onClick={async () => {
                    if (patients.length === 0) {
                      toast.error('No patients available');
                      return;
                    }

                    const patientId = patients[0].id; // Use first patient as default
                    const totalAmount = 50000; // Default consultation fee
                    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                    const invoiceData = {
                      invoice_number: generateInvoiceNumber(),
                      patient_id: patientId,
                      total_amount: totalAmount,
                      due_date: dueDate,
                      notes: 'Quick invoice - Standard consultation'
                    };

                    const { error } = await supabase.from('invoices').insert([invoiceData]);

                    if (error) {
                      toast.error('Failed to create quick invoice');
                    } else {
                      toast.success('Quick invoice created successfully');
                      fetchData();
                    }
                  }}
                >
                  <Plus className="h-6 w-6" />
                  <span>⚡ Quick Invoice</span>
                  <span className="text-xs text-muted-foreground">Auto-fill defaults</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-2"
                  onClick={() => {
                    // Find patients with completed payments
                    const paidPatients = invoices.filter(p => p.status === 'Paid');
                    if (paidPatients.length === 0) {
                      toast.info('No patients with completed payments ready for discharge');
                    } else {
                      // Navigate to discharge page in same tab
                      window.location.href = '/discharge';
                    }
                  }}
                >
                  <CheckCircle className="h-6 w-6" />
                  <span>Process Discharge</span>
                  <span className="text-xs text-muted-foreground">For paid patients</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-2"
                  onClick={() => window.location.href = '/discharge'}
                >
                  <File className="h-6 w-6" />
                  <span>View Discharges</span>
                  <span className="text-xs text-muted-foreground">Recent discharges</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-2"
                  onClick={() => setClaimDialogOpen(true)}
                >
                  <Shield className="h-6 w-6" />
                  <span>Submit Claim</span>
                  <span className="text-xs text-muted-foreground">Insurance claims</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>
                Record payment for invoice {selectedInvoice?.invoice_number}
              </DialogDescription>
            </DialogHeader>

            {/* Invoice Details */}
            {selectedInvoice && (
              <div className="border rounded-lg p-4 mb-4 bg-gray-50">
                <h4 className="font-semibold mb-3">Invoice Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Patient:</span>
                    <span className="font-medium">{selectedInvoice.patient?.full_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Invoice Date:</span>
                    <span>{format(new Date(selectedInvoice.invoice_date), 'MMM dd, yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Due Date:</span>
                    <span>{format(new Date(selectedInvoice.due_date), 'MMM dd, yyyy')}</span>
                  </div>

                  {/* Invoice Items */}
                  {selectedInvoice.invoice_items && selectedInvoice.invoice_items.length > 0 && (
                    <div className="mt-4">
                      <h5 className="font-medium mb-2">Items:</h5>
                      <div className="space-y-1">
                        {selectedInvoice.invoice_items.map((item: any, index: number) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>{item.description}</span>
                            <span>
                              {item.quantity} × TSh{Number(item.unit_price as number).toFixed(2)} = TSh{Number(item.total_price as number).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold text-base">
                      <span>Total:</span>
                      <span>TSh{Number(selectedInvoice.total_amount as number).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Paid:</span>
                      <span>TSh{Number(selectedInvoice.paid_amount as number || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-green-600">
                      <span>Remaining:</span>
                      <span>TSh{(Number(selectedInvoice.total_amount as number) - Number(selectedInvoice.paid_amount as number || 0)).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Payment Amount (TSh)</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  value={selectedInvoice ? (Number(selectedInvoice.total_amount as number) - Number(selectedInvoice.paid_amount as number || 0)).toFixed(2) : ''}
                  readOnly
                  className="bg-gray-50"
                />
                <p className="text-sm text-muted-foreground">
                  Payment amount is automatically set to the remaining balance
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select name="paymentMethod" value={paymentMethod} onValueChange={setPaymentMethod} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">💵 Cash</SelectItem>
                    <SelectItem value="Card">💳 Debit/Credit Card</SelectItem>
                    <SelectItem value="M-Pesa">📱 M-Pesa</SelectItem>
                    <SelectItem value="Airtel Money">📱 Airtel Money</SelectItem>
                    <SelectItem value="Tigo Pesa">📱 Tigo Pesa</SelectItem>
                    <SelectItem value="Halopesa">📱 Halopesa</SelectItem>
                    <SelectItem value="Bank Transfer">🏦 Bank Transfer</SelectItem>
                    <SelectItem value="Cheque">📄 Cheque</SelectItem>
                    <SelectItem value="Insurance">🛡️ Insurance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Mobile Money Fields */}
              {['M-Pesa', 'Airtel Money', 'Tigo Pesa', 'Halopesa'].includes(paymentMethod) && (
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">
                    <Smartphone className="inline h-4 w-4 mr-1" />
                    Phone Number *
                  </Label>
                  <Input
                    id="phoneNumber"
                    name="phoneNumber"
                    placeholder="0712345678"
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    Customer will receive payment request on this number
                  </p>
                </div>
              )}

              {/* Bank Transfer Fields */}
              {paymentMethod === 'Bank Transfer' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="bankName">Bank Name</Label>
                    <Input id="bankName" name="bankName" placeholder="e.g., CRDB Bank" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountNumber">Account Number</Label>
                    <Input id="accountNumber" name="accountNumber" placeholder="Account number" required />
                  </div>
                </>
              )}

              {/* Cheque Fields */}
              {paymentMethod === 'Cheque' && (
                <div className="space-y-2">
                  <Label htmlFor="chequeNumber">Cheque Number</Label>
                  <Input id="chequeNumber" name="chequeNumber" placeholder="Cheque number" required />
                </div>
              )}

              {/* Insurance Fields */}
              {paymentMethod === 'Insurance' && (
                <div className="space-y-2">
                  <Label>Insurance Company</Label>
                  <Select name="insuranceCompanyId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select insurance company" />
                    </SelectTrigger>
                    <SelectContent>
                      {insuranceCompanies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name} ({company.coverage_percentage}% coverage)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {['M-Pesa', 'Airtel Money', 'Tigo Pesa', 'Halopesa'].includes(paymentMethod) ? (
                <Button type="submit" className="w-full" disabled={mobilePaymentProcessing}>
                  {mobilePaymentProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Payment Request
                    </>
                  )}
                </Button>
              ) : (
                <Button type="submit" className="w-full">Record Payment</Button>
              )}
            </form>
          </DialogContent>
        </Dialog>

        {/* Insurance Claim Dialog */}
        <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Submit Insurance Claim</DialogTitle>
              <DialogDescription>
                Submit a new insurance claim for an invoice
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);

              const claimData = {
                invoice_id: formData.get('invoiceId') as string,
                insurance_company_id: formData.get('insuranceCompanyId') as string,
                patient_id: invoices
                  .find(patientData => patientData.invoices.some(inv => inv.id === formData.get('invoiceId')))
                  ?.patient?.id,
                claim_number: `CLM-${Date.now().toString().slice(-8)}`,
                claim_amount: Number(formData.get('claimAmount') as string),
                notes: formData.get('notes') as string,
              };

              const { error } = await supabase.from('insurance_claims').insert([claimData]);

              if (error) {
                toast.error('Failed to submit claim');
              } else {
                toast.success('Insurance claim submitted successfully');
                setClaimDialogOpen(false);
                fetchData();
              }
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invoiceId">Invoice</Label>
                <Select name="invoiceId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    {invoices.filter(patientData => patientData.patient?.insurance_company_id && patientData.status !== 'Paid')
                      .map((patientData, index) => (
                        <Fragment key={index}>
                          {patientData.invoices
                            .filter(inv => inv.status !== 'Paid')
                            .map(invoice => (
                              <SelectItem key={invoice.id} value={invoice.id}>
                                {invoice.invoice_number} - {patientData.patient?.full_name || 'Unknown'} (TSh{Number(invoice.total_amount as number).toFixed(2)})
                              </SelectItem>
                            ))}
                        </Fragment>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="insuranceCompanyId">Insurance Company</Label>
                <Select name="insuranceCompanyId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select insurance company" />
                  </SelectTrigger>
                  <SelectContent>
                    {insuranceCompanies && insuranceCompanies.length > 0 ? (
                      insuranceCompanies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name} ({company.coverage_percentage || 100}% coverage)
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="" disabled>
                        No insurance companies available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="claimAmount">Claim Amount (TSh)</Label>
                <Input
                  id="claimAmount"
                  name="claimAmount"
                  type="number"
                  step="0.01"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={3} />
              </div>
              <Button type="submit" className="w-full">Submit Claim</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
