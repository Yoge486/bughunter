-- ============================================
-- BugHunter AI — Supabase Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Profiles Table (auto-linked to Supabase Auth)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Scans Table
-- ============================================
CREATE TABLE IF NOT EXISTS scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  target_url TEXT NOT NULL,
  target_type TEXT DEFAULT 'url' CHECK (target_type IN ('url', 'github_repo')),
  security_score INTEGER CHECK (security_score >= 0 AND security_score <= 100),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scanning', 'completed', 'failed')),
  scan_duration_ms INTEGER,
  headers_checked JSONB DEFAULT '{}',
  technologies JSONB DEFAULT '[]',
  ssl_info JSONB DEFAULT '{}',
  cookie_info JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Vulnerabilities Table
-- ============================================
CREATE TABLE IF NOT EXISTS vulnerabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES scans(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')) NOT NULL,
  category TEXT CHECK (category IN ('headers', 'ssl', 'xss', 'sqli', 'auth', 'config', 'cookies', 'info_exposure', 'sast', 'other')),
  ai_explanation TEXT,
  remediation TEXT,
  evidence JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Scheduled Scans Table
-- ============================================
CREATE TABLE IF NOT EXISTS scheduled_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  target_url TEXT NOT NULL,
  target_type TEXT DEFAULT 'url' CHECK (target_type IN ('url', 'github_repo')),
  frequency TEXT CHECK (frequency IN ('daily', 'weekly')) NOT NULL,
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Row Level Security
-- ============================================

-- Profiles RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Scans RLS
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scans"
  ON scans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scans"
  ON scans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scans"
  ON scans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scans"
  ON scans FOR DELETE
  USING (auth.uid() = user_id);

-- Vulnerabilities RLS
ALTER TABLE vulnerabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vulnerabilities"
  ON vulnerabilities FOR SELECT
  USING (
    scan_id IN (SELECT id FROM scans WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert vulnerabilities for own scans"
  ON vulnerabilities FOR INSERT
  WITH CHECK (
    scan_id IN (SELECT id FROM scans WHERE user_id = auth.uid())
  );

-- Scheduled Scans RLS
ALTER TABLE scheduled_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scheduled scans"
  ON scheduled_scans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scheduled scans"
  ON scheduled_scans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scheduled scans"
  ON scheduled_scans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scheduled scans"
  ON scheduled_scans FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_scan_id ON vulnerabilities(scan_id);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_severity ON vulnerabilities(severity);
