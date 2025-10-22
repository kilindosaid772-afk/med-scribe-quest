-- COMPREHENSIVE FIX for MedScribe Quest Issues
-- Run this SQL in your Supabase SQL Editor

-- Add the missing notes column to prescriptions table
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_prescriptions_notes ON public.prescriptions(notes) WHERE notes IS NOT NULL;

-- Fix RLS policies to allow pharmacists to create invoices when dispensing
-- Drop existing policies that conflict
DROP POLICY IF EXISTS "Billing staff can manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Billing staff can manage invoice items" ON public.invoice_items;

-- Recreate policies with pharmacist permissions
CREATE POLICY "Billing staff can manage invoices"
  ON public.invoices FOR ALL
  USING (public.has_role(auth.uid(), 'billing') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Pharmacists can create invoices for dispensing" ON public.invoices;
CREATE POLICY "Pharmacists can create invoices for dispensing"
  ON public.invoices FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'pharmacist') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Billing staff can manage invoice items"
  ON public.invoice_items FOR ALL
  USING (public.has_role(auth.uid(), 'billing') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Pharmacists can create invoice items for dispensing" ON public.invoice_items;
CREATE POLICY "Pharmacists can create invoice items for dispensing"
  ON public.invoice_items FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'pharmacist') OR public.has_role(auth.uid(), 'admin'));

-- Create missing insurance tables for billing dashboard
CREATE TABLE IF NOT EXISTS public.insurance_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  license_number TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  coverage_percentage DECIMAL(5,2) DEFAULT 100.00,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number TEXT UNIQUE NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  insurance_company_id UUID REFERENCES public.insurance_companies(id) ON DELETE SET NULL,
  claim_amount DECIMAL(10,2) NOT NULL,
  approved_amount DECIMAL(10,2),
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Partially Approved')),
  submission_date TIMESTAMPTZ DEFAULT now() NOT NULL,
  approval_date TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on insurance tables
ALTER TABLE public.insurance_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Insurance Companies
DROP POLICY IF EXISTS "Medical staff can view insurance companies" ON public.insurance_companies;
DROP POLICY IF EXISTS "Billing staff can manage insurance companies" ON public.insurance_companies;

CREATE POLICY "Medical staff can view insurance companies"
  ON public.insurance_companies FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'doctor') OR
    public.has_role(auth.uid(), 'billing')
  );

CREATE POLICY "Billing staff can manage insurance companies"
  ON public.insurance_companies FOR ALL
  USING (public.has_role(auth.uid(), 'billing') OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies for Insurance Claims
DROP POLICY IF EXISTS "Medical staff can view all insurance claims" ON public.insurance_claims;
DROP POLICY IF EXISTS "Patients can view their own insurance claims" ON public.insurance_claims;
DROP POLICY IF EXISTS "Billing staff can manage insurance claims" ON public.insurance_claims;

CREATE POLICY "Medical staff can view all insurance claims"
  ON public.insurance_claims FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'doctor') OR
    public.has_role(auth.uid(), 'billing')
  );

