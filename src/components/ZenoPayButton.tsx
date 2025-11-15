import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { zenoPay, type PaymentRequest } from '@/lib/zenopay';
import { toast } from 'sonner';

interface ZenoPayButtonProps {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency?: string;
  patientName: string;
  patientEmail?: string;
  patientPhone?: string;
  onSuccess: (transactionId: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

export function ZenoPayButton({
  invoiceId,
  invoiceNumber,
  amount,
  currency = 'USD',
  patientName,
  patientEmail,
  patientPhone,
  onSuccess,
  onError,
  disabled = false,
}: ZenoPayButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');
  const [transactionId, setTransactionId] = useState<string>('');

  const handlePayment = async () => {
    setLoading(true);
    setShowDialog(true);
    setPaymentStatus('processing');

    try {
      // Prepare payment request
      const paymentRequest: PaymentRequest = {
        amount,
        currency,
        reference: invoiceNumber,
        description: `Hospital Invoice Payment - ${invoiceNumber}`,
        customerName: patientName,
        customerEmail: patientEmail,
        customerPhone: patientPhone,
        callbackUrl: import.meta.env.VITE_ZENOPAY_CALLBACK_URL,
        returnUrl: import.meta.env.VITE_ZENOPAY_RETURN_URL || window.location.origin + '/billing/payment-success',
      };

      // Initiate payment
      const result = await zenoPay.initiatePayment(paymentRequest);

      if (result.success && result.paymentUrl) {
        // Store transaction ID for verification
        if (result.transactionId) {
          setTransactionId(result.transactionId);
          // Store in localStorage for verification after redirect
          localStorage.setItem('pending_payment', JSON.stringify({
            transactionId: result.transactionId,
            reference: invoiceNumber,
            invoiceId,
            timestamp: Date.now(),
          }));
        }

        // Redirect to ZenoPay payment page
        toast.info('Redirecting to payment page...');
        setTimeout(() => {
          window.location.href = result.paymentUrl!;
        }, 1000);
      } else {
        // Payment initiation failed
        setPaymentStatus('failed');
        const errorMsg = result.error || 'Failed to initiate payment';
        toast.error(errorMsg);
        if (onError) onError(errorMsg);
        setLoading(false);
      }
    } catch (error) {
      setPaymentStatus('failed');
      const errorMsg = error instanceof Error ? error.message : 'Payment error occurred';
      toast.error(errorMsg);
      if (onError) onError(errorMsg);
      setLoading(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!transactionId) return;

    setLoading(true);
    try {
      const verification = await zenoPay.verifyPayment(invoiceNumber);

      if (verification.success && verification.status === 'success') {
        setPaymentStatus('success');
        toast.success('Payment verified successfully!');
        onSuccess(verification.transactionId);
      } else {
        setPaymentStatus('failed');
        toast.error(`Payment ${verification.status}: ${verification.message || 'Please try again'}`);
      }
    } catch (error) {
      setPaymentStatus('failed');
      toast.error('Failed to verify payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={handlePayment}
        disabled={disabled || loading}
        className="flex items-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4" />
            Pay with ZenoPay
          </>
        )}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {paymentStatus === 'processing' && (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  Processing Payment
                </>
              )}
              {paymentStatus === 'success' && (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Payment Successful
                </>
              )}
              {paymentStatus === 'failed' && (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  Payment Failed
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {paymentStatus === 'processing' && 'Redirecting to ZenoPay payment page...'}
              {paymentStatus === 'success' && 'Your payment has been processed successfully.'}
              {paymentStatus === 'failed' && 'There was an issue processing your payment.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Invoice</p>
                <p className="font-semibold">{invoiceNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="font-semibold text-lg">{currency} {amount.toFixed(2)}</p>
              </div>
            </div>

            {paymentStatus === 'processing' && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <p className="text-sm text-blue-800">
                  Please complete the payment on the ZenoPay page. You will be redirected back after payment.
                </p>
              </div>
            )}

            {paymentStatus === 'success' && transactionId && (
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                  <span className="text-sm text-green-800">Transaction ID:</span>
                  <Badge variant="outline" className="bg-green-100 text-green-800">
                    {transactionId}
                  </Badge>
                </div>
              </div>
            )}

            {paymentStatus === 'failed' && (
              <div className="flex flex-col gap-2">
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    The payment could not be completed. Please try again or contact support.
                  </p>
                </div>
                <Button onClick={handlePayment} variant="outline" className="w-full">
                  Try Again
                </Button>
              </div>
            )}

            {transactionId && paymentStatus === 'processing' && (
              <Button onClick={handleVerifyPayment} variant="outline" className="w-full">
                Verify Payment Status
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
