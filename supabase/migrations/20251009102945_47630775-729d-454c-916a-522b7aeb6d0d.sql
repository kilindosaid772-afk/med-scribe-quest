-- First create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create patient visits table for workflow tracking
CREATE TABLE IF NOT EXISTS public.patient_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  visit_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Workflow stages
  reception_status TEXT DEFAULT 'Pending' CHECK (reception_status IN ('Pending', 'Checked In', 'Completed')),
  reception_notes TEXT,
  reception_completed_at TIMESTAMP WITH TIME ZONE,
  
  nurse_status TEXT DEFAULT 'Pending' CHECK (nurse_status IN ('Pending', 'In Progress', 'Completed')),
  nurse_notes TEXT,
  nurse_vitals JSONB,
  nurse_completed_at TIMESTAMP WITH TIME ZONE,
  
  doctor_status TEXT DEFAULT 'Pending' CHECK (doctor_status IN ('Pending', 'In Consultation', 'Completed')),
  doctor_notes TEXT,
  doctor_diagnosis TEXT,
  doctor_completed_at TIMESTAMP WITH TIME ZONE,
  
  lab_status TEXT DEFAULT 'Not Required' CHECK (lab_status IN ('Not Required', 'Pending', 'In Progress', 'Completed')),
  lab_notes TEXT,
  lab_completed_at TIMESTAMP WITH TIME ZONE,
  
  pharmacy_status TEXT DEFAULT 'Not Required' CHECK (pharmacy_status IN ('Not Required', 'Pending', 'Dispensing', 'Completed')),
  pharmacy_notes TEXT,
  pharmacy_completed_at TIMESTAMP WITH TIME ZONE,
  
  billing_status TEXT DEFAULT 'Pending' CHECK (billing_status IN ('Pending', 'Invoiced', 'Paid')),
  billing_notes TEXT,
  billing_completed_at TIMESTAMP WITH TIME ZONE,
  
  current_stage TEXT DEFAULT 'reception' CHECK (current_stage IN ('reception', 'nurse', 'doctor', 'lab', 'pharmacy', 'billing', 'completed')),
  overall_status TEXT DEFAULT 'Active' CHECK (overall_status IN ('Active', 'Completed', 'Cancelled')),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.patient_visits ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Medical staff can view all visits"
ON public.patient_visits FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'doctor'::app_role) OR
  has_role(auth.uid(), 'nurse'::app_role) OR
  has_role(auth.uid(), 'receptionist'::app_role) OR
  has_role(auth.uid(), 'lab_tech'::app_role) OR
  has_role(auth.uid(), 'pharmacist'::app_role) OR
  has_role(auth.uid(), 'billing'::app_role)
);

CREATE POLICY "Patients can view their own visits"
ON public.patient_visits FOR SELECT
USING (
  patient_id IN (
    SELECT id FROM public.patients WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Medical staff can create visits"
ON public.patient_visits FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'receptionist'::app_role)
);

CREATE POLICY "Medical staff can update visits"
ON public.patient_visits FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'doctor'::app_role) OR
  has_role(auth.uid(), 'nurse'::app_role) OR
  has_role(auth.uid(), 'receptionist'::app_role) OR
  has_role(auth.uid(), 'lab_tech'::app_role) OR
  has_role(auth.uid(), 'pharmacist'::app_role) OR
  has_role(auth.uid(), 'billing'::app_role)
);

-- Create indexes for better performance
CREATE INDEX idx_patient_visits_patient ON public.patient_visits(patient_id);
CREATE INDEX idx_patient_visits_current_stage ON public.patient_visits(current_stage);
CREATE INDEX idx_patient_visits_visit_date ON public.patient_visits(visit_date);

-- Create trigger for updating timestamp
CREATE TRIGGER update_patient_visits_updated_at
BEFORE UPDATE ON public.patient_visits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for workflow updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_visits;