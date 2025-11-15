import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Loader2, XCircle, ArrowLeft, Download } from 'lucide-react';
import { zenoPay } from '@/lib/zenopay';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logActivity } from '@/lib/utils';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'failed' | 'pending'>('pending');
  const [paymentDetails, setPaymentDetails] = useState<any>(null);

  useEffect(() => {
    verifyPayment();
  }, []);

  const verifyPayment = async () => {
    try {
      // Get reference from URL params or localStorage
      const reference = searchParams.get('reference');
      const storedPayment = localStorage.getItem('pending_payment');
      
      let paymentInfo = null;
      if (storedPayment) {
        paymentInfo = JSON.parse(storedPayment);
      }

      const paymentRef = reference || paymentInfo?.reference;

      if (!paymentRef) {
        toast.error('No payment reference found');
        setPaymentStatus('failed');
        setVerifying(false);
        return;
      }

      // Verify payment with ZenoPay
      const verification = await zenoPay.verifyPayment(paymentRef);

      if (verification.success && verification.status === 'success') {
        setPaymentStatus('success');
        setPaymentDetails(verification);

        // Update invoice and payment in database
        if (paymentInfo?.invoiceId) {
          await updatePaymentInDatabase(
            paymentInfo.invoiceId,
            verification.transactionId,
            verification.amount
          );
        }

        // Clear stored payment info
        localStorage.removeItem('pending_payment');
        
        toast.success('Payment verified successfully!');
      } else {
        setPaymentStatus(verification.status === 'pending' ? 'pending' : 'failed');
        setPaymentDetails(verification);
        
        if (verification.status === 'failed') {
          toast.error('Payment verification failed');
        } else if (verification.status === 'pending') {
          toast.info('Payment is still processing');
        }
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      setPaymentStatus('failed');
      toast.error('Failed to verify payment');
    } finally {
      setVerifying(false);
    }
  };

  const updatePaymentInDatabase = async (
    invoiceId: string,
    transactionId: string,
    amount: number
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Get invoice details
      const { data: invoice } = await supabase
        .from('invoices')
        .select('*, patient:patients(full_name)')
        .eq('id', invoiceId)
        .single();

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Create payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          invoice_id: invoiceId,
          amount: amount,
          payment_method: 'ZenoPay',
          payment_date: new Date().toISOString(),
          transaction_id: transactionId,
          status: 'completed',
          received_by: user?.id,
        });

      if (paymentError) throw paymentError;

      // Update invoice status
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          status: 'Paid',
          paid_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (invoiceError) throw invoiceError;

      // Log activity
      await logActivity('billing.payment.received', {
        invoice_id: invoiceId,
        patient_id: invoice.patient_id,
        amount: amount,
        payment_method: 'ZenoPay',
        transaction_id: transactionId,
        invoice_number: invoice.invoice_number,
      });

      console.log('Payment recorded successfully');
    } catch (error) {
      console.error('Error updating payment in database:', error);
      toast.error('Payment verified but failed to update records');
    }
  };

  const handleDownloadReceipt = () => {
    // Implement receipt download logic
    toast.info('Receipt download feature coming soon');
  };

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <Loader2 className="h-16 w-16 animate-spin text-blue-600" />
              <h2 className="text-xl font-semibold">Verifying Payment...</h2>
              <p className="text-sm text-muted-foreground text-center">
                Please wait while we confirm your payment with ZenoPay
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex flex-col items-center space-y-4">
            {paymentStatus === 'success' && (
              <>
                <div className="rounded-full bg-green-100 p-3">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
                <CardTitle className="text-2xl text-center">Payment Successful!</CardTitle>
                <CardDescription className="text-center">
                  Your payment has been processed successfully
                </CardDescription>
              </>
            )}
            
            {paymentStatus === 'pending' && (
              <>
                <div className="rounded-full bg-yellow-100 p-3">
                  <Loader2 className="h-12 w-12 text-yellow-600 animate-spin" />
                </div>
                <CardTitle className="text-2xl text-center">Payment Pending</CardTitle>
                <CardDescription className="text-center">
                  Your payment is being processed
                </CardDescription>
              </>
            )}
            
            {paymentStatus === 'failed' && (
              <>
                <div className="rounded-full bg-red-100 p-3">
                  <XCircle className="h-12 w-12 text-red-600" />
                </div>
                <CardTitle className="text-2xl text-center">Payment Failed</CardTitle>
                <CardDescription className="text-center">
                  There was an issue processing your payment
                </CardDescription>
              </>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {paymentDetails && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge 
                  variant={
                    paymentStatus === 'success' ? 'default' : 
                    paymentStatus === 'pending' ? 'secondary' : 
                    'destructive'
                  }
                >
                  {paymentStatus.toUpperCase()}
                </Badge>
              </div>

              {paymentDetails.transactionId && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm text-muted-foreground">Transaction ID</span>
                  <span className="text-sm font-mono">{paymentDetails.transactionId}</span>
                </div>
              )}

              {paymentDetails.reference && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm text-muted-foreground">Reference</span>
                  <span className="text-sm font-semibold">{paymentDetails.reference}</span>
                </div>
              )}

              {paymentDetails.amount && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="text-lg font-bold">
                    {paymentDetails.currency} {paymentDetails.amount.toFixed(2)}
                  </span>
                </div>
              )}

              {paymentDetails.paidAt && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm text-muted-foreground">Paid At</span>
                  <span className="text-sm">
                    {new Date(paymentDetails.paidAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {paymentStatus === 'success' && (
              <Button onClick={handleDownloadReceipt} variant="outline" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download Receipt
              </Button>
            )}

            {paymentStatus === 'pending' && (
              <Button onClick={verifyPayment} variant="outline" className="w-full">
                <Loader2 className="h-4 w-4 mr-2" />
                Check Status Again
              </Button>
            )}

            <Button 
              onClick={() => navigate('/billing')} 
              className="w-full"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Billing
            </Button>
          </div>

          {paymentStatus === 'failed' && paymentDetails?.message && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{paymentDetails.message}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
