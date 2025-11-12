# Fix for Lab Tests and Prescriptions Not Loading ✅

## Problem
- Lab test dialog shows "No lab tests available"
- Prescription dialog doesn't show medications
- Cannot order lab tests or write prescriptions

## Root Cause
The required database tables (`lab_test_catalog` and `medications`) either:
1. Don't exist in the database
2. Exist but are empty
3. Have RLS policies blocking access

## Solution

### Run This SQL Script: `create_lab_and_medication_tables.sql`

This script will:
1. ✅ Create `lab_test_catalog` table
2. ✅ Create `medications` table
3. ✅ Set up proper RLS policies
4. ✅ Insert 20 sample lab tests
5. ✅ Insert 20 sample medications

### How to Run:

1. **Open Supabase Dashboard** → SQL Editor
2. **Copy and paste** the entire contents of `create_lab_and_medication_tables.sql`
3. **Click "Run"**
4. **Wait for** "✓ COMPLETE" message
5. **Refresh your browser**

## What Gets Created

### Lab Test Catalog (20 tests):
- Complete Blood Count (CBC)
- Blood Glucose (Fasting & Random)
- Lipid Panel
- Liver Function Test
- Kidney Function Test
- Urinalysis
- Thyroid Function Test
- Hemoglobin A1C
- Electrolytes Panel
- Malaria Test
- HIV Test
- Hepatitis B Test
- Pregnancy Test
- Stool Analysis
- X-Ray Chest
- Ultrasound Abdomen
- ECG
- Blood Culture
- Sputum Culture

### Medications (20 medications):
- Amoxicillin (Antibiotic)
- Paracetamol (Pain reliever)
- Ibuprofen (Anti-inflammatory)
- Metformin (Diabetes)
- Omeprazole (Acid reducer)
- Amlodipine (Blood pressure)
- Atorvastatin (Cholesterol)
- Ciprofloxacin (Antibiotic)
- Azithromycin (Antibiotic)
- Cetirizine (Allergy)
- Artemether/Lumefantrine (Malaria)
- Doxycycline (Antibiotic)
- Prednisolone (Steroid)
- Salbutamol (Asthma inhaler)
- Enalapril (Blood pressure)
- Furosemide (Diuretic)
- Insulin (Diabetes)
- Diclofenac (Pain)
- Ceftriaxone (Injectable antibiotic)
- Multivitamin (Supplement)

## Testing After Fix

### Test Lab Test Ordering:
1. Go to Doctor Dashboard
2. Find a pending patient
3. Click "Order Lab Tests"
4. ✅ Should see list of 20 lab tests
5. Select a few tests (e.g., CBC, Blood Glucose)
6. Set priority to "Routine"
7. Click "Order X Test(s)"
8. ✅ Should see success message
9. ✅ Patient should move to lab queue

### Test Prescription Writing:
1. Go to Doctor Dashboard
2. Find a pending patient
3. Click "Write Prescription"
4. ✅ Should see dropdown with 20 medications
5. Select "Amoxicillin"
6. Fill in:
   - Dosage: 500mg
   - Frequency: Three times daily
   - Duration: 7 days
   - Quantity: 21 tablets
   - Instructions: Take with food
7. Click "Write Prescription"
8. ✅ Should see success message

## Troubleshooting

### Still Not Loading?

**Check if tables exist:**
```sql
SELECT COUNT(*) FROM lab_test_catalog;
SELECT COUNT(*) FROM medications;
```

**Check RLS policies:**
```sql
-- Check if you have doctor role
SELECT has_role(auth.uid(), 'doctor');
```

**Check for errors in browser console:**
1. Open DevTools (F12)
2. Go to Console tab
3. Click "Order Lab Tests" or "Write Prescription"
4. Look for error messages

### Common Errors:

**"relation lab_test_catalog does not exist"**
- Solution: Run the SQL script to create tables

**"permission denied for table lab_test_catalog"**
- Solution: Ensure you have doctor role assigned
- Run: `INSERT INTO user_roles (user_id, role) VALUES (auth.uid(), 'doctor');`

**"No lab tests available" but table has data**
- Solution: Check RLS policies
- The policy allows: admin, doctor, nurse, pharmacist roles

## Adding More Items

### Add More Lab Tests:
```sql
INSERT INTO lab_test_catalog (test_name, test_type, description, price)
VALUES ('Your Test Name', 'Test Type', 'Description', 25.00);
```

### Add More Medications:
```sql
INSERT INTO medications (name, strength, dosage_form, description, category, price, stock_quantity)
VALUES ('Medication Name', '500mg', 'Tablet', 'Description', 'Category', 0.50, 500);
```

## Files Created

1. `create_lab_and_medication_tables.sql` - Main setup script
2. `check_lab_and_medication_tables.sql` - Verification script

## What's Fixed

After running the SQL script:
- ✅ Lab test catalog populated with 20 tests
- ✅ Medications catalog populated with 20 medications
- ✅ RLS policies configured correctly
- ✅ Doctor can order lab tests
- ✅ Doctor can write prescriptions
- ✅ Proper pricing and stock tracking
- ✅ Categorized by type/category

The consultation workflow is now fully operational!
