-- Assign billing role to current user (for billing dashboard access)
-- Replace 'YOUR_USER_EMAIL' with the actual email of the user who needs billing access

-- First, find the user by email
INSERT INTO public.user_roles (user_id, role)
SELECT
  id,
  'billing'
FROM auth.users
WHERE email = 'YOUR_USER_EMAIL' -- Replace with the actual billing user email
ON CONFLICT (user_id, role) DO NOTHING;

-- Alternative: If you know the user ID directly, use this instead:
-- INSERT INTO public.user_roles (user_id, role) VALUES ('USER_UUID_HERE', 'billing');

-- Verify the role was assigned
SELECT
  u.email,
  ur.role,
  ur.created_at as role_assigned_at
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.role = 'billing'
ORDER BY ur.created_at DESC;
