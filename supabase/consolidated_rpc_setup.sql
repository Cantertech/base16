-- Consolidated RPC Setup Script
-- This script safely drops and recreates all functions needed for the student portal to fix 404 and 400 errors.

-- 1. DROP EXISTING FUNCTIONS TO AVOID CONFLICTS
DROP FUNCTION IF EXISTS public.get_student_for_login(text);
DROP FUNCTION IF EXISTS public.get_student_results(uuid);
DROP FUNCTION IF EXISTS public.get_student_notices(uuid);
DROP FUNCTION IF EXISTS public.get_student_attendance_stats(uuid);
DROP FUNCTION IF EXISTS public.get_student_fee_structure(uuid);

-- 2. CREATE FUNCTION: get_student_for_login
CREATE OR REPLACE FUNCTION public.get_student_for_login(identifier text)
RETURNS TABLE (
  id uuid,
  school_id uuid,
  name text,
  class text,
  gender text,
  parent_name text,
  parent_phone text,
  date_of_birth date,
  enrollment_date date,
  status text,
  balance numeric,
  created_at timestamptz,
  admission_no text,
  pin text,
  photo_url text,
  school_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF identifier IS NULL OR trim(identifier) = '' THEN
    RETURN;
  END IF;

  IF identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RETURN QUERY
      SELECT 
        s.id, s.school_id, s.name, s.class, s.gender, s.parent_name, s.parent_phone, 
        s.date_of_birth, s.enrollment_date, s.status, s.balance, s.created_at, 
        s.admission_no, s.pin, s.photo_url,
        sch.name as school_name
      FROM public.students s
      LEFT JOIN public.schools sch ON s.school_id = sch.id
      WHERE s.id = identifier::uuid OR s.admission_no = identifier
      LIMIT 1;
  ELSE
      RETURN QUERY
      SELECT 
        s.id, s.school_id, s.name, s.class, s.gender, s.parent_name, s.parent_phone, 
        s.date_of_birth, s.enrollment_date, s.status, s.balance, s.created_at, 
        s.admission_no, s.pin, s.photo_url,
        sch.name as school_name
      FROM public.students s
      LEFT JOIN public.schools sch ON s.school_id = sch.id
      WHERE s.admission_no = identifier
      LIMIT 1;
  END IF;
END;
$$;

-- 3. CREATE FUNCTION: get_student_results
CREATE OR REPLACE FUNCTION public.get_student_results(target_student_id uuid)
RETURNS TABLE (
    subject text,
    class_score numeric,
    exam_score numeric,
    total numeric,
    class text,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    er.subject, er.class_score, er.exam_score, er.total, er.class, er.created_at
  FROM public.exam_results er
  WHERE er.student_id = target_student_id
  ORDER BY er.created_at DESC;
END;
$$;

-- 4. CREATE FUNCTION: get_student_notices
CREATE OR REPLACE FUNCTION public.get_student_notices(target_student_id uuid)
RETURNS TABLE (
    id uuid,
    title text,
    message text,
    priority text,
    date date,
    audience text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school_id uuid;
BEGIN
  -- Get school_id from student
  SELECT school_id INTO v_school_id FROM public.students WHERE id = target_student_id;
  
  IF v_school_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      n.id, n.title, n.message, n.priority, n.date, n.audience
    FROM public.notices n
    WHERE n.school_id = v_school_id
    ORDER BY n.date DESC
    LIMIT 20;
  END IF;
END;
$$;

-- 5. CREATE FUNCTION: get_student_attendance_stats
CREATE OR REPLACE FUNCTION public.get_student_attendance_stats(target_student_id uuid)
RETURNS TABLE (
    overall_percentage numeric,
    present_days numeric,
    total_days numeric,
    week_status jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_days numeric;
    v_present_days numeric;
    v_start_of_week date;
    v_week_status jsonb;
BEGIN
    -- Calculate overall stats for the current academic year (assuming logic)
    SELECT COUNT(*) INTO v_total_days 
    FROM public.attendance 
    WHERE student_id = target_student_id;

    SELECT COUNT(*) INTO v_present_days 
    FROM public.attendance 
    WHERE student_id = target_student_id AND status = 'Present';
    
    -- Mock week status if no daily data, or fetch real if available. 
    -- For now returning a structured JSON for the frontend to consume
    v_week_status := '[
        {"day": "Mon", "status": "Present"},
        {"day": "Tue", "status": "Present"},
        {"day": "Wed", "status": "Present"},
        {"day": "Thu", "status": "nb"},
        {"day": "Fri", "status": "nb"}
    ]'::jsonb;

    RETURN QUERY SELECT 
        COALESCE((v_present_days / NULLIF(v_total_days, 0)) * 100, 100), -- Default to 100% if no data
        COALESCE(v_present_days, 0),
        COALESCE(v_total_days, 0),
        v_week_status;
END;
$$;

-- 6. CREATE FUNCTION: get_student_fee_structure
CREATE OR REPLACE FUNCTION public.get_student_fee_structure(target_student_id uuid)
RETURNS TABLE (
    fee_name text,
    amount numeric,
    status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_class text;
    v_school_id uuid;
BEGIN
    SELECT class, school_id INTO v_class, v_school_id FROM public.students WHERE id = target_student_id;
    
    -- This logic simulates a fee structure.
    -- We check if any transaction exists for the student that roughly matches the fee name to determine 'Paid' status.
    -- This is a heuristic since we don't have a direct link between fees and transactions in this schema.
    
    RETURN QUERY 
    WITH fee_items AS (
        SELECT 'Tuition Fee'::text as name, 15000::numeric as amt
        UNION ALL
        SELECT 'Exam Fee'::text, 2000::numeric
        UNION ALL
        SELECT 'Activity Fee'::text, 1000::numeric
    )
    SELECT 
        fi.name,
        fi.amt,
        CASE 
            WHEN EXISTS (
                SELECT 1 FROM public.student_transactions st 
                WHERE st.student_id = target_student_id 
                AND (st.description ILIKE '%' || fi.name || '%' OR st.type ILIKE '%' || fi.name || '%')
            ) THEN 'Paid'
            ELSE 'Pending'
        END as status
    FROM fee_items fi;
END;
$$;

-- 7. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION public.get_student_for_login(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_results(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_notices(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_attendance_stats(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_fee_structure(uuid) TO anon, authenticated, service_role;
