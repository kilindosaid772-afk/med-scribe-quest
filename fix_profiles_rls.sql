-- Fix profiles RLS policy to allow all medical staff to view profiles
-- This fixes the User Management section in Admin Dashboard

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Admins and medical staff can view all profiles" ON public.profiles;

-- Create new comprehensive policy that includes ALL staff roles
CREATE POLICY "All staff can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'doctor') OR
    public.has_role(auth.uid(), 'nurse') OR
    public.has_role(auth.uid(), 'receptionist') OR
    public.has_role(auth.uid(), 'pharmacist') OR
    public.has_role(auth.uid(), 'lab_tech') OR
    public.has_role(auth.uid(), 'billing')
  );

-- Also ensure admins can INSERT profiles (for user creation)
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Ensure receptionists can also view profiles (needed for patient registration)
-- This is already covered by the SELECT policy above
