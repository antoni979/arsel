# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Arsel Inspecciones** is a Vue 3 Progressive Web App (PWA) for managing rack/shelving inspections. The application supports offline functionality with a sophisticated sync queue system, allowing field technicians to perform inspections without internet connectivity.

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Initialize Tailwind (already configured)
npm run tailwind:init
```

## Tech Stack

- **Frontend Framework:** Vue 3 with Composition API (`<script setup>`)
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Routing:** Vue Router with authentication guards
- **Backend:** Supabase (PostgreSQL database + Storage + Auth + Realtime)
- **PWA:** vite-plugin-pwa with Workbox for service worker management
- **State Management:** Vue 3 Composition API (ref/reactive) - no Vuex/Pinia
- **PDF Generation:** jsPDF + jspdf-autotable
- **Excel Export:** xlsx-js-style
- **Image Processing:** browser-image-compression, compressorjs, html2canvas

## Architecture & Key Patterns

### 1. Offline-First Sync Queue System

The application's core architecture centers around `src/utils/syncQueue.js`, which manages offline operations:

- **Queue Actions:** `insert`, `update`, `delete`, `deleteFile`, `uploadAndUpdate`
- **Temporary ID Mapping:** Uses `temp_` prefix for locally created records, resolved when synced
- **File Storage:** IndexedDB (`ArselOfflineFiles`) stores files offline until upload
- **Dependency Resolution:** Automatically reorders queue items when temp IDs aren't yet resolved
- **Persistence:** Queue stored in localStorage (`arsel-sync-queue`)
- **Triggers:** Processes on `online` event and app visibility change

**Key Functions:**
- `addToQueue(action)` - Adds operations to sync queue
- `processQueue()` - Processes pending sync operations
- `initializeQueue()` - Initializes queue from localStorage on app start

### 2. Layout System

Two layouts controlled by route meta:
- **DefaultLayout** (`src/layouts/DefaultLayout.vue`): Standard app layout with navigation
- **BlankLayout** (`src/layouts/BlankLayout.vue`): Minimal layout for login and preview pages

Layout selected in `App.vue` based on `route.meta.layout` (defaults to DefaultLayout).

### 3. Supabase Integration

- **Client:** Initialized in `src/supabase.js` with env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- **Authentication:** Route guards in `src/router/index.js` check session via `supabase.auth.getSession()`
- **Realtime Subscriptions:** Used in composables for live data updates (e.g., `useInspections.js`)
- **Storage Caching:** PWA workbox config caches Supabase storage images (30 days) and API responses (1 day)

### 4. Composables Pattern

Reusable composition functions in `src/composables/`:
- **useInspections.js:** Manages inspection list with pagination, caching, realtime updates, and Web Worker for processing
- **useOnlineStatus.js:** Tracks online/offline status
- **useFileUpload.js:** Handles file uploads with offline support

### 5. Web Workers for Performance

`useInspections.js` uses inline Web Workers to process inspection details (grouping points by room, counting incidents) without blocking the main thread.

### 6. Global Utilities

- **Notifications:** `src/utils/notification.js` - Reactive notification/confirm dialogs (provided in App.vue)
- **Checklist:** `src/utils/checklist.js` - 27 predefined inspection checklist items
- **PDF Modules:** `src/utils/pdf/` - Modular PDF generation (text, summary, photos, checklist, gestion)
- **Excel Export:** `src/utils/excel/excel-module-gestion.js`
- **Plano Layout:** `src/utils/plano-layout.js` - Floor plan rendering logic

### 7. Route Structure

```
/                           → Login (BlankLayout)
/dashboard                  → Dashboard (DefaultLayout, auth required)
/gestion                    → Management view (DefaultLayout, auth required)
/centros                    → Centers list (DefaultLayout, auth required)
/centros/:id/versiones      → Center versions (DefaultLayout, auth required)
/versiones/:id/configurar   → Version config (DefaultLayout, auth required)
/inspecciones               → Inspections list (DefaultLayout, auth required)
/inspecciones/:id           → Inspection detail (DefaultLayout, auth required)
/inspecciones/:id/plano-preview → Floor plan preview (BlankLayout)
/inspecciones/:id/cierre    → Close report (DefaultLayout, auth required)
/centros/:id/historial      → Center history (DefaultLayout, auth required)
/admin                      → Admin panel (DefaultLayout, auth required)
```

## Database Schema (Key Tables)

- **centros** - Centers/facilities
- **versiones_plano** - Floor plan versions for centers
- **inspecciones** - Inspections linked to centers and plan versions
- **salas** - Rooms within floor plans
- **puntos_maestros** - Master points (inspection locations) linked to rooms
- **puntos_inspeccionados** - Inspected points for a specific inspection
- **incidencias** - Incidents/issues found (linked to inspected points)
  - Severity levels: `verde` (green/OK), `ambar` (amber/warning), `rojo` (red/critical)

## Important Implementation Notes

### Offline Support
- Always use `addToQueue()` for DB operations that need offline support
- Use temporary IDs (`temp_${Date.now()}`) for locally created records
- Store files in IndexedDB before queueing `uploadAndUpdate` actions
- Check `navigator.onLine` status using `useOnlineStatus` composable

### PWA Configuration
- Manifest defined in `vite.config.js`
- Service worker auto-updates via `useRegisterSW` hook
- CSP allows `worker-src blob:` for Web Workers (see `index.html`)
- Preload critical components in `index.html` for performance

### State Management
- No centralized store - use composables for shared state
- Provide/inject pattern for global utilities (notifications, confirm dialogs)
- Route params drive data fetching in views

### File Uploads
- Compress images before upload using browser-image-compression
- Store files in Supabase Storage buckets
- Public URLs stored in database records

## Environment Variables

Required in `.env` or `.env.local`:
```
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

## Testing Offline Functionality

1. Open DevTools → Network → Set to "Offline"
2. Perform operations (create/edit/delete inspections, upload photos)
3. Check localStorage for `arsel-sync-queue` and IndexedDB for `ArselOfflineFiles`
4. Go back online - operations should auto-sync
5. Watch browser console for sync logs

## Vite Development Server

- Dev server configured with `host: true` to allow network access
- Hot module replacement enabled by default
- Vue DevTools compatible

You are gonna use the agent vue-pwa-developer.md for doing edit, debuggind or similar tasks. 