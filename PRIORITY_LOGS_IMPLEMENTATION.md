# Priority Logs Implementation Guide

## 🎯 Quick Reference for Adding Required Logs

This guide shows exactly where and how to add the 4 priority log types you requested.

---

## 1. Lab Test Orders and Results

### Where to Add:
- **Doctor Dashboard** - When ordering lab tests
- **Lab Dashboard** - When receiving, processing, and entering results

### Implementation:

#### A. Doctor Orders Lab Test
```typescript
// In DoctorDashboard.tsx - after creating lab test order
await logActivity('doctor.lab_test.ordered', {
  patient_id: patientId,
  visit_id: visitId,
  test_name: testName,
  test_id: testId,
  doctor_id: user.id
});
```

#### B. Lab Receives Test
```typescript
// In LabDashboard.tsx - when test appears in queue
await logActivity('lab.test.received', {
  test_id: testId,
  patient_id: patientId,
  test_name: testName,
  ordered_by: doctorId
});
```

#### C. Lab Enters Results
```typescript
// In LabDashboard.tsx - after saving test results
await logActivity('lab.results.entered', {
  test_id: testId,
  patient_id: patientId,
  test_name: testName,
  result_value: resultValue,
  technician_id: user.id
});
```

#### D. Doctor Reviews Results
```typescript
// In DoctorDashboard.tsx - when viewing lab results
await logActivity('doctor.lab_results.reviewed', {
  test_id: testId,
  patient_id: patientId,
  test_name: testName,
  doctor_id: user.id
});
```

---

## 2. User Login/Logout

### Where to Add:
- **Auth Context** or **Login Page** - Track authentication events

### Implementation:

#### A. User Login
```typescript
// In your auth context or login handler (after successful login)
import { logActivity } from '@/lib/utils';

// After supabase.auth.signInWithPassword succeeds
const { data: { user } } = await supabase.auth.getUser();

await logActivity('user.login', {
  user_id: user.id,
  email: user.email,
  role: user.user_metadata?.role || 'unknown',
  login_method: 'password'
});
```

#### B. User Logout
```typescript
// In your logout handler (before or after signOut)
const { data: { user } } = await supabase.auth.getUser();

await logActivity('user.logout', {
  user_id: user?.id,
  email: user?.email
});

await supabase.auth.signOut();
```

---

## 3. User Create/Update/Delete

### Where to Add:
- **Admin Dashboard** - User management section

### Implementation:

#### A. User Created
```typescript
// In AdminDashboard.tsx - after creating new user
await logActivity('admin.user.created', {
  new_user_id: newUser.id,
  email: newUser.email,
  full_name: newUser.full_name,
  role: assignedRole,
  created_by: currentUser.id
});
```

#### B. User Updated
```typescript
// In AdminDashboard.tsx - after updating user
await logActivity('admin.user.updated', {
  user_id: userId,
  updated_fields: Object.keys(updatedData),
  new_role: updatedData.role,
  updated_by: currentUser.id
});
```

#### C. User Deleted
```typescript
// In AdminDashboard.tsx - after deleting user
await logActivity('admin.user.deleted', {
  deleted_user_id: userId,
  email: userEmail,
  full_name: userFullName,
  deleted_by: currentUser.id
});
```

---

## 4. Nurse Vitals Recording

### Where to Add:
- **Nurse Dashboard** - When recording patient vitals

### Implementation:

#### A. Vitals Recorded
```typescript
// In NurseDashboard.tsx - after saving vitals
await logActivity('nurse.vitals.recorded', {
  patient_id: patientId,
  visit_id: visitId,
  vitals: {
    blood_pressure: vitals.blood_pressure,
    temperature: vitals.temperature,
    pulse: vitals.pulse,
    respiratory_rate: vitals.respiratory_rate,
    weight: vitals.weight,
    height: vitals.height
  },
  nurse_id: user.id
});
```

#### B. Assessment Completed
```typescript
// In NurseDashboard.tsx - after completing assessment
await logActivity('nurse.assessment.completed', {
  patient_id: patientId,
  visit_id: visitId,
  assessment_notes: notes,
  nurse_id: user.id
});
```

#### C. Patient Moved to Doctor
```typescript
// In NurseDashboard.tsx - when sending patient to doctor
await logActivity('nurse.patient.moved_to_doctor', {
  patient_id: patientId,
  visit_id: visitId,
  from_stage: 'nurse',
  to_stage: 'doctor',
  nurse_id: user.id
});
```

---

## 📋 Implementation Checklist

### Lab Tests
- [ ] Doctor orders lab test
- [ ] Lab receives test order
- [ ] Lab enters results
- [ ] Doctor reviews results

### Authentication
- [ ] User login
- [ ] User logout

### User Management
- [ ] User created
- [ ] User updated
- [ ] User deleted

### Nurse Activities
- [ ] Vitals recorded
- [ ] Assessment completed
- [ ] Patient moved to doctor

---

## 🔍 How to Verify Logs

After implementing, verify logs appear in:

1. **Admin Dashboard** → Activity Logs tab
2. Filter by action type to see specific logs
3. Click "View Details" to see full JSON data

---

## 💡 Tips

1. **Always include relevant IDs**: patient_id, user_id, visit_id, etc.
2. **Use consistent naming**: `role.entity.action` format
3. **Log after success**: Only log when action completes successfully
4. **Include context**: Add details that help understand what happened
5. **Don't log sensitive data**: Avoid passwords, full credit cards, etc.

---

**Last Updated:** November 15, 2025
