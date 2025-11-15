# User Creation Setup Guide

This guide explains how to configure Supabase to allow admin user creation.

## Issue: "User not allowed" Error

This error occurs because the admin API requires special configuration in Supabase.

## Solution: Configure Supabase Settings

### Option 1: Disable Email Confirmation (Recommended for Internal Systems)

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Providers** → **Email**
3. Scroll down to **Email Confirmation**
4. **Uncheck** "Enable email confirmations"
5. Click **Save**

This allows users to be created without email verification, which is suitable for internal hospital staff.

### Option 2: Enable Admin API (Advanced)

If you need the admin API for other features:

1. Go to **Settings** → **API**
2. Copy your **service_role** key (⚠️ Keep this secret!)
3. Create a backend API endpoint that uses the service_role key
4. Call that endpoint from your frontend

**Note**: Never expose the service_role key in frontend code!

## Current Implementation

The system now uses `supabase.auth.signUp()` instead of `supabase.auth.admin.createUser()`, which:

✅ Works without admin privileges
✅ Creates user in auth system
✅ Triggers profile creation automatically
✅ Assigns the selected role
✅ Sends confirmation email (if enabled)

## User Creation Flow

```
1. Admin fills in user form
         ↓
2. System calls signUp() with email/password
         ↓
3. Supabase creates auth user
         ↓
4. Database trigger creates profile
         ↓
5. System assigns role to user
         ↓
6. User receives confirmation email (if enabled)
         ↓
7. User can log in
```

## Email Confirmation Settings

### If Email Confirmation is ENABLED:
- New users receive a confirmation email
- They must click the link to activate their account
- Good for security but requires email setup

### If Email Confirmation is DISABLED:
- Users can log in immediately
- No email verification needed
- Faster onboarding for internal staff
- Recommended for hospital staff

## Testing User Creation

1. Go to Admin Dashboard
2. Click "Create User" in User Management
3. Fill in the form:
   - Full Name: Test User
   - Email: test@example.com
   - Phone: +255 700 000 000
   - Password: test123
   - Role: Receptionist
4. Click "Create User"
5. Check for success message
6. New user should appear in the list

## Troubleshooting

### "User already registered"
- A user with this email already exists
- Use a different email or delete the existing user

### "Password must be at least 6 characters"
- Password is too short
- Use a password with 6+ characters

### "Invalid email"
- Email format is incorrect
- Use a valid email format (user@domain.com)

### User created but not appearing
- Wait a few seconds and refresh
- Check browser console for errors
- Verify database triggers are working

### User can't log in
- If email confirmation is enabled, they need to confirm their email first
- Check spam folder for confirmation email
- Or disable email confirmation in Supabase settings

## Security Best Practices

1. **Strong Passwords**: Require minimum 8 characters with mix of letters, numbers, symbols
2. **Email Verification**: Enable for external users, optional for internal staff
3. **Role Assignment**: Only admins should create users
4. **Audit Trail**: Log all user creation activities
5. **Regular Review**: Periodically review user accounts and remove inactive ones

## Alternative: Invite System

For better security, consider implementing an invite system:

1. Admin sends invite to email
2. User receives invite link
3. User sets their own password
4. Account is activated

This is more secure than admin setting passwords.

---

**Last Updated:** November 15, 2025
