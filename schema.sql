-- Cal.com Clone Database Schema
-- Run this SQL in Supabase SQL Editor

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  timezone VARCHAR(100) DEFAULT 'UTC',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Event Types table
CREATE TABLE IF NOT EXISTS event_types (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL DEFAULT 30,
  slug VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#7C3AED',
  is_active BOOLEAN DEFAULT true,
  buffer_before INTEGER DEFAULT 0,
  buffer_after INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, slug)
);

-- Availability Schedules table
CREATE TABLE IF NOT EXISTS availability (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  timezone VARCHAR(100) DEFAULT 'UTC',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Weekly Schedule table
CREATE TABLE IF NOT EXISTS schedules (
  id SERIAL PRIMARY KEY,
  availability_id INTEGER REFERENCES availability(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL
);

-- Date Overrides table
CREATE TABLE IF NOT EXISTS overrides (
  id SERIAL PRIMARY KEY,
  availability_id INTEGER REFERENCES availability(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_blocked BOOLEAN DEFAULT false
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  uid UUID DEFAULT gen_random_uuid(),
  event_type_id INTEGER REFERENCES event_types(id) ON DELETE CASCADE,
  booker_name VARCHAR(255) NOT NULL,
  booker_email VARCHAR(255) NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'confirmed',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Custom Questions table
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  event_type_id INTEGER REFERENCES event_types(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  required BOOLEAN DEFAULT false,
  question_type VARCHAR(50) DEFAULT 'text'
);

-- Booking Answers table
CREATE TABLE IF NOT EXISTS answers (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  answer TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_event_types_user_id ON event_types(user_id);
CREATE INDEX IF NOT EXISTS idx_event_types_slug ON event_types(slug);
CREATE INDEX IF NOT EXISTS idx_availability_user_id ON availability(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_availability_id ON schedules(availability_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event_type_id ON bookings(event_type_id);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- Seed default user
INSERT INTO users (name, email, username, timezone) 
VALUES ('Shubhendu Shukla', 'shubhendu@example.com', 'shubhendu', 'America/New_York')
ON CONFLICT (username) DO NOTHING;

-- Seed default availability
INSERT INTO availability (user_id, name, timezone, is_default)
SELECT id, 'Working Hours', 'America/New_York', true FROM users WHERE username = 'shubhendu'
ON CONFLICT DO NOTHING;

-- Seed default schedules (Mon-Fri 9am-5pm)
DO $$
DECLARE
  avail_id INTEGER;
BEGIN
  SELECT a.id INTO avail_id FROM availability a 
  JOIN users u ON a.user_id = u.id 
  WHERE u.username = 'shubhendu' AND a.is_default = true;
  
  IF avail_id IS NOT NULL THEN
    INSERT INTO schedules (availability_id, day_of_week, start_time, end_time)
    VALUES 
      (avail_id, 1, '09:00', '17:00'),
      (avail_id, 2, '09:00', '17:00'),
      (avail_id, 3, '09:00', '17:00'),
      (avail_id, 4, '09:00', '17:00'),
      (avail_id, 5, '09:00', '17:00')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Seed sample event types
INSERT INTO event_types (user_id, title, description, duration, slug, color)
SELECT id, '30 Minute Meeting', 'A quick 30 minute meeting to discuss anything.', 30, '30min', '#7C3AED'
FROM users WHERE username = 'shubhendu'
ON CONFLICT (user_id, slug) DO NOTHING;

INSERT INTO event_types (user_id, title, description, duration, slug, color)
SELECT id, '60 Minute Meeting', 'A full hour for in-depth discussions.', 60, '60min', '#2563EB'
FROM users WHERE username = 'shubhendu'
ON CONFLICT (user_id, slug) DO NOTHING;

INSERT INTO event_types (user_id, title, description, duration, slug, color)
SELECT id, '15 Minute Call', 'Quick check-in or introduction call.', 15, '15min', '#059669'
FROM users WHERE username = 'shubhendu'
ON CONFLICT (user_id, slug) DO NOTHING;
