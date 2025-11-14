# Admin Settings & Reports Guide

## Accessing Admin Settings

### Location
The Admin Reports and Settings are now available in the **Admin Dashboard**.

### How to Access
1. Log in as an admin user
2. Navigate to the Admin Dashboard
3. Scroll down to the **"Reports & Settings"** section
4. You'll see the full AdminReports component with all features

## Features Available

### 1. Report Generation
- **Date Filters**: Today, This Week, This Month, All Time
- **Export Options**: 
  - Print reports
  - Export to CSV
- **Report Sections**:
  - Patients
  - Appointments
  - Patient Visits
  - Prescriptions
  - Lab Tests

### 2. System Settings
Click the **"Settings"** button in the Reports section to access:

#### Consultation Fee Management
- **Default Fee**: TSh 2,000
- **How to Change**:
  1. Click "Settings" button
  2. Find "Consultation Fee (TSh)" field
  3. Enter new amount
  4. Click "Save" button next to the field
  5. New fee applies immediately

#### Report Configuration
- Hospital Name
- Report Header
- Toggle which sections to include in reports:
  - Patient Details
  - Appointments
  - Patient Visits
  - Prescriptions
  - Lab Tests

## Using the Consultation Fee

### Reception Workflow
1. When a patient arrives for an appointment
2. Receptionist clicks "Check In"
3. **Payment dialog appears automatically**
4. Shows the consultation fee set by admin
5. Receptionist collects payment
6. Patient is checked in and sent to nurse

### Payment Methods Supported
- Cash
- Mobile Money
- Card

### Payment Tracking
- All payments are recorded in the database
- Can be viewed in reports
- Includes payment method, amount, and timestamp

## Report Features

### Statistics Dashboard
Shows real-time counts for:
- Total Patients
- Total Appointments
- Total Visits
- Total Prescriptions
- Total Lab Tests

### Detailed Tables
Each section shows:
- Patient information with status
- Appointment details with doctor assignments
- Visit tracking with current stage
- Lab test results with priority levels

### Print Functionality
- Clean print layout
- Includes hospital name and report header
- Shows date range and generation time
- Optimized for paper printing

### CSV Export
- Downloads all data in CSV format
- Includes summary statistics
- Separate sections for each data type
- Easy to import into Excel or other tools

## Tips

1. **Change Consultation Fee**: Do this during off-hours to avoid confusion
2. **Regular Reports**: Generate weekly reports to track hospital performance
3. **Export Data**: Use CSV exports for detailed analysis in Excel
4. **Print Reports**: Keep physical copies for record-keeping

## Troubleshooting

### Can't See Settings Button
- Make sure you're logged in as an admin
- Refresh the page
- Check you're on the Admin Dashboard

### Consultation Fee Not Updating
- Click "Save" button after entering new amount
- Wait a few seconds for the update
- Refresh the reception dashboard to see new fee

### Reports Not Loading
- Check your internet connection
- Verify database connection
- Try refreshing the page
- Check browser console for errors

## Database Tables

### system_settings
Stores configuration values:
- `consultation_fee`: Current consultation fee amount

### payments
Stores all payment records:
- Patient ID
- Amount paid
- Payment method
- Payment type
- Timestamp

## Security

- Only admin users can access settings
- All changes are logged
- Payment records are auditable
- Settings require authentication

---

For technical support or questions, contact your system administrator.
