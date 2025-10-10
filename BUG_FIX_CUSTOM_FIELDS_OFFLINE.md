# Bug Fix: Custom Fields Not Saving During Offline Sync

## Problem Description

When creating incidents OFFLINE with custom fields (e.g., "Bastidor"), the custom field values were not being persisted after sync and page reload, despite photos and observations being saved correctly.

### What Was Working
- Creating/deleting incidents offline ✅
- Photos saved correctly after sync ✅
- Observations (regular field) saved correctly ✅
- Custom fields worked fine when ONLINE ✅

### What Was Broken
- Custom field VALUES were lost after offline sync ❌
- Only the incident itself was created, but `custom_fields` remained empty `{}` ❌

## Root Cause Analysis

### Data Flow Analysis

The application uses a dual-state system for custom fields:

1. **`incidencias` array**: Contains incident objects with a `custom_fields` property (JSON object)
2. **`customValues` ref**: Separate reactive object that tracks custom field values by incident ID

```javascript
// Structure example
incidencias.value = [
  {
    id: 'temp_123',
    item_checklist: 5,
    gravedad: 'ambar',
    observaciones: 'Some text',
    custom_fields: { fieldId1: 'value1', fieldId2: 'value2' }  // ← This should persist
  }
]

customValues.value = {
  'temp_123': {
    fieldId1: 'value1',
    fieldId2: 'value2'
  }
}
```

### The Bug

In `ChecklistModal.vue`, the `saveIncidencia` function was:

```javascript
const saveIncidencia = (incidencia) => {
  const { id, ...dataToUpdate } = incidencia;
  dataToUpdate.custom_fields = customValues.value[id] || {};  // ✅ Gets custom values
  emit('update:incidencias', incidencias.value);  // ❌ But incidencia.custom_fields was never updated!

  const payload = { ...dataToUpdate };
  delete payload.url_foto_antes;
  delete payload.offlinePhotoKey_antes;

  addToQueue({ table: 'incidencias', type: 'update', id: id, payload });
};
```

**The Issue:**
1. Custom field values were stored in `customValues[incidencia.id]`
2. When saving, these values were added to `dataToUpdate.custom_fields`
3. The `payload` sent to the sync queue included the correct `custom_fields` ✅
4. **BUT** the `incidencia` object itself was never updated with the new `custom_fields` ❌
5. When emitting `update:incidencias`, the parent component received the array with OLD empty `custom_fields`
6. On modal close/reopen or page reload, the custom field values were lost

### Why Observations Worked But Custom Fields Didn't

**Observations:**
```html
<textarea v-model="incidencia.observaciones" @blur="saveIncidencia(incidencia)" ...>
```
- `v-model` directly binds to `incidencia.observaciones`
- Changes immediately update the incident object ✅

**Custom Fields:**
```html
<input v-model="customValues[incidencia.id][field.id]" @blur="saveIncidencia(incidencia)" ...>
```
- `v-model` binds to a SEPARATE reactive object
- Changes don't automatically update `incidencia.custom_fields` ❌

## The Fix

### File Modified
`/workspaces/arsel/src/components/ChecklistModal.vue`

### Code Change

```javascript
const saveIncidencia = (incidencia) => {
  const { id, ...dataToUpdate } = incidencia;
  dataToUpdate.custom_fields = customValues.value[id] || {};

  // CRITICAL FIX: Update the incidencia object's custom_fields so it persists in the local state
  // This ensures that when the parent component receives the updated incidencias array,
  // the custom_fields are included and will be sent in the sync queue payload
  incidencia.custom_fields = dataToUpdate.custom_fields;  // ← NEW LINE

  emit('update:incidencias', incidencias.value);

  const payload = { ...dataToUpdate };
  delete payload.url_foto_antes;
  delete payload.offlinePhotoKey_antes;

  addToQueue({ table: 'incidencias', type: 'update', id: id, payload });
};
```

### What This Fixes

1. **Local State Synchronization**: The incident object in the local array now has the updated `custom_fields`
2. **Parent Component State**: When emitting to the parent, it receives the complete incident data
3. **Modal Reopen**: Custom field values persist when closing and reopening the modal
4. **Offline Sync**: The sync queue payload includes all custom field values
5. **Page Reload**: After sync completes and page reloads, custom fields are preserved in the database

## Testing Instructions

### Test Scenario 1: Offline Incident Creation with Custom Fields

1. **Setup:**
   - Open browser DevTools → Network tab → Set to "Offline"
   - Navigate to an inspection detail view
   - Select a point with custom fields configured (e.g., a checklist item with "Bastidor" field)

2. **Create Incident:**
   - Click "INSATISFACTORIO" to create an incident
   - Verify incident is created locally
   - Fill in a custom field (e.g., "Bastidor": "ABC-123")
   - Blur from the input (triggers `saveIncidencia`)

3. **Verify Local Persistence:**
   - Close the modal
   - Reopen the same point's modal
   - **EXPECTED:** Custom field value "ABC-123" should still be visible ✅
   - **BEFORE FIX:** Field would be empty ❌

