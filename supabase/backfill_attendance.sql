-- Backfill Attendance with Term Info
UPDATE attendance a
SET term = s.current_term,
    academic_year = s.academic_year
FROM schools s
WHERE a.school_id = s.id
AND a.term IS NULL;
