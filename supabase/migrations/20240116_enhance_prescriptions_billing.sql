-- Add columns to prescriptions table for cost tracking and billing
ALTER TABLE prescriptions 
ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS include_in_billing BOOLEAN DEFAULT true;

-- Add cash payment support to payments table (if not exists)
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS change_amount DECIMAL(10, 2) DEFAULT 0;

-- Update invoices table to support cash payments
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'Cash';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_prescriptions_include_billing ON prescriptions(include_in_billing);
CREATE INDEX IF NOT EXISTS idx_prescriptions_unit_price ON prescriptions(unit_price);

-- Add comment
COMMENT ON COLUMN prescriptions.unit_price IS 'Unit price of medication for billing purposes';
COMMENT ON COLUMN prescriptions.include_in_billing IS 'Whether this prescription should be included in patient billing';
COMMENT ON COLUMN payments.change_amount IS 'Change returned to patient for cash payments';
COMMENT ON COLUMN invoices.payment_method IS 'Payment method used (Cash, Mobile Money, Card, Insurance)';