CREATE POLICY "Patients can view their own insurance claims"
  ON public.insurance_claims FOR SELECT
  USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Billing staff can manage insurance claims"
  ON public.insurance_claims FOR ALL
  USING (public.has_role(auth.uid(), 'billing') OR public.has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_insurance_companies_status ON public.insurance_companies(status);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_patient_id ON public.insurance_claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON public.insurance_claims(status);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_submission_date ON public.insurance_claims(submission_date);

-- Add missing insurance columns to patients table
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS insurance_company_id UUID;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS insurance_policy_number TEXT;

-- Create index for insurance company queries
CREATE INDEX IF NOT EXISTS idx_patients_insurance_company_id ON public.patients(insurance_company_id);

-- Insert sample insurance companies
INSERT INTO public.insurance_companies (name, license_number, contact_email, contact_phone, address, coverage_percentage) VALUES
  ('National Health Insurance Fund (NHIF)', 'NHIF-TZ-001', 'info@nhif.or.tz', '+255 22 2123456', 'NHIF House, Kurasini, Dar es Salaam', 80.00),
  ('AAR Insurance Tanzania', 'AAR-TZ-002', 'info@aarinsurance.co.tz', '+255 22 2123457', 'AAR House, Upanga, Dar es Salaam', 90.00),
  ('Jubilee Insurance Tanzania', 'JUB-TZ-003', 'info@jubileeinsurance.co.tz', '+255 22 2123458', 'Jubilee House, Upanga, Dar es Salaam', 85.00),
  ('Sanlam Insurance Tanzania', 'SAN-TZ-004', 'info@sanlam.co.tz', '+255 22 2123459', 'Sanlam House, Upanga, Dar es Salaam', 95.00)
  ON CONFLICT (name) DO NOTHING;

-- NOTE: ROUTING FIX ALREADY APPLIED
-- Added /billing route to App.tsx for billing dashboard access

-- Fix RLS policies to allow pharmacists to create invoices when dispensing
-- Drop existing policies that conflict
DROP POLICY IF EXISTS "Billing staff can manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Billing staff can manage invoice items" ON public.invoice_items;

-- Recreate policies with pharmacist permissions
CREATE POLICY "Billing staff can manage invoices"
  ON public.invoices FOR ALL
  USING (public.has_role(auth.uid(), 'billing') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Pharmacists can create invoices for dispensing" ON public.invoices;
CREATE POLICY "Pharmacists can create invoices for dispensing"
  ON public.invoices FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'pharmacist') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Billing staff can manage invoice items"
  ON public.invoice_items FOR ALL
  USING (public.has_role(auth.uid(), 'billing') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Pharmacists can create invoice items for dispensing" ON public.invoice_items;
CREATE POLICY "Pharmacists can create invoice items for dispensing"
  ON public.invoice_items FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'pharmacist') OR public.has_role(auth.uid(), 'admin'));

-- Create missing insurance tables for billing dashboard
CREATE TABLE IF NOT EXISTS public.insurance_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  license_number TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  coverage_percentage DECIMAL(5,2) DEFAULT 100.00,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number TEXT UNIQUE NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  insurance_company_id UUID REFERENCES public.insurance_companies(id) ON DELETE SET NULL,
  claim_amount DECIMAL(10,2) NOT NULL,
  approved_amount DECIMAL(10,2),
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Partially Approved')),
  submission_date TIMESTAMPTZ DEFAULT now() NOT NULL,
  approval_date TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on insurance tables
ALTER TABLE public.insurance_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Insurance Companies
DROP POLICY IF EXISTS "Medical staff can view insurance companies" ON public.insurance_companies;
DROP POLICY IF EXISTS "Billing staff can manage insurance companies" ON public.insurance_companies;

CREATE POLICY "Medical staff can view insurance companies"
  ON public.insurance_companies FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'doctor') OR
    public.has_role(auth.uid(), 'billing')
  );

CREATE POLICY "Billing staff can manage insurance companies"
  ON public.insurance_companies FOR ALL
  USING (public.has_role(auth.uid(), 'billing') OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies for Insurance Claims
DROP POLICY IF EXISTS "Medical staff can view all insurance claims" ON public.insurance_claims;
DROP POLICY IF EXISTS "Patients can view their own insurance claims" ON public.insurance_claims;
DROP POLICY IF EXISTS "Billing staff can manage insurance claims" ON public.insurance_claims;

CREATE POLICY "Medical staff can view all insurance claims"
  ON public.insurance_claims FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'doctor') OR
    public.has_role(auth.uid(), 'billing')
  );

CREATE POLICY "Patients can view their own insurance claims"
  ON public.insurance_claims FOR SELECT
  USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Billing staff can manage insurance claims"
  ON public.insurance_claims FOR ALL
  USING (public.has_role(auth.uid(), 'billing') OR public.has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_insurance_companies_status ON public.insurance_companies(status);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_patient_id ON public.insurance_claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON public.insurance_claims(status);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_submission_date ON public.insurance_claims(submission_date);

-- Add missing insurance columns to patients table
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS insurance_company_id UUID;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS insurance_policy_number TEXT;

-- Create index for insurance company queries
CREATE INDEX IF NOT EXISTS idx_patients_insurance_company_id ON public.patients(insurance_company_id);
