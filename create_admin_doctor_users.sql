-- Script to create admin and doctor users
-- Run this in your Supabase SQL editor or through the Supabase CLI

-- 1. First, let's check if these users already exist
SELECT email, full_name FROM public.profiles WHERE email IN ('admin@hospital.com', 'doctor@hospital.com');

-- 2. If they don't exist, you need to create them in Supabase Auth first
-- Go to Authentication > Users in your Supabase dashboard and create:
-- Admin User: admin@hospital.com / password: Admin123!
-- Doctor User: doctor@hospital.com / password: Doctor123!

-- 3. After creating users in Auth, run this to assign proper roles:
INSERT INTO public.user_roles (user_id, role, is_primary)
SELECT
  p.id,
  CASE
    WHEN p.email = 'admin@hospital.com' THEN 'admin'::app_role
    WHEN p.email = 'doctor@hospital.com' THEN 'doctor'::app_role
  END,
  true
FROM public.profiles p
WHERE p.email IN ('admin@hospital.com', 'doctor@hospital.com')
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id
);

-- 4. Verify the roles were assigned
SELECT p.email, p.full_name, ur.role, ur.is_primary
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id
WHERE p.email IN ('admin@hospital.com', 'doctor@hospital.com')
ORDER BY p.email;
