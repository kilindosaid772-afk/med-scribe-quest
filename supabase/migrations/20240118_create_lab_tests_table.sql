-- Create lab_tests table for storing ordered lab tests
CREATE TABLE IF NOT EXISTS public.lab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  test_type TEXT,
  status TEXT DEFAULT 'Pending',
  priority TEXT DEFAULT 'Routine',
  ordered_date TIMESTAMPTZ DEFAULT NOW(),
  completed_date TIMESTAMPTZ,
  ordered_by_doctor_id UUID REFERENCES public.profiles(id),
  performed_by_tech_id UUID REFERENCES public.profiles(id),
  notes TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create lab_results table for storing individual test results
CREATE TABLE IF NOT EXISTS public.lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_test_id UUID NOT NULL REFERENCES public.lab_tests(id) ON DELETE CASCADE,
  result_value TEXT NOT NULL,
  unit TEXT,
  reference_range TEXT,
  abnormal_flag BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.lab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lab_tests
CREATE POLICY "Medical staff can view lab tests"
  ON public.lab_tests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'doctor', 'nurse', 'lab_tech')
    )
  );

CREATE POLICY "Doctors can create lab tests"
  ON public.lab_tests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'doctor')
    )
  );

CREATE POLICY "Lab techs and doctors can update lab tests"
  ON public.lab_tests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'doctor', 'lab_tech')
    )
  );

CREATE POLICY "Admins can delete lab tests"
  ON public.lab_tests FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- RLS Policies for lab_results
CREATE POLICY "Medical staff can view lab results"
  ON public.lab_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'doctor', 'nurse', 'lab_tech')
    )
  );

CREATE POLICY "Lab techs can manage lab results"
  ON public.lab_results FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'lab_tech')
    )
  );

-- Drop existing constraints if they exist
ALTER TABLE public.lab_tests DROP CONSTRAINT IF EXISTS lab_tests_status_check;
ALTER TABLE public.lab_tests DROP CONSTRAINT IF EXISTS lab_tests_priority_check;

-- Add check constraints with correct values
ALTER TABLE public.lab_tests 
  ADD CONSTRAINT lab_tests_status_check 
  CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Cancelled'));

ALTER TABLE public.lab_tests 
  ADD CONSTRAINT lab_tests_priority_check 
  CHECK (priority IN ('Routine', 'Urgent', 'STAT'));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lab_tests_patient_id ON public.lab_tests(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_tests_status ON public.lab_tests(status);
CREATE INDEX IF NOT EXISTS idx_lab_tests_ordered_date ON public.lab_tests(ordered_date);
CREATE INDEX IF NOT EXISTS idx_lab_results_lab_test_id ON public.lab_results(lab_test_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_lab_tests_updated_at ON public.lab_tests;
CREATE TRIGGER update_lab_tests_updated_at
    BEFORE UPDATE ON public.lab_tests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lab_results_updated_at ON public.lab_results;
CREATE TRIGGER update_lab_results_updated_at
    BEFORE UPDATE ON public.lab_results
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