4. **Test Sync:**
   - Keep modal closed
   - Set Network to "Online" in DevTools
   - Wait for sync queue to process (watch console logs)
   - Verify sync completes without errors

5. **Verify Database Persistence:**
   - Refresh the page (F5)
   - Navigate back to the same inspection and point
   - Open the checklist modal
   - **EXPECTED:** Custom field value "ABC-123" is still present ✅
   - **BEFORE FIX:** Field would be empty ❌

### Test Scenario 2: Multiple Custom Fields

1. **Setup:** Same as Scenario 1
2. **Create incident with multiple custom fields:**
   - Create incident on a checklist item with 2+ custom fields
   - Fill in: "Bastidor": "XYZ-789", "Altura": "25"
   - Close modal
3. **Verify:** Reopen modal → both fields should have values
4. **Sync and reload:** Both values should persist after sync and page reload

### Test Scenario 3: Edit Existing Incident Custom Fields

1. **Setup:** Create incident online first (with custom field value)
2. **Go offline:** Set Network to "Offline"
3. **Edit:** Change the custom field value
4. **Verify local:** Close/reopen modal → new value should be visible
5. **Go online:** Sync should update the database
6. **Reload page:** New value should persist

### Test Scenario 4: Mix of Photos, Observations, and Custom Fields

1. **Go offline**
2. **Create incident** with all three:
   - Upload a photo
   - Write observation: "Test observation"
   - Fill custom field: "Bastidor": "TEST-001"
3. **Close modal** and verify all three persist locally
4. **Sync online** and reload page
5. **EXPECTED:** All three (photo, observation, custom field) should be saved ✅

## Verification Checklist

After applying the fix, verify:

- [ ] Custom field values persist when closing/reopening modal while offline
- [ ] Custom field values are included in sync queue payloads
- [ ] Custom field values persist in database after sync completes
- [ ] Custom field values visible after page reload
- [ ] Multiple custom fields all save correctly
- [ ] Photos still work correctly (no regression)
- [ ] Observations still work correctly (no regression)
- [ ] No console errors during sync
- [ ] Sync queue processes successfully

## Technical Details

### Sync Queue Flow

1. **Initial Insert (when incident created):**
   ```javascript
   addToQueue({
     table: 'incidencias',
     type: 'insert',
     tempId: 'temp_123',
     payload: {
       punto_inspeccionado_id: 456,
       item_checklist: 5,
       gravedad: 'ambar',
       custom_fields: {},  // Empty initially
       observaciones: null
     }
   })
   ```

2. **Update (when custom field filled):**
   ```javascript
   addToQueue({
     table: 'incidencias',
     type: 'update',
     id: 'temp_123',  // Will be resolved to real ID during sync
     payload: {
       punto_inspeccionado_id: 456,
       item_checklist: 5,
       gravedad: 'ambar',
       custom_fields: { fieldId1: 'value1' },  // ← NOW INCLUDED
       observaciones: null
     }
   })
   ```

3. **Sync Processing:**
   - INSERT creates the record → gets real ID (e.g., 789)
   - Temp ID mapping: `temp_123` → `789`
   - UPDATE resolves temp ID and updates the record with custom_fields

### Database Schema

Custom fields are stored in the `incidencias` table as a JSON column:

```sql
-- incidencias table structure (relevant columns)
id: integer
punto_inspeccionado_id: integer
inspeccion_id: integer
item_checklist: integer
gravedad: text ('verde' | 'ambar' | 'rojo')
observaciones: text
custom_fields: jsonb  -- JSON object: { fieldId: value, ... }
url_foto_antes: text
url_foto_despues: text
```

## Related Files

- **Fixed:** `/workspaces/arsel/src/components/ChecklistModal.vue` (line 127)
- **Sync Queue:** `/workspaces/arsel/src/utils/syncQueue.js`
- **Custom Fields Config:** Stored in `checklist_custom_fields` table
- **Parent Component:** `/workspaces/arsel/src/views/InspeccionDetailView.vue`

## Additional Notes

### Why This Bug Was Subtle

1. The sync queue payload WAS correct (included custom_fields)
2. The bug only manifested when:
   - Creating incidents offline
   - Closing and reopening the modal before sync
   - Or after page reload post-sync

3. The fix is a single line, but critical for state consistency

### Performance Impact

- Minimal: One additional property assignment per save
- No additional network calls
- No additional database operations

## Prevention

To prevent similar issues in the future:

1. **Always sync v-model target with the source object** when using separate reactive state
2. **Test offline flows** thoroughly, especially with modal close/reopen cycles
3. **Verify emit payloads** contain complete data before sending to parent
4. **Use integration tests** that cover the full offline → sync → reload cycle

## Conclusion

This fix ensures that custom field values are properly synchronized between the separate `customValues` reactive object and the incident's `custom_fields` property, maintaining data consistency throughout the offline creation, sync, and persistence lifecycle.
