-- Recreate the missing calculate_patient_total_cost RPC function
-- This function was defined in migration 20251023120000_create_medical_services.sql but appears to be missing from the database

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

-- Also recreate the get_patient_services_breakdown function
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
