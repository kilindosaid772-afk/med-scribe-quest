-- Simple script to assign receptionist role directly by user ID
-- For admin users to run

-- Replace 'USER_UUID_HERE' with the actual user ID you want to assign the role to
-- You can find the user ID in the debug dashboard or from the auth.users table

INSERT INTO public.user_roles (user_id, role, is_primary)
VALUES ('USER_UUID_HERE', 'receptionist', true)
ON CONFLICT (user_id, role)
DO UPDATE SET
  is_primary = EXCLUDED.is_primary,
  updated_at = now();

-- Verify the assignment
SELECT
  '=== ROLE ASSIGNED ===' as status,
  ur.*, p.full_name, p.email
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.user_id = 'USER_UUID_HERE' AND ur.role = 'receptionist';

-- Test if user can now create patients (this should return true)
SELECT
  '=== PERMISSION TEST ===' as test,
  CASE WHEN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = 'USER_UUID_HERE' AND role IN ('admin', 'receptionist')
  ) THEN '✅ CAN CREATE PATIENTS'
  ELSE '❌ CANNOT CREATE PATIENTS' END as can_create_patients;
