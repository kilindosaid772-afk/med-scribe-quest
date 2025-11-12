-- ============================================
-- CHECK AND FIX RECEPTIONIST ROLE
-- ============================================
-- This script checks if you have receptionist role and assigns it if needed
-- Run this in Supabase SQL Editor while logged in

-- ============================================
-- STEP 1: Check current user and roles
-- ============================================

SELECT 
  '=== YOUR CURRENT USER ===' as info,
  auth.uid() as your_user_id,
  (SELECT email FROM auth.users WHERE id = auth.uid()) as your_email;

SELECT 
  '=== YOUR CURRENT ROLES ===' as info,
  role,
  is_primary,
  created_at
FROM public.user_roles
WHERE user_id = auth.uid()
ORDER BY created_at DESC;

-- ============================================
-- STEP 2: Check if you can register patients
-- ============================================

SELECT 
  '=== PERMISSION CHECK ===' as info,
  public.has_role(auth.uid(), 'receptionist') as has_receptionist_role,
  public.has_role(auth.uid(), 'admin') as has_admin_role,
  CASE 
    WHEN public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'admin')
    THEN '✓ YES - You can register patients'
    ELSE '✗ NO - You need receptionist or admin role'
  END as can_register_patients;

-- ============================================
-- STEP 3: Auto-assign receptionist role if missing
-- ============================================

DO $$
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated. Please log in first.';
  END IF;

  -- Check if user already has receptionist role
  IF public.has_role(auth.uid(), 'receptionist') THEN
    RAISE NOTICE '✓ You already have receptionist role';
  ELSE
    -- Assign receptionist role
    INSERT INTO public.user_roles (user_id, role, is_primary)
    VALUES (auth.uid(), 'receptionist', true)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE '✓ Receptionist role assigned successfully!';
    RAISE NOTICE 'Please refresh your browser to apply changes.';
  END IF;
END $$;

-- ============================================
-- STEP 4: Verify the fix
-- ============================================

SELECT 
  '=== AFTER FIX ===' as info,
  role,
  is_primary,
  created_at
FROM public.user_roles
WHERE user_id = auth.uid()
ORDER BY created_at DESC;

SELECT 
  '=== FINAL CHECK ===' as info,
  CASE 
    WHEN public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'admin')
    THEN '✓ SUCCESS! You can now register patients. Please refresh your browser.'
    ELSE '✗ FAILED - Please contact your administrator'
  END as status;

-- ============================================
-- STEP 5: Test patient creation (optional)
-- ============================================

-- Uncomment the lines below to test if you can create a patient
-- This will create a test patient to verify permissions

/*
INSERT INTO public.patients (
  full_name,
  date_of_birth,
  gender,
  phone,
  status
) VALUES (
  'Test Patient',
  '1990-01-01',
  'Male',
  '+255700000000',
  'Active'
) RETURNING id, full_name, created_at;
*/
