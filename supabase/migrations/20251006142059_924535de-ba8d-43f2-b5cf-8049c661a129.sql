-- Add is_primary column to user_roles to track active role
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Create function to ensure only one primary role per user
CREATE OR REPLACE FUNCTION public.ensure_single_primary_role()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting this role as primary, unset all other primary roles for this user
  IF NEW.is_primary = true THEN
    UPDATE public.user_roles 
    SET is_primary = false 
    WHERE user_id = NEW.user_id 
    AND id != NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to enforce single primary role
DROP TRIGGER IF EXISTS ensure_single_primary_role_trigger ON public.user_roles;
CREATE TRIGGER ensure_single_primary_role_trigger
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_primary_role();

-- Create function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_primary_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id AND is_primary = true
  LIMIT 1;
$$;

-- Update RLS policy to allow users to view if a role is primary
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Allow admins to update is_primary field
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Set first role as primary for existing users
UPDATE public.user_roles ur1
SET is_primary = true
WHERE id IN (
  SELECT DISTINCT ON (user_id) id
  FROM public.user_roles ur2
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles ur3
    WHERE ur3.user_id = ur2.user_id AND ur3.is_primary = true
  )
  ORDER BY user_id, created_at ASC
);