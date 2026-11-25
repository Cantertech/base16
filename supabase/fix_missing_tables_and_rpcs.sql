-- ==============================================================================
-- Missing Tables & RPCs Patch for cvikeikqhxxkwdupglpp.supabase.co
-- Run this once in Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. message_logs table (used by Communication.tsx & Exams.tsx)
CREATE TABLE IF NOT EXISTS public.message_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    recipient TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'Delivered',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_logs_school ON public.message_logs(school_id, created_at DESC);

ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'message_logs' AND policyname = 'Schools can manage own message logs'
    ) THEN
        CREATE POLICY "Schools can manage own message logs"
        ON public.message_logs
        FOR ALL
        TO authenticated
        USING (school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid()))
        WITH CHECK (school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid()));
    END IF;
END $$;

-- 2. demo_bookings table (used by BookDemo.tsx)
CREATE TABLE IF NOT EXISTS public.demo_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    school_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    role TEXT,
    email TEXT,
    message TEXT,
    status TEXT DEFAULT 'Pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.demo_bookings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'demo_bookings' AND policyname = 'Allow public insert to demo_bookings'
    ) THEN
        CREATE POLICY "Allow public insert to demo_bookings"
        ON public.demo_bookings
        FOR INSERT
        TO public
        WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'demo_bookings' AND policyname = 'Allow authenticated read to demo_bookings'
    ) THEN
        CREATE POLICY "Allow authenticated read to demo_bookings"
        ON public.demo_bookings
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;
END $$;

-- 3. add_fee_to_students RPC (used by Fees.tsx)
CREATE OR REPLACE FUNCTION public.add_fee_to_students(
    p_school_id UUID,
    p_amount NUMERIC,
    p_target_class TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN;
    END IF;

    IF p_target_class IS NULL OR p_target_class = '' THEN
        UPDATE public.students
        SET balance = COALESCE(balance, 0) + p_amount
        WHERE school_id = p_school_id;
    ELSE
        UPDATE public.students
        SET balance = COALESCE(balance, 0) + p_amount
        WHERE school_id = p_school_id
          AND class = p_target_class;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_fee_to_students(UUID, NUMERIC, TEXT) TO authenticated;

-- 4. get_student_class_rank RPC (used by Exams.tsx)
DROP FUNCTION IF EXISTS public.get_student_class_rank(UUID, TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.get_student_class_rank(
    p_school_id UUID,
    p_class TEXT,
    p_term TEXT,
    p_year TEXT,
    p_student_id UUID
)
RETURNS TABLE(student_position BIGINT, total_students BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH student_scores AS (
        SELECT
            er.student_id,
            SUM(COALESCE(er.class_score, 0) + COALESCE(er.exam_score, 0)) AS total_marks
        FROM public.exam_results er
        WHERE er.school_id = p_school_id
          AND UPPER(TRIM(er.class)) = UPPER(TRIM(p_class))
          AND UPPER(TRIM(er.term)) = UPPER(TRIM(p_term))
          AND UPPER(TRIM(er.academic_year)) = UPPER(TRIM(p_year))
        GROUP BY er.student_id
    ),
    rankings AS (
        SELECT
            ss.student_id,
            RANK() OVER (ORDER BY ss.total_marks DESC) AS pos,
            COUNT(*) OVER () AS tot
        FROM student_scores ss
    )
    SELECT r.pos AS student_position, r.tot AS total_students
    FROM rankings r
    WHERE r.student_id = p_student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_class_rank(UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;
