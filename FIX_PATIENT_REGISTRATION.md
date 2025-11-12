# Patient Registration Fix ✅

## What Was Fixed

I've fixed the patient registration issue in your reception dashboard:

### 1. **Better Error Messages**
- Now shows specific error messages instead of generic "Failed to register patient"
- If you lack permissions, it tells you: "You need receptionist role to register patients"
- Shows the actual error from the database

### 2. **Gender Dropdown**
- Changed from text input to dropdown (Male/Female/Other)
- Prevents validation errors from typos

### 3. **Input Validation**
- Validates gender value before submitting
- Checks all required fields

## How to Fix the Role Issue

The most common problem is **missing receptionist role**. Here's how to fix it:

### Option 1: Automatic Fix (Recommended)

1. Open **Supabase Dashboard** → **SQL Editor**
2. Run the file: **`check_and_fix_receptionist.sql`**
3. Refresh your browser
4. Try registering a patient again

### Option 2: Manual Fix

If you prefer to do it manually:

1. Open **Supabase Dashboard** → **SQL Editor**
2. Run this SQL (replace with your email):

```sql
INSERT INTO user_roles (user_id, role, is_primary)
SELECT id, 'receptionist', true
FROM auth.users
WHERE email = 'your-email@example.com'
ON CONFLICT (user_id, role) DO NOTHING;
```

3. Refresh your browser

## Testing

After fixing the role:

1. Log in to your application
2. Go to Reception Dashboard
3. Click "Register New Patient"
4. Fill in the form:
   - Full Name: Test Patient
   - Date of Birth: 1990-01-01
   - Gender: Male (from dropdown)
   - Phone: +255700000000
5. Click "Register Patient"

You should see: "Patient registered and added to nurse queue successfully!"

## Still Having Issues?

If it still doesn't work, check the browser console (F12) for error messages and let me know what it says.

## Files Modified

- `src/pages/ReceptionistDashboard.tsx` - Improved error handling and gender dropdown
- `check_and_fix_receptionist.sql` - New SQL script to check and fix roles automatically
