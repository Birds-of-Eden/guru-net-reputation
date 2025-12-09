# Auto-Save & Draft Restoration System

## Overview
Implemented a comprehensive auto-save and draft restoration system for the client onboarding forms to prevent data loss during power outages or browser crashes.

## Problem Solved
Previously, if power went out or the browser crashed during client onboarding (filling General Info, Website Info, Biography, etc.), all form data was lost and users had to start over from scratch. This was frustrating and time-consuming.

## Solution
Implemented a **localStorage-based auto-save system** that:
- ✅ Automatically saves form data every 2 seconds (debounced)
- ✅ Restores draft data when you return to the form
- ✅ Shows real-time save status
- ✅ Handles file uploads (profile pictures)
- ✅ Clears draft after successful submission
- ✅ Works across all onboarding pages

## Technical Implementation

### 1. Custom Hook: `use-onboarding-autosave.ts`
**Location:** `hooks/use-onboarding-autosave.ts`

**Features:**
- Debounced auto-save (default: 2000ms)
- Automatic draft restoration on mount
- File handling (converts files to base64 for storage)
- Status tracking (idle, saving, saved, error)
- Manual save and clear draft functions
- Timestamps for last save time

**Usage:**
```typescript
const { saveStatus, hasDraft, clearDraft, lastSavedAt } = useOnboardingAutosave(
  formData,
  currentStep,
  {
    storageKey: "onboarding-draft-clients",
    debounceMs: 2000,
    onRestore: handleRestoreDraft,
  }
);
```

### 2. Visual Indicator Component
**Location:** `components/onboarding/autosave-indicator.tsx`

**Features:**
- Fixed position indicator (top-right corner)
- Real-time status updates:
  - 🔵 "Saving draft..." (blue)
  - ✅ "Saved X seconds/minutes ago" (green)
  - ❌ "Failed to save" (red)
- Clear draft button
- Time-ago display that updates every 5 seconds

### 3. Updated Files

#### Onboarding Pages (4 files):
1. `app/[role]/clients/onboarding/page.tsx`
2. `app/[role]/am_clients/onboarding/page.tsx`
3. `app/[role]/data_entry/clients/onboarding/page.tsx`
4. `app/[role]/onboarding/page.tsx`

**Changes:**
- Added auto-save hook integration
- Added draft restoration callback
- Added AutosaveIndicator component
- Pass `clearDraft` to all step components

#### Type Definitions:
- `types/onboarding.ts` - Added `clearDraft?: () => void` to `StepProps`
- `components/onboarding/review-info.tsx` - Updated to clear draft on successful submission

## How It Works

### Auto-Save Flow:
1. User fills out form fields
2. After 2 seconds of inactivity, form data is saved to localStorage
3. Visual indicator shows "Saving draft..."
4. Once saved, indicator shows "Saved X seconds ago"
5. Data includes current step, timestamp, and all form fields

### Draft Restoration Flow:
1. User returns to onboarding page (after power outage, etc.)
2. Hook checks localStorage for saved draft
3. If draft exists, data is automatically restored
4. User can continue from where they left off
5. Draft is cleared after successful form submission

### Data Storage Structure:
```json
{
  "formData": {
    "name": "John Doe",
    "email": "john@example.com",
    "websites": ["https://example.com"],
    "biography": "...",
    "profilePictureBase64": {
      "data": "data:image/jpeg;base64,...",
      "name": "profile.jpg",
      "type": "image/jpeg"
    }
    // ... all other form fields
  },
  "currentStep": 3,
  "timestamp": "2024-11-07T12:00:00.000Z"
}
```

## Storage Keys
Different storage keys for different onboarding flows:
- `onboarding-draft-clients` - Main clients page
- `onboarding-draft-am-clients` - AM clients page
- `onboarding-draft-data-entry` - Data entry clients page
- `onboarding-draft-general` - General onboarding page

## Benefits

### For Users:
- ✅ No data loss during power outages
- ✅ Can close browser and continue later
- ✅ Peace of mind with visual save indicator
- ✅ Time saved by not re-entering data

