# How to Add Activity Logs to Admin Dashboard

## Quick Integration

To add the Activity Logs view to your Admin Dashboard, follow these steps:

### Step 1: Import the Component

Add this import at the top of `src/pages/AdminDashboard.tsx`:

```typescript
import ActivityLogsView from '@/components/ActivityLogsView';
```

### Step 2: Add to Dashboard

Add the ActivityLogsView component in your AdminDashboard return statement where you want it to appear:

```typescript
{/* Activity Logs Section */}
<Card>
  <CardHeader>
    <CardTitle>System Activity Logs</CardTitle>
    <CardDescription>Monitor all system activities</CardDescription>
  </CardHeader>
  <CardContent>
    <ActivityLogsView />
  </CardContent>
</Card>
```

### Step 3: Run Migration

Make sure to run the database migration:

```bash
# Apply the migration
supabase migration up
```

Or manually run the SQL in `supabase/migrations/20240116_add_activity_logs.sql`

### Step 4: Start Logging Activities

To log activities throughout your app, use the `logActivity` utility function:

```typescript
import { logActivity } from '@/lib/utils';

// Example: Log patient registration
await logActivity('patient.register', { 
  patient_id: newPatient.id, 
  full_name: patientForm.full_name 
});

// Example: Log appointment booking
await logActivity('appointment.book', {
  appointment_id: appointment.id,
  patient_id: patientId,
  doctor_id: doctorId
});

// Example: Log payment
await logActivity('payment.received', {
  amount: paymentAmount,
  patient_id: patientId,
  payment_method: 'Cash'
});
```

## Alternative: Standalone Page

If you prefer a dedicated logs page, create `src/pages/ActivityLogsPage.tsx`:

```typescript
import { DashboardLayout } from '@/components/DashboardLayout';
import ActivityLogsView from '@/components/ActivityLogsView';

export default function ActivityLogsPage() {
  return (
    <DashboardLayout title="Activity Logs">
      <ActivityLogsView />
    </DashboardLayout>
  );
}
```

Then add the route to your router configuration.

## Features Available

- ✅ Filter by Today / This Week / This Month / All Time
- ✅ Search by action, user, or email
- ✅ Filter by action type (patient, appointment, lab, etc.)
- ✅ Export to CSV
- ✅ Real-time refresh
- ✅ Visual indicators with icons and badges
- ✅ Stats cards showing activity counts

That's it! The Activity Logs are now integrated into your admin dashboard.
