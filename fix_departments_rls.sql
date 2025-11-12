-- Fix departments RLS policy to allow receptionists to manage departments
-- This fixes the Add Department functionality in Receptionist Dashboard

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Admins can manage departments" ON public.departments;

-- Create new comprehensive policy that includes receptionists
CREATE POLICY "Admins and receptionists can manage departments"
  ON public.departments FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'receptionist')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'receptionist')
  );