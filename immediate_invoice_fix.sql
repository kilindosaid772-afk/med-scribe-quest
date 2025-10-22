-- IMMEDIATE FIX: Update RLS policies for pharmacist invoice creation
-- Run this in your Supabase SQL Editor RIGHT NOW

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Billing staff can manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Billing staff can manage invoice items" ON public.invoice_items;

-- Create new policies that allow pharmacists to create invoices
CREATE POLICY "Allow pharmacist invoice creation"
  ON public.invoices FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'pharmacist') OR
    public.has_role(auth.uid(), 'billing') OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Allow pharmacist invoice item creation"
  ON public.invoice_items FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'pharmacist') OR
    public.has_role(auth.uid(), 'billing') OR
    public.has_role(auth.uid(), 'admin')
  );

-- Also ensure SELECT permissions for pharmacists
DROP POLICY IF EXISTS "Billing staff can view all invoices" ON public.invoices;
CREATE POLICY "Staff can view invoices"
  ON public.invoices FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'doctor') OR
    public.has_role(auth.uid(), 'pharmacist') OR
    public.has_role(auth.uid(), 'billing')
  );

-- Same for invoice items
DROP POLICY IF EXISTS "Billing staff can view all invoice items" ON public.invoice_items;
CREATE POLICY "Staff can view invoice items"
  ON public.invoice_items FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'doctor') OR
    public.has_role(auth.uid(), 'pharmacist') OR
    public.has_role(auth.uid(), 'billing')
  );
