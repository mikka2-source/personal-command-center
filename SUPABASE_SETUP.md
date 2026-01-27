# Supabase Setup Guide

The app already has full Supabase integration code (`src/supabaseClient.js` + `src/persistence.js`).
It works with localStorage fallback when Supabase isn't configured.

## Manual Setup Steps

### 1. Create Supabase Account
1. Go to https://supabase.com
2. Sign up with: `mikkadan2.0@gmail.com`
3. Create a new project: **personal-command-center** (Free tier)
4. Pick region closest to Cyprus (e.g., Frankfurt)
5. Set a database password and save it

### 2. Run Database Migration
1. In Supabase Dashboard → SQL Editor
2. Paste contents of `supabase/migrations/001_initial_schema.sql`
3. Click "Run" to create tables: `tasks`, `daily_focus`, `morning_routine`, `completed_tasks`

### 3. Get API Credentials
1. Go to Settings → API
2. Copy the **Project URL** (e.g., `https://xxxx.supabase.co`)
3. Copy the **anon public** key

### 4. Add to Vercel
Run these commands (replace with your actual values):
```bash
# Set env vars
npx vercel env add REACT_APP_SUPABASE_URL production < <(echo "https://xxxx.supabase.co")
npx vercel env add REACT_APP_SUPABASE_ANON_KEY production < <(echo "your-anon-key-here")

# Or via API:
curl -X POST "https://api.vercel.com/v10/projects/prj_TXyQzrB3MdlgBykuycHT8ftF0yKs/env" \
  -H "Authorization: Bearer Aot6sNWAZ0ylFpWUkLJk7qlp" \
  -H "Content-Type: application/json" \
  -d '{"key":"REACT_APP_SUPABASE_URL","value":"https://xxxx.supabase.co","target":["production","preview","development"],"type":"plain"}'

curl -X POST "https://api.vercel.com/v10/projects/prj_TXyQzrB3MdlgBykuycHT8ftF0yKs/env" \
  -H "Authorization: Bearer Aot6sNWAZ0ylFpWUkLJk7qlp" \
  -H "Content-Type: application/json" \
  -d '{"key":"REACT_APP_SUPABASE_ANON_KEY","value":"your-anon-key","target":["production","preview","development"],"type":"plain"}'
```

### 5. Redeploy
```bash
cd ~/Desktop/personal-command-center
npx vercel --prod --token Aot6sNWAZ0ylFpWUkLJk7qlp --yes
```

## Architecture
- **`src/supabaseClient.js`** — Creates Supabase client (only if env vars exist)
- **`src/persistence.js`** — Dual-write layer: saves to both localStorage AND Supabase
  - `loadTasks()` / `saveTasks()` — Task CRUD with priority grouping
  - `loadDailyFocus()` / `saveDailyFocus()` — Daily focus with per-day uniqueness
  - `loadMorningRoutine()` / `saveMorningRoutine()` — Routine tracking
  - `completeTask()` / `restoreCompletedTask()` — Completion history
- Falls back gracefully to localStorage-only when Supabase is unavailable
