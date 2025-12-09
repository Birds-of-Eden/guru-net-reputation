# QC Dashboard Data Entry Status Fix

## Issue
Data entry task statuses were not showing up in the QC dashboard. The QC dashboard was only displaying the main task status but not the data entry completion status.

## Root Cause
1. The `/api/tasks` endpoint was not including the `dataEntryReport` JSON field in its response
2. The QC Dashboard component had no way to display data entry status information
3. Data entry status is stored in the `dataEntryReport` JSON field with structure:
   ```json
   {
     "completedByUserId": "user_id",
     "completedByName": "User Name",
     "completedBy": "2024-01-01T00:00:00.000Z"
   }
   ```

## Solution

### 1. API Endpoint Fix (`app/api/tasks/route.ts`)
- Added data entry status enrichment to the `/api/tasks` endpoint
- Now extracts `dataEntryReport` from each task and adds computed fields:
  - `dataEntryStatus`: "completed" or "pending" based on presence of `completedByUserId`
  - `dataEntryCompletedBy`: Name of the person who completed data entry
  - `dataEntryCompletedAt`: Timestamp of data entry completion

### 2. QC Dashboard Updates (`components/QCDashboard.tsx`)

#### Added Data Entry Metrics
- `dataEntryCompleted`: Count of tasks with completed data entry
- `dataEntryPending`: Count of tasks with pending data entry

#### Added Data Entry KPI Card
- New metric card in the KPI row showing:
  - Title: "Data Entry"
  - Value: Number of completed data entry tasks
  - Description: Number of pending data entry tasks
  - Icon: Activity icon with teal gradient

#### Added Data Entry Status Column
Updated all three tables to include a "Data Entry" column:

1. **All Tasks Table**
   - Added "Data Entry" column header
   - Shows color-coded badges:
     - Green (emerald) for "Completed"
     - Amber for "Pending"
   - Updated colSpan from 11 to 12 for empty state

2. **QC Approved Table**
   - Added "Data Entry" column header
   - Same color-coded badges as above
   - Updated colSpan from 6 to 7 for empty state

3. **Overdue/Reassign Table**
   - Added "Data Entry" column header
   - Same color-coded badges as above
   - Updated colSpan from 7 to 8 for empty state

## Files Modified
1. `app/api/tasks/route.ts` - Added data entry status enrichment
2. `components/QCDashboard.tsx` - Added data entry metrics and display

## Testing
To verify the fix:
1. Navigate to `/qc/qc-dashboard`
2. Check that the "Data Entry" KPI card shows correct counts
3. Verify all tables display the "Data Entry" column
4. Confirm that tasks with completed data entry show a green "Completed" badge
5. Confirm that tasks without data entry show an amber "Pending" badge

## Data Flow
1. Data entry users complete tasks and set `dataEntryReport.completedByUserId`
2. `/api/tasks` endpoint reads this field and derives `dataEntryStatus`
3. QC Dashboard receives enriched tasks with data entry status
4. Dashboard displays status in tables and metrics

## Notes
- The fix maintains backward compatibility - tasks without data entry reports show "—" in the dashboard
- The data entry status is separate from the main task status
- A task can be "completed" (main status) but still have "pending" data entry status
