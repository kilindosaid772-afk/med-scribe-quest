-- Fix all status values to match database constraints
-- This migration ensures all existing data conforms to the check constraints

-- 1. Fix appointments table - change 'In Progress' to 'Confirmed', remove 'No Show'
UPDATE public.appointments 
SET status = CASE 
  WHEN status = 'In Progress' THEN 'Confirmed'
  WHEN status = 'No Show' THEN 'Cancelled'
  ELSE status
END
WHERE status NOT IN ('Scheduled', 'Confirmed', 'Cancelled', 'Completed');

-- 2. Fix patient_visits.reception_status - only allow Pending, Checked In, Completed
UPDATE public.patient_visits 
SET reception_status = CASE 
  WHEN reception_status = 'In Progress' THEN 'Pending'
  ELSE reception_status
END
WHERE reception_status NOT IN ('Pending', 'Checked In', 'Completed');

-- 3. Fix patient_visits.doctor_status - change 'In Progress' to 'In Consultation'
UPDATE public.patient_visits 
SET doctor_status = CASE 
  WHEN doctor_status = 'In Progress' THEN 'In Consultation'
  ELSE doctor_status
END
WHERE doctor_status NOT IN ('Pending', 'In Consultation', 'Completed');

-- 4. Fix patient_visits.pharmacy_status - change 'In Progress' to 'Dispensing'
UPDATE public.patient_visits 
SET pharmacy_status = CASE 
  WHEN pharmacy_status = 'In Progress' THEN 'Dispensing'
  ELSE pharmacy_status
END
WHERE pharmacy_status NOT IN ('Not Required', 'Pending', 'Dispensing', 'Completed');

-- 5. Verify lab_tests priority values are correct (already fixed in previous migration)
-- Just ensure any remaining invalid values are updated
UPDATE public.lab_tests 
SET priority = 'Routine'
WHERE priority NOT IN ('Routine', 'Urgent', 'STAT');
