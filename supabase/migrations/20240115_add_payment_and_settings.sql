-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash',
  payment_type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Completed',
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default consultation fee
INSERT INTO system_settings (key, value, description)
VALUES ('consultation_fee', '2000', 'Default consultation fee charged at reception')
ON CONFLICT (key) DO NOTHING;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_payments_patient_id ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- Add RLS policies
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Payments policies
CREATE POLICY "Allow authenticated users to view payments"
  ON payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- System settings policies
CREATE POLICY "Allow authenticated users to view settings"
  ON system_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admin users to update settings"
  ON system_settings FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow admin users to insert settings"
  ON system_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add columns to prescriptions table for enhanced dispensing
ALTER TABLE prescriptions 
ADD COLUMN IF NOT EXISTS actual_dosage TEXT,
ADD COLUMN IF NOT EXISTS dosage_mg VARCHAR(50),
ADD COLUMN IF NOT EXISTS quantity_dispensed INTEGER,
ADD COLUMN IF NOT EXISTS pharmacist_notes TEXT;

-- Add comment
COMMENT ON TABLE payments IS 'Stores payment records for consultations and services';
COMMENT ON TABLE system_settings IS 'Stores system-wide configuration settings';
