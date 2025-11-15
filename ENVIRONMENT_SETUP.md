# Environment Variables Setup Guide

This guide explains where and how to configure environment variables for your hospital management system.

## 📁 File Location

All environment variables go in the **FRONTEND** project (this project), not the backend.

```
your-project/
├── .env.local          ← Create this file (gitignored)
├── .env.local.template ← Template to copy from
├── .env.example        ← Example for reference
├── src/
├── package.json
└── ...
```

## 🚀 Quick Setup

### Step 1: Create `.env.local` file

In your project root (same folder as `package.json`), create a file named `.env.local`:

```bash
# On Windows (PowerShell)
Copy-Item .env.local.template .env.local

# On Mac/Linux
cp .env.local.template .env.local
```

### Step 2: Edit `.env.local`

Open `.env.local` and fill in your actual credentials:

```bash
# NHIF Configuration
VITE_NHIF_API_ENDPOINT=https://verification.nhif.or.tz/nhifservice/services/ClaimsService
VITE_NHIF_API_KEY=abc123xyz789  # Your actual NHIF API key
VITE_NHIF_FACILITY_CODE=HF001   # Your actual facility code

# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Step 3: Restart Development Server

After creating/editing `.env.local`, restart your dev server:

```bash
# Stop the server (Ctrl+C)
# Then start again
npm run dev
```

## 🔐 Security Notes

### ✅ DO:
- Store sensitive credentials in `.env.local`
- Keep `.env.local` in `.gitignore`
- Use different values for development and production
- Share `.env.local.template` with your team (without actual credentials)

### ❌ DON'T:
- Commit `.env.local` to Git
- Share API keys in chat/email
- Use production credentials in development
- Hardcode credentials in source code

## 📝 Environment Variables Explained

### NHIF Variables (Frontend)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_NHIF_API_ENDPOINT` | NHIF API URL | `https://verification.nhif.or.tz/...` |
| `VITE_NHIF_API_KEY` | Your NHIF API key | `abc123xyz789` |
| `VITE_NHIF_FACILITY_CODE` | Your facility code | `HF001` |

**Why VITE_ prefix?**
- Vite (your build tool) only exposes variables starting with `VITE_` to the frontend
- This prevents accidentally exposing backend-only secrets

### Supabase Variables (Frontend)

| Variable | Description | Where to find |
|----------|-------------|---------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Public anonymous key | Supabase Dashboard → Settings → API |

## 🌍 Different Environments

### Development (Local)
File: `.env.local`
```bash
VITE_NHIF_API_ENDPOINT=https://uat.nhif.or.tz/...  # Test endpoint
VITE_NHIF_API_KEY=test_key_12345
VITE_NHIF_FACILITY_CODE=HF999
```

### Production (Deployed)
Configure in your hosting platform:

#### Vercel
1. Go to your project dashboard
2. Settings → Environment Variables
3. Add each variable:
   - Name: `VITE_NHIF_API_ENDPOINT`
   - Value: `https://verification.nhif.or.tz/...`
4. Click "Save"

#### Netlify
1. Go to Site Settings
2. Build & Deploy → Environment
3. Click "Add variable"
4. Add each variable

#### Railway
1. Go to your project
2. Click "Variables" tab
3. Add each variable

## 🧪 Testing Configuration

### Test if variables are loaded:

Create a test file `src/test-env.ts`:

```typescript
console.log('NHIF Endpoint:', import.meta.env.VITE_NHIF_API_ENDPOINT);
console.log('NHIF API Key:', import.meta.env.VITE_NHIF_API_KEY ? '✓ Set' : '✗ Not set');
console.log('Facility Code:', import.meta.env.VITE_NHIF_FACILITY_CODE);
```

Import it in your app and check the browser console.

### Test NHIF connection:

```typescript
// In browser console
fetch(import.meta.env.VITE_NHIF_API_ENDPOINT, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${import.meta.env.VITE_NHIF_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ test: true })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

## 🐛 Troubleshooting

### Variables not loading?

1. **Check file name**: Must be exactly `.env.local` (with the dot)
2. **Restart dev server**: Changes require restart
3. **Check prefix**: Must start with `VITE_`
4. **Check location**: Must be in project root (same folder as `package.json`)

### NHIF API not working?

1. **Verify credentials**: Contact NHIF IT to confirm your API key
2. **Check endpoint**: Ensure you're using the correct URL
3. **Test connectivity**: Try the test endpoint first (`https://httpbin.org/post`)
4. **Check facility code**: Verify your facility is registered with NHIF

### Production deployment issues?

1. **Set variables in hosting platform**: Don't rely on `.env.local` in production
2. **Rebuild after changes**: Environment variables are baked into the build
3. **Check variable names**: Must match exactly (case-sensitive)

## 📞 Support

### NHIF Technical Support
- Phone: +255 22 211 5340
- Email: itsupport@nhif.or.tz
- For API issues: api-support@nhif.or.tz

### Project Issues
- Check `TANZANIA_INSURANCE_SETUP.md` for NHIF setup
- Check browser console for errors
- Verify all variables are set correctly

---

**Last Updated:** November 15, 2025
