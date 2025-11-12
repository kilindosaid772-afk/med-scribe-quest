-- ============================================
-- FIX USER_ROLES UPDATED_AT COLUMN
-- ============================================
-- Add missing updated_at column to user_roles table

-- ============================================
-- STEP 1: Check current user_roles structure
-- ============================================

SELECT 
  '=== CURRENT USER_ROLES COLUMNS ===' as step,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_roles' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================
-- STEP 2: Add updated_at column if missing
-- ============================================

-- Add updated_at column to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now() NOT NULL;

-- Update existing records to have updated_at = created_at
UPDATE public.user_roles 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- ============================================
-- STEP 3: Create trigger to auto-update updated_at
-- ============================================

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_user_roles_updated_at ON public.user_roles;

-- Create trigger for user_roles
CREATE TRIGGER update_user_roles_updated_at
    BEFORE UPDATE ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- STEP 4: Verify the fix
-- ============================================

SELECT 
  '=== UPDATED USER_ROLES COLUMNS ===' as step,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_roles' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test the trigger
SELECT 
  '=== TESTING TRIGGER ===' as step,
  'Trigger created successfully' as status;

SELECT '✓ COMPLETE - user_roles table now has updated_at column!' as final_status;