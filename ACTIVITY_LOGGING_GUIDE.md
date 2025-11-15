# Activity Logging Implementation Guide

## Current Status

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
- ❌ Consultation completed
- ❌ Prescription written
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
- ❌ Payment received
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
1. ✅ User login/logout
2. ✅ Payment received
3. ✅ Prescription created
4. ✅ Lab results entered
5. ✅ Vitals recorded

### Medium Priority
6. Consultation completed
7. Invoice created
8. User created/deleted
9. Lab test ordered
10. Medication dispensed (already done)

### Low Priority
11. Settings updated (already done)
12. Notes added
13. Patient moved between stages
14. Stock updated

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
