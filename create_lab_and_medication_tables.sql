-- ============================================
-- CREATE LAB TEST CATALOG AND MEDICATIONS TABLES
-- ============================================
-- Run this in Supabase SQL Editor to create the required tables

-- ============================================
-- STEP 1: Create lab_test_catalog table
-- ============================================

CREATE TABLE IF NOT EXISTS public.lab_test_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name TEXT NOT NULL,
  test_type TEXT NOT NULL,
  description TEXT,
  normal_range TEXT,
  unit TEXT,
  price DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.lab_test_catalog ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lab_test_catalog
CREATE POLICY "Anyone can view lab test catalog"
  ON public.lab_test_catalog FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage lab test catalog"
  ON public.lab_test_catalog FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role)
  );

-- ============================================
-- STEP 2: Create medications table
-- ============================================

CREATE TABLE IF NOT EXISTS public.medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  generic_name TEXT,
  strength TEXT,
  dosage_form TEXT,
  description TEXT,
  category TEXT,
  manufacturer TEXT,
  price DECIMAL(10,2),
  stock_quantity INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for medications
CREATE POLICY "Medical staff can view medications"
  ON public.medications FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'doctor'::app_role) OR
    has_role(auth.uid(), 'nurse'::app_role) OR
    has_role(auth.uid(), 'pharmacist'::app_role)
  );

CREATE POLICY "Admins and pharmacists can manage medications"
  ON public.medications FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'pharmacist'::app_role)
  );

-- ============================================
-- STEP 3: Insert sample lab tests
-- ============================================

INSERT INTO public.lab_test_catalog (test_name, test_type, description, normal_range, unit, price) VALUES
  ('Complete Blood Count (CBC)', 'Hematology', 'Measures different components of blood including RBC, WBC, platelets', 'Varies by component', 'Various', 25.00),
  ('Blood Glucose (Fasting)', 'Chemistry', 'Measures blood sugar levels after fasting', '70-100 mg/dL', 'mg/dL', 10.00),
  ('Blood Glucose (Random)', 'Chemistry', 'Measures blood sugar levels at any time', '<140 mg/dL', 'mg/dL', 10.00),
  ('Lipid Panel', 'Chemistry', 'Cholesterol and triglycerides', 'Varies by component', 'mg/dL', 30.00),
  ('Liver Function Test (LFT)', 'Chemistry', 'Evaluates liver health - ALT, AST, Bilirubin', 'Varies by component', 'U/L', 35.00),
  ('Kidney Function Test', 'Chemistry', 'Creatinine, BUN, eGFR', 'Varies by component', 'mg/dL', 30.00),
  ('Urinalysis', 'Urinalysis', 'Examines urine composition and detects abnormalities', 'Normal', 'Various', 15.00),
  ('Thyroid Function Test (TSH)', 'Endocrinology', 'Measures thyroid stimulating hormone', '0.4-4.0 mIU/L', 'mIU/L', 40.00),
  ('Hemoglobin A1C', 'Chemistry', 'Average blood sugar over 3 months', '<5.7%', '%', 35.00),
  ('Electrolytes Panel', 'Chemistry', 'Sodium, potassium, chloride levels', 'Varies by component', 'mEq/L', 25.00),
  ('Malaria Test (RDT)', 'Microbiology', 'Rapid diagnostic test for malaria', 'Negative', 'Qualitative', 8.00),
  ('HIV Test', 'Serology', 'HIV antibody test', 'Negative', 'Qualitative', 20.00),
  ('Hepatitis B Surface Antigen', 'Serology', 'Tests for Hepatitis B infection', 'Negative', 'Qualitative', 25.00),
  ('Pregnancy Test (HCG)', 'Serology', 'Detects pregnancy hormone', 'Negative (if not pregnant)', 'Qualitative', 10.00),
  ('Stool Analysis', 'Microbiology', 'Examines stool for parasites and bacteria', 'Normal', 'Various', 15.00),
  ('X-Ray Chest', 'Radiology', 'Chest X-ray imaging', 'Normal', 'Image', 50.00),
  ('Ultrasound Abdomen', 'Radiology', 'Abdominal ultrasound', 'Normal', 'Image', 80.00),
  ('ECG (Electrocardiogram)', 'Cardiology', 'Records heart electrical activity', 'Normal sinus rhythm', 'Tracing', 30.00),
  ('Blood Culture', 'Microbiology', 'Detects bacteria in blood', 'No growth', 'Qualitative', 45.00),
  ('Sputum Culture', 'Microbiology', 'Identifies respiratory infections', 'Normal flora', 'Qualitative', 35.00)
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 4: Insert sample medications
-- ============================================

