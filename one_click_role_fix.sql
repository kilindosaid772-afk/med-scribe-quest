-- One-click fix for role assignment issues
-- Run this in Supabase SQL editor when logged in as the user who needs receptionist access

-- Step 1: Check current authentication
SELECT
  '=== STEP 1: AUTHENTICATION ===' as step,
  'User ID: ' || COALESCE(auth.uid()::text, 'NULL - Not authenticated!') as user_id,
  'User Email: ' || (SELECT email FROM auth.users WHERE id = auth.uid()) as user_email;

-- Step 2: Check current roles
SELECT
  '=== STEP 2: CURRENT ROLES ===' as step,
  ur.*, p.full_name
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.user_id = auth.uid()
ORDER BY ur.created_at DESC;

-- Step 3: Auto-assign receptionist role if user is authenticated
DO $$
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please log in to Supabase dashboard first!';
  END IF;

  -- Check if receptionist role already exists
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'receptionist') THEN
    RAISE NOTICE '✅ User already has receptionist role';
  ELSE
    -- Assign receptionist role
    INSERT INTO public.user_roles (user_id, role, is_primary)
    VALUES (auth.uid(), 'receptionist', true);

    RAISE NOTICE '✅ Receptionist role assigned successfully!';
  END IF;

  -- Set as primary if it's the only role
  UPDATE public.user_roles
  SET is_primary = true
  WHERE user_id = auth.uid() AND role = 'receptionist'
  AND (SELECT COUNT(*) FROM public.user_roles WHERE user_id = auth.uid()) = 1;

END $$;

-- Step 4: Verify assignment
SELECT
  '=== STEP 4: VERIFICATION ===' as step,
  ur.*, p.full_name
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.user_id = auth.uid()
ORDER BY ur.created_at DESC;

-- Step 5: Test permissions
SELECT
  '=== STEP 5: PERMISSION TEST ===' as step,
  'Can view patients: ' || (
    SELECT CASE WHEN COUNT(*) > 0 THEN '✅ YES' ELSE '❌ NO' END
    FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'receptionist', 'doctor', 'nurse')
  ) as can_view_patients,
  'Can create patients: ' || (
    SELECT CASE WHEN COUNT(*) > 0 THEN '✅ YES' ELSE '❌ NO' END
    FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'receptionist')
  ) as can_create_patients,
  'Can access medical services: ' || (
    SELECT CASE WHEN COUNT(*) > 0 THEN '✅ YES' ELSE '❌ NO' END
    FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'doctor', 'nurse', 'receptionist', 'lab_tech', 'pharmacist', 'billing')
  ) as can_access_services;

-- Success message
SELECT
  '=== SUCCESS! ===' as final_step,
  '🎉 Role assignment completed!' as message,
  'You should now be able to register patients.' as next_step,
  'Go to /receptionist to test patient registration.' as test_location;
