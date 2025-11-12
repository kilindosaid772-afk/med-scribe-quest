-- ============================================
-- TEST PATIENT REGISTRATION
-- ============================================
-- Run this to test if patient registration works
-- This will create a test patient and verify permissions

-- ============================================
-- STEP 1: Check your permissions
-- ============================================

SELECT 
  '=== PERMISSION CHECK ===' as step,
  auth.uid() as your_user_id,
  (SELECT email FROM auth.users WHERE id = auth.uid()) as your_email,
  public.has_role(auth.uid(), 'receptionist') as has_receptionist,
  public.has_role(auth.uid(), 'admin') as has_admin,
  CASE 
    WHEN public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'admin')
    THEN '✓ You have permission to register patients'
    ELSE '✗ You need receptionist or admin role'
  END as status;

-- ============================================
-- STEP 2: Try to create a test patient
-- ============================================

-- This will fail if you don't have the right permissions
INSERT INTO public.patients (
  full_name,
  date_of_birth,
  gender,
  phone,
  email,
  blood_group,
  status
) VALUES (
  'Test Patient ' || to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
  '1990-01-01',
  'Male',
  '+255700' || floor(random() * 1000000)::text,
  'test' || floor(random() * 10000)::text || '@example.com',
  'O+',
  'Active'
) RETURNING 
  '=== TEST PATIENT CREATED ===' as result,
  id,
  full_name,
  phone,
  created_at;

-- ============================================
-- STEP 3: Verify the patient was created
-- ============================================

SELECT 
  '=== RECENT PATIENTS ===' as info,
  id,
  full_name,
  phone,
  gender,
  created_at
FROM public.patients
ORDER BY created_at DESC
LIMIT 5;

-- ============================================
-- STEP 4: Clean up test patient (optional)
-- ============================================

-- Uncomment to delete the test patient
/*
DELETE FROM public.patients
WHERE full_name LIKE 'Test Patient%'
AND created_at > now() - interval '1 hour';
*/

SELECT '✓ TEST COMPLETE - If you see test patient above, registration works!' as final_status;
