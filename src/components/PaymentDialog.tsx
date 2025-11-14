import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: any;
  onPaymentComplete: (appointmentId: string) => void;
}

export function PaymentDialog({ open, onOpenChange, appointment, onPaymentComplete }: PaymentDialogProps) {
  const [consultationFee, setConsultationFee] = useState(2000);
  const [paymentForm, setPaymentForm] = useState({
    amount_paid: '2000',
    payment_method: 'Cash'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchConsultationFee();
  }, []);

  useEffect(() => {
    if (consultationFee) {
      setPaymentForm(prev => ({ ...prev, amount_paid: consultationFee.toString() }));
    }
  }, [consultationFee]);

  const fetchConsultationFee = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'consultation_fee')
        .single();

      if (!error && data) {
        setConsultationFee(Number(data.value));
      }
    } catch (error) {
      console.log('Using default consultation fee');
    }
  };

  const handleSubmit = async () => {
    if (!appointment) return;

    const amountPaid = Number(paymentForm.amount_paid);
    if (isNaN(amountPaid) || amountPaid < consultationFee) {
      toast.error(`Payment must be at least TSh ${consultationFee}`);
      return;
    }

    setLoading(true);
    try {
      // Create payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          patient_id: appointment.patient?.id || appointment.patient_id,
          amount: amountPaid,
          payment_method: paymentForm.payment_method,
          payment_type: 'Consultation Fee',
          status: 'Completed',
          payment_date: new Date().toISOString()
        });

      if (paymentError) throw paymentError;

      toast.success(`Payment of TSh ${amountPaid} received`);
      onPaymentComplete(appointment.id);
      onOpenChange(false);
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Failed to process payment');
    } finally {
      setLoading(false);
    }
  };

  const change = Number(paymentForm.amount_paid) - consultationFee;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Collect Consultation Fee</DialogTitle>
          <DialogDescription>
            Patient: {appointment?.patient?.full_name || 'Unknown'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex justify-between items-center">
              <span className="font-medium">Consultation Fee:</span>
              <span className="text-2xl font-bold text-blue-600">TSh {consultationFee.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_method">Payment Method</Label>
            <Select
              value={paymentForm.payment_method}
              onValueChange={(value) => setPaymentForm({ ...paymentForm, payment_method: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                <SelectItem value="Card">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount_paid">Amount Paid</Label>
            <Input
              id="amount_paid"
              type="number"
              value={paymentForm.amount_paid}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount_paid: e.target.value })}
              placeholder="Enter amount"
            />
          </div>

          {change > 0 && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex justify-between items-center">
                <span className="font-medium text-green-800">Change to Return:</span>
                <span className="text-xl font-bold text-green-600">TSh {change.toLocaleString()}</span>
              </div>
            </div>
          )}

          {change < 0 && (
            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
              <span className="text-sm text-red-600">Insufficient payment amount</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || change < 0}>
              {loading ? 'Processing...' : 'Confirm Payment & Check In'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
