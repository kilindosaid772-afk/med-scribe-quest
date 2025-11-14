-- Fix lab_tests table constraints to match application values
-- This migration fixes the priority check constraint issue

-- First, check what priority values exist in the table
DO $$
BEGIN
  -- Update any non-standard priority values to match our constraint
  UPDATE public.lab_tests 
  SET priority = CASE 
    WHEN priority IS NULL THEN 'Routine'
    WHEN TRIM(LOWER(priority)) IN ('normal', 'routine') THEN 'Routine'
    WHEN TRIM(LOWER(priority)) = 'urgent' THEN 'Urgent'
    WHEN TRIM(LOWER(priority)) IN ('stat', 'emergency', 'immediate') THEN 'STAT'
    ELSE 'Routine'  -- Default to Routine for any unknown values (including 'full', etc.)
  END
  WHERE priority IS NULL OR priority NOT IN ('Routine', 'Urgent', 'STAT');

  -- Update any non-standard status values
  UPDATE public.lab_tests 
  SET status = CASE 
    WHEN LOWER(status) = 'pending' THEN 'Pending'
    WHEN LOWER(status) = 'in progress' THEN 'In Progress'
    WHEN LOWER(status) = 'completed' THEN 'Completed'
    WHEN LOWER(status) = 'cancelled' THEN 'Cancelled'
    WHEN LOWER(status) = 'canceled' THEN 'Cancelled'
    ELSE 'Pending'  -- Default to Pending for any unknown values
  END
  WHERE status NOT IN ('Pending', 'In Progress', 'Completed', 'Cancelled');
END $$;

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
