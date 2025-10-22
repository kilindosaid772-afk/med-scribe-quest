-- Add discharge-related fields to patient_visits table
ALTER TABLE public.patient_visits
ADD COLUMN IF NOT EXISTS discharge_date DATE,
ADD COLUMN IF NOT EXISTS discharge_time TIME,
ADD COLUMN IF NOT EXISTS discharge_type TEXT DEFAULT 'Regular' CHECK (discharge_type IN ('Regular', 'Emergency', 'Transfer', 'Against Medical Advice')),
ADD COLUMN IF NOT EXISTS discharge_instructions TEXT,
ADD COLUMN IF NOT EXISTS medications_summary TEXT,
ADD COLUMN IF NOT EXISTS follow_up_date DATE,
ADD COLUMN IF NOT EXISTS follow_up_doctor TEXT,
ADD COLUMN IF NOT EXISTS follow_up_notes TEXT,
ADD COLUMN IF NOT EXISTS discharge_completed_at TIMESTAMP WITH TIME ZONE;

-- Create index for discharge_date queries
CREATE INDEX IF NOT EXISTS idx_patient_visits_discharge_date ON public.patient_visits(discharge_date);

-- Create index for follow_up_date queries
CREATE INDEX IF NOT EXISTS idx_patient_visits_follow_up_date ON public.patient_visits(follow_up_date);
