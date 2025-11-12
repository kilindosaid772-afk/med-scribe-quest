-- Add columns to track when lab results have been reviewed by doctor
-- This ensures patients only appear in "Lab Results Queue" until doctor reviews them

-- Add lab_results_reviewed flag
ALTER TABLE patient_visits 
ADD COLUMN IF NOT EXISTS lab_results_reviewed BOOLEAN DEFAULT FALSE;

-- Add timestamp for when lab results were reviewed
ALTER TABLE patient_visits 
ADD COLUMN IF NOT EXISTS lab_results_reviewed_at TIMESTAMPTZ;

-- Add comment to explain the columns
COMMENT ON COLUMN patient_visits.lab_results_reviewed IS 
'Indicates whether the doctor has reviewed the lab results for this visit';

COMMENT ON COLUMN patient_visits.lab_results_reviewed_at IS 
'Timestamp when the doctor reviewed the lab results';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_patient_visits_lab_reviewed 
ON patient_visits(lab_results_reviewed) 
WHERE lab_completed_at IS NOT NULL;

-- Update existing records: mark as reviewed if doctor_status is Completed
UPDATE patient_visits 
SET 
  lab_results_reviewed = TRUE,
  lab_results_reviewed_at = doctor_completed_at
WHERE 
  lab_completed_at IS NOT NULL 
  AND doctor_status = 'Completed'
  AND lab_results_reviewed IS NULL;

SELECT 'Lab results reviewed columns added successfully!' AS status;