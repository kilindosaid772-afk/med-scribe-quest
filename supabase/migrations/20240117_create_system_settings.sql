-- Create system_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for system_settings
CREATE POLICY "Allow admin to read system_settings"
  ON public.system_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Allow admin to insert system_settings"
  ON public.system_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Allow admin to update system_settings"
  ON public.system_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Allow admin to delete system_settings"
  ON public.system_settings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Create department_fees table for department-specific consultation fees
CREATE TABLE IF NOT EXISTS public.department_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  fee_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'TSh',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(department_id)
);

-- Enable RLS for department_fees
ALTER TABLE public.department_fees ENABLE ROW LEVEL SECURITY;

-- Create policies for department_fees
CREATE POLICY "Allow all authenticated users to read department_fees"
  ON public.department_fees
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admin to manage department_fees"
  ON public.department_fees
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Insert default consultation fee
INSERT INTO public.system_settings (key, value, description)
VALUES 
  ('consultation_fee', '50000', 'Default consultation fee in TSh'),
  ('currency', 'TSh', 'Default currency'),
  ('hospital_name', 'Medical Center', 'Hospital or clinic name'),
  ('enable_appointment_fees', 'true', 'Enable department-specific appointment fees')
ON CONFLICT (key) DO NOTHING;