-- Alternative script to assign receptionist role using user email
-- Use this if the auth.uid() approach doesn't work

-- STEP 1: Find your user ID by email
-- Replace 'your-email@example.com' with your actual email address
SELECT
  '=== FIND YOUR USER ===' as step,
  id, email, created_at
FROM auth.users
WHERE email = 'your-email@example.com';  -- <-- REPLACE WITH YOUR EMAIL

-- STEP 2: Check current roles (replace USER_ID with the ID from Step 1)
SELECT
  '=== CURRENT ROLES ===' as info,
  ur.*, p.full_name, p.email as profile_email
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.user_id = 'USER_ID';  -- <-- REPLACE WITH YOUR USER ID

-- STEP 3: Assign receptionist role (replace USER_ID with your actual ID)
-- Run this block after replacing USER_ID
INSERT INTO public.user_roles (user_id, role, is_primary)
SELECT 'USER_ID', 'receptionist', true  -- <-- REPLACE USER_ID
WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = 'USER_ID' AND role = 'receptionist'  -- <-- REPLACE USER_ID
);

-- STEP 4: Verify the assignment
SELECT
  '=== VERIFICATION ===' as info,
  ur.*, p.full_name, p.email as profile_email
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.user_id = 'USER_ID'  -- <-- REPLACE USER_ID
ORDER BY ur.created_at DESC;

-- STEP 5: Test permissions
SELECT
  '=== PERMISSION CHECK ===' as info,
  'Can view patients: ' || (
    SELECT CASE WHEN COUNT(*) > 0 THEN 'YES' ELSE 'NO' END
    FROM public.user_roles
    WHERE user_id = 'USER_ID'  -- <-- REPLACE USER_ID
    AND role IN ('admin', 'receptionist', 'doctor', 'nurse')
  ) as can_view_patients,
  'Can create patients: ' || (
    SELECT CASE WHEN COUNT(*) > 0 THEN 'YES' ELSE 'NO' END
    FROM public.user_roles
    WHERE user_id = 'USER_ID'  -- <-- REPLACE USER_ID
    AND role IN ('admin', 'receptionist')
  ) as can_create_patients;
