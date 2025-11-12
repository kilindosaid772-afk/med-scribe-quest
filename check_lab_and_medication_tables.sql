-- ============================================
-- CHECK LAB TEST CATALOG AND MEDICATIONS TABLES
-- ============================================
-- Run this to check if the required tables exist and have data

-- ============================================
-- STEP 1: Check if lab_test_catalog table exists
-- ============================================

SELECT 
  '=== LAB TEST CATALOG TABLE ===' as step,
  COUNT(*) as total_tests
FROM lab_test_catalog;

-- Show sample lab tests
SELECT 
  '=== SAMPLE LAB TESTS ===' as step,
  id,
  test_name,
  test_type,
  description
FROM lab_test_catalog
ORDER BY test_name
LIMIT 10;

-- ============================================
-- STEP 2: Check if medications table exists
-- ============================================

SELECT 
  '=== MEDICATIONS TABLE ===' as step,
  COUNT(*) as total_medications
FROM medications;

-- Show sample medications
SELECT 
  '=== SAMPLE MEDICATIONS ===' as step,
  id,
  name,
  strength,
  dosage_form,
  description
FROM medications
ORDER BY name
LIMIT 10;

-- ============================================
-- STEP 3: If tables are empty, create sample data
-- ============================================

-- Insert sample lab tests if none exist
INSERT INTO lab_test_catalog (test_name, test_type, description)
SELECT * FROM (VALUES
  ('Complete Blood Count (CBC)', 'Hematology', 'Measures different components of blood'),
  ('Blood Glucose', 'Chemistry', 'Measures blood sugar levels'),
  ('Lipid Panel', 'Chemistry', 'Cholesterol and triglycerides'),
  ('Liver Function Test (LFT)', 'Chemistry', 'Evaluates liver health'),
  ('Kidney Function Test', 'Chemistry', 'Evaluates kidney health'),
  ('Urinalysis', 'Urinalysis', 'Examines urine composition'),
  ('Thyroid Function Test', 'Endocrinology', 'Measures thyroid hormones'),
  ('Hemoglobin A1C', 'Chemistry', 'Average blood sugar over 3 months'),
  ('Electrolytes Panel', 'Chemistry', 'Sodium, potassium, chloride levels'),
  ('X-Ray Chest', 'Radiology', 'Chest X-ray imaging')
) AS t(test_name, test_type, description)
WHERE NOT EXISTS (SELECT 1 FROM lab_test_catalog LIMIT 1);

-- Insert sample medications if none exist
INSERT INTO medications (name, strength, dosage_form, description)
SELECT * FROM (VALUES
  ('Amoxicillin', '500mg', 'Capsule', 'Antibiotic for bacterial infections'),
  ('Paracetamol', '500mg', 'Tablet', 'Pain reliever and fever reducer'),
  ('Ibuprofen', '400mg', 'Tablet', 'Anti-inflammatory pain reliever'),
  ('Metformin', '500mg', 'Tablet', 'Diabetes medication'),
  ('Omeprazole', '20mg', 'Capsule', 'Reduces stomach acid'),
  ('Amlodipine', '5mg', 'Tablet', 'Blood pressure medication'),
  ('Atorvastatin', '20mg', 'Tablet', 'Cholesterol medication'),
  ('Ciprofloxacin', '500mg', 'Tablet', 'Antibiotic'),
  ('Azithromycin', '250mg', 'Tablet', 'Antibiotic'),
  ('Cetirizine', '10mg', 'Tablet', 'Antihistamine for allergies')
) AS m(name, strength, dosage_form, description)
WHERE NOT EXISTS (SELECT 1 FROM medications LIMIT 1);

-- ============================================
-- STEP 4: Verify data was inserted
-- ============================================

SELECT 
  '=== VERIFICATION ===' as step,
  (SELECT COUNT(*) FROM lab_test_catalog) as lab_tests_count,
  (SELECT COUNT(*) FROM medications) as medications_count;

SELECT '✓ COMPLETE - Tables checked and sample data added if needed!' as final_status;
