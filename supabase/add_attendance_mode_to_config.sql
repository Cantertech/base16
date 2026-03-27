-- Add attendance_mode to exam_config
ALTER TABLE exam_config 
ADD COLUMN IF NOT EXISTS attendance_mode TEXT DEFAULT 'manual'; -- 'manual' or 'system'
