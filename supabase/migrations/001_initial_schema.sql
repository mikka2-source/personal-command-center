-- Personal Command Center - Supabase Schema
-- Single-user (Dan), no RLS needed for now

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'dan',
  text TEXT NOT NULL,
  area TEXT NOT NULL DEFAULT 'personal',
  priority TEXT NOT NULL DEFAULT 'today', -- 'now', 'today', 'later'
  owner TEXT DEFAULT 'me',
  from_person TEXT,
  project TEXT,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_completed ON tasks(user_id, completed);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);

-- Daily Focus table (one per day per user)
CREATE TABLE IF NOT EXISTS daily_focus (
  id BIGINT,
  user_id TEXT NOT NULL DEFAULT 'dan',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  text TEXT NOT NULL,
  area TEXT NOT NULL DEFAULT 'personal',
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Morning Routine table (one per day per user)
CREATE TABLE IF NOT EXISTS morning_routine (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'dan',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplements BOOLEAN DEFAULT FALSE,
  workout BOOLEAN DEFAULT FALSE,
  protein BOOLEAN DEFAULT FALSE,
  meditation BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, date)
);

-- Completed Tasks log (historical record)
CREATE TABLE IF NOT EXISTS completed_tasks (
  id SERIAL PRIMARY KEY,
  task_id BIGINT NOT NULL,
  user_id TEXT NOT NULL DEFAULT 'dan',
  text TEXT NOT NULL,
  area TEXT DEFAULT 'personal',
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  completed_date DATE DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_completed_user_date ON completed_tasks(user_id, completed_date);

-- Disable RLS for simplicity (single user, anon key is fine)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_focus ENABLE ROW LEVEL SECURITY;
ALTER TABLE morning_routine ENABLE ROW LEVEL SECURITY;
ALTER TABLE completed_tasks ENABLE ROW LEVEL SECURITY;

-- Allow anon access (single user app)
CREATE POLICY "Allow all for anon" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON daily_focus FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON morning_routine FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON completed_tasks FOR ALL USING (true) WITH CHECK (true);
