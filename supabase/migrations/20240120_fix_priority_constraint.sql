-- Fix lab_tests priority constraint to match application code
-- The constraint currently expects 'Normal' but the app uses 'Routine'

-- First, update any existing 'Normal' values to 'Routine' for consistency
UPDATE public.lab_tests 
SET priority = 'Routine'
WHERE priority = 'Normal';

-- Drop the existing constraint
ALTER TABLE public.lab_tests DROP CONSTRAINT IF EXISTS lab_tests_priority_check;

-- Add the correct constraint that matches the application
ALTER TABLE public.lab_tests 
  ADD CONSTRAINT lab_tests_priority_check 
  CHECK (priority IN ('Routine', 'Urgent', 'STAT'));
