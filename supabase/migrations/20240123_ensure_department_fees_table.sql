-- Ensure department_fees table exists with proper structure
CREATE TABLE IF NOT EXISTS public.department_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  fee_amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'TSh',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT department_fees_department_id_key UNIQUE (department_id)
);

-- Enable RLS
ALTER TABLE public.department_fees ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view department fees"
  ON public.department_fees FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage department fees"
  ON public.department_fees FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_department_fees_department_id 
  ON public.department_fees(department_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_department_fees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_department_fees_updated_at ON public.department_fees;
CREATE TRIGGER update_department_fees_updated_at
    BEFORE UPDATE ON public.department_fees
    FOR EACH ROW
    EXECUTE FUNCTION update_department_fees_updated_at();
