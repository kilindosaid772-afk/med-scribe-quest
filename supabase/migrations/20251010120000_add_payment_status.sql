-- Add status field to payments table for mobile money payment tracking
ALTER TABLE public.payments
ADD COLUMN status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled'));

-- Create index for payment status queries
CREATE INDEX idx_payments_status ON public.payments(status);

-- Update existing payments to have 'completed' status (since they were recorded as completed)
UPDATE public.payments SET status = 'completed' WHERE status IS NULL;
