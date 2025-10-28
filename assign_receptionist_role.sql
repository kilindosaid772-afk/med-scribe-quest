-- Assign receptionist role to current user
-- Run this script in the Supabase SQL editor when logged in as the user who needs receptionist access

-- First, check current authentication and roles
SELECT
  '=== AUTHENTICATION CHECK ===' as info,
  'Current User ID: ' || auth.uid() as current_user_id,
  'Current User Email: ' || (SELECT email FROM auth.users WHERE id = auth.uid()) as current_user_email;

-- Check if user exists in auth.users
SELECT
  '=== USER EXISTS IN AUTH ===' as info,
  id, email, created_at
FROM auth.users
WHERE id = auth.uid();

-- Check current roles in user_roles table
SELECT
  '=== CURRENT ROLES ===' as info,
  ur.*, p.full_name, p.email as profile_email
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.user_id = auth.uid()
ORDER BY ur.created_at DESC;

-- Only proceed if user is authenticated
DO $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found. Please log in first.';
  END IF;

  -- Check if receptionist role already exists
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'receptionist') THEN
    RAISE NOTICE 'User already has receptionist role';
  ELSE
    -- Insert receptionist role
    INSERT INTO public.user_roles (user_id, role, is_primary)
    VALUES (auth.uid(), 'receptionist', true);

    RAISE NOTICE 'Receptionist role assigned successfully';
  END IF;

  -- Set other roles as non-primary if this is the first role
  IF (SELECT COUNT(*) FROM public.user_roles WHERE user_id = auth.uid()) = 1 THEN
    UPDATE public.user_roles
    SET is_primary = false
    WHERE user_id = auth.uid() AND role = 'receptionist';
  END IF;
END $$;

-- Verify the assignment
SELECT
  '=== AFTER ASSIGNMENT ===' as info,
  ur.*, p.full_name, p.email as profile_email
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.user_id = auth.uid()
ORDER BY ur.created_at DESC;

-- Test role permissions
SELECT
  '=== PERMISSION TESTS ===' as info,
  'Can view patients: ' || (
    SELECT CASE WHEN COUNT(*) > 0 THEN 'YES' ELSE 'NO' END
    FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'receptionist', 'doctor', 'nurse')
  ) as can_view_patients,
  'Can create patients: ' || (
    SELECT CASE WHEN COUNT(*) > 0 THEN 'YES' ELSE 'NO' END
    FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'receptionist')
  ) as can_create_patients;

-- Test has_role function
SELECT
  '=== ROLE FUNCTION TESTS ===' as info,
  'has_role(admin): ' || public.has_role(auth.uid(), 'admin') as is_admin,
  'has_role(receptionist): ' || public.has_role(auth.uid(), 'receptionist') as is_receptionist,
  'has_role(doctor): ' || public.has_role(auth.uid(), 'doctor') as is_doctor,
  'has_role(nurse): ' || public.has_role(auth.uid(), 'nurse') as is_nurse;
