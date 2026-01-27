# Personal Command Center - Setup Notes

## ✅ What's Done

### Task 1: Calendar Integration
- **Work ICS** is configured and working on Vercel (`WORK_ICS` env var)
- Personal ICS skipped (returns 404)
- Calendar API at `/api/calendar` fetches and parses ICS data
- Proper timezone handling for Asia/Nicosia (EET/EEST with DST)
- Frontend fetches calendar on load + refreshes every 5 minutes
- Sidebar shows: time, title, location, duration for each meeting
- Meetings sorted by status: ongoing → upcoming → past

### Task 2: Supabase Backend (Code Ready, Needs Setup)
- `@supabase/supabase-js` installed
- `src/supabaseClient.js` - Supabase client (reads env vars)
- `src/persistence.js` - Full persistence layer with localStorage fallback
- SQL migration at `supabase/migrations/001_initial_schema.sql`
- App works perfectly with just localStorage if Supabase is not configured

## 🔧 Supabase Setup Steps (Manual)

1. **Confirm Supabase account**: A signup was sent to `dann.mizrachi@gmail.com`
   - Password: `Pcc$upabase2026!`
   - Check email and click confirm link

2. **Create a new project** in Supabase dashboard:
   - Name: `personal-command-center`
   - Region: Choose closest (EU West recommended)
   - Generate a database password

3. **Run the SQL migration**:
   - Go to SQL Editor in Supabase dashboard
   - Copy contents of `supabase/migrations/001_initial_schema.sql`
   - Execute it

4. **Get your credentials** from Project Settings → API:
   - `Project URL` (e.g., `https://xxxxx.supabase.co`)
   - `anon public` key

5. **Set environment variables**:
   ```bash
   # In .env (local development)
   REACT_APP_SUPABASE_URL=https://xxxxx.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

6. **Set on Vercel** (for production):
   ```bash
   vercel env add REACT_APP_SUPABASE_URL
   vercel env add REACT_APP_SUPABASE_ANON_KEY
   ```
   Or set via Vercel dashboard → Project Settings → Environment Variables

7. **Redeploy** after setting env vars

## Architecture

```
Dashboard.js
  ├── persistence.js (load/save layer)
  │     ├── supabaseClient.js (if configured)
  │     └── localStorage (always, as fallback)
  ├── /api/calendar.js (Vercel serverless, fetches ICS)
  └── /api/data.js (seed data for first load)
```
