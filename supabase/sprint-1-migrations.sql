-- Sprint 1: Core Logic & Trust Migrations
-- Run these in Supabase SQL Editor

-- ============================================
-- 1. Add new columns to tasks table
-- ============================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS family_override BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS energy_level TEXT CHECK (energy_level IN ('low', 'medium', 'high'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS frozen BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee TEXT DEFAULT 'dan';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS owner TEXT DEFAULT 'dan';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS labels TEXT[] DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS dependencies TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS domain TEXT DEFAULT 'work';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_load INTEGER DEFAULT 10;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS closed_by TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- ============================================
-- 2. Add metadata column to daily_briefs
-- ============================================

ALTER TABLE daily_briefs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE daily_briefs ADD COLUMN IF NOT EXISTS doing_today_structured JSONB DEFAULT '[]';
ALTER TABLE daily_briefs ADD COLUMN IF NOT EXISTS not_doing_today_structured JSONB DEFAULT '[]';
ALTER TABLE daily_briefs ADD COLUMN IF NOT EXISTS conservation_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE daily_briefs ADD COLUMN IF NOT EXISTS sleep_confidence TEXT;

-- ============================================
-- 3. Create day_close table for soft close model
-- ============================================

CREATE TABLE IF NOT EXISTS day_close (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('auto', 'partial', 'reviewed')),
  summary JSONB DEFAULT '{}',
  tomorrow_note TEXT,
  closed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE day_close ENABLE ROW LEVEL SECURITY;

-- Open policy (single user, no auth)
CREATE POLICY "Allow all for day_close" ON day_close
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 4. Create correction_signals table for AI learning
-- ============================================

CREATE TABLE IF NOT EXISTS correction_signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  corrections JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE correction_signals ENABLE ROW LEVEL SECURITY;

-- Open policy
CREATE POLICY "Allow all for correction_signals" ON correction_signals
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 5. Create pa_users table for PA role
-- ============================================

CREATE TABLE IF NOT EXISTS pa_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  permissions JSONB DEFAULT '{
    "canViewTasks": true,
    "canMarkDone": true,
    "canViewHorizon": true,
    "canViewGoals": true,
    "canEditGoals": false,
    "canAccessCommand": false,
    "canAccessBrain": false,
    "canAccessSystemRules": false
  }',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE pa_users ENABLE ROW LEVEL SECURITY;

-- Open policy
CREATE POLICY "Allow all for pa_users" ON pa_users
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 6. Create pa_inbox view (tasks assigned to PA)
-- ============================================

CREATE OR REPLACE VIEW pa_inbox AS
SELECT 
  t.id,
  t.text,
  t.title,
  t.labels,
  t.energy_level,
  t.domain,
  t.assignee,
  t.owner,
  t.completed,
  t.created_at,
  t.due_date
FROM tasks t
WHERE t.assignee = 'pa' 
  AND t.completed = FALSE
  AND t.archived = FALSE
ORDER BY t.created_at DESC;

-- ============================================
-- 7. Add indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee);
CREATE INDEX IF NOT EXISTS idx_tasks_family_override ON tasks(family_override);
CREATE INDEX IF NOT EXISTS idx_tasks_archived ON tasks(archived);
CREATE INDEX IF NOT EXISTS idx_day_close_user_date ON day_close(user_id, date);
CREATE INDEX IF NOT EXISTS idx_correction_signals_entity ON correction_signals(entity_type, entity_id);

-- ============================================
-- 8. Add health_data confidence tracking
-- ============================================

ALTER TABLE health_data ADD COLUMN IF NOT EXISTS confidence TEXT DEFAULT 'high';
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS device_worn BOOLEAN DEFAULT TRUE;
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'garmin';

-- ============================================
-- Done!
-- ============================================
