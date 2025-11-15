# Activity Logging Implementation Guide

## Current Status.

Activity logging is **partially implemented**. Some actions are tracked, but many important activities are missing.

## Currently Logged Activities

### ✅ Receptionist
- `appointment.check_in` - Patient check-in
- `appointment.cancel` - Appointment cancellation
- `patient.register` - New patient registration

### ✅ Pharmacy
- `pharmacy.dispense.start` - Dispensing started
- `pharmacy.dispense.success` - Prescription dispensed
- `pharmacy.dispense.error` - Dispensing errors
- `pharmacy.visit.moved_to_billing` - Patient moved to billing

### ✅ Admin
- `settings.update` - System settings updated
- `patient.create` - Patient created
- `user.role.assigned` - Role assigned to user
- `service.add` - Medical service added
- `service.import` - Bulk service import

## ❌ Missing Critical Logs

### Doctor Activities
- ❌ Consultation started
- ✅ Consultation completed
- ✅ Prescription written
- ❌ Lab test ordered
- ❌ Lab results reviewed
- ❌ Diagnosis recorded

### Nurse Activities
- ❌ Vitals recorded
- ❌ Patient assessment
- ❌ Notes added
- ❌ Patient moved to doctor

### Lab Activities
- ❌ Test received
- ❌ Test started
- ❌ Results entered
- ❌ Results approved
- ❌ Results sent to doctor

### Billing Activities
- ❌ Invoice created
- ✅ Payment received
- ❌ Payment method used
- ❌ Receipt generated
- ❌ Insurance claim submitted

### User Management
- ❌ User created
- ❌ User updated
- ❌ User deleted
- ❌ User login
- ❌ User logout
- ❌ Password changed

## How to Add Logging

### Import the function
```typescript
import { logActivity } from '@/lib/utils';
```

### Add logging to actions
```typescript
// Example: After creating a prescription
await logActivity('doctor.prescription.created', {
  prescription_id: newPrescription.id,
  patient_id: patientId,
  medication: medicationName,
  doctor_id: user.id
});

// Example: After recording vitals
await logActivity('nurse.vitals.recorded', {
  patient_id: patientId,
  visit_id: visitId,
  blood_pressure: vitals.blood_pressure,
  temperature: vitals.temperature
});

// Example: After payment
await logActivity('billing.payment.received', {
  invoice_id: invoiceId,
  amount: paymentAmount,
  payment_method: method,
  patient_id: patientId
});
```

## Recommended Actions to Log

### Format: `role.entity.action`

#### Doctor
```typescript
'doctor.consultation.started'
'doctor.consultation.completed'
'doctor.prescription.created'
'doctor.lab_test.ordered'
'doctor.lab_results.reviewed'
'doctor.diagnosis.recorded'
'doctor.patient.referred'
```

#### Nurse
```typescript
'nurse.vitals.recorded'
'nurse.assessment.completed'
'nurse.notes.added'
'nurse.patient.moved_to_doctor'
'nurse.medication.administered'
```

#### Lab
```typescript
'lab.test.received'
'lab.test.started'
'lab.results.entered'
'lab.results.approved'
'lab.results.sent'
'lab.sample.collected'
```

#### Pharmacy
```typescript
'pharmacy.prescription.received'
'pharmacy.medication.dispensed'
'pharmacy.stock.updated'
'pharmacy.medication.returned'
```

#### Billing
```typescript
'billing.invoice.created'
'billing.payment.received'
'billing.payment.refunded'
'billing.insurance.claimed'
'billing.receipt.generated'
```

#### Admin
```typescript
'admin.user.created'
'admin.user.updated'
'admin.user.deleted'
'admin.role.assigned'
'admin.settings.updated'
'admin.department.created'
```

#### Receptionist
```typescript
'receptionist.patient.registered'
'receptionist.appointment.booked'
'receptionist.appointment.cancelled'
'receptionist.patient.checked_in'
```

## Details to Include

Always include relevant IDs and key information:

```typescript
{
  user_id: currentUser.id,          // Who did it
  patient_id: patient.id,            // Who it affects
  entity_id: prescription.id,        // What was modified
  timestamp: new Date().toISOString(), // When (auto-added)
  // Additional context
  medication_name: "Amoxicillin",
  quantity: 14,
  status: "completed"
}
```

## Implementation Priority

### High Priority (Implement First)
1. ❌ User login/logout - **NEEDS IMPLEMENTATION**
2. ✅ Payment received
3. ✅ Prescription created
4. ❌ Lab test ordered - **NEEDS IMPLEMENTATION**
5. ❌ Lab results entered - **NEEDS IMPLEMENTATION**
6. ❌ Vitals recorded - **NEEDS IMPLEMENTATION**

