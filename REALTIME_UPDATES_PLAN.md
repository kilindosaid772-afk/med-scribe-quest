# Real-Time Updates Implementation Plan

## Overview
Add Supabase real-time subscriptions to all dashboards so they automatically update when data changes.

## Dashboards to Update

1. **ReceptionistDashboard** - Listen to:
   - `appointments` table changes
   - `patients` table changes
   - `patient_visits` table changes

2. **NurseDashboard** - Listen to:
   - `patient_visits` table (nurse stage)
   - `patients` table changes

3. **DoctorDashboard** - Listen to:
   - `patient_visits` table (doctor stage)
   - `lab_tests` table changes
   - `prescriptions` table changes

4. **LabDashboard** - Listen to:
   - `lab_tests` table changes
   - `patient_visits` table (lab stage)

5. **PharmacyDashboard** - Listen to:
   - `prescriptions` table changes
   - `patient_visits` table (pharmacy stage)
   - `medications` table (stock changes)

6. **BillingDashboard** - Listen to:
   - `invoices` table changes
   - `patient_visits` table (billing stage)
   - `payments` table changes

## Implementation Pattern

```typescript
useEffect(() => {
  if (!user?.id) return;

  // Initial data fetch
  fetchData();

  // Set up real-time subscription
  const channel = supabase
    .channel('table_changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'table_name' },
      (payload) => {
        console.log('Change received:', payload);
        fetchData(); // Refresh data
      }
    )
    .subscribe();

  // Cleanup
  return () => {
    supabase.removeChannel(channel);
  };
}, [user?.id]);
```

## Benefits
- Instant updates across all users
- No manual refresh needed
- Better collaboration
- Real-time workflow tracking