### Technical Benefits:
- ✅ Client-side storage (no server load)
- ✅ Instant restoration (no API calls)
- ✅ Handles complex data types (files, arrays, nested objects)
- ✅ Debounced saves (performance optimized)
- ✅ Type-safe implementation

## Why localStorage Instead of Redis?

While Redis would work for server-side caching, localStorage is the better choice here because:

1. **Client-Side Data**: Form data exists in the browser before submission
2. **No Server Load**: Saves happen locally without hitting the server
3. **Instant Access**: No network latency for restoration
4. **Privacy**: Sensitive draft data stays on user's device
5. **Simplicity**: No additional infrastructure needed
6. **Offline Support**: Works even if server is down
7. **Per-User Storage**: Each browser automatically gets isolated storage

## Browser Storage Limits
- localStorage typically allows 5-10 MB per domain
- Our form data is typically < 100 KB
- File handling: Profile pictures converted to base64 (included in limit)

## Testing

### To Test Auto-Save:
1. Go to any onboarding page
2. Fill out some form fields
3. Wait 2 seconds - see "Saving draft..." then "Saved just now"
4. Close the browser or refresh the page
5. Return to the onboarding page
6. Verify all your data is restored

### To Test Power Outage Scenario:
1. Fill out multiple sections (General Info, Website Info, Biography, etc.)
2. Close browser WITHOUT submitting
3. Reopen browser and go to onboarding page
4. All data should be restored exactly as you left it

### To Clear Draft:
- Click the "Clear" button in the auto-save indicator
- OR successfully submit the form (auto-clears)

## Future Enhancements

### Potential Improvements:
1. **Multiple Drafts**: Save multiple drafts with names
2. **Cloud Sync**: Sync drafts across devices (would require backend)
3. **Version History**: Keep previous versions of drafts
4. **Export Draft**: Download draft as JSON for backup
5. **Conflict Resolution**: Handle multiple tabs editing same draft
6. **Compression**: Compress large form data before saving
7. **Encryption**: Encrypt sensitive data in localStorage

## Troubleshooting

### Draft Not Restoring?
- Check browser's localStorage is enabled
- Check console for errors
- Verify storage key matches your page
- Check if localStorage quota is exceeded

### Save Indicator Not Showing?
- Check if data is actually changing (debounce requires changes)
- Look for TypeScript errors in console
- Verify hook is properly initialized

### Files Not Restoring?
- Large files (>5MB) may fail to store
- Check browser's localStorage limit
- Files are converted to base64 (increases size ~33%)

## Code Maintainability

### Adding Auto-Save to New Forms:
1. Import the hook and indicator
2. Add storage key (unique per form)
3. Create restoration callback
4. Add indicator component to render
5. Pass `clearDraft` to step components

Example:
```typescript
import { useOnboardingAutosave } from "@/hooks/use-onboarding-autosave";
import { AutosaveIndicator } from "@/components/onboarding/autosave-indicator";

const handleRestoreDraft = useCallback((restoredData) => {
  setFormData(restoredData);
}, []);

const { saveStatus, hasDraft, clearDraft, lastSavedAt } = useOnboardingAutosave(
  formData,
  currentStep,
  {
    storageKey: "my-unique-form-key",
    debounceMs: 2000,
    onRestore: handleRestoreDraft,
  }
);

return (
  <>
    <AutosaveIndicator {...{ saveStatus, hasDraft, lastSavedAt, onClearDraft: clearDraft }} />
    {/* Your form */}
  </>
);
```

## Performance Considerations

- **Debouncing**: Prevents excessive saves (2-second delay)
- **Minimal Re-renders**: Only status component re-renders on save
- **Async Operations**: File reading happens asynchronously
- **Cleanup**: Timeouts are properly cleaned up
- **Memory**: Draft cleared after successful submission

## Security Considerations

- localStorage is accessible to any JavaScript on the same domain
- Don't store passwords or sensitive credentials in drafts
- Consider encrypting sensitive fields before storage
- localStorage persists even after browser restart
- Users can manually clear it via browser settings

## Summary

This implementation provides a robust, user-friendly solution to prevent data loss during client onboarding. It's lightweight, performant, and requires no backend changes while providing significant value to users.
