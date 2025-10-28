# 🔧 Role Assignment Fix

## Problem
You're getting this error when trying to register patients:
```
ERROR: null value in column "user_id" of relation "user_roles" violates not-null constraint
```

This happens because your user account doesn't have the required role (receptionist, admin, etc.) to perform patient registration.

## Solutions

### ✅ **Solution 1: Use the Debug Dashboard (Recommended)**

1. **Go to Debug Dashboard**: Navigate to `/debug` in your application
2. **Check Your Current Roles**: See what roles you currently have
3. **Assign Receptionist Role**: Click the "Receptionist" button in the Role Assignment section
4. **Test Registration**: Use the "Test Patient Registration" button to verify it works
5. **Start Using**: Your patient registration should now work!

### ✅ **Solution 2: Use the Application Interface**

1. **In the Debug Dashboard** (`/debug`):
   - Look for the "Assign Roles" section
   - Click the **"Receptionist"** button
   - The role will be assigned automatically and your permissions will update

### ✅ **Solution 3: Manual SQL Assignment (If Above Don't Work)**

If you need to assign roles manually:

1. **Find Your User ID**:
   ```sql
   SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
   ```

2. **Assign Role Using Admin Account**:
   ```sql
   INSERT INTO public.user_roles (user_id, role, is_primary)
   VALUES ('YOUR_USER_ID', 'receptionist', true);
   ```

3. **Verify Assignment**:
   ```sql
   SELECT * FROM public.user_roles WHERE user_id = 'YOUR_USER_ID';
   ```

## Required Roles for Different Actions

| Action | Required Roles |
|--------|----------------|
| **Register Patients** | `receptionist` or `admin` |
| **View Patients** | `receptionist`, `doctor`, `nurse`, `admin` |
| **Create Appointments** | `receptionist`, `doctor`, `admin` |
| **Record Lab Tests** | `doctor`, `admin` |
| **Process Payments** | `billing`, `admin` |

## Testing Your Setup

After assigning the receptionist role:

1. **Go to Receptionist Dashboard** (`/receptionist`)
2. **Try Registering a Patient**: Click "Register New Patient"
3. **Verify Success**: You should see a success message and the patient should appear in the system

## Troubleshooting

### If You Still Can't Register Patients:

1. **Check Your Role Assignment**:
   - Visit `/debug` and verify you have the receptionist role
   - Check both "Frontend Roles" and "Database Roles" sections

2. **Try Refreshing**:
   - Refresh the page after role assignment
   - Clear browser cache if needed

3. **Check Database Permissions**:
   - Make sure RLS (Row Level Security) policies are working
   - Verify the `has_role` function is working correctly

### If Debug Dashboard Shows Role But Registration Still Fails:

1. **Check Database Connection**: Ensure Supabase is connected properly
2. **Verify RLS Policies**: The database policies might need adjustment
3. **Check User Session**: Make sure you're logged in with the correct account

## Quick Test

Run this query in your Supabase SQL editor to check your current permissions:

```sql
-- Check your current roles
SELECT
  'Current Roles:' as info,
  ur.role,
  ur.is_primary,
  p.full_name
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.user_id = auth.uid();

-- Test if you can create patients
SELECT
  'Can Create Patients:' as permission,
  CASE WHEN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'receptionist')
  ) THEN 'YES ✅' ELSE 'NO ❌' END as can_create;
```

## Need Help?

If you're still having issues:

1. **Check the Debug Dashboard** (`/debug`) for detailed information
2. **Review the SQL scripts** in the project root for manual fixes
3. **Check browser console** for any JavaScript errors
4. **Verify Supabase connection** and authentication status

The debug dashboard should show you exactly what roles you have and what permissions are missing!
