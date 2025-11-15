# NHIF Integration Setup for Tanzania

This guide explains how to configure NHIF (National Health Insurance Fund) for automated claim submission.

## About NHIF

### NHIF (National Health Insurance Fund)
- **Type**: Government/Public Insurance
- **Coverage**: 100% for registered members
- **API Available**: Yes (NHIF Claims Portal)
- **Card Number Format**: NHIF-XXXXXXXXXX
- **Membership**: Mandatory for all formal sector employees in Tanzania
- **Benefits**: Covers outpatient, inpatient, and specialized services

---

## Environment Variables Setup

**Location: FRONTEND (This Project)**

For security, store NHIF API credentials in environment variables instead of hardcoding them.

### Create `.env.local` file

In your **project root** (same folder as `package.json`), create a `.env.local` file:

```bash
# NHIF API Configuration
VITE_NHIF_API_ENDPOINT=https://verification.nhif.or.tz/nhifservice/services/ClaimsService
VITE_NHIF_API_KEY=your_actual_nhif_api_key_here
VITE_NHIF_FACILITY_CODE=HF001

# Alternative for production
# VITE_NHIF_API_ENDPOINT=https://api.nhif.or.tz/v1/claims/submit

# For testing/development
# VITE_NHIF_API_ENDPOINT=https://uat.nhif.or.tz/nhifservice/services/ClaimsService
# VITE_NHIF_API_KEY=test_api_key_12345
# VITE_NHIF_FACILITY_CODE=HF999
```

### Add to `.gitignore`

Ensure `.env.local` is in your `.gitignore`:

```bash
# Environment variables
.env.local
.env.*.local
.env.production.local
```

### Access in Code

The system will automatically use these environment variables when available. If not set, it will use the values from the database.

```typescript
// Example: How the system uses env variables
const nhifEndpoint = import.meta.env.VITE_NHIF_API_ENDPOINT || insuranceCompany.api_endpoint;
const nhifApiKey = import.meta.env.VITE_NHIF_API_KEY || insuranceCompany.api_key;
const facilityCode = import.meta.env.VITE_NHIF_FACILITY_CODE || insuranceCompany.facility_code;
```

### Production Deployment

For production (e.g., Vercel, Netlify, Railway):

1. **Vercel**: Go to Project Settings → Environment Variables
2. **Netlify**: Go to Site Settings → Build & Deploy → Environment
3. **Railway**: Go to Variables tab

Add these variables:
- `VITE_NHIF_API_ENDPOINT`
- `VITE_NHIF_API_KEY`
- `VITE_NHIF_FACILITY_CODE`

---

## Database Setup

### Add API Configuration Columns

Run this SQL in your Supabase SQL Editor:

```sql
-- Add API configuration columns to insurance_companies table
ALTER TABLE insurance_companies 
ADD COLUMN IF NOT EXISTS api_endpoint TEXT,
ADD COLUMN IF NOT EXISTS api_key TEXT,
ADD COLUMN IF NOT EXISTS api_type VARCHAR(50) DEFAULT 'REST',
ADD COLUMN IF NOT EXISTS facility_code VARCHAR(50);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_insurance_companies_api_key ON insurance_companies(api_key);
```

---

## NHIF Configuration

### Step 1: Add NHIF to Database

```sql
INSERT INTO insurance_companies (name, coverage_percentage, status, api_endpoint, api_type, facility_code)
VALUES (
  'NHIF - National Health Insurance Fund',
  100,
  'Active',
  'https://verification.nhif.or.tz/nhifservice/services/ClaimsService',
  'REST',
  'HF001'  -- Your facility code from NHIF (replace with your actual code)
);
```

**Note**: The actual NHIF API endpoint is provided during facility registration. Common endpoints include:
- Production: `https://verification.nhif.or.tz/nhifservice/services/ClaimsService`
- Alternative: `https://api.nhif.or.tz/v1/claims/submit`
- Test/UAT: `https://uat.nhif.or.tz/nhifservice/services/ClaimsService`