INSERT INTO public.medications (name, generic_name, strength, dosage_form, description, category, price, stock_quantity) VALUES
  ('Amoxicillin', 'Amoxicillin', '500mg', 'Capsule', 'Antibiotic for bacterial infections', 'Antibiotic', 0.50, 500),
  ('Paracetamol', 'Acetaminophen', '500mg', 'Tablet', 'Pain reliever and fever reducer', 'Analgesic', 0.10, 1000),
  ('Ibuprofen', 'Ibuprofen', '400mg', 'Tablet', 'Anti-inflammatory pain reliever', 'NSAID', 0.20, 800),
  ('Metformin', 'Metformin HCl', '500mg', 'Tablet', 'Diabetes medication - lowers blood sugar', 'Antidiabetic', 0.30, 600),
  ('Omeprazole', 'Omeprazole', '20mg', 'Capsule', 'Reduces stomach acid production', 'PPI', 0.40, 400),
  ('Amlodipine', 'Amlodipine', '5mg', 'Tablet', 'Blood pressure medication', 'Antihypertensive', 0.35, 500),
  ('Atorvastatin', 'Atorvastatin', '20mg', 'Tablet', 'Cholesterol lowering medication', 'Statin', 0.60, 300),
  ('Ciprofloxacin', 'Ciprofloxacin', '500mg', 'Tablet', 'Broad-spectrum antibiotic', 'Antibiotic', 0.80, 250),
  ('Azithromycin', 'Azithromycin', '250mg', 'Tablet', 'Antibiotic for respiratory infections', 'Antibiotic', 1.00, 200),
  ('Cetirizine', 'Cetirizine', '10mg', 'Tablet', 'Antihistamine for allergies', 'Antihistamine', 0.15, 600),
  ('Artemether/Lumefantrine', 'Artemether/Lumefantrine', '20/120mg', 'Tablet', 'Antimalarial medication', 'Antimalarial', 2.50, 300),
  ('Doxycycline', 'Doxycycline', '100mg', 'Capsule', 'Antibiotic for various infections', 'Antibiotic', 0.45, 400),
  ('Prednisolone', 'Prednisolone', '5mg', 'Tablet', 'Corticosteroid for inflammation', 'Steroid', 0.25, 350),
  ('Salbutamol', 'Salbutamol', '100mcg', 'Inhaler', 'Bronchodilator for asthma', 'Bronchodilator', 5.00, 100),
  ('Enalapril', 'Enalapril', '10mg', 'Tablet', 'ACE inhibitor for blood pressure', 'Antihypertensive', 0.40, 400),
  ('Furosemide', 'Furosemide', '40mg', 'Tablet', 'Diuretic for fluid retention', 'Diuretic', 0.20, 500),
  ('Insulin (Regular)', 'Human Insulin', '100IU/ml', 'Injection', 'Insulin for diabetes', 'Antidiabetic', 15.00, 50),
  ('Diclofenac', 'Diclofenac', '50mg', 'Tablet', 'NSAID for pain and inflammation', 'NSAID', 0.25, 600),
  ('Ceftriaxone', 'Ceftriaxone', '1g', 'Injection', 'Injectable antibiotic', 'Antibiotic', 3.00, 150),
  ('Multivitamin', 'Multivitamin', 'Various', 'Tablet', 'Daily vitamin supplement', 'Supplement', 0.30, 800)
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 5: Verify data
-- ============================================

SELECT 
  '=== LAB TESTS CREATED ===' as status,
  COUNT(*) as total_tests
FROM public.lab_test_catalog;

SELECT 
  '=== MEDICATIONS CREATED ===' as status,
  COUNT(*) as total_medications
FROM public.medications;

SELECT '✓ COMPLETE - Tables created and populated with sample data!' as final_status;
