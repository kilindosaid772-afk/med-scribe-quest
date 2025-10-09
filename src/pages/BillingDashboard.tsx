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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DollarSign, CreditCard, AlertCircle, Loader2, Plus, Shield, Smartphone, Building2, Send } from 'lucide-react';
import { format } from 'date-fns';

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
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [mobilePaymentProcessing, setMobilePaymentProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch invoices with items
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select(`
          *,
          patient:patients(full_name, phone, insurance_company_id, insurance_policy_number),
          invoice_items(*)
        `)
        .order('invoice_date', { ascending: false })
        .limit(50);

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
          insurance_company:insurance_companies(name),
          invoice:invoices(invoice_number)
        `)
        .order('submission_date', { ascending: false });

      setInvoices(invoicesData || []);
      setPatients(patientsData || []);
      setInsuranceCompanies(insuranceData || []);
      setInsuranceClaims(claimsData || []);

      const unpaid = invoicesData?.filter(i => i.status === 'Unpaid').length || 0;
      const partiallyPaid = invoicesData?.filter(i => i.status === 'Partially Paid').length || 0;
      const totalRevenue = invoicesData
        ?.filter(i => i.status === 'Paid')
        .reduce((sum, i) => sum + Number(i.total_amount), 0) || 0;
      const pendingClaims = claimsData?.filter(c => c.status === 'Pending').length || 0;

      setStats({ unpaid, partiallyPaid, totalRevenue, pendingClaims });
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

  const handleInitiateMobilePayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const formData = new FormData(e.currentTarget);
    const phoneNumber = formData.get('phoneNumber') as string;
    const amount = Number(formData.get('amount'));

    setMobilePaymentProcessing(true);

    try {
      // Simulate mobile payment push request
      toast.info(`📱 Payment request sent to ${phoneNumber}. Waiting for confirmation...`);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Record the payment
      const paymentData = {
        invoice_id: selectedInvoice.id,
        amount,
        payment_method: paymentMethod,
        reference_number: `${paymentMethod.replace(/\s/g, '').toUpperCase()}-${Date.now()}`,
        notes: `Mobile payment via ${paymentMethod} from ${phoneNumber}`,
      };

      const { error: paymentError } = await supabase.from('payments').insert([paymentData]);
      if (paymentError) throw paymentError;

      const newPaidAmount = Number(selectedInvoice.paid_amount) + amount;
      const totalAmount = Number(selectedInvoice.total_amount);
      const newStatus = newPaidAmount >= totalAmount ? 'Paid' : newPaidAmount > 0 ? 'Partially Paid' : 'Unpaid';

      const { error: updateError } = await supabase
        .from('invoices')
        .update({ paid_amount: newPaidAmount, status: newStatus })
        .eq('id', selectedInvoice.id);

      if (updateError) throw updateError;

      toast.success('✅ Payment completed successfully!');
      setPaymentDialogOpen(false);
      setSelectedInvoice(null);
      setPaymentMethod('');
      fetchData();
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Failed to process mobile payment');
    } finally {
      setMobilePaymentProcessing(false);
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

    // If fully paid, complete the workflow
    if (newStatus === 'Paid') {
      const { data: visits } = await supabase
        .from('patient_visits')
        .select('*')
        .eq('patient_id', selectedInvoice.patient_id)
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
            current_stage: 'completed',
            overall_status: 'Completed'
          })
          .eq('id', visits[0].id);
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
                    <TableCell>TSh{Number(invoice.total_amount).toFixed(2)}</TableCell>
                    <TableCell>TSh{Number(invoice.paid_amount).toFixed(2)}</TableCell>
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
                        <TableCell>TSh{Number(claim.claim_amount).toFixed(2)}</TableCell>
                        <TableCell>TSh{Number(claim.approved_amount).toFixed(2)}</TableCell>
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

        {/* Payment Dialog */}
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
                              {item.quantity} × TSh{Number(item.unit_price).toFixed(2)} = TSh{Number(item.total_price).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>TSh{(Number(selectedInvoice.total_amount) - Number(selectedInvoice.tax || 0)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax (10%):</span>
                      <span>TSh{Number(selectedInvoice.tax || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-base">
                      <span>Total:</span>
                      <span>TSh{Number(selectedInvoice.total_amount).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Paid:</span>
                      <span>TSh{Number(selectedInvoice.paid_amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-green-600">
                      <span>Remaining:</span>
                      <span>TSh{(Number(selectedInvoice.total_amount) - Number(selectedInvoice.paid_amount || 0)).toFixed(2)}</span>
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
                  value={selectedInvoice ? (Number(selectedInvoice.total_amount) - Number(selectedInvoice.paid_amount || 0)).toFixed(2) : ''}
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
                patient_id: invoices.find(inv => inv.id === formData.get('invoiceId'))?.patient_id,
                claim_number: `CLM-${Date.now().toString().slice(-8)}`,
                claim_amount: Number(formData.get('claimAmount')),
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
                    {invoices.filter(inv => inv.patient?.insurance_company_id).map((invoice) => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {invoice.invoice_number} - {invoice.patient?.full_name}
                      </SelectItem>
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
                    {insuranceCompanies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name} ({company.coverage_percentage}% coverage)
                      </SelectItem>
                    ))}
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
