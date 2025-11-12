-- ============================================
-- SETUP DOCTOR DASHBOARD
-- ============================================
-- This script sets up everything needed for the doctor dashboard to work
-- Run this in Supabase SQL Editor while logged in as the doctor user

-- ============================================
-- STEP 1: Check current user and roles
-- ============================================

SELECT 
  '=== YOUR ACCOUNT ===' as step,
  auth.uid() as your_user_id,
  (SELECT email FROM auth.users WHERE id = auth.uid()) as your_email;

SELECT 
  '=== YOUR CURRENT ROLES ===' as step,
  role,
  is_primary,
  created_at
FROM user_roles
WHERE user_id = auth.uid()
ORDER BY created_at DESC;

-- ============================================
-- STEP 2: Assign doctor role if missing
-- ============================================

DO $$
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated. Please log in first.';
  END IF;

  -- Check if user already has doctor role
  IF public.has_role(auth.uid(), 'doctor') THEN
    RAISE NOTICE '✓ You already have doctor role';
  ELSE
    -- Assign doctor role
    INSERT INTO public.user_roles (user_id, role, is_primary)
    VALUES (auth.uid(), 'doctor', true)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE '✓ Doctor role assigned successfully!';
    RAISE NOTICE 'Please refresh your browser to apply changes.';
  END IF;
END $$;

-- ============================================
-- STEP 3: Check existing appointments
-- ============================================

SELECT 
  '=== YOUR APPOINTMENTS ===' as step,
  COUNT(*) as total_appointments,
  COUNT(*) FILTER (WHERE appointment_date = CURRENT_DATE) as today_appointments,
  COUNT(*) FILTER (WHERE status = 'Scheduled') as scheduled,
  COUNT(*) FILTER (WHERE status = 'Completed') as completed
FROM appointments
WHERE doctor_id = auth.uid();

-- Show recent appointments
SELECT 
  '=== RECENT APPOINTMENTS ===' as step,
  a.id,
  p.full_name as patient_name,
  a.appointment_date,
  a.appointment_time,
  a.status,
  a.reason
FROM appointments a
JOIN patients p ON p.id = a.patient_id
WHERE a.doctor_id = auth.uid()
ORDER BY a.appointment_date DESC, a.appointment_time DESC
LIMIT 5;

-- ============================================
-- STEP 4: Check pending consultations
-- ============================================

SELECT 
  '=== PATIENTS WAITING FOR YOU ===' as step,
  COUNT(*) as pending_consultations
FROM patient_visits
WHERE current_stage = 'doctor'
  AND doctor_status = 'Pending'
  AND overall_status = 'Active';

-- Show pending patients
SELECT 
  '=== PENDING PATIENTS ===' as step,
  pv.id as visit_id,
  p.full_name as patient_name,
  p.phone,
  pv.nurse_vitals,
  pv.created_at,
  pv.nurse_completed_at
FROM patient_visits pv
JOIN patients p ON p.id = pv.patient_id
WHERE pv.current_stage = 'doctor'
  AND pv.doctor_status = 'Pending'
  AND pv.overall_status = 'Active'
ORDER BY pv.nurse_completed_at DESC
LIMIT 5;

-- ============================================
-- STEP 5: Create test appointment (optional)
-- ============================================

-- Uncomment to create a test appointment for today
/*
DO $$
DECLARE
  v_patient_id UUID;
BEGIN
  -- Get a random patient
  SELECT id INTO v_patient_id FROM patients LIMIT 1;
  
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'No patients found. Please register a patient first.';
  END IF;
  
  -- Create test appointment
  INSERT INTO appointments (
    patient_id,
    doctor_id,
    appointment_date,
    appointment_time,
    reason,
    status
  ) VALUES (
    v_patient_id,
    auth.uid(),
    CURRENT_DATE,
    '14:00',
    'Test consultation - General checkup',
    'Scheduled'
  );
  
  RAISE NOTICE '✓ Test appointment created for today at 2:00 PM';
END $$;
*/

-- ============================================
-- STEP 6: Verify setup
-- ============================================

SELECT 
  '=== SETUP VERIFICATION ===' as step,
  CASE 
    WHEN public.has_role(auth.uid(), 'doctor') THEN '✓ Has doctor role'
    ELSE '✗ Missing doctor role'
  END as role_check,
  CASE 
    WHEN EXISTS (SELECT 1 FROM appointments WHERE doctor_id = auth.uid()) THEN '✓ Has appointments'
    ELSE '⚠ No appointments yet'
  END as appointments_check,
  CASE 
    WHEN EXISTS (SELECT 1 FROM patient_visits WHERE current_stage = 'doctor' AND doctor_status = 'Pending') THEN '✓ Has pending consultations'
    ELSE '⚠ No pending consultations'
  END as consultations_check;

SELECT '✓ SETUP COMPLETE - Refresh your browser and check the doctor dashboard!' as final_status;