### Medium Priority
7. ✅ Consultation completed
8. ❌ Invoice created
9. ❌ User created/deleted - **NEEDS IMPLEMENTATION**
10. ✅ Medication dispensed

### Low Priority
11. ✅ Settings updated
12. Notes added
13. Patient moved between stages
14. Stock updated

## 🎯 Priority Logs to Implement

### 1. Lab Test Orders and Results
```typescript
// When doctor orders a lab test
await logActivity('doctor.lab_test.ordered', {
  patient_id: patientId,
  visit_id: visitId,
  test_name: testName,
  doctor_id: user.id
});

// When lab receives test order
await logActivity('lab.test.received', {
  test_id: testId,
  patient_id: patientId,
  test_name: testName
});

// When lab enters results
await logActivity('lab.results.entered', {
  test_id: testId,
  patient_id: patientId,
  test_name: testName,
  technician_id: user.id
});

// When doctor reviews results
await logActivity('doctor.lab_results.reviewed', {
  test_id: testId,
  patient_id: patientId,
  doctor_id: user.id
});
```

### 2. User Login/Logout
```typescript
// In your auth context or login handler
await logActivity('user.login', {
  user_id: user.id,
  email: user.email,
  role: user.role
});

// On logout
await logActivity('user.logout', {
  user_id: user.id,
  session_duration: calculateDuration()
});
```

### 3. User Create/Update/Delete
```typescript
// When admin creates a user
await logActivity('admin.user.created', {
  new_user_id: newUser.id,
  email: newUser.email,
  role: newUser.role,
  created_by: currentUser.id
});

// When admin updates a user
await logActivity('admin.user.updated', {
  user_id: userId,
  updated_fields: ['role', 'email'],
  updated_by: currentUser.id
});

// When admin deletes a user
await logActivity('admin.user.deleted', {
  deleted_user_id: userId,
  email: userEmail,
  deleted_by: currentUser.id
});
```

### 4. Nurse Vitals Recording
```typescript
// When nurse records vitals
await logActivity('nurse.vitals.recorded', {
  patient_id: patientId,
  visit_id: visitId,
  vitals: {
    blood_pressure: vitals.blood_pressure,
    temperature: vitals.temperature,
    pulse: vitals.pulse,
    weight: vitals.weight
  },
  nurse_id: user.id
});

// When nurse completes assessment
await logActivity('nurse.assessment.completed', {
  patient_id: patientId,
  visit_id: visitId,
  nurse_id: user.id
});

// When nurse moves patient to doctor
await logActivity('nurse.patient.moved_to_doctor', {
  patient_id: patientId,
  visit_id: visitId,
  from_stage: 'nurse',
  to_stage: 'doctor',
  nurse_id: user.id
});
```

## Quick Implementation

Add this to each major action in your dashboards:

```typescript
try {
  // Your action code here
  const result = await performAction();
  
  // Log success
  await logActivity('role.entity.action', {
    entity_id: result.id,
    // other relevant details
  });
  
  toast.success('Action completed');
} catch (error) {
  // Log error
  await logActivity('role.entity.action.error', {
    error: error.message,
    // context
  });
  
  toast.error('Action failed');
}
```

## Viewing Logs

Logs can be viewed in:
1. Admin Dashboard → Activity Logs section
2. Each log shows:
   - Action type
   - User who performed it
   - Timestamp
   - Details in JSON format

## Database Schema

The `activity_logs` table has:
- `id` - UUID
- `action` - String (e.g., 'doctor.prescription.created')
- `user_id` - UUID (who did it)
- `details` - JSONB (additional context)
- `created_at` - Timestamp

## Best Practices

1. ✅ **Always log critical actions** (payments, prescriptions, results)
2. ✅ **Include relevant IDs** (patient_id, user_id, entity_id)
3. ✅ **Use consistent naming** (role.entity.action)
4. ✅ **Log both success and errors**
5. ✅ **Don't log sensitive data** (passwords, full credit card numbers)
6. ❌ **Don't log too frequently** (avoid logging every keystroke)
7. ❌ **Don't log personal health details** (use IDs instead)

## Next Steps

1. Review each dashboard file
2. Identify critical actions
3. Add `logActivity()` calls after each action
4. Test to ensure logs appear in Admin Dashboard
5. Monitor log volume and adjust as needed

---

**Last Updated:** November 15, 2025
