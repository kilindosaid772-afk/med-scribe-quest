# Fix for Duplicate Patient Visits in Nurse Queue ✅

## Problem
When checking in a patient from reception, the same patient appears twice in the nurse queue.

## Root Cause
The `patient_visits` table had **no unique constraint** on `appointment_id`, allowing multiple visit records to be created for the same appointment. This happened when:

1. An appointment is booked → creates a patient_visit
2. The appointment is checked in → tries to create another patient_visit
3. Result: 2 visits for the same patient/appointment

## Solution

### 1. Database Fix (Run First!)

Run the SQL script: **`fix_duplicate_patient_visits.sql`**

This script will:
- ✅ Find and remove existing duplicate visits
- ✅ Add a unique constraint on `appointment_id` to prevent future duplicates
- ✅ Verify the fix worked

**How to run:**
1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `fix_duplicate_patient_visits.sql`
3. Click "Run"
4. You should see "✓ FIX COMPLETE" message

### 2. Code Fix (Already Applied!)

I've updated `src/pages/ReceptionistDashboard.tsx` to:
- ✅ Handle duplicate insert errors gracefully
- ✅ Update existing visits instead of creating duplicates
- ✅ Better error handling for edge cases

## Testing

After running the SQL fix:

1. **Clear existing duplicates:**
   - Go to Nurse Dashboard
   - You should now see each patient only once

2. **Test new check-ins:**
   - Go to Reception Dashboard
   - Book an appointment for a patient
   - Check in that appointment
   - Go to Nurse Dashboard
   - Verify the patient appears only ONCE

3. **Test new registrations:**
   - Register a new patient from Reception
   - Go to Nurse Dashboard
   - Verify the patient appears only ONCE

## What Changed

### Database Schema
```sql
-- Added unique constraint
ALTER TABLE public.patient_visits
ADD CONSTRAINT unique_appointment_visit 
UNIQUE (appointment_id);
```

### Code Logic
- Changed from "check then insert" to "check then insert with duplicate handling"
- If a duplicate is detected (error code 23505), it updates the existing visit instead
- This ensures no duplicates even if there's a race condition

## Files Modified

1. `fix_duplicate_patient_visits.sql` - SQL script to fix database
2. `src/pages/ReceptionistDashboard.tsx` - Improved check-in logic

## Verification

Run this SQL to check for any remaining duplicates:

```sql
SELECT 
  appointment_id,
  patient_id,
  COUNT(*) as visit_count
FROM public.patient_visits
WHERE appointment_id IS NOT NULL
GROUP BY appointment_id, patient_id
HAVING COUNT(*) > 1;
```

If this returns no rows, you're all set! ✅
