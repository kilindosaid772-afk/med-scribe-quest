-- Create insurance companies table
CREATE TABLE IF NOT EXISTS public.insurance_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  coverage_percentage NUMERIC DEFAULT 100,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create insurance claims table
CREATE TABLE IF NOT EXISTS public.insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  insurance_company_id UUID NOT NULL REFERENCES public.insurance_companies(id),
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  claim_number TEXT NOT NULL UNIQUE,
  claim_amount NUMERIC NOT NULL,
  approved_amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Pending',
  submission_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  approval_date TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add insurance information to patients table
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS insurance_company_id UUID REFERENCES public.insurance_companies(id),
ADD COLUMN IF NOT EXISTS insurance_policy_number TEXT,
ADD COLUMN IF NOT EXISTS insurance_coverage_percentage NUMERIC DEFAULT 0;

-- Enable RLS
ALTER TABLE public.insurance_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;

-- RLS Policies for insurance_companies
CREATE POLICY "Billing staff can view insurance companies"
ON public.insurance_companies FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'billing'::app_role) OR 
  has_role(auth.uid(), 'receptionist'::app_role)
);

CREATE POLICY "Admins and billing can manage insurance companies"
ON public.insurance_companies FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'billing'::app_role)
);

-- RLS Policies for insurance_claims
CREATE POLICY "Billing staff can view all claims"
ON public.insurance_claims FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'billing'::app_role)
);

CREATE POLICY "Patients can view their own claims"
ON public.insurance_claims FOR SELECT
TO authenticated
USING (
  patient_id IN (
    SELECT id FROM public.patients WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Billing staff can manage claims"
ON public.insurance_claims FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'billing'::app_role)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_insurance_claims_invoice_id ON public.insurance_claims(invoice_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_patient_id ON public.insurance_claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON public.insurance_claims(status);
CREATE INDEX IF NOT EXISTS idx_patients_insurance_company ON public.patients(insurance_company_id);

-- Insert sample insurance companies
INSERT INTO public.insurance_companies (name, phone, email, coverage_percentage, status) VALUES
('National Health Insurance Fund (NHIF)', '+255-22-2111721', 'info@nhif.or.tz', 80, 'Active'),
('AAR Health Insurance', '+255-22-2601044', 'info@aar.co.tz', 90, 'Active'),
('Jubilee Insurance', '+255-22-2136363', 'info@jubilee.co.tz', 85, 'Active'),
('Strategis Insurance', '+255-22-2124746', 'info@strategis.co.tz', 75, 'Active'),
('Resolution Health', '+255-786-500000', 'info@resolution.co.tz', 95, 'Active')
ON CONFLICT DO NOTHING;