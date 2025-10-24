-- Create medical services table for patient-specific billing
CREATE TABLE IF NOT EXISTS public.medical_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_code TEXT NOT NULL UNIQUE,
  service_name TEXT NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('Consultation', 'Procedure', 'Surgery', 'Emergency', 'Ward Stay', 'Other')),
  description TEXT,
  base_price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'TSh',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create patient services table to track services provided
CREATE TABLE IF NOT EXISTS public.patient_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES public.patient_visits(id) ON DELETE SET NULL,
  service_id UUID NOT NULL REFERENCES public.medical_services(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  service_date DATE DEFAULT CURRENT_DATE,
  provided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  status TEXT DEFAULT 'Completed' CHECK (status IN ('Scheduled', 'In Progress', 'Completed', 'Cancelled')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.medical_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_services ENABLE ROW LEVEL SECURITY;

-- RLS Policies for medical_services
CREATE POLICY "Medical staff can view services"
ON public.medical_services FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'doctor'::app_role) OR
  has_role(auth.uid(), 'nurse'::app_role) OR
  has_role(auth.uid(), 'billing'::app_role)
);

CREATE POLICY "Admins can manage services"
ON public.medical_services FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for patient_services
CREATE POLICY "Medical staff can view patient services"
ON public.patient_services FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'doctor'::app_role) OR
  has_role(auth.uid(), 'nurse'::app_role) OR
  has_role(auth.uid(), 'billing'::app_role)
);

CREATE POLICY "Patients can view their own services"
ON public.patient_services FOR SELECT
TO authenticated
USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Medical staff can manage patient services"
ON public.patient_services FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'doctor'::app_role) OR
  has_role(auth.uid(), 'nurse'::app_role) OR
  has_role(auth.uid(), 'billing'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'doctor'::app_role) OR
  has_role(auth.uid(), 'nurse'::app_role) OR
  has_role(auth.uid(), 'billing'::app_role)
);

-- Create indexes
CREATE INDEX idx_medical_services_type ON public.medical_services(service_type);
CREATE INDEX idx_medical_services_active ON public.medical_services(is_active);
CREATE INDEX idx_patient_services_patient ON public.patient_services(patient_id);
CREATE INDEX idx_patient_services_visit ON public.patient_services(visit_id);
CREATE INDEX idx_patient_services_date ON public.patient_services(service_date);

-- Insert default medical services
INSERT INTO public.medical_services (service_code, service_name, service_type, description, base_price) VALUES
  ('CONS-GEN', 'General Consultation', 'Consultation', 'Standard doctor consultation', 50000.00),
  ('CONS-SPEC', 'Specialist Consultation', 'Consultation', 'Specialist doctor consultation', 75000.00),
  ('CONS-EMER', 'Emergency Consultation', 'Emergency', 'Emergency room consultation', 100000.00),
  ('PROC-XRAY', 'X-Ray', 'Procedure', 'Standard X-ray imaging', 25000.00),
  ('PROC-ULTRA', 'Ultrasound', 'Procedure', 'Ultrasound imaging', 40000.00),
  ('PROC-CT', 'CT Scan', 'Procedure', 'CT scan imaging', 150000.00),
  ('PROC-MRI', 'MRI Scan', 'Procedure', 'MRI scan imaging', 200000.00),
  ('SURG-MINOR', 'Minor Surgery', 'Surgery', 'Minor surgical procedure', 100000.00),
  ('SURG-MAJOR', 'Major Surgery', 'Surgery', 'Major surgical procedure', 300000.00),
  ('WARD-DAY', 'Day Ward Stay', 'Ward Stay', 'Daily ward accommodation', 20000.00),
  ('WARD-ICU', 'ICU Stay', 'Ward Stay', 'Intensive Care Unit daily stay', 100000.00),
  ('EMER-ROOM', 'Emergency Room Visit', 'Emergency', 'Emergency room visit and stabilization', 50000.00)
ON CONFLICT (service_code) DO NOTHING;

-- Create trigger for updating timestamps
CREATE TRIGGER update_medical_services_updated_at
BEFORE UPDATE ON public.medical_services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patient_services_updated_at
BEFORE UPDATE ON public.patient_services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to calculate patient total costs
CREATE OR REPLACE FUNCTION public.calculate_patient_total_cost(_patient_id UUID)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_cost DECIMAL(10,2) := 0;
BEGIN
  -- Sum up all patient services
  SELECT COALESCE(SUM(total_price), 0) INTO total_cost
  FROM public.patient_services
  WHERE patient_id = _patient_id AND status = 'Completed';

  -- Add medication costs from prescriptions
  SELECT total_cost + COALESCE(SUM(
    p.quantity * m.unit_price
  ), 0) INTO total_cost
  FROM public.prescriptions p
  JOIN public.medications m ON p.medication_id = m.id
  WHERE p.patient_id = _patient_id AND p.status = 'Dispensed';

  -- Add lab test costs (if there's a pricing system for lab tests)
  SELECT total_cost + COALESCE(SUM(
    CASE
      WHEN lt.test_type = 'Basic' THEN 25000
      WHEN lt.test_type = 'Advanced' THEN 50000
      WHEN lt.test_type = 'Specialized' THEN 75000
      ELSE 25000
    END
  ), 0) INTO total_cost
  FROM public.lab_tests lt
  WHERE lt.patient_id = _patient_id AND lt.status = 'Completed';

  RETURN total_cost;
END;
$$;

-- Create function to get patient services breakdown
CREATE OR REPLACE FUNCTION public.get_patient_services_breakdown(_patient_id UUID)
RETURNS TABLE(
  service_type TEXT,
  service_name TEXT,
  quantity INTEGER,
  unit_price DECIMAL(10,2),
  total_price DECIMAL(10,2),
  service_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  -- Patient services
  SELECT
    ms.service_type,
    ms.service_name,
    ps.quantity,
    ps.unit_price,
    ps.total_price,
    ps.service_date
  FROM public.patient_services ps
  JOIN public.medical_services ms ON ps.service_id = ms.id
  WHERE ps.patient_id = _patient_id AND ps.status = 'Completed'

  UNION ALL

  -- Medications
  SELECT
    'Medication' as service_type,
    m.name as service_name,
    p.quantity,
    m.unit_price,
    (p.quantity * m.unit_price) as total_price,
    p.prescribed_date::DATE as service_date
  FROM public.prescriptions p
  JOIN public.medications m ON p.medication_id = m.id
  WHERE p.patient_id = _patient_id AND p.status = 'Dispensed'

  UNION ALL

  -- Lab tests
  SELECT
    'Lab Test' as service_type,
    lt.test_name as service_name,
    1 as quantity,
    CASE
      WHEN lt.test_type = 'Basic' THEN 25000
      WHEN lt.test_type = 'Advanced' THEN 50000
      WHEN lt.test_type = 'Specialized' THEN 75000
      ELSE 25000
    END as unit_price,
    CASE
      WHEN lt.test_type = 'Basic' THEN 25000
      WHEN lt.test_type = 'Advanced' THEN 50000
      WHEN lt.test_type = 'Specialized' THEN 75000
      ELSE 25000
    END as total_price,
    lt.ordered_date::DATE as service_date
  FROM public.lab_tests lt
  WHERE lt.patient_id = _patient_id AND lt.status = 'Completed'

  ORDER BY service_date DESC, service_type;
END;
$$;
