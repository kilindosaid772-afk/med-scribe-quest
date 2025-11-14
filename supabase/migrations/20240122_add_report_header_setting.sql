-- Add report_header to system_settings if it doesn't exist
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'report_header',
  'Healthcare Management System Report',
  'Custom header text for printed reports and documents'
)
ON CONFLICT (key) DO NOTHING;

-- Ensure hospital_name exists
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'hospital_name',
  'Medical Center',
  'Name of the hospital or clinic'
)
ON CONFLICT (key) DO NOTHING;
