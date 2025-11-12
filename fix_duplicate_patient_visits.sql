-- ============================================
-- FIX DUPLICATE PATIENT VISITS
-- ============================================
-- This script fixes the duplicate patient visits issue
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Check for duplicates
-- ============================================

SELECT 
  '=== CHECKING FOR DUPLICATES ===' as step,
  appointment_id,
  patient_id,
  COUNT(*) as visit_count,
  array_agg(id) as visit_ids
FROM public.patient_visits
WHERE appointment_id IS NOT NULL
GROUP BY appointment_id, patient_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- ============================================
-- STEP 2: Remove duplicate visits (keep the oldest one)
-- ============================================

-- This will delete duplicate visits, keeping only the first one created
WITH duplicates AS (
  SELECT 
    id,
    appointment_id,
    ROW_NUMBER() OVER (
      PARTITION BY appointment_id 
      ORDER BY created_at ASC
    ) as rn
  FROM public.patient_visits
  WHERE appointment_id IS NOT NULL
)
DELETE FROM public.patient_visits
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Show how many duplicates were removed
SELECT '✓ Duplicates removed' as status;

-- ============================================
-- STEP 3: Add unique constraint to prevent future duplicates
-- ============================================

-- Add a unique constraint on appointment_id
-- This ensures one visit per appointment
ALTER TABLE public.patient_visits
ADD CONSTRAINT unique_appointment_visit 
UNIQUE (appointment_id);

SELECT '✓ Unique constraint added' as status;

-- ============================================
-- STEP 4: Verify the fix
-- ============================================

SELECT 
  '=== VERIFICATION ===' as step,
  COUNT(*) as total_visits,
  COUNT(DISTINCT appointment_id) as unique_appointments,
  COUNT(*) - COUNT(DISTINCT appointment_id) as potential_duplicates
FROM public.patient_visits
WHERE appointment_id IS NOT NULL;

-- Check if any duplicates remain
SELECT 
  '=== REMAINING DUPLICATES ===' as step,
  appointment_id,
  COUNT(*) as visit_count
FROM public.patient_visits
WHERE appointment_id IS NOT NULL
GROUP BY appointment_id
HAVING COUNT(*) > 1;

SELECT '✓ FIX COMPLETE - No more duplicate visits should appear!' as final_status;
