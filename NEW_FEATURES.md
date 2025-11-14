# New Features Implementation

## 1. Reception Payment Collection

### Feature
Reception staff now collects consultation fees (default: TSh 2,000) before checking in patients.

### How it Works
1. When receptionist clicks "Check In" for an appointment, a payment dialog appears
2. Receptionist enters the amount paid and payment method (Cash/Mobile Money/Card)
3. System calculates change if overpayment
4. Payment is recorded in the database
5. Patient is then checked in and sent to nurse queue

### Components
- `src/components/PaymentDialog.tsx` - Payment collection dialog
- Payment records stored in `payments` table

### Usage
- Default fee: TSh 2,000
- Admin can change this fee in Admin Reports > Settings
- Payment methods: Cash, Mobile Money, Card

---

## 2. Admin Settings for Consultation Fee

### Feature
Admin can now configure the consultation fee from the Admin Reports dashboard.

### How it Works
1. Go to Admin Reports
2. Click "Settings" button
3. Update "Consultation Fee" field
4. Click "Save"
5. New fee applies immediately to all future check-ins

### Components
- `src/components/AdminReports.tsx` - Enhanced with settings dialog
- Settings stored in `system_settings` table

### Configuration
- Key: `consultation_fee`
- Default: 2000 (TSh)
- Can be changed anytime by admin

---

## 3. Enhanced Pharmacy Dispensing

### Feature
Pharmacists now input detailed information when dispensing medications, including:
- Actual dosage instructions (can correct doctor errors)
- Dosage strength in mg
- Quantity dispensed
- Stock availability status
- Out-of-stock handling with reasons and alternatives
- Pharmacist notes

### How it Works
1. Pharmacist clicks "Dispense" on a pending prescription
2. Enhanced dialog shows:
   - Prescription details
   - Current stock status (with warnings for low/out of stock)
   - Dosage verification fields
   - Stock status selection
3. If medication is in stock:
   - Pharmacist verifies/corrects dosage
   - Enters dosage strength (mg)
   - Confirms quantity to dispense
   - Adds any notes
   - Clicks "Dispense Medication"
4. If medication is out of stock:
   - Pharmacist selects "Out of Stock / Not Available"
   - Enters reason for non-availability
   - Suggests alternative medication (optional)
   - Prescription remains pending with notes

### Components
- `src/components/DispenseDialog.tsx` - Enhanced dispensing dialog
- `src/pages/PharmacyDashboard.tsx` - Updated to use new dialog
- Additional fields in `prescriptions` table:
  - `actual_dosage` - Verified dosage instructions
  - `dosage_mg` - Dosage strength
  - `quantity_dispensed` - Actual quantity given
  - `pharmacist_notes` - Additional notes

### Benefits
- Prevents dispensing errors from incorrect prescriptions
- Tracks stock issues and alternatives
- Provides audit trail of pharmacist actions
- Improves patient safety

---

## Database Changes

### New Tables
1. **payments** - Stores payment records
   - patient_id, amount, payment_method, payment_type, status, payment_date

2. **system_settings** - Stores system configuration
   - key, value, description

### Modified Tables
1. **prescriptions** - Added columns:
   - actual_dosage
   - dosage_mg
   - quantity_dispensed
   - pharmacist_notes

### Migration
Run the migration file: `supabase/migrations/20240115_add_payment_and_settings.sql`

---

## Testing

### Test Reception Payment
1. Create an appointment
2. Click "Check In"
3. Payment dialog should appear with TSh 2,000 default
4. Enter amount and payment method
5. Verify payment is recorded and patient is checked in

### Test Admin Settings
1. Go to Admin Reports
2. Click Settings
3. Change consultation fee to 3000
4. Save
5. Create new appointment and verify new fee is used

### Test Pharmacy Dispensing
1. Create a prescription
2. Go to Pharmacy Dashboard
3. Click "Dispense" on pending prescription
4. Enhanced dialog should show stock status
5. Fill in dosage details
6. Test both "in stock" and "out of stock" scenarios

---

## Notes

- All features include proper error handling
- Payment records are auditable
- Stock warnings help prevent dispensing errors
- System is backwards compatible with existing data
