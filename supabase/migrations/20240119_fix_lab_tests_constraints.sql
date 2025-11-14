-- Fix lab_tests table constraints to match application values
-- This migration fixes the priority check constraint issue

-- Drop existing constraints if they exist
ALTER TABLE public.lab_tests DROP CONSTRAINT IF EXISTS lab_tests_status_check;
ALTER TABLE public.lab_tests DROP CONSTRAINT IF EXISTS lab_tests_priority_check;

-- Add correct check constraints
ALTER TABLE public.lab_tests 
  ADD CONSTRAINT lab_tests_status_check 
  CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Cancelled'));

ALTER TABLE public.lab_tests 
  ADD CONSTRAINT lab_tests_priority_check 
  CHECK (priority IN ('Routine', 'Urgent', 'STAT'));

-- Verify the constraints
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.lab_tests'::regclass
  AND contype = 'c';
