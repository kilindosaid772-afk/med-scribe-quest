# Deployment Guide - Hospital Management System

## 🚀 Quick Start Deployment

### Prerequisites
- Node.js 18+ installed
- Supabase account and project
- Hosting platform account (Vercel, Netlify, or custom)

## 📦 Step 1: Prepare for Production

### 1.1 Install Dependencies
```bash
npm install
```

### 1.2 Configure Environment Variables
```bash
# Copy the example file
cp .env.production.example .env.production

# Edit with your production values
nano .env.production
```

Required variables:
- `VITE_SUPABASE_URL`: Your production Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your production Supabase anon key

### 1.3 Build for Production
```bash
npm run build
```

This creates an optimized production build in the `dist` folder.

### 1.4 Test Production Build Locally
```bash
npm run preview
```

Visit `http://localhost:4173` to test the production build.

## 🗄️ Step 2: Database Setup

### 2.1 Supabase Configuration

1. **Create Production Project**
   - Go to https://supabase.com
   - Create a new project for production
   - Note your project URL and anon key

2. **Run Migrations**
   - Apply all database migrations
   - Set up tables, views, and functions
   - Configure Row Level Security (RLS) policies

3. **Verify RLS Policies**
   ```sql
   -- Check that RLS is enabled on all tables
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public';
   ```

4. **Create Initial Admin User**
   - Sign up through the app
   - Manually set role to 'admin' in database
   - Or use SQL:
   ```sql
   INSERT INTO user_roles (user_id, role)
   VALUES ('user-uuid-here', 'admin');
   ```

### 2.2 Database Indexes (Performance)
```sql
-- Add indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_patient_visits_patient_id ON patient_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_visits_current_stage ON patient_visits(current_stage);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_tests_patient_id ON lab_tests(patient_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
```

## 🌐 Step 3: Deploy to Hosting

### Option A: Vercel (Recommended)

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel --prod
   ```

4. **Configure Environment Variables**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add all variables from `.env.production`

### Option B: Netlify

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify**
   ```bash
   netlify login
   ```

3. **Deploy**
   ```bash
   netlify deploy --prod
   ```

4. **Configure Environment Variables**
   - Go to Netlify Dashboard → Site Settings → Environment Variables
   - Add all variables from `.env.production`

### Option C: Custom Server (VPS/Cloud)

1. **Upload Build Files**
   ```bash
   # Upload the dist folder to your server
   scp -r dist/* user@your-server:/var/www/html/
   ```

2. **Configure Web Server**

   **Nginx Configuration:**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       root /var/www/html;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       # Enable gzip compression
       gzip on;
       gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

       # Cache static assets
       location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
           expires 1y;
           add_header Cache-Control "public, immutable";
       }
   }
   ```

3. **Set up SSL Certificate**
   ```bash
   # Using Let's Encrypt
   sudo certbot --nginx -d yourdomain.com
   ```

## 🔒 Step 4: Security Configuration

### 4.1 Supabase Security

1. **Enable RLS on All Tables**
   ```sql
   ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
   ```

2. **Configure CORS**
   - Go to Supabase Dashboard → Settings → API
   - Add your production domain to allowed origins

3. **API Rate Limiting**
   - Configure rate limits in Supabase dashboard
   - Recommended: 100 requests per minute per IP

### 4.2 Application Security

1. **Content Security Policy**
   Add to your `index.html`:
   ```html
   <meta http-equiv="Content-Security-Policy" 
         content="default-src 'self'; 
                  script-src 'self' 'unsafe-inline' 'unsafe-eval'; 
                  style-src 'self' 'unsafe-inline'; 
                  img-src 'self' data: https:; 
                  connect-src 'self' https://*.supabase.co;">
   ```

2. **Environment Variables**
   - Never commit `.env.production` to git
   - Use hosting platform's environment variable management
   - Rotate keys regularly

## 📊 Step 5: Monitoring Setup

### 5.1 Error Tracking (Optional - Sentry)

1. **Install Sentry**
   ```bash
   npm install @sentry/react
   ```

2. **Configure Sentry**
   ```typescript
   // src/main.tsx
   import * as Sentry from "@sentry/react";

   if (import.meta.env.PROD) {
     Sentry.init({
       dsn: import.meta.env.VITE_SENTRY_DSN,
       environment: "production",
       tracesSampleRate: 0.1,
     });
   }
   ```

### 5.2 Analytics (Optional)

Add Google Analytics or similar:
```html
<!-- Add to index.html -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
```

## ✅ Step 6: Post-Deployment Verification

### 6.1 Functional Testing
- [ ] User login/logout works
- [ ] All dashboards load correctly
- [ ] Patient registration works
- [ ] Appointment booking works
- [ ] Prescription creation works
- [ ] Lab test ordering works
- [ ] Payment processing works
- [ ] Activity logging works

### 6.2 Performance Testing
- [ ] Page load time < 3 seconds
- [ ] Real-time updates work
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Works on all major browsers

### 6.3 Security Testing
- [ ] Unauthorized access blocked
- [ ] RLS policies working
- [ ] No exposed secrets
- [ ] HTTPS enabled
- [ ] CORS configured correctly

## 🔄 Step 7: Continuous Deployment (Optional)

### GitHub Actions Example
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

## 🆘 Troubleshooting

### Build Fails
```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### Environment Variables Not Working
- Ensure variables start with `VITE_`
- Restart dev server after changes
- Check hosting platform environment settings

### Database Connection Issues
- Verify Supabase URL and key
- Check network connectivity
- Verify RLS policies aren't blocking access

### Real-time Updates Not Working
- Check Supabase realtime is enabled
- Verify subscription channels
- Check browser console for errors

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review Supabase logs
3. Check browser console for errors
4. Review activity logs in admin dashboard

## 🔄 Updates and Maintenance

### Regular Updates
```bash
# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Build and deploy
npm run build
vercel --prod
```

### Database Migrations
- Always backup before migrations
- Test migrations in staging first
- Run during low-traffic periods

---

**Last Updated**: November 15, 2025
**Version**: 1.0.0