Contact NHIF IT department to confirm the correct endpoint for your facility.

### Step 2: Update with Your API Key

After receiving your API credentials from NHIF:

```sql
UPDATE insurance_companies 
SET api_key = 'YOUR_NHIF_API_KEY_HERE',
    facility_code = 'YOUR_FACILITY_CODE'
WHERE name LIKE '%NHIF%';
```

---

## How to Get NHIF API Credentials

### Registration Process:

1. **Visit NHIF Office**
   - Go to NHIF headquarters in Dar es Salaam or any regional office
   - Bring your facility registration documents
   - Bring business license and health facility license

2. **Submit Application**
   - Fill out "Healthcare Provider Registration Form"
   - Submit facility details (name, location, services offered)
   - Provide IT contact person details
   - Submit bank account details for reimbursements

3. **Facility Inspection**
   - NHIF will schedule a facility inspection
   - Ensure you meet NHIF standards
   - Prepare required documentation

4. **Receive Credentials**
   - After approval, NHIF will provide:
     - **Facility Code** (e.g., HF001, HF002)
     - **API Endpoint URL**
     - **API Key** for authentication
     - **Technical Documentation**

5. **Configure System**
   - Update your database with the credentials
   - Test the integration
   - Start submitting claims

### Required Documents:
- Business registration certificate
- Health facility license
- Tax clearance certificate (TIN)
- Bank account details
- List of services offered
- IT contact person details

---

## Testing NHIF Integration

### 1. Add Test NHIF Configuration

```sql
-- For testing without actual NHIF credentials, use a test endpoint
INSERT INTO insurance_companies (name, coverage_percentage, status, api_endpoint, api_key, facility_code)
VALUES (
  'NHIF - Test',
  100,
  'Active',
  'https://httpbin.org/post',  -- Test endpoint that echoes back your request
  'test-api-key-12345',
  'HF999'  -- Test facility code
);

-- For production with actual NHIF credentials
INSERT INTO insurance_companies (name, coverage_percentage, status, api_endpoint, api_key, facility_code)
VALUES (
  'NHIF - National Health Insurance Fund',
  100,
  'Active',
  'https://verification.nhif.or.tz/nhifservice/services/ClaimsService',
  'YOUR_ACTUAL_NHIF_API_KEY',  -- Provided by NHIF
  'YOUR_FACILITY_CODE'  -- e.g., HF001, HF002, etc.
);
```

### 2. Register Test Patient with NHIF

1. Go to Receptionist Dashboard
2. Register a new patient
3. Set their insurance company to "NHIF - Test"
4. Set NHIF card number: NHIF-1234567890
5. Complete registration

### 3. Create Invoice and Submit Claim

1. Patient goes through consultation, lab, pharmacy
2. Invoice is created in billing
3. Go to Billing Dashboard → Insurance Claims tab
4. Click "Submit Claim"
5. Select the NHIF patient's invoice
6. Enter claim amount
7. Submit the claim
8. Check browser console (F12) for API request/response

### 4. Verify Claim Submission

Check the console output for:
```json
{
  "ClaimNumber": "CLM-12345678",
  "CardNumber": "NHIF-1234567890",
  "PatientName": "Test Patient",
  "FacilityCode": "HF999",
  "DateOfService": "2025-11-15",
  "TotalAmount": 50000,
  "Services": [...],
  "Remarks": "Test claim"
}
```

---

## Claim Submission Flow

```
1. User submits claim in Billing Dashboard
         ↓
2. System checks if insurance company has API config
         ↓
3a. If API configured:
    - Format payload (NHIF format or standard format)
    - Send POST request to insurance API
    - Include API key in Authorization header
    - Log response in claim notes
         ↓
3b. If no API:
    - Save claim locally only
    - Mark for manual submission
         ↓
4. Save claim to database with status
         ↓
5. Show success/error message to user
```

---

## NHIF API Payload Format

The system automatically formats claims in NHIF's required format:

```json
{
  "ClaimNumber": "CLM-12345678",
  "CardNumber": "NHIF-1234567890",
  "PatientName": "John Doe",
  "FacilityCode": "HF001",
  "DateOfService": "2025-11-15",
  "TotalAmount": 50000,
  "Services": [
    {
      "ServiceCode": "CONS",
      "ServiceName": "Doctor Consultation",
      "Quantity": 1,
      "UnitPrice": 30000,
      "TotalPrice": 30000
    },
    {
      "ServiceCode": "LAB",
      "ServiceName": "Blood Test - Full Blood Count",
      "Quantity": 1,
      "UnitPrice": 15000,
      "TotalPrice": 15000
    },
    {
      "ServiceCode": "PHARM",
      "ServiceName": "Medication - Amoxicillin 500mg",
      "Quantity": 14,
      "UnitPrice": 357,
      "TotalPrice": 5000
    }
  ],
  "Remarks": "Routine checkup and treatment"
}
```

### NHIF Service Codes

Common service codes used:
- **CONS**: Consultation/Examination
- **LAB**: Laboratory tests
- **PHARM**: Pharmacy/Medications
- **XRAY**: X-Ray imaging
- **ULTRA**: Ultrasound
- **SURG**: Surgical procedures
- **ADMIT**: Admission/Inpatient care

---

## Troubleshooting

### Claim submission fails with "API request failed"
- Check if API endpoint is correct
- Verify API key is valid
- Check internet connection
- Review API documentation for correct format

### Claims saved but not sent to insurance
- Insurance company doesn't have API configuration
- Add `api_endpoint` and `api_key` to the insurance company record

### NHIF claims rejected
- Verify patient's NHIF card number is valid
- Check if facility code is correct
- Ensure services are NHIF-approved
- Verify patient's NHIF membership is active

---

## Security Notes

1. **API Keys**: Store securely in database, never expose in frontend code
2. **HTTPS Only**: All API endpoints must use HTTPS
3. **Access Control**: Only billing staff should submit claims
4. **Audit Trail**: All claim submissions are logged with timestamps
5. **Data Privacy**: Patient data is encrypted in transit

---

## NHIF Support Contacts

### NHIF Headquarters (Dar es Salaam)
- **Address**: Maktaba Street, Dar es Salaam
- **Phone**: +255 22 211 5335 / +255 22 211 5336
- **Email**: info@nhif.or.tz
- **Website**: www.nhif.or.tz
- **Working Hours**: Monday - Friday, 8:00 AM - 4:00 PM

### NHIF Regional Offices

**Arusha**
- Phone: +255 27 250 2345

**Mwanza**
- Phone: +255 28 250 0123

**Mbeya**
- Phone: +255 25 250 3456

**Dodoma**
- Phone: +255 26 232 1234

### Technical Support
- **IT Department**: +255 22 211 5340
- **Email**: itsupport@nhif.or.tz
- **For API Issues**: api-support@nhif.or.tz

---

## NHIF API Endpoints

### Production Endpoints
```
Base URL: https://verification.nhif.or.tz/nhifservice/services/

Endpoints:
- ClaimsService - Submit claims
- VerificationService - Verify member eligibility
- FacilityService - Facility management
```

### Authentication
NHIF uses API Key authentication:
```
Headers:
  Authorization: Bearer YOUR_API_KEY
  Content-Type: application/json
  X-Facility-Code: YOUR_FACILITY_CODE
```

### Rate Limits
- Maximum 100 requests per minute
- Maximum 1000 claims per day
- Bulk submission available for large facilities

### Response Codes
- **200**: Success - Claim accepted
- **400**: Bad Request - Invalid data format
- **401**: Unauthorized - Invalid API key
- **403**: Forbidden - Facility not authorized
- **404**: Not Found - Member not found
- **429**: Too Many Requests - Rate limit exceeded
- **500**: Server Error - NHIF system issue

### Claim Status Checking
After submission, check claim status:
```
GET https://verification.nhif.or.tz/nhifservice/services/ClaimsService/status/{ClaimNumber}
```

---

**Last Updated:** November 15, 2025
