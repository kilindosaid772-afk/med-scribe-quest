-- Debug current user roles and permissions
-- Run this to see what roles the current user has

-- Check current user's roles
SELECT
  '=== CURRENT USER DEBUG ===' as debug_info,
  'User ID: ' || auth.uid() as user_id,
  'User Email: ' || u.email as user_email,
  '=== USER ROLES ===' as roles_header;

SELECT
  ur.role,
  ur.created_at as role_assigned_at,
  'Has role: ' || public.has_role(auth.uid(), ur.role) as has_role_check
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.user_id = auth.uid()
ORDER BY ur.created_at DESC;

-- Check all available roles for current user
SELECT
  '=== ROLE CHECKS ===' as role_checks,
  'Admin: ' || public.has_role(auth.uid(), 'admin') as is_admin,
  'Doctor: ' || public.has_role(auth.uid(), 'doctor') as is_doctor,
  'Pharmacist: ' || public.has_role(auth.uid(), 'pharmacist') as is_pharmacist,
  'Billing: ' || public.has_role(auth.uid(), 'billing') as is_billing,
  'Nurse: ' || public.has_role(auth.uid(), 'nurse') as is_nurse;

-- Check current RLS policies for invoices
SELECT
  '=== CURRENT RLS POLICIES FOR INVOICES ===' as policies_header,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'invoices'
ORDER BY policyname;
