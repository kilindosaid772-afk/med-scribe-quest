# Real-Time Updates Implementation Plan

## Overview
Add Supabase real-time subscriptions to automatically update dashboards when data changes.

## Key Tables to Monitor

### 1. Reception Dashboard
- `patient_visits` - New patients, check-ins
- `appointments` - New appointments, status changes

### 2. Nurse Dashboard  
- `patient_visits` WHERE `current_stage = 'nurse'` - Patients waiting for vitals

### 3. Doctor Dashboard
- `patient_visits` WHERE `current_stage = 'doctor'` - Patients waiting for consultation
- `lab_tests` - Lab results completed

### 4. Lab Dashboard
- `lab_tests` WHERE `status = 'Pending'` - New lab orders

### 5. Pharmacy Dashboard
- `prescriptions` WHERE `status = 'Pending'` - New prescriptions
- `patient_visits` WHERE `current_stage = 'pharmacy'` - Patients waiting

### 6. Billing Dashboard
- `invoices` WHERE `status IN ('Unpaid', 'Partially Paid')` - Unpaid invoices
- `patient_visits` WHERE `current_stage = 'billing'` - Patients waiting for payment

## Implementation Strategy

1. Add real-time subscription in each dashboard's useEffect
2. Listen for INSERT, UPDATE, DELETE events
3. Refresh data when changes detected
4. Clean up subscriptions on unmount

## Benefits
- No manual refresh needed
- Instant updates across all users
- Better user experience
- Reduced server load (no polling)
