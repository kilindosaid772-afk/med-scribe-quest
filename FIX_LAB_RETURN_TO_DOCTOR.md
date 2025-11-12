# Fix: Lab Patients Returning to Doctor Queue

## Problem
When a doctor ordered lab tests for a patient, the patient would go to the lab, but after the lab completed the tests, the patient would NOT return to the doctor's queue. This was because the consultation was being marked as "Completed" when lab tests were ordered.

## Root Cause
In the `DoctorDashboard.tsx`, when ordering lab tests, the code was setting:
```typescript
doctor_status: 'Completed',
doctor_completed_at: new Date().toISOString()
```

This meant that when the patient returned from the lab, they wouldn't show up in the doctor's queue because the filtering logic excluded patients with `doctor_status === 'Completed'`.

## Solution Applied

### 1. Updated Lab Test Ordering Logic
Changed the `doctor_status` from 'Completed' to 'In Progress' when ordering lab tests:

**Before:**
```typescript
.update({
  current_stage: 'lab',
  lab_status: 'Pending',
  doctor_status: 'Completed',
  doctor_completed_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
})
```

**After:**
```typescript
.update({
  current_stage: 'lab',
  lab_status: 'Pending',
  doctor_status: 'In Progress',  // Keep consultation open
  updated_at: new Date().toISOString()
})
```

### 2. Updated Query Filter
Changed the query to explicitly exclude only completed consultations:

**Before:**
```typescript
.in('doctor_status', ['Pending', 'In Progress'])
```

**After:**
```typescript
.neq('doctor_status', 'Completed')
```

This ensures that patients with any status OTHER than 'Completed' will appear in the queue.

### 3. Enhanced Filtering Logic
Added clear comments explaining the filtering:

```typescript
// Filter out visits that shouldn't be in doctor queue
// Only show visits where:
// 1. current_stage is 'doctor'
// 2. doctor_status is NOT 'Completed' (ensures patients from lab only show if consultation incomplete)
// 3. overall_status is 'Active'
// This filtering ensures that:
// - New patients appear in the queue
// - Patients returning from lab ONLY appear if their consultation is not yet complete
```

## Workflow Now

### Complete Patient Journey:
1. **Patient arrives** → `doctor_status: 'Pending'` → Shows in doctor queue ✅
2. **Doctor orders lab tests** → `doctor_status: 'In Progress'` → Patient goes to lab
3. **Lab completes tests** → Patient returns to doctor → `doctor_status: 'In Progress'` → Shows in doctor queue ✅
4. **Doctor reviews lab results** → Can complete consultation
5. **Doctor completes consultation** → `doctor_status: 'Completed'` → Patient moves to pharmacy/billing → No longer in doctor queue ✅

### Key Points:
- Patients returning from lab ONLY show if consultation is NOT complete
- Consultation is only marked complete when doctor explicitly completes it (sends to pharmacy/billing)
- Lab test ordering keeps the consultation "in progress" so patient returns to doctor

## Testing
1. Start a consultation with a patient
2. Order lab tests for the patient
3. Complete the lab tests in LabDashboard
4. Check DoctorDashboard - patient should appear in "Lab Results Ready" section
5. Review lab results and complete consultation
6. Patient should move to pharmacy/billing and disappear from doctor queue

## Benefits
- Proper workflow continuity
- Patients don't get lost in the system
- Doctors can review lab results before completing consultations
- Clear separation between "consultation in progress" and "consultation completed"