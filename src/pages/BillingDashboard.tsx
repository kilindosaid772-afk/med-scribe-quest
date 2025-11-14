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
import { generateInvoiceNumber } from '@/lib/utils';
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
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<string>('');
  const [transactionId, setTransactionId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [mobilePaymentProcessing, setMobilePaymentProcessing] = useState<boolean>(false);
  const [rawInvoicesData, setRawInvoicesData] = useState<any[]>([]);
  const [rawPatientsData, setRawPatientsData] = useState<any[]>([]);
  const [rawInsuranceData, setRawInsuranceData] = useState<any[]>([]);
  const [rawClaimsData, setRawClaimsData] = useState<any[]>([]);
  const [patientServices, setPatientServices] = useState<any[]>([]);
  const [patientCosts, setPatientCosts] = useState<Record<string, number>>({});
  const [billingVisits, setBillingVisits] = useState<any[]>([]);

  useEffect(() => {
    fetchData();

    // Set up real-time subscription for invoices and patient visits
    const invoicesChannel = supabase
      .channel('billing_invoices_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'invoices' },
        (payload) => {
          console.log('Invoice change detected:', payload);
          fetchData(); // Refresh data when invoices change
        }
      )
      .subscribe();

    const visitsChannel = supabase
      .channel('billing_visits_changes')
      .on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'patient_visits',
          filter: 'current_stage=eq.billing'
        },
        (payload) => {
          console.log('Patient visit change detected:', payload);
          fetchData(); // Refresh when patients move to billing
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(invoicesChannel);
      supabase.removeChannel(visitsChannel);
    };
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

    let totalRevenue = 0;
    processedPatients
      .filter((p: any) => p.totalPaid > 0)
      .forEach((p: any) => {
        const paidAmount = typeof p.totalPaid === 'number' ? p.totalPaid : Number(p.totalPaid) || 0;
        totalRevenue += paidAmount;
      });

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

      // Fetch patient visits waiting for billing (from pharmacy)
      const { data: billingVisitsData, error: visitsError } = await supabase
        .from('patient_visits')
        .select(`
          *,
          patient:patients(id, full_name, phone, insurance_company_id, insurance_policy_number)
        `)
        .eq('current_stage', 'billing')
        .eq('overall_status', 'Active')
        .neq('billing_status', 'Paid')
        .order('pharmacy_completed_at', { ascending: true });

      if (visitsError) {
        console.error('Error fetching billing visits:', visitsError);
      }

      console.log('Billing visits from pharmacy:', billingVisitsData?.length || 0);

      // Fetch invoices with patient details
      // Filter to show only unpaid and partially paid invoices by default
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select(`
          *,
          patient:patients(full_name, phone, insurance_company_id, insurance_policy_number),
          invoice_items(*)
        `)
        .in('status', ['Unpaid', 'Partially Paid'])
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

      // Fetch patient services for cost calculations
      const { data: servicesData } = await supabase
        .from('patient_services')
        .select(`
          *,
          service:medical_services(*)
        `)
        .eq('status', 'Completed');

      // Update raw data state to trigger memoized computations
      setRawInvoicesData(invoicesData || []);
      setRawPatientsData(patientsData || []);
      setRawInsuranceData(insuranceData || []);
      setRawClaimsData(claimsData || []);
      setPatientServices(servicesData || []);

      // Calculate patient costs
      const costs: Record<string, number> = {};
      if (patientsData) {
        for (const patient of patientsData) {
          try {
            const { data: costData } = await supabase.rpc('calculate_patient_total_cost', {
              _patient_id: patient.id
            });
            costs[patient.id] = costData || 0;
          } catch (error) {
            console.error(`Error calculating cost for patient ${patient.id}:`, error);
            costs[patient.id] = 0;
          }
        }
      }
      setPatientCosts(costs);

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

  const handleOpenPaymentDialog = (invoice: any) => {
    setSelectedInvoice(invoice);
    setPaymentMethod('');
    setPaymentStatus('');
    setTransactionId('');
    setMobilePaymentProcessing(false);
    setPaymentDialogOpen(true);
  };

  const handleCreateInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (!selectedPatientId) {
      toast.error('Please select a patient');
      return;
    }

    const calculatedCost = patientCosts[selectedPatientId] || 50000; // Fallback to default if no services

    const invoiceNumber = await generateInvoiceNumber();

    const invoiceData = {
      invoice_number: invoiceNumber,
      patient_id: selectedPatientId,
      total_amount: calculatedCost,
      paid_amount: 0,
      discount: 0,
      tax: 0,
      status: 'Unpaid',
      due_date: formData.get('dueDate') as string || null,
      invoice_date: new Date().toISOString(),
      notes: formData.get('notes') as string || `Invoice based on medical services - Total: TSh${calculatedCost.toFixed(2)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: createdInvoice, error } = await supabase
      .from('invoices')
      .insert([invoiceData])
      .select()
      .single();

    if (error) {
      console.error('Error creating invoice:', error);
      toast.error(`Failed to create invoice: ${error.message}`);
    } else {
      console.log('Invoice created successfully:', createdInvoice);
      toast.success(`Invoice ${createdInvoice.invoice_number} created for TSh${calculatedCost.toFixed(2)}`);
      setDialogOpen(false);
      setSelectedPatientId('');
      
      // Wait a moment then refresh to ensure data is committed
      setTimeout(() => {
        fetchData();
      }, 500);
    }
  };

  const handleInitiateMobilePayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const formData = new FormData(e.currentTarget);
    const phoneNumber = formData.get('phoneNumber') as string;
    const amount = Number(formData.get('amount'));

    // Validate amount
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    const maxAmount = Number(selectedInvoice.total_amount as number) - Number(selectedInvoice.paid_amount as number || 0);
    if (amount > maxAmount) {
      toast.error(`Payment amount cannot exceed remaining balance of TSh${maxAmount.toFixed(2)}`);
      return;
    }

    // Validate phone number format for Tanzania
    const phoneRegex = /^0[67][0-9]{8}$/;
    if (!phoneRegex.test(phoneNumber)) {
      toast.error('Please enter a valid Tanzanian phone number (07xxxxxxxx or 06xxxxxxxx)');
      return;
    }

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

        // If fully paid, complete the visit
        if (newStatus === 'Paid') {
          const { data: invoice_with_patient } = await supabase
            .from('invoices')
            .select('patient_id')
            .eq('id', invoiceId)
            .single();

          if (invoice_with_patient) {
            const { data: visits } = await supabase
              .from('patient_visits')
              .select('*')
              .eq('patient_id', invoice_with_patient.patient_id)
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
                  overall_status: 'Completed',
                  updated_at: new Date().toISOString()
                })
                .eq('id', visits[0].id);

              console.log('Patient visit completed and removed from billing queue');
            }
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

    // Validate amount
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    if (!selectedInvoice) {
      toast.error('No invoice selected');
      return;
    }

    const maxAmount = Number(selectedInvoice.total_amount as number) - Number(selectedInvoice.paid_amount as number || 0);
    if (amount > maxAmount) {
      toast.error(`Payment amount cannot exceed remaining balance of TSh${maxAmount.toFixed(2)}`);
      return;
    }

    const paymentData = {
      invoice_id: selectedInvoice.id,
      amount,
      payment_method: paymentMethod,
      reference_number: formData.get('referenceNumber') as string || null,
      notes: formData.get('notes') as string || null,
      status: 'completed',
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

    // If fully paid, complete the visit
    if (newStatus === 'Paid') {
      console.log('Payment fully completed, updating patient visit...', {
        patient_id: selectedInvoice?.patient_id,
        invoice_id: selectedInvoice?.id
      });

      if (!selectedInvoice?.patient_id) {
        console.error('No patient_id found on invoice');
        toast.warning('Payment recorded but could not update patient visit - no patient ID');
      } else {
        // First, try to find visit in billing stage
        let { data: visits, error: visitError } = await supabase
          .from('patient_visits')
          .select('*')
          .eq('patient_id', selectedInvoice.patient_id)
          .eq('current_stage', 'billing')
          .eq('overall_status', 'Active')
          .order('created_at', { ascending: false })
          .limit(1);

        if (visitError) {
          console.error('Error fetching patient visit:', visitError);
        }

        console.log('Found visits in billing stage:', visits?.length || 0);

        // If no visit in billing, try to find ANY active visit for this patient
        if (!visits || visits.length === 0) {
          console.log('No visit in billing stage, checking for any active visit...');
          const { data: anyVisits } = await supabase
            .from('patient_visits')
            .select('*')
            .eq('patient_id', selectedInvoice.patient_id)
            .eq('overall_status', 'Active')
            .order('created_at', { ascending: false })
            .limit(1);
          
          console.log('Found any active visits:', anyVisits?.length || 0, anyVisits?.[0]?.current_stage);
          
          // Use the active visit even if not in billing stage
          if (anyVisits && anyVisits.length > 0) {
            visits = anyVisits;
            console.log('Using active visit from stage:', anyVisits[0].current_stage);
          }
        }

        if (visits && visits.length > 0) {
          const { error: updateError } = await supabase
            .from('patient_visits')
            .update({
              billing_status: 'Paid',
              billing_completed_at: new Date().toISOString(),
              current_stage: 'completed',
              overall_status: 'Completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', visits[0].id);

          if (updateError) {
            console.error('Error updating patient visit:', updateError);
            toast.error(`Failed to update patient visit: ${updateError.message}`);
          } else {
            console.log('Patient visit completed and removed from billing queue');
            toast.success('Payment completed! Patient visit finished.');
          }
        } else {
          console.warn('No active patient visit found - creating completed visit record');
          
          // Create a completed visit record for this payment
          const { error: createError } = await supabase
            .from('patient_visits')
            .insert([{
              patient_id: selectedInvoice.patient_id,
              visit_date: new Date().toISOString(),
              reception_status: 'Completed',
              nurse_status: 'Completed',
              doctor_status: 'Completed',
              lab_status: 'Not Required',
              pharmacy_status: 'Completed',
              billing_status: 'Paid',
              billing_completed_at: new Date().toISOString(),
              current_stage: 'completed',
              overall_status: 'Completed',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }]);
          
          if (createError) {
            console.error('Error creating visit record:', createError);
            toast.warning('Payment recorded successfully (no visit record created)');
          } else {
            console.log('Created completed visit record for payment');
            toast.success('Payment completed successfully!');
          }
        }
      }
    }

    toast.success(`Payment of TSh${amount.toFixed(2)} recorded successfully`);
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
          <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm animate-in slide-in-from-right-2 ${
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
                  {paymentStatus === 'completed' && '✅ Payment Completed Successfully!'}
                  {paymentStatus === 'failed' && '❌ Payment Failed'}
                  {paymentStatus === 'pending' && '⏳ Payment Request Sent - Waiting for Confirmation'}
                  {paymentStatus === 'processing' && '🔄 Processing Payment...'}
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
                {paymentStatus === 'pending' && (
                  <p className="text-xs text-blue-600 mt-1">
                    Customer will receive payment request on their phone
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                </div>
              </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[120px]">Patient</TableHead>
                        <TableHead className="min-w-[100px]">Phone</TableHead>
                        <TableHead className="min-w-[120px]">Calculated Cost</TableHead>
                        <TableHead className="min-w-[100px]">Total Amount</TableHead>
                        <TableHead className="min-w-[100px]">Paid Amount</TableHead>
                        <TableHead className="min-w-[100px]">Unpaid Amount</TableHead>
                        <TableHead className="min-w-[80px]">Invoice Count</TableHead>
                        <TableHead className="min-w-[100px]">Latest Date</TableHead>
                        <TableHead className="min-w-[80px]">Status</TableHead>
                        <TableHead className="min-w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((patientData) => (
                        <TableRow key={patientData.patient.id}>
                          <TableCell className="font-medium">{patientData.patient.full_name}</TableCell>
                          <TableCell className="text-sm">{patientData.patient.phone}</TableCell>
                          <TableCell className="font-semibold text-blue-600">
                            TSh{(patientCosts[patientData.patient.id] || 0).toFixed(2)}
                          </TableCell>
                          <TableCell>TSh{Number(patientData.totalAmount as number).toFixed(2)}</TableCell>
                          <TableCell>TSh{Number(patientData.totalPaid as number).toFixed(2)}</TableCell>
                          <TableCell>TSh{Number(patientData.unpaidAmount as number).toFixed(2)}</TableCell>
                          <TableCell>{patientData.invoiceCount}</TableCell>
                          <TableCell className="text-sm">
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
                            {(patientData.status === 'Unpaid' || patientData.status === 'Partially Paid') && (
                              <Button
                                size="sm"
                                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white border-0 shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                                onClick={() => {
                                  // For now, select the first unpaid invoice for payment
                                  const unpaidInvoice = patientData.invoices.find(inv => inv.status !== 'Paid');
                                  if (unpaidInvoice) {
                                    handleOpenPaymentDialog(unpaidInvoice);
                                  }
                                }}
                              >
                                <CreditCard className="mr-1 h-3 w-3" />
                                Pay Now
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
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
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[100px]">Claim #</TableHead>
                        <TableHead className="min-w-[120px]">Patient</TableHead>
                        <TableHead className="min-w-[120px]">Insurance</TableHead>
                        <TableHead className="min-w-[120px]">Claim Amount</TableHead>
                        <TableHead className="min-w-[120px]">Approved Amount</TableHead>
                        <TableHead className="min-w-[80px]">Status</TableHead>
                        <TableHead className="min-w-[100px]">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {insuranceClaims.map((claim) => (
                        <TableRow key={claim.id}>
                          <TableCell className="font-medium">{claim.claim_number}</TableCell>
                          <TableCell className="text-sm">{claim.patient?.full_name || 'Unknown'}</TableCell>
                          <TableCell className="text-sm">{claim.insurance_company?.name || 'N/A'}</TableCell>
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
                          <TableCell className="text-sm">
                            {format(new Date(claim.submission_date), 'MMM dd, yyyy')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={paymentDialogOpen} onOpenChange={(open) => {
          setPaymentDialogOpen(open);
          if (!open) {
            // Reset form state when dialog closes
            setPaymentStatus('');
            setTransactionId('');
            setPaymentMethod('');
            setMobilePaymentProcessing(false);
          }
        }}>
          <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
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
                          <div key={item.id || index} className="flex justify-between text-sm">
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
              {/* Form validation helper */}
              {(() => {
                const form = document.querySelector('form');
                const isFormValid = form?.checkValidity();
                return !isFormValid ? (
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-red-600">⚠️ Please fill in all required fields</p>
                  </div>
                ) : null;
              })()}

              <div className="space-y-2">
                <Label htmlFor="amount">Payment Amount (TSh)</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedInvoice ? Number(selectedInvoice.total_amount as number) - Number(selectedInvoice.paid_amount as number || 0) : undefined}
                  defaultValue={selectedInvoice ? (Number(selectedInvoice.total_amount as number) - Number(selectedInvoice.paid_amount as number || 0)).toFixed(2) : ''}
                  className={`bg-white ${selectedInvoice ? 'border-green-300 focus:border-green-500' : 'border-red-300'}`}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  💰 Enter payment amount (max: TSh{selectedInvoice ? (Number(selectedInvoice.total_amount as number) - Number(selectedInvoice.paid_amount as number || 0)).toFixed(2) : '0.00'})
                </p>
                {selectedInvoice && (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-green-700">Remaining Balance:</span>
                      <span className="font-semibold text-green-800">
                        TSh{(Number(selectedInvoice.total_amount as number) - Number(selectedInvoice.paid_amount as number || 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select name="paymentMethod" value={paymentMethod} onValueChange={setPaymentMethod} required>
                  <SelectTrigger className={paymentMethod ? 'border-green-500' : 'border-red-500'}>
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
                {!paymentMethod && (
                  <p className="text-sm text-red-600">Please select a payment method</p>
                )}
              </div>

              {/* Mobile Money Fields */}
              {['M-Pesa', 'Airtel Money', 'Tigo Pesa', 'Halopesa'].includes(paymentMethod) && (
                <div className="space-y-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-blue-600" />
                    <Label htmlFor="phoneNumber" className="text-blue-800 font-medium">
                      Phone Number *
                    </Label>
                  </div>
                  <Input
                    id="phoneNumber"
                    name="phoneNumber"
                    placeholder="0712345678"
                    pattern="^0[67][0-9]{8}$"
                    title="Please enter a valid Tanzanian phone number (07xxxxxxxx or 06xxxxxxxx)"
                    className="border-blue-300 focus:border-blue-500"
                    required
                  />
                  <p className="text-sm text-blue-600">
                    💡 Customer will receive payment request on this number
                  </p>
                  <p className="text-xs text-blue-500">
                    Format: 07xxxxxxxx or 06xxxxxxxx
                  </p>
                </div>
              )}

              {/* Bank Transfer Fields */}
              {paymentMethod === 'Bank Transfer' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bankName">Bank Name</Label>
                    <Input id="bankName" name="bankName" placeholder="e.g., CRDB Bank" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountNumber">Account Number</Label>
                    <Input id="accountNumber" name="accountNumber" placeholder="Account number" required />
                  </div>
                </div>
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

              {/* Mobile Payment Button */}
              {['M-Pesa', 'Airtel Money', 'Tigo Pesa', 'Halopesa'].includes(paymentMethod) ? (
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                  disabled={mobilePaymentProcessing || !paymentMethod || !selectedInvoice}
                >
                  {mobilePaymentProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing Payment...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Payment Request
                    </>
                  )}
                </Button>
              ) : (
                /* Regular Payment Button */
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                  disabled={!paymentMethod || !selectedInvoice}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Record Payment
                </Button>
              )}
            </form>
          </DialogContent>
        </Dialog>

        {/* Insurance Claim Dialog */}
        <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
          <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
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
                        <Fragment key={patientData.patient.id || index}>
                          {patientData.invoices
                            .filter(inv => inv.status !== 'Paid')
                            .map(invoice => (
                              <SelectItem key={invoice.id} value={invoice.id}>
                                {invoice.invoice_number} - {patientData.patient?.full_name || 'Unknown'} (TSh{Number(invoice.total_amount).toFixed(2)})
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
