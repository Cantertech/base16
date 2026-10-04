-- ==============================================================================
-- ORBIT / BASE16 SCHOOL MANAGEMENT SYSTEM: MASTER DATABASE SCHEMA (V1)
-- ==============================================================================
-- Purpose:
-- 1. Rock-solid single-source-of-truth for Auth, Profiles & Teachers.
-- 2. Standardized Terms & Academic Years with ENUM / standard constraints to prevent typos.
-- 3. Robust Foreign Keys & CASCADE rules so deleting/adding staff never leaves orphaned records.
-- 4. Clean RPCs for Teacher management (Create, Delete, Reset Password, Assignments).
-- 5. Standardized Row-Level-Security (RLS) policies.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- AUTH HOOKS: AUTO-CONFIRM EMAILS & AUTO-CREATE IDENTITIES (Zero Email Barriers)
-- ==============================================================================
-- Eliminates email confirmation blockers across all accounts (Admins, Teachers)
-- and automatically ensures auth.identities has matching GoTrue provider rows.
CREATE OR REPLACE FUNCTION public.auto_confirm_and_identify_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());
    NEW.phone_confirmed_at := COALESCE(NEW.phone_confirmed_at, now());
    NEW.confirmation_token := '';
    NEW.recovery_token := '';
    NEW.email_change_token_new := '';
    NEW.email_change := '';
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_confirm_auth_user ON auth.users;
CREATE TRIGGER trg_auto_confirm_auth_user
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_confirm_and_identify_auth_user();

-- Auto-generate identity record for GoTrue email authentication if missing
CREATE OR REPLACE FUNCTION public.auto_create_auth_identity_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = NEW.id) THEN
        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            NEW.id,
            jsonb_build_object('sub', NEW.id::text, 'email', lower(NEW.email), 'email_verified', true),
            'email',
            lower(NEW.email),
            now(),
            now(),
            now()
        )
        ON CONFLICT (provider, provider_id) DO NOTHING;
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_auth_identity ON auth.users;
CREATE TRIGGER trg_auto_create_auth_identity
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_auth_identity_after_insert();

-- ==============================================================================
-- RESOLVE LOGIN IDENTIFIER (Supports Phone Numbers, Usernames, and Emails)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.resolve_login_identifier(p_identifier TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean_ident TEXT := lower(trim(p_identifier));
    v_digits_only TEXT := regexp_replace(p_identifier, '[^0-9]', '', 'g');
    v_resolved_email TEXT;
BEGIN
    -- Handle 'silas' shortcut for super admin
    IF v_clean_ident = 'silas' THEN
        RETURN 'silas@base16.com';
    END IF;

    -- 1. Direct email match
    SELECT email INTO v_resolved_email
    FROM public.profiles
    WHERE lower(email) = v_clean_ident
    LIMIT 1;

    IF v_resolved_email IS NOT NULL THEN
        RETURN v_resolved_email;
    END IF;

    -- 2. Phone number match (matches exact or rightmost 9 digits for local Ghana formats e.g. 024XXXXXXX)
    IF length(v_digits_only) >= 9 THEN
        -- Check public.profiles first
        SELECT email INTO v_resolved_email
        FROM public.profiles
        WHERE regexp_replace(COALESCE(phone_number, ''), '[^0-9]', '', 'g') = v_digits_only
           OR right(regexp_replace(COALESCE(phone_number, ''), '[^0-9]', '', 'g'), 9) = right(v_digits_only, 9)
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_resolved_email IS NOT NULL THEN
            RETURN v_resolved_email;
        END IF;

        -- Fallback: Check auth.users phone directly
        SELECT email INTO v_resolved_email
        FROM auth.users
        WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_digits_only
           OR right(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), 9) = right(v_digits_only, 9)
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_resolved_email IS NOT NULL THEN
            RETURN v_resolved_email;
        END IF;
    END IF;

    -- If not found in profiles or auth.users, return original input to let GoTrue attempt standard login
    RETURN p_identifier;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_login_identifier TO anon, authenticated;

-- Helper RPC to explicitly confirm user email on demand
CREATE OR REPLACE FUNCTION public.confirm_user_by_email(target_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
        phone_confirmed_at = COALESCE(phone_confirmed_at, now()),
        updated_at = now()
    WHERE lower(email) = lower(trim(target_email));

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_user_by_email TO anon, authenticated;

-- ==============================================================================
-- 2. SCHOOLS TABLE (Master Tenant)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    name TEXT NOT NULL,
    motto TEXT,
    phone TEXT,
    email TEXT,
    brand_color TEXT DEFAULT '#2563eb',
    theme_color TEXT DEFAULT 'blue',
    logo_url TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended')),
    currency TEXT NOT NULL DEFAULT 'GHS',
    sms_balance INTEGER NOT NULL DEFAULT 0,
    subscription_plan TEXT NOT NULL DEFAULT 'Small School',
    next_payment_due DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
    last_payment_date DATE DEFAULT CURRENT_DATE,
    
    -- Current Active Session (Synced to dropdowns)
    current_term TEXT NOT NULL DEFAULT 'First Term' CHECK (current_term IN ('First Term', 'Second Term', 'Third Term')),
    academic_year TEXT NOT NULL DEFAULT '2025/2026',
    
    -- Config JSONs
    exam_config JSONB DEFAULT '{}'::jsonb,
    report_card_config JSONB DEFAULT '{}'::jsonb,
    payment_config JSONB DEFAULT '{}'::jsonb,
    
    -- Additional school options
    feeding_fee_amount NUMERIC(10,2) DEFAULT 0.00,
    teachers_can_collect_feeding BOOLEAN DEFAULT false,
    collect_daily_fees BOOLEAN DEFAULT false,
    daily_fee_amount NUMERIC(10,2) DEFAULT 0.00
);

-- ==============================================================================
-- 3. ACADEMIC SESSIONS / TERMS TABLE (Strict Normalization)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.academic_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    academic_year TEXT NOT NULL CHECK (
        academic_year IN (
            '2022/2023', '2023/2024', '2024/2025', '2025/2026', 
            '2026/2027', '2027/2028', '2028/2029', '2029/2030', 
            '2030/2031', '2031/2032', '2032/2033', '2033/2034'
        )
    ),
    term TEXT NOT NULL CHECK (term IN ('First Term', 'Second Term', 'Third Term')),
    is_current BOOLEAN NOT NULL DEFAULT false,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    start_date DATE,
    end_date DATE,
    total_days INTEGER DEFAULT 65,
    next_term_reopens TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT unique_school_year_term UNIQUE (school_id, academic_year, term)
);

-- Index for instant term lookups
CREATE INDEX IF NOT EXISTS idx_academic_terms_lookup ON public.academic_terms(school_id, academic_year, term);

-- ==============================================================================
-- 4. PROFILES TABLE (Users: Admin, Teachers, Super Admin)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'super_admin')),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone_number TEXT,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'On Leave', 'Suspended')),
    salary NUMERIC(12,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_profiles_school ON public.profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ==============================================================================
-- 5. CLASSES & SUBJECTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    section TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT unique_class_per_school UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    type TEXT DEFAULT 'Core' CHECK (type IN ('Core', 'Elective')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT unique_subject_per_school UNIQUE (school_id, name)
);

-- ==============================================================================
-- 5B. SUBJECT ASSIGNMENTS (Curriculum: Linking Subjects to Classes)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.subject_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT unique_subject_class UNIQUE (subject_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_subject_assignments_lookup ON public.subject_assignments(school_id, subject_id, class_id);
CREATE INDEX IF NOT EXISTS idx_subject_assignments_class ON public.subject_assignments(class_id);

ALTER TABLE public.subject_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Schools can manage subject assignments" ON public.subject_assignments;
CREATE POLICY "Schools can manage subject assignments" ON public.subject_assignments
    USING (school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid()));
GRANT ALL ON public.subject_assignments TO authenticated, service_role, anon;

-- ==============================================================================
-- 6. TEACHER ASSIGNMENTS (Multi-Class & Subject Teaching)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.teacher_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    is_class_teacher BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    -- Ensures a teacher isn't assigned the exact same class + subject twice
    CONSTRAINT unique_teacher_class_subject UNIQUE NULLS NOT DISTINCT (school_id, teacher_id, class_id, subject_id, is_class_teacher)
);

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_lookup ON public.teacher_assignments(school_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_class ON public.teacher_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_class_teacher ON public.teacher_assignments(class_id) WHERE is_class_teacher = true;

-- ==============================================================================
-- 6B. TEACHER DAILY ATTENDANCE & LEAVE TRACKING
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.teacher_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Late', 'On Leave', 'Half Day')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT unique_teacher_attendance_day UNIQUE (school_id, teacher_id, date)
);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_lookup ON public.teacher_attendance(school_id, date);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_teacher ON public.teacher_attendance(school_id, teacher_id, date);

ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Schools can manage teacher attendance" ON public.teacher_attendance;
CREATE POLICY "Schools can manage teacher attendance" ON public.teacher_attendance
    USING (school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid()));
GRANT ALL ON public.teacher_attendance TO authenticated, service_role;

-- ==============================================================================
-- 6C. TEACHER PAYROLL & SALARY DISBURSEMENT
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.payroll_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    month TEXT NOT NULL, -- Format: 'YYYY-MM', e.g. '2026-10'
    base_salary NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    days_absent INTEGER NOT NULL DEFAULT 0,
    absent_deduction NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    bonus NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    other_deductions NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    allowances JSONB DEFAULT '[]'::jsonb,
    deductions JSONB DEFAULT '[]'::jsonb,
    net_salary NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Paid', 'Pending', 'Cancelled')),
    payment_date DATE,
    payment_method TEXT DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Mobile Money', 'Bank Transfer', 'Cheque', 'Other')),
    reference TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT unique_teacher_payroll_month UNIQUE (school_id, teacher_id, month)
);

CREATE INDEX IF NOT EXISTS idx_payroll_records_month ON public.payroll_records(school_id, month);
CREATE INDEX IF NOT EXISTS idx_payroll_records_teacher ON public.payroll_records(school_id, teacher_id);

-- ==============================================================================
-- 6D. TIMETABLE & CLASS SCHEDULES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.timetable_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    type TEXT DEFAULT 'Lesson' CHECK (type IN ('Lesson', 'Break', 'Assembly', 'Other')),
    room_number TEXT,
    activity_name TEXT,
    term TEXT,
    academic_year TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_timetable_school ON public.timetable_entries(school_id);
CREATE INDEX IF NOT EXISTS idx_timetable_class ON public.timetable_entries(class_id);
CREATE INDEX IF NOT EXISTS idx_timetable_teacher ON public.timetable_entries(teacher_id);
CREATE INDEX IF NOT EXISTS idx_timetable_day ON public.timetable_entries(school_id, day_of_week);

ALTER TABLE public.timetable_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view timetable entries from their school" ON public.timetable_entries;
CREATE POLICY "Users can view timetable entries from their school"
    ON public.timetable_entries FOR SELECT
    USING (school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage timetable entries" ON public.timetable_entries;
CREATE POLICY "Admins can manage timetable entries"
    ON public.timetable_entries FOR ALL
    USING (
        school_id IN (
            SELECT school_id FROM public.profiles 
            WHERE id = auth.uid() 
            AND (role ILIKE '%admin%' OR role ILIKE '%director%' OR role ILIKE '%principal%' OR role ILIKE '%head%')
        )
    );
GRANT ALL ON public.timetable_entries TO authenticated, service_role;

-- ==============================================================================
-- 7. PARENTS & GUARDIANS (Normalized Family & Multi-Child Linking)
-- ==============================================================================
-- Parents can have 1, 2, or more children in the same school or across classes.
CREATE TABLE IF NOT EXISTS public.guardians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    relationship TEXT DEFAULT 'Parent' CHECK (relationship IN ('Parent', 'Father', 'Mother', 'Guardian', 'Other')),
    alternate_phone TEXT,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT unique_guardian_per_school UNIQUE (school_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_guardians_phone ON public.guardians(school_id, phone);

-- ==============================================================================
-- 8. STUDENTS & STUDENT-GUARDIAN LINKING
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    class TEXT NOT NULL, -- kept for backward compatibility and fast direct queries
    name TEXT NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female')),
    parent_name TEXT NOT NULL, -- primary contact (fast access)
    parent_phone TEXT NOT NULL, -- primary contact (fast SMS dispatch)
    guardian_id UUID REFERENCES public.guardians(id) ON DELETE SET NULL, -- relational link to guardian
    admission_no TEXT,
    pin TEXT,
    photo_url TEXT,
    date_of_birth DATE,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended', 'Graduated')),
    balance NUMERIC(12,2) DEFAULT 0.00,
    feeding_credit NUMERIC(10,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_students_school ON public.students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(school_id, class);
CREATE INDEX IF NOT EXISTS idx_students_parent_phone ON public.students(school_id, parent_phone);

-- Multi-child mapping table (Allows multiple guardians per student, or 1 parent linked to multiple siblings)
CREATE TABLE IF NOT EXISTS public.student_guardians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    guardian_id UUID NOT NULL REFERENCES public.guardians(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT unique_student_guardian UNIQUE (student_id, guardian_id)
);

CREATE INDEX IF NOT EXISTS idx_student_guardians_lookup ON public.student_guardians(student_id, guardian_id);

-- ==============================================================================
-- 8. EXAM RESULTS & SUBMISSIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.exam_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class TEXT NOT NULL,
    subject TEXT NOT NULL,
    term TEXT NOT NULL CHECK (term IN ('First Term', 'Second Term', 'Third Term')),
    academic_year TEXT NOT NULL CHECK (
        academic_year IN (
            '2022/2023', '2023/2024', '2024/2025', '2025/2026', 
            '2026/2027', '2027/2028', '2028/2029', '2029/2030', 
            '2030/2031', '2031/2032', '2032/2033', '2033/2034'
        )
    ),
    class_score NUMERIC(6,2) DEFAULT 0,
    exam_score NUMERIC(6,2) DEFAULT 0,
    total NUMERIC(6,2) GENERATED ALWAYS AS (COALESCE(class_score,0) + COALESCE(exam_score,0)) STORED,
    competency_status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT unique_student_subject_session UNIQUE (student_id, subject, term, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_exam_results_lookup ON public.exam_results(school_id, term, academic_year, class);

-- Teacher Mark Submissions Table
CREATE TABLE IF NOT EXISTS public.exam_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    class TEXT NOT NULL,
    subject TEXT NOT NULL,
    term TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Submitted', 'Approved', 'Rejected')),
    submitted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT unique_exam_submission UNIQUE (school_id, class, subject, term, academic_year)
);

-- Exam Config Table (Fast toggle and term sync table)
CREATE TABLE IF NOT EXISTS public.exam_config (
    school_id UUID PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
    mark_entry_enabled BOOLEAN DEFAULT true,
    current_term TEXT DEFAULT 'First Term',
    academic_year TEXT DEFAULT '2025/2026',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.exam_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Schools can manage their exam config" ON public.exam_config;
CREATE POLICY "Schools can manage their exam config" ON public.exam_config
    USING (school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid()));
GRANT ALL ON public.exam_config TO authenticated, service_role;

-- Exam Report Status Table (Terminal report release control per class)
CREATE TABLE IF NOT EXISTS public.exam_report_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    class_name TEXT NOT NULL,
    term TEXT NOT NULL,
    academic_year TEXT,
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Approved', 'Released')),
    released_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT unique_exam_report_status UNIQUE (school_id, class_name, term)
);

ALTER TABLE public.exam_report_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Schools can manage report statuses" ON public.exam_report_status;
CREATE POLICY "Schools can manage report statuses" ON public.exam_report_status
    USING (school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid()));
DROP POLICY IF EXISTS "Public can view released report status" ON public.exam_report_status;
CREATE POLICY "Public can view released report status" ON public.exam_report_status
    FOR SELECT USING (status = 'Released');
GRANT ALL ON public.exam_report_status TO authenticated, service_role, anon;

-- Ensure exam_results supports composite uniqueness with class as well
CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_results_full_composite 
ON public.exam_results (student_id, class, subject, term, academic_year);

-- ==============================================================================
-- 9. STUDENT REPORT CARDS (Appraisals & Term Summaries)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.student_report_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class TEXT NOT NULL,
    term TEXT NOT NULL CHECK (term IN ('First Term', 'Second Term', 'Third Term')),
    academic_year TEXT NOT NULL,
    teacher_remark TEXT,
    principal_remark TEXT,
    promotion_status TEXT,
    conduct TEXT,
    interest TEXT,
    attendance_present INTEGER,
    attendance_total INTEGER,
    pupil_bill NUMERIC(10,2),
    other_fees NUMERIC(10,2),
    next_class TEXT,
    items_to_bring TEXT,
    next_term_reopens TEXT,
    position_in_class INTEGER,
    total_students INTEGER,
    extra_bill_items JSONB DEFAULT '[]'::jsonb,
    extra_report_sections JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT unique_student_term_report UNIQUE (school_id, student_id, term, academic_year)
);

-- ==============================================================================
-- 10. ATTENDANCE & FINANCIAL TRANSACTIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Late')),
    term TEXT,
    academic_year TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT unique_attendance_day UNIQUE (student_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_lookup ON public.attendance(school_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON public.attendance(school_id, class, date);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance(student_id, date);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Schools can manage attendance" ON public.attendance;
CREATE POLICY "Schools can manage attendance" ON public.attendance
    USING (school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid()));
GRANT ALL ON public.attendance TO authenticated, service_role;

-- Daily Feeding Ledger Table
CREATE TABLE IF NOT EXISTS public.feeding_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'PAID' CHECK (status IN ('PAID', 'PARTIAL', 'DEBT')),
    amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT unique_feeding_log UNIQUE (student_id, date)
);

CREATE INDEX IF NOT EXISTS idx_feeding_logs_lookup ON public.feeding_logs(school_id, date);
CREATE INDEX IF NOT EXISTS idx_feeding_logs_student ON public.feeding_logs(student_id, date);

ALTER TABLE public.feeding_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Schools can manage feeding logs" ON public.feeding_logs;
CREATE POLICY "Schools can manage feeding logs" ON public.feeding_logs
    USING (school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid()));
GRANT ALL ON public.feeding_logs TO authenticated, service_role;

-- ==============================================================================
-- 10. FEE STRUCTURE & INVOICING
-- ==============================================================================
-- School Fee Items (e.g. Tuition, Exam Fee, Maintenance, PTA, Feeding)
CREATE TABLE IF NOT EXISTS public.fee_structure (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    target_class TEXT, -- NULL means applicable to all classes, or specific class name
    term TEXT NOT NULL CHECK (term IN ('First Term', 'Second Term', 'Third Term')),
    academic_year TEXT NOT NULL,
    is_mandatory BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT unique_fee_item UNIQUE (school_id, name, target_class, term, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_fee_structure_lookup ON public.fee_structure(school_id, term, academic_year, target_class);

-- Student Fee Invoices (Actual billed ledger per student)
CREATE TABLE IF NOT EXISTS public.student_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    fee_item_id UUID REFERENCES public.fee_structure(id) ON DELETE SET NULL,
    fee_name TEXT NOT NULL,
    amount_due NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    term TEXT NOT NULL CHECK (term IN ('First Term', 'Second Term', 'Third Term')),
    academic_year TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (status IN ('Unpaid', 'Partially Paid', 'Paid', 'Waived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_student_invoices_student ON public.student_invoices(student_id, term, academic_year);

-- ==============================================================================
-- 11. FINANCIAL TRANSACTIONS & ONLINE PAYMENT GATEWAY LOGS (Paystack/Hubtel/MTN MoMo)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    guardian_id UUID REFERENCES public.guardians(id) ON DELETE SET NULL, -- who paid (optional)
    amount NUMERIC(12,2) NOT NULL,
    type TEXT NOT NULL DEFAULT 'Fee Payment', -- 'Fee Payment', 'Payment Reversal', 'Daily Feeding', 'Other'
    method TEXT NOT NULL DEFAULT 'Cash' CHECK (method IN ('Cash', 'Mobile Money', 'Bank Transfer', 'Online/Card', 'Cheque')),
    reference TEXT, -- Receipt # or Payment Gateway Transaction Reference (e.g. Paystack ref)
    channel TEXT DEFAULT 'Admin Desk' CHECK (channel IN ('Admin Desk', 'Parent Mobile App', 'USSD', 'Bank Webhook')),
    payer_name TEXT,
    payer_phone TEXT,
    term TEXT NOT NULL CHECK (term IN ('First Term', 'Second Term', 'Third Term')),
    academic_year TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'Completed' CHECK (status IN ('Completed', 'Pending', 'Failed', 'Reversed')),
    metadata JSONB DEFAULT '{}'::jsonb, -- stores raw webhook or provider payload
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_transactions_student ON public.transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_transactions_school_date ON public.transactions(school_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_ref ON public.transactions(reference);

-- Dedicated Payment Verification / Webhook Table for Parent Online App Payments
CREATE TABLE IF NOT EXISTS public.payment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    guardian_id UUID REFERENCES public.guardians(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL,
    provider TEXT NOT NULL DEFAULT 'Paystack' CHECK (provider IN ('Paystack', 'Hubtel', 'Flutterwave', 'MTN_MoMo', 'Telecel_Cash')),
    reference TEXT NOT NULL UNIQUE,
    provider_reference TEXT,
    term TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Successful', 'Failed', 'Expired')),
    payer_phone TEXT,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_ref ON public.payment_requests(reference);

-- ==============================================================================
-- 12. SAAS BILLING & SCHOOL SUBSCRIPTION PACKAGES (Monthly, Termly/4-Month, Full Pack)
-- ==============================================================================
-- How Orbit / Base16 charges schools:
-- 1. Monthly: Charged every 30 days (per student or flat).
-- 2. Per Term / Semester (4 Months): Charged per term (e.g. GHS 4 - 6 per student per term).
-- 3. Full Pack (Annual): 1 Year / 3 Terms all-inclusive discount license.

CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE, -- 'monthly_standard', 'termly_basic', 'annual_fullpack'
    name TEXT NOT NULL,
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('Monthly', 'Termly', 'Annual')),
    duration_months INTEGER NOT NULL DEFAULT 4, -- 1 for monthly, 4 for termly, 12 for annual
    price_per_student NUMERIC(10,2) DEFAULT 0.00,
    flat_price NUMERIC(10,2) DEFAULT 0.00,
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Seed default billing tiers & modular pricing
INSERT INTO public.subscription_plans (code, name, billing_cycle, duration_months, price_per_student, flat_price, features)
VALUES 
    ('full_suite', '⭐ All-in-One Full Suite', 'Termly', 4, 0.00, 350.00, '["Academic Engine", "Revenue Guard", "Operations & Payroll", "Parent Portal", "Orbit AI Co-Pilot", "Unlimited Students", "Priority Support"]'::jsonb),
    ('academic_engine', 'Academic Engine', 'Termly', 4, 0.00, 100.00, '["Terminal Exams", "Assessment Sheets", "Report Cards", "Broadsheets", "PDF Export"]'::jsonb),
    ('revenue_guard', 'Revenue Guard', 'Termly', 4, 0.00, 120.00, '["Fee Structure", "Invoices", "Receipts", "Debtor Tracking", "Finance Reports"]'::jsonb),
    ('daily_operations', 'Operations, Staff & Feeding', 'Termly', 4, 0.00, 100.00, '["Student Attendance", "Teacher Attendance", "Staff Payroll", "Payslips", "Feeding Tracker"]'::jsonb),
    ('parent_portal', 'Parent Portal & Notices', 'Termly', 4, 0.00, 80.00, '["Parent Online Access", "Report Cards Lookup", "Notice Board", "Fee Balance View"]'::jsonb),
    ('ai_copilot', 'Orbit AI Co-Pilot', 'Termly', 4, 0.00, 100.00, '["Automated AI Remarks", "School Intelligence", "Performance Forecasting"]'::jsonb),
    ('monthly_pro', 'Monthly Active License', 'Monthly', 1, 2.00, 0.00, '["Core SMS", "Attendance", "Feeding", "Mobile App"]'::jsonb),
    ('termly_foundation', 'Termly Semester Package (4 Months)', 'Termly', 4, 4.00, 0.00, '["Full Exam Module", "Reports", "Parent Access", "Unlimited Teachers"]'::jsonb),
    ('annual_fullpack', 'Annual Full Pack (3 Terms / 12 Months)', 'Annual', 12, 10.00, 0.00, '["All Modules Included", "Priority Support", "Custom Branding", "Free SMS Quota"]'::jsonb)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    flat_price = EXCLUDED.flat_price,
    features = EXCLUDED.features;

-- Active School Subscription Tracking
CREATE TABLE IF NOT EXISTS public.school_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    plan_code TEXT NOT NULL REFERENCES public.subscription_plans(code),
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('Monthly', 'Termly', 'Annual')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'expired')),
    student_count_billed INTEGER DEFAULT 0,
    amount_billed NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    auto_renew BOOLEAN NOT NULL DEFAULT false,
    current_period_start DATE NOT NULL DEFAULT CURRENT_DATE,
    current_period_end DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '4 months'),
    payment_method TEXT DEFAULT 'Mobile Money',
    payment_reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT unique_school_active_sub UNIQUE (school_id)
);

CREATE INDEX IF NOT EXISTS idx_school_subs_status ON public.school_subscriptions(school_id, status);

-- School SaaS Billing History / Invoices Issued to Schools
CREATE TABLE IF NOT EXISTS public.school_billing_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('Monthly', 'Termly', 'Annual')),
    student_count INTEGER NOT NULL DEFAULT 0,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'Paid' CHECK (status IN ('Pending', 'Paid', 'Failed', 'Waived')),
    payment_method TEXT DEFAULT 'Mobile Money',
    payment_ref TEXT,
    paid_at TIMESTAMPTZ,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_school_billing_invoices ON public.school_billing_invoices(school_id, status);

-- RPC: Activate or renew school subscription
CREATE OR REPLACE FUNCTION public.activate_school_subscription(
    p_school_id UUID,
    p_plan_code TEXT,
    p_amount NUMERIC,
    p_payment_method TEXT DEFAULT 'Mobile Money',
    p_payment_ref TEXT DEFAULT NULL,
    p_description TEXT DEFAULT 'Orbit Subscription Plan'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_end_date DATE := (CURRENT_DATE + INTERVAL '4 months');
    v_inv_num TEXT := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM()*10000)::TEXT, 4, '0');
    v_ref TEXT := COALESCE(p_payment_ref, 'REF-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS'));
BEGIN
    -- 1. Upsert active subscription
    INSERT INTO public.school_subscriptions (
        school_id, plan_code, billing_cycle, status, amount_billed, auto_renew,
        current_period_start, current_period_end, payment_method, payment_reference, updated_at
    )
    VALUES (
        p_school_id, p_plan_code, 'Termly', 'active', p_amount, true,
        CURRENT_DATE, v_end_date, p_payment_method, v_ref, timezone('utc', now())
    )
    ON CONFLICT (school_id) DO UPDATE SET
        plan_code = EXCLUDED.plan_code,
        billing_cycle = 'Termly',
        status = 'active',
        amount_billed = EXCLUDED.amount_billed,
        current_period_start = CURRENT_DATE,
        current_period_end = v_end_date,
        payment_method = EXCLUDED.payment_method,
        payment_reference = EXCLUDED.payment_reference,
        updated_at = timezone('utc', now());

    -- 2. Update school subscription_plan and next_payment_due
    UPDATE public.schools
    SET subscription_plan = p_plan_code,
        next_payment_due = v_end_date,
        status = 'active'
    WHERE id = p_school_id;

    -- 3. Create billing invoice record
    INSERT INTO public.school_billing_invoices (
        school_id, invoice_number, description, billing_cycle,
        amount, status, payment_method, payment_ref, paid_at,
        period_start, period_end
    )
    VALUES (
        p_school_id, v_inv_num, p_description, 'Termly',
        p_amount, 'Paid', p_payment_method, v_ref, timezone('utc', now()),
        CURRENT_DATE, v_end_date
    );

    RETURN jsonb_build_object(
        'success', true,
        'school_id', p_school_id,
        'plan_code', p_plan_code,
        'amount', p_amount,
        'invoice_number', v_inv_num,
        'expires_at', v_end_date
    );
END;
$$;

-- ==============================================================================
-- 11. RPC: CREATE TEACHER (Auth + Profile + Cleanup Atomicity)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_create_teacher(
    p_school_id UUID,
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_phone TEXT,
    p_salary NUMERIC,
    p_primary_class TEXT DEFAULT NULL,
    p_primary_subject TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_normalized_email TEXT;
    v_clean_phone TEXT := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
BEGIN
    -- If no email provided, generate phone-based system email
    IF p_email IS NULL OR trim(p_email) = '' THEN
        v_normalized_email := 'teacher_' || v_clean_phone || '@school.orbit';
    ELSE
        v_normalized_email := lower(trim(p_email));
    END IF;

    -- Check if user already exists in auth.users
    SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = v_normalized_email;

    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();

        -- Insert into auth.users with auto-confirmed email & phone
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            phone,
            encrypted_password,
            email_confirmed_at,
            phone_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            recovery_token,
            email_change_token_new,
            email_change
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_user_id,
            'authenticated',
            'authenticated',
            v_normalized_email,
            p_phone,
            crypt(p_password, gen_salt('bf')),
            now(),
            now(),
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            jsonb_build_object('full_name', p_full_name, 'role', 'teacher', 'school_id', p_school_id),
            now(),
            now(),
            '',
            '',
            '',
            ''
        );

        -- Insert into auth.identities
        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            v_user_id,
            v_user_id,
            jsonb_build_object('sub', v_user_id::text, 'email', v_normalized_email, 'email_verified', true),
            'email',
            v_normalized_email,
            now(),
            now(),
            now()
        )
        ON CONFLICT (provider, provider_id) DO NOTHING;
    ELSE
        -- Update password and phone if re-registering
        UPDATE auth.users 
        SET encrypted_password = crypt(p_password, gen_salt('bf')),
            phone = p_phone,
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            phone_confirmed_at = COALESCE(phone_confirmed_at, now()),
            updated_at = now()
        WHERE id = v_user_id;

        -- Ensure identity exists
        INSERT INTO auth.identities (
            id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
        ) VALUES (
            v_user_id, v_user_id,
            jsonb_build_object('sub', v_user_id::text, 'email', v_normalized_email, 'email_verified', true),
            'email', v_normalized_email, now(), now(), now()
        )
        ON CONFLICT (provider, provider_id) DO NOTHING;
    END IF;

    -- Upsert profile record
    INSERT INTO public.profiles (
        id, school_id, role, full_name, email, phone_number, salary, status
    ) VALUES (
        v_user_id, p_school_id, 'teacher', p_full_name, v_normalized_email, p_phone, COALESCE(p_salary, 0), 'Active'
    )
    ON CONFLICT (id) DO UPDATE SET
        school_id = EXCLUDED.school_id,
        role = 'teacher',
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        phone_number = EXCLUDED.phone_number,
        salary = EXCLUDED.salary,
        status = 'Active';

    -- Optional default class assignment
    IF p_primary_class IS NOT NULL AND trim(p_primary_class) != '' THEN
        INSERT INTO public.teacher_assignments (
            school_id, teacher_id, class_name, subject_name, is_form_teacher
        ) VALUES (
            p_school_id, v_user_id, trim(p_primary_class), trim(COALESCE(p_primary_subject, '')), true
        )
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN v_user_id;
END;
$$;

-- ==============================================================================
-- 12. RPC: DELETE TEACHER (Cascade delete from auth + profiles + assignments)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_delete_teacher(
    p_school_id UUID,
    p_teacher_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verify teacher belongs to this school
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = p_teacher_id AND school_id = p_school_id AND role = 'teacher'
    ) THEN
        RAISE EXCEPTION 'Teacher does not belong to this school or is not a teacher';
    END IF;

    -- Delete teacher assignments, attendance, and payroll records
    DELETE FROM public.teacher_assignments WHERE teacher_id = p_teacher_id;
    DELETE FROM public.teacher_attendance WHERE teacher_id = p_teacher_id;
    DELETE FROM public.payroll_records WHERE teacher_id = p_teacher_id;

    -- Delete from profiles
    DELETE FROM public.profiles WHERE id = p_teacher_id;

    -- Delete from auth identities and users
    DELETE FROM auth.identities WHERE user_id = p_teacher_id;
    DELETE FROM auth.users WHERE id = p_teacher_id;

    RETURN TRUE;
END;
$$;

-- ==============================================================================
-- 13. RPC: RESET TEACHER PASSWORD
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_reset_teacher_password(
    target_teacher_id UUID DEFAULT NULL,
    new_password TEXT DEFAULT NULL,
    p_teacher_id UUID DEFAULT NULL,
    p_new_password TEXT DEFAULT NULL,
    p_school_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actual_target_id UUID := COALESCE(target_teacher_id, p_teacher_id);
    v_actual_password TEXT := COALESCE(new_password, p_new_password);
BEGIN
    IF v_actual_target_id IS NULL OR v_actual_password IS NULL THEN
        RAISE EXCEPTION 'Target teacher ID and new password are required';
    END IF;

    UPDATE auth.users
    SET encrypted_password = crypt(v_actual_password, gen_salt('bf')),
        updated_at = now()
    WHERE id = v_actual_target_id;

    RETURN TRUE;
END;
$$;

-- Compatibility: delete_teacher_user(teacher_id)
CREATE OR REPLACE FUNCTION public.delete_teacher_user(teacher_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.teacher_assignments WHERE teacher_id = delete_teacher_user.teacher_id;
    DELETE FROM public.teacher_attendance WHERE teacher_id = delete_teacher_user.teacher_id;
    DELETE FROM public.payroll_records WHERE teacher_id = delete_teacher_user.teacher_id;
    DELETE FROM public.teachers WHERE id = delete_teacher_user.teacher_id;
    DELETE FROM public.profiles WHERE id = delete_teacher_user.teacher_id;
    DELETE FROM auth.identities WHERE user_id = delete_teacher_user.teacher_id;
    DELETE FROM auth.users WHERE id = delete_teacher_user.teacher_id;
END;
$$;

-- ==============================================================================
-- 14. RPC: SAVE INDIVIDUAL STUDENT REPORT CARD (Single Student)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.save_student_report(
    p_school_id UUID,
    p_student_id UUID,
    p_class TEXT,
    p_term TEXT,
    p_year TEXT,
    p_teacher_remark TEXT DEFAULT NULL,
    p_principal_remark TEXT DEFAULT NULL,
    p_promotion_status TEXT DEFAULT NULL,
    p_position INTEGER DEFAULT 0,
    p_total_students INTEGER DEFAULT 0,
    p_attendance_present INTEGER DEFAULT NULL,
    p_attendance_total INTEGER DEFAULT NULL,
    p_next_class TEXT DEFAULT NULL,
    p_pupil_bill NUMERIC DEFAULT 0,
    p_other_fees NUMERIC DEFAULT 0,
    p_conduct TEXT DEFAULT NULL,
    p_interest TEXT DEFAULT NULL,
    p_items_to_bring TEXT DEFAULT NULL,
    p_next_term_reopens TEXT DEFAULT NULL,
    p_extra_bill_items JSONB DEFAULT '[]'::jsonb,
    p_extra_report_sections JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.student_report_cards (
        school_id,
        student_id,
        class,
        term,
        academic_year,
        teacher_remark,
        principal_remark,
        promotion_status,
        position_in_class,
        total_students,
        attendance_present,
        attendance_total,
        next_class,
        pupil_bill,
        other_fees,
        conduct,
        interest,
        items_to_bring,
        next_term_reopens,
        extra_bill_items,
        extra_report_sections,
        updated_at
    )
    VALUES (
        p_school_id,
        p_student_id,
        trim(p_class),
        trim(p_term),
        trim(p_year),
        p_teacher_remark,
        p_principal_remark,
        p_promotion_status,
        p_position,
        p_total_students,
        p_attendance_present,
        p_attendance_total,
        p_next_class,
        COALESCE(p_pupil_bill, 0),
        COALESCE(p_other_fees, 0),
        p_conduct,
        p_interest,
        p_items_to_bring,
        p_next_term_reopens,
        COALESCE(p_extra_bill_items, '[]'::jsonb),
        COALESCE(p_extra_report_sections, '[]'::jsonb),
        now()
    )
    ON CONFLICT (school_id, student_id, term, academic_year)
    DO UPDATE SET
        class = EXCLUDED.class,
        teacher_remark = COALESCE(EXCLUDED.teacher_remark, student_report_cards.teacher_remark),
        principal_remark = COALESCE(EXCLUDED.principal_remark, student_report_cards.principal_remark),
        promotion_status = COALESCE(EXCLUDED.promotion_status, student_report_cards.promotion_status),
        position_in_class = CASE WHEN EXCLUDED.position_in_class > 0 THEN EXCLUDED.position_in_class ELSE student_report_cards.position_in_class END,
        total_students = CASE WHEN EXCLUDED.total_students > 0 THEN EXCLUDED.total_students ELSE student_report_cards.total_students END,
        attendance_present = COALESCE(EXCLUDED.attendance_present, student_report_cards.attendance_present),
        attendance_total = COALESCE(EXCLUDED.attendance_total, student_report_cards.attendance_total),
        next_class = COALESCE(EXCLUDED.next_class, student_report_cards.next_class),
        pupil_bill = COALESCE(EXCLUDED.pupil_bill, student_report_cards.pupil_bill),
        other_fees = COALESCE(EXCLUDED.other_fees, student_report_cards.other_fees),
        conduct = COALESCE(EXCLUDED.conduct, student_report_cards.conduct),
        interest = COALESCE(EXCLUDED.interest, student_report_cards.interest),
        items_to_bring = COALESCE(EXCLUDED.items_to_bring, student_report_cards.items_to_bring),
        next_term_reopens = COALESCE(EXCLUDED.next_term_reopens, student_report_cards.next_term_reopens),
        extra_bill_items = CASE WHEN jsonb_array_length(EXCLUDED.extra_bill_items) > 0 THEN EXCLUDED.extra_bill_items ELSE student_report_cards.extra_bill_items END,
        extra_report_sections = CASE WHEN jsonb_array_length(EXCLUDED.extra_report_sections) > 0 THEN EXCLUDED.extra_report_sections ELSE student_report_cards.extra_report_sections END,
        updated_at = now();

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ==============================================================================
-- 15. RPC: SAVE BULK STUDENT REMARKS / REPORT CARDS (Class Level Teacher View)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.save_student_reports_bulk(p_reports JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    report_item JSONB;
BEGIN
    FOR report_item IN SELECT * FROM jsonb_array_elements(p_reports)
    LOOP
        INSERT INTO public.student_report_cards (
            school_id,
            student_id,
            class,
            term,
            academic_year,
            teacher_remark,
            principal_remark,
            promotion_status,
            conduct,
            interest,
            attendance_present,
            attendance_total,
            next_class,
            pupil_bill,
            other_fees,
            items_to_bring,
            next_term_reopens,
            extra_bill_items,
            extra_report_sections,
            updated_at
        )
        VALUES (
            (report_item->>'school_id')::UUID,
            (report_item->>'student_id')::UUID,
            trim(report_item->>'class'),
            trim(report_item->>'term'),
            trim(report_item->>'academic_year'),
            report_item->>'teacher_remark',
            report_item->>'principal_remark',
            report_item->>'promotion_status',
            report_item->>'conduct',
            report_item->>'interest',
            (report_item->>'attendance_present')::INTEGER,
            (report_item->>'attendance_total')::INTEGER,
            report_item->>'next_class',
            COALESCE((report_item->>'pupil_bill')::NUMERIC, 0),
            COALESCE((report_item->>'other_fees')::NUMERIC, 0),
            report_item->>'items_to_bring',
            report_item->>'next_term_reopens',
            COALESCE(report_item->'extra_bill_items', '[]'::JSONB),
            COALESCE(report_item->'extra_report_sections', '[]'::JSONB),
            now()
        )
        ON CONFLICT (school_id, student_id, term, academic_year)
        DO UPDATE SET
            teacher_remark = COALESCE(EXCLUDED.teacher_remark, student_report_cards.teacher_remark),
            principal_remark = COALESCE(EXCLUDED.principal_remark, student_report_cards.principal_remark),
            promotion_status = COALESCE(EXCLUDED.promotion_status, student_report_cards.promotion_status),
            conduct = COALESCE(EXCLUDED.conduct, student_report_cards.conduct),
            interest = COALESCE(EXCLUDED.interest, student_report_cards.interest),
            attendance_present = COALESCE(EXCLUDED.attendance_present, student_report_cards.attendance_present),
            attendance_total = COALESCE(EXCLUDED.attendance_total, student_report_cards.attendance_total),
            next_class = COALESCE(EXCLUDED.next_class, student_report_cards.next_class),
            pupil_bill = COALESCE(EXCLUDED.pupil_bill, student_report_cards.pupil_bill),
            other_fees = COALESCE(EXCLUDED.other_fees, student_report_cards.other_fees),
            items_to_bring = COALESCE(EXCLUDED.items_to_bring, student_report_cards.items_to_bring),
            next_term_reopens = COALESCE(EXCLUDED.next_term_reopens, student_report_cards.next_term_reopens),
            extra_bill_items = CASE WHEN jsonb_array_length(EXCLUDED.extra_bill_items) > 0 THEN EXCLUDED.extra_bill_items ELSE student_report_cards.extra_bill_items END,
            extra_report_sections = CASE WHEN jsonb_array_length(EXCLUDED.extra_report_sections) > 0 THEN EXCLUDED.extra_report_sections ELSE student_report_cards.extra_report_sections END,
            updated_at = now();
    END LOOP;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ==============================================================================
-- 16. RPC: ATOMIC TEACHER ASSIGNMENTS (Set Class Teacher & Subjects in one go)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_set_teacher_assignments(
    p_school_id UUID,
    p_teacher_id UUID,
    p_assignments JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    assign_item JSONB;
BEGIN
    -- Verify teacher belongs to school
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = p_teacher_id AND school_id = p_school_id AND role = 'teacher'
    ) THEN
        RAISE EXCEPTION 'Target user is not a teacher at this school';
    END IF;

    -- Clear old assignments atomically
    DELETE FROM public.teacher_assignments 
    WHERE school_id = p_school_id AND teacher_id = p_teacher_id;

    -- Insert new assignments
    IF p_assignments IS NOT NULL AND jsonb_array_length(p_assignments) > 0 THEN
        FOR assign_item IN SELECT * FROM jsonb_array_elements(p_assignments)
        LOOP
            INSERT INTO public.teacher_assignments (
                school_id,
                teacher_id,
                class_id,
                subject_id,
                is_class_teacher
            )
            VALUES (
                p_school_id,
                p_teacher_id,
                (assign_item->>'class_id')::UUID,
                CASE WHEN (assign_item->>'subject_id') IS NOT NULL AND (assign_item->>'subject_id') <> '' 
                     THEN (assign_item->>'subject_id')::UUID 
                     ELSE NULL 
                END,
                COALESCE((assign_item->>'is_class_teacher')::BOOLEAN, false)
            )
            ON CONFLICT (school_id, teacher_id, class_id, subject_id, is_class_teacher) DO NOTHING;
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ==============================================================================
-- 17. RPC: RECORD PAYMENT & AUTO-UPDATE STUDENT BALANCE (Atomic Accounting)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.record_fee_payment(
    p_school_id UUID,
    p_student_id UUID,
    p_amount NUMERIC,
    p_method TEXT,
    p_reference TEXT,
    p_term TEXT,
    p_academic_year TEXT,
    p_channel TEXT DEFAULT 'Admin Desk',
    p_payer_name TEXT DEFAULT NULL,
    p_payer_phone TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_transaction_id UUID;
    v_new_balance NUMERIC;
BEGIN
    -- 1. Insert transaction record
    INSERT INTO public.transactions (
        school_id,
        student_id,
        amount,
        type,
        method,
        reference,
        channel,
        payer_name,
        payer_phone,
        term,
        academic_year,
        date,
        status,
        metadata
    )
    VALUES (
        p_school_id,
        p_student_id,
        p_amount,
        'Fee Payment',
        p_method,
        p_reference,
        p_channel,
        p_payer_name,
        p_payer_phone,
        trim(p_term),
        trim(p_academic_year),
        CURRENT_DATE,
        'Completed',
        p_metadata
    )
    RETURNING id INTO v_new_transaction_id;

    -- 2. Deduct from student's outstanding balance
    UPDATE public.students
    SET balance = balance - p_amount
    WHERE id = p_student_id AND school_id = p_school_id
    RETURNING balance INTO v_new_balance;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_new_transaction_id,
        'new_balance', v_new_balance
    );
END;
$$;

-- ==============================================================================
-- 18. RPC: GET PARENT PORTAL / APP DATA (Children, Balances, Reports & Results)
-- ==============================================================================
-- Used by the parent app or web portal to securely load student profile,
-- current term report card, exam marks, and outstanding balance by student admission_no + pin or parent phone.
CREATE OR REPLACE FUNCTION public.get_parent_portal_student_data(
    p_identifier TEXT, -- admission_no or student UUID
    p_pin TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_student RECORD;
    v_school RECORD;
    v_report RECORD;
    v_results JSONB;
    v_transactions JSONB;
BEGIN
    -- 1. Look up student
    SELECT * INTO v_student
    FROM public.students
    WHERE (admission_no = trim(p_identifier) OR id::text = trim(p_identifier))
      AND (p_pin IS NULL OR pin = trim(p_pin) OR pin IS NULL)
    LIMIT 1;

    IF v_student IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Student not found or incorrect PIN');
    END IF;

    -- 2. Look up school details
    SELECT id, name, motto, logo_url, brand_color, current_term, academic_year, currency, payment_config 
    INTO v_school
    FROM public.schools
    WHERE id = v_student.school_id;

    -- 3. Fetch latest active report card
    SELECT * INTO v_report
    FROM public.student_report_cards
    WHERE student_id = v_student.id
      AND term = v_school.current_term
      AND academic_year = v_school.academic_year
    LIMIT 1;

    -- 4. Fetch current exam results
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'subject', er.subject,
        'class_score', er.class_score,
        'exam_score', er.exam_score,
        'total', er.total,
        'competency_status', er.competency_status
    )), '[]'::jsonb) INTO v_results
    FROM public.exam_results er
    WHERE er.student_id = v_student.id
      AND er.term = v_school.current_term
      AND er.academic_year = v_school.academic_year;

    -- 5. Fetch recent payment transactions
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', t.id,
        'date', t.date,
        'amount', t.amount,
        'method', t.method,
        'reference', t.reference,
        'type', t.type
    )), '[]'::jsonb) INTO v_transactions
    FROM (
        SELECT id, date, amount, method, reference, type
        FROM public.transactions
        WHERE student_id = v_student.id
        ORDER BY date DESC, created_at DESC
        LIMIT 10
    ) t;

    RETURN jsonb_build_object(
        'success', true,
        'student', jsonb_build_object(
            'id', v_student.id,
            'name', v_student.name,
            'class', v_student.class,
            'admission_no', v_student.admission_no,
            'balance', v_student.balance,
            'parent_name', v_student.parent_name,
            'parent_phone', v_student.parent_phone,
            'photo_url', v_student.photo_url
        ),
        'school', jsonb_build_object(
            'id', v_school.id,
            'name', v_school.name,
            'motto', v_school.motto,
            'logo_url', v_school.logo_url,
            'current_term', v_school.current_term,
            'academic_year', v_school.academic_year,
            'currency', v_school.currency,
            'payment_config', v_school.payment_config
        ),
        'report_card', to_jsonb(v_report),
        'exam_results', v_results,
        'transactions', v_transactions
    );
END;
$$;

-- ==============================================================================
-- 19. RPC: SWITCH / START NEW ACADEMIC TERM OR YEAR (With Data Isolation & Fee Rollover)
-- ==============================================================================
-- When a school closes a term/year and starts a new one:
-- 1. All marks and report cards of the past term remain permanently untouched.
-- 2. Outstanding fee balances are preserved (brought forward) or reset as desired.
-- 3. Fee structure can automatically copy forward from the previous term so the admin doesn't re-type.
-- 4. Mark entry is freshly configured for the incoming term.
CREATE OR REPLACE FUNCTION public.admin_switch_academic_term(
    p_school_id UUID,
    p_new_term TEXT,
    p_new_year TEXT,
    p_copy_fee_structure BOOLEAN DEFAULT true,
    p_roll_over_arrears BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_old_term TEXT;
    v_old_year TEXT;
    v_fee_count INTEGER := 0;
BEGIN
    -- Validate term and year constraints
    IF p_new_term NOT IN ('First Term', 'Second Term', 'Third Term') THEN
        RAISE EXCEPTION 'Invalid term name: %', p_new_term;
    END IF;

    -- 1. Fetch current active session
    SELECT current_term, academic_year INTO v_old_term, v_old_year
    FROM public.schools
    WHERE id = p_school_id;

    -- 2. Register or update the target term in academic_terms table
    -- Deactivate current term flags
    UPDATE public.academic_terms
    SET is_current = false
    WHERE school_id = p_school_id;

    -- Activate target term
    INSERT INTO public.academic_terms (
        school_id, academic_year, term, is_current, is_locked
    )
    VALUES (
        p_school_id, p_new_year, p_new_term, true, false
    )
    ON CONFLICT (school_id, academic_year, term)
    DO UPDATE SET
        is_current = true,
        is_locked = false;

    -- 3. Update schools table main configuration
    UPDATE public.schools
    SET current_term = p_new_term,
        academic_year = p_new_year
    WHERE id = p_school_id;

    -- 4. Copy forward fee structure if requested and not yet existing for the new term
    IF p_copy_fee_structure AND v_old_term IS NOT NULL AND v_old_year IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.fee_structure 
            WHERE school_id = p_school_id AND term = p_new_term AND academic_year = p_new_year
        ) THEN
            INSERT INTO public.fee_structure (
                school_id, name, amount, target_class, term, academic_year, is_mandatory
            )
            SELECT 
                school_id, name, amount, target_class, p_new_term, p_new_year, is_mandatory
            FROM public.fee_structure
            WHERE school_id = p_school_id 
              AND term = v_old_term 
              AND academic_year = v_old_year;

            GET DIAGNOSTICS v_fee_count = ROW_COUNT;

            -- Apply new mandatory fees to student balances
            UPDATE public.students s
            SET balance = balance + COALESCE(
                (SELECT SUM(fs.amount) 
                 FROM public.fee_structure fs
                 WHERE fs.school_id = p_school_id
                   AND fs.term = p_new_term
                   AND fs.academic_year = p_new_year
                   AND (fs.target_class IS NULL OR fs.target_class = s.class)
                   AND fs.is_mandatory = true),
                0
            )
            WHERE s.school_id = p_school_id AND s.status = 'Active';
        END IF;
    END IF;

    -- 5. If arrears are NOT rolled over, reset balances to only the new term fees
    IF NOT p_roll_over_arrears THEN
        UPDATE public.students s
        SET balance = COALESCE(
            (SELECT SUM(fs.amount) 
             FROM public.fee_structure fs
             WHERE fs.school_id = p_school_id
               AND fs.term = p_new_term
               AND fs.academic_year = p_new_year
               AND (fs.target_class IS NULL OR fs.target_class = s.class)
               AND fs.is_mandatory = true),
            0
        )
        WHERE s.school_id = p_school_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'previous_session', jsonb_build_object('term', v_old_term, 'year', v_old_year),
        'active_session', jsonb_build_object('term', p_new_term, 'year', p_new_year),
        'fees_copied', v_fee_count
    );
END;
$$;

-- ==============================================================================
-- 20. RPC: ACTIVATE / RENEW SCHOOL SUBSCRIPTION (Monthly, Termly 4-Month, Annual)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.activate_school_subscription(
    p_school_id UUID,
    p_plan_code TEXT,
    p_billing_cycle TEXT, -- 'Monthly', 'Termly', 'Annual'
    p_payment_reference TEXT DEFAULT NULL,
    p_payment_method TEXT DEFAULT 'Mobile Money'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_plan RECORD;
    v_student_count INTEGER := 0;
    v_total_amount NUMERIC := 0.00;
    v_duration_months INTEGER;
    v_start_date DATE := CURRENT_DATE;
    v_end_date DATE;
    v_inv_no TEXT;
BEGIN
    -- 1. Fetch Plan
    SELECT * INTO v_plan FROM public.subscription_plans WHERE code = p_plan_code;
    IF v_plan IS NULL THEN
        RAISE EXCEPTION 'Subscription plan code % not found', p_plan_code;
    END IF;

    -- 2. Determine duration based on cycle
    IF p_billing_cycle = 'Monthly' THEN
        v_duration_months := 1;
    ELSIF p_billing_cycle = 'Termly' THEN
        v_duration_months := 4; -- 1 Semester / Term in Ghana is 4 months
    ELSIF p_billing_cycle = 'Annual' THEN
        v_duration_months := 12;
    ELSE
        RAISE EXCEPTION 'Invalid billing cycle: %', p_billing_cycle;
    END IF;

    v_end_date := v_start_date + (v_duration_months || ' months')::INTERVAL;

    -- 3. Calculate Bill
    SELECT COUNT(*) INTO v_student_count 
    FROM public.students 
    WHERE school_id = p_school_id AND status = 'Active';

    IF v_plan.flat_price > 0 THEN
        v_total_amount := v_plan.flat_price;
    ELSE
        v_total_amount := v_student_count * COALESCE(v_plan.price_per_student, 4.00);
    END IF;

    -- 4. Upsert School Subscription
    INSERT INTO public.school_subscriptions (
        school_id, plan_code, billing_cycle, status, 
        student_count_billed, amount_billed, auto_renew,
        current_period_start, current_period_end, payment_method, payment_reference, updated_at
    )
    VALUES (
        p_school_id, p_plan_code, p_billing_cycle, 'active',
        v_student_count, v_total_amount, false,
        v_start_date, v_end_date, p_payment_method, p_payment_reference, now()
    )
    ON CONFLICT (school_id)
    DO UPDATE SET
        plan_code = EXCLUDED.plan_code,
        billing_cycle = EXCLUDED.billing_cycle,
        status = 'active',
        student_count_billed = EXCLUDED.student_count_billed,
        amount_billed = EXCLUDED.amount_billed,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        payment_method = EXCLUDED.payment_method,
        payment_reference = EXCLUDED.payment_reference,
        updated_at = now();

    -- 5. Update Schools table master payment due date
    UPDATE public.schools
    SET next_payment_due = v_end_date,
        last_payment_date = v_start_date,
        subscription_plan = v_plan.name,
        status = 'active'
    WHERE id = p_school_id;

    -- 6. Issue SaaS Invoice Record
    v_inv_no := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || substr(p_school_id::text, 1, 4);

    INSERT INTO public.school_billing_invoices (
        school_id, invoice_number, description, billing_cycle,
        student_count, amount, status, payment_method, payment_ref,
        paid_at, period_start, period_end
    )
    VALUES (
        p_school_id, v_inv_no, 
        v_plan.name || ' (' || p_billing_cycle || ')',
        p_billing_cycle, v_student_count, v_total_amount, 'Paid',
        p_payment_method, p_payment_reference, now(), v_start_date, v_end_date
    );

    RETURN jsonb_build_object(
        'success', true,
        'plan', v_plan.name,
        'billing_cycle', p_billing_cycle,
        'period_end', v_end_date,
        'student_count', v_student_count,
        'amount_billed', v_total_amount,
        'invoice_number', v_inv_no
    );
END;
$$;

-- ==============================================================================
-- 21. SUPER ADMIN OPERATIONS & DASHBOARD RPCS
-- ==============================================================================

-- A. Fetch High-Level Metrics Across All Schools for Super Admin Dashboard
CREATE OR REPLACE FUNCTION public.get_admin_school_stats()
RETURNS TABLE (
    id UUID,
    name TEXT,
    status TEXT,
    created_at TIMESTAMPTZ,
    next_payment_due TIMESTAMPTZ,
    last_payment_date TIMESTAMPTZ,
    admin_name TEXT,
    admin_email TEXT,
    school_email TEXT,
    school_phone TEXT,
    student_count BIGINT,
    teacher_count BIGINT,
    sms_balance INTEGER,
    wallet_balance NUMERIC,
    active_modules_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verify Super Admin Access
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (role = 'super_admin' OR email ILIKE 'silas%')
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only Super Admin can access platform metrics.';
    END IF;

    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.status,
        s.created_at,
        s.next_payment_due::TIMESTAMPTZ,
        s.last_payment_date::TIMESTAMPTZ,
        (SELECT p.full_name FROM public.profiles p WHERE p.school_id = s.id AND p.role = 'admin' LIMIT 1) as admin_name,
        (SELECT p.email FROM public.profiles p WHERE p.school_id = s.id AND p.role = 'admin' LIMIT 1) as admin_email,
        s.email as school_email,
        s.phone as school_phone,
        (SELECT count(*) FROM public.students st WHERE st.school_id = s.id) as student_count,
        (SELECT count(*) FROM public.profiles pr WHERE pr.school_id = s.id AND pr.role = 'teacher') as teacher_count,
        COALESCE(s.sms_balance, 0) as sms_balance,
        0.00::NUMERIC as wallet_balance,
        (SELECT count(*) FROM public.school_subscriptions ss WHERE ss.school_id = s.id AND ss.status = 'active') as active_modules_count
    FROM public.schools s
    ORDER BY s.created_at DESC;
END;
$$;

-- B. Update School Profile & Admin Contact from Super Admin
CREATE OR REPLACE FUNCTION public.super_admin_update_school_profile(
    p_school_id UUID,
    p_school_name TEXT,
    p_school_email TEXT,
    p_school_phone TEXT,
    p_admin_name TEXT,
    p_admin_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (role = 'super_admin' OR email ILIKE 'silas%')
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only Super Admin can edit school profiles.';
    END IF;

    -- Update school
    UPDATE public.schools
    SET name = trim(p_school_name),
        email = trim(p_school_email),
        phone = trim(p_school_phone)
    WHERE id = p_school_id;

    -- Update admin profile
    UPDATE public.profiles
    SET full_name = trim(p_admin_name),
        phone_number = trim(p_admin_phone)
    WHERE school_id = p_school_id AND role = 'admin';

    RETURN jsonb_build_object('success', true);
END;
$$;

-- C. Reset School Admin Password from Super Admin
CREATE OR REPLACE FUNCTION public.reset_school_admin_password(
    target_school_id UUID,
    new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_id UUID;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (role = 'super_admin' OR email ILIKE 'silas%')
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only Super Admin can reset school passwords.';
    END IF;

    SELECT id INTO v_admin_id 
    FROM public.profiles 
    WHERE school_id = target_school_id AND role = 'admin' 
    LIMIT 1;

    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Admin user for target school not found.';
    END IF;

    UPDATE auth.users
    SET encrypted_password = crypt(new_password, gen_salt('bf')),
        updated_at = now()
    WHERE id = v_admin_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- D. Delete School Permanently (Atomic Cascade Deletion of all school data + auth users)
CREATE OR REPLACE FUNCTION public.delete_school_permanently(target_school_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_auth_ids UUID[];
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (role = 'super_admin' OR email ILIKE 'silas%')
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only Super Admin can delete schools.';
    END IF;

    -- 1. Collect all auth user IDs associated with this school (Admins + Teachers)
    SELECT ARRAY_AGG(id) INTO v_auth_ids
    FROM public.profiles
    WHERE school_id = target_school_id;

    -- 2. Delete the School row (Foreign keys with ON DELETE CASCADE will delete
    -- students, classes, subjects, teacher_assignments, exam_results, report cards, invoices, transactions)
    DELETE FROM public.schools WHERE id = target_school_id;

    -- 3. Delete auth.identities & auth.users accounts for the deleted school
    IF v_auth_ids IS NOT NULL AND array_length(v_auth_ids, 1) > 0 THEN
        DELETE FROM auth.identities WHERE user_id = ANY(v_auth_ids);
        DELETE FROM auth.users WHERE id = ANY(v_auth_ids);
    END IF;

    RETURN jsonb_build_object('success', true, 'deleted_school_id', target_school_id);
END;
$$;

-- ==============================================================================
-- 22. SMS TOP-UP PURCHASES, WALLET & DEDUCTION LEDGER
-- ==============================================================================
-- Top-up transactions when a school buys SMS bundles (e.g. 500, 1000, 5000 credits)
CREATE TABLE IF NOT EXISTS public.sms_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    amount_paid NUMERIC(10,2) NOT NULL,
    rate_per_sms NUMERIC(6,4) DEFAULT 0.035,
    payment_reference TEXT NOT NULL UNIQUE,
    payment_method TEXT DEFAULT 'Mobile Money',
    status TEXT NOT NULL DEFAULT 'Completed' CHECK (status IN ('Pending', 'Completed', 'Failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_sms_purchases_school ON public.sms_purchases(school_id);

-- Atomic Top-up Function
CREATE OR REPLACE FUNCTION public.top_up_school_sms(
    p_school_id UUID,
    p_quantity INTEGER,
    p_amount NUMERIC,
    p_payment_ref TEXT,
    p_payment_method TEXT DEFAULT 'Mobile Money'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_balance INTEGER;
BEGIN
    -- Record purchase
    INSERT INTO public.sms_purchases (
        school_id, quantity, amount_paid, payment_reference, payment_method, status
    )
    VALUES (
        p_school_id, p_quantity, p_amount, p_payment_ref, p_payment_method, 'Completed'
    )
    ON CONFLICT (payment_reference) DO NOTHING;

    -- Add to school balance
    UPDATE public.schools
    SET sms_balance = sms_balance + p_quantity
    WHERE id = p_school_id
    RETURNING sms_balance INTO v_new_balance;

    RETURN jsonb_build_object('success', true, 'new_sms_balance', v_new_balance);
END;
$$;

-- Atomic SMS Deduction Function
CREATE OR REPLACE FUNCTION public.deduct_sms_credits(
    p_school_id UUID,
    p_count INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance INTEGER;
BEGIN
    SELECT sms_balance INTO v_current_balance
    FROM public.schools
    WHERE id = p_school_id;

    IF v_current_balance < p_count THEN
        RAISE EXCEPTION 'Insufficient SMS balance. Current: %, Required: %', v_current_balance, p_count;
    END IF;

    UPDATE public.schools
    SET sms_balance = sms_balance - p_count
    WHERE id = p_school_id
    RETURNING sms_balance INTO v_current_balance;

    RETURN jsonb_build_object('success', true, 'remaining_balance', v_current_balance);
END;
$$;

-- ==============================================================================
-- 22B. SCHOOL PREPAID BASE WALLET & UNIFIED BILLING LEDGER
-- ==============================================================================
-- Add wallet_balance to schools if not already present
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00;

CREATE TABLE IF NOT EXISTS public.school_wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('deposit', 'subscription', 'sms', 'adjustment')),
    amount NUMERIC(12,2) NOT NULL,
    balance_after NUMERIC(12,2) NOT NULL,
    payment_method TEXT DEFAULT 'Mobile Money',
    payment_reference TEXT,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_school ON public.school_wallet_transactions(school_id, created_at DESC);

-- RPC: Top up school virtual wallet
CREATE OR REPLACE FUNCTION public.top_up_school_wallet(
    p_school_id UUID,
    p_amount NUMERIC,
    p_payment_ref TEXT,
    p_payment_method TEXT DEFAULT 'Mobile Money'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_balance NUMERIC;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Top up amount must be greater than zero';
    END IF;

    -- 1. Increment school wallet_balance
    UPDATE public.schools
    SET wallet_balance = COALESCE(wallet_balance, 0.00) + p_amount,
        updated_at = timezone('utc', now())
    WHERE id = p_school_id
    RETURNING wallet_balance INTO v_new_balance;

    -- 2. Record wallet transaction
    INSERT INTO public.school_wallet_transactions (
        school_id, type, amount, balance_after, payment_method, payment_reference, description
    ) VALUES (
        p_school_id, 'deposit', p_amount, v_new_balance, p_payment_method, p_payment_ref,
        'Wallet deposit of GH¢ ' || p_amount::TEXT || ' via ' || p_payment_method
    );

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_new_balance,
        'amount_added', p_amount,
        'reference', p_payment_ref
    );
END;
$$;

-- RPC: Unified payment from school virtual wallet (for Subscriptions or SMS)
CREATE OR REPLACE FUNCTION public.pay_from_school_wallet(
    p_school_id UUID,
    p_amount NUMERIC,
    p_purpose TEXT, -- 'subscription' or 'sms'
    p_description TEXT,
    p_plan_code TEXT DEFAULT NULL,
    p_sms_quantity INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance NUMERIC;
    v_new_balance NUMERIC;
    v_new_sms_bal INTEGER := 0;
    v_inv_num TEXT := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM()*10000)::TEXT, 4, '0');
    v_end_date DATE := (CURRENT_DATE + INTERVAL '4 months');
BEGIN
    SELECT COALESCE(wallet_balance, 0.00) INTO v_current_balance
    FROM public.schools
    WHERE id = p_school_id;

    IF v_current_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient wallet balance. Current: GH¢ %, Required: GH¢ %', v_current_balance, p_amount;
    END IF;

    -- 1. Deduct wallet balance
    UPDATE public.schools
    SET wallet_balance = wallet_balance - p_amount,
        updated_at = timezone('utc', now())
    WHERE id = p_school_id
    RETURNING wallet_balance INTO v_new_balance;

    -- 2. Record debit transaction
    INSERT INTO public.school_wallet_transactions (
        school_id, type, amount, balance_after, payment_method, payment_reference, description
    ) VALUES (
        p_school_id, p_purpose, p_amount, v_new_balance, 'Orbit Wallet', v_inv_num, p_description
    );

    -- 3. Execute purpose-specific actions
    IF p_purpose = 'subscription' THEN
        -- Activate school subscription
        INSERT INTO public.school_subscriptions (
            school_id, plan_code, billing_cycle, status, amount_billed, auto_renew,
            current_period_start, current_period_end, payment_method, payment_reference, updated_at
        ) VALUES (
            p_school_id, p_plan_code, 'Termly', 'active', p_amount, true,
            CURRENT_DATE, v_end_date, 'Orbit Wallet', v_inv_num, timezone('utc', now())
        )
        ON CONFLICT (school_id) DO UPDATE SET
            plan_code = EXCLUDED.plan_code,
            billing_cycle = 'Termly',
            status = 'active',
            amount_billed = EXCLUDED.amount_billed,
            current_period_start = CURRENT_DATE,
            current_period_end = v_end_date,
            payment_method = 'Orbit Wallet',
            payment_reference = v_inv_num,
            updated_at = timezone('utc', now());

        UPDATE public.schools
        SET subscription_plan = p_plan_code,
            next_payment_due = v_end_date,
            status = 'active'
        WHERE id = p_school_id;

        INSERT INTO public.school_billing_invoices (
            school_id, invoice_number, description, billing_cycle,
            amount, status, payment_method, payment_ref, paid_at,
            period_start, period_end
        ) VALUES (
            p_school_id, v_inv_num, p_description, 'Termly',
            p_amount, 'Paid', 'Orbit Wallet', v_inv_num, timezone('utc', now()),
            CURRENT_DATE, v_end_date
        );

    ELSIF p_purpose = 'sms' THEN
        -- Top up SMS credits
        INSERT INTO public.sms_purchases (
            school_id, quantity, amount_paid, payment_reference, payment_method, status
        ) VALUES (
            p_school_id, p_sms_quantity, p_amount, v_inv_num, 'Orbit Wallet', 'Completed'
        );

        UPDATE public.schools
        SET sms_balance = sms_balance + p_sms_quantity
        WHERE id = p_school_id
        RETURNING sms_balance INTO v_new_sms_bal;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'new_wallet_balance', v_new_balance,
        'new_sms_balance', v_new_sms_bal,
        'invoice_number', v_inv_num,
        'purpose', p_purpose
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.top_up_school_wallet(UUID, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_from_school_wallet(UUID, NUMERIC, TEXT, TEXT, TEXT, INTEGER) TO authenticated;



-- ==============================================================================
-- 23. IN-APP PUSH NOTIFICATIONS & ANNOUNCEMENTS (Parents, Teachers, Admins)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.app_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General' CHECK (category IN ('General', 'Fees', 'Academics', 'Attendance', 'Urgent', 'Holiday')),
    target_audience TEXT NOT NULL CHECK (target_audience IN ('All', 'Parents Only', 'Teachers Only', 'Specific Class')),
    target_class TEXT, -- if target_audience is 'Specific Class'
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_school_aud ON public.app_notifications(school_id, target_audience);

-- ==============================================================================
-- 23B. SUPPORT & FEATURE REQUEST TICKETS (Help Center & Super Admin)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
    type TEXT NOT NULL DEFAULT 'Feature Request',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Support tickets accessible by school admins and super admin" ON public.support_tickets
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (role = 'super_admin' OR school_id = support_tickets.school_id)
    )
);

-- ==============================================================================
-- 24. AI OPERATIONAL INTELLIGENCE ENGINE ("Ask Your School Anything")
-- ==============================================================================
-- This clean RPC gathers real-time structured data so an AI agent or LLM prompt 
-- can answer executive queries instantly without hallucination.
CREATE OR REPLACE FUNCTION public.get_school_ai_context(p_school_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_school RECORD;
    v_active_students INTEGER;
    v_total_debtors INTEGER;
    v_total_debt_amount NUMERIC;
    v_top_debtor_classes JSONB;
    v_unsubmitted_marks JSONB;
    v_attendance_summary JSONB;
BEGIN
    -- 1. School Info
    SELECT name, current_term, academic_year, sms_balance INTO v_school
    FROM public.schools WHERE id = p_school_id;

    -- 2. Total active students
    SELECT COUNT(*) INTO v_active_students
    FROM public.students WHERE school_id = p_school_id AND status = 'Active';

    -- 3. Debt overview
    SELECT COUNT(*), COALESCE(SUM(balance), 0)
    INTO v_total_debtors, v_total_debt_amount
    FROM public.students 
    WHERE school_id = p_school_id AND balance > 0 AND status = 'Active';

    -- 4. Classes with highest unpaid fees
    SELECT COALESCE(jsonb_agg(jsonb_build_object('class', class, 'unpaid_amount', total_debt, 'debtor_count', cnt)), '[]'::jsonb)
    INTO v_top_debtor_classes
    FROM (
        SELECT class, SUM(balance) as total_debt, COUNT(*) as cnt
        FROM public.students
        WHERE school_id = p_school_id AND balance > 0 AND status = 'Active'
        GROUP BY class
        ORDER BY total_debt DESC
        LIMIT 5
    ) d;

    -- 5. Mark submission status (Unsubmitted or pending subject marks)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'class', ta.classes_name, 
        'subject', ta.subject_name,
        'teacher', ta.teacher_name,
        'status', COALESCE(es.status, 'Not Started')
    )), '[]'::jsonb)
    INTO v_unsubmitted_marks
    FROM (
        SELECT 
            c.name as classes_name, 
            s.name as subject_name,
            p.full_name as teacher_name,
            ta.class_id,
            ta.subject_id
        FROM public.teacher_assignments ta
        JOIN public.classes c ON c.id = ta.class_id
        JOIN public.subjects s ON s.id = ta.subject_id
        JOIN public.profiles p ON p.id = ta.teacher_id
        WHERE ta.school_id = p_school_id AND ta.is_class_teacher = false
    ) ta
    LEFT JOIN public.exam_submissions es ON 
        es.school_id = p_school_id 
        AND es.class = ta.classes_name 
        AND es.subject = ta.subject_name
        AND es.term = v_school.current_term
        AND es.academic_year = v_school.academic_year
    WHERE es.status IS NULL OR es.status = 'Pending'
    LIMIT 10;

    -- 6. Today's attendance summary
    SELECT jsonb_build_object(
        'present', COUNT(*) FILTER (WHERE status = 'Present'),
        'absent', COUNT(*) FILTER (WHERE status = 'Absent'),
        'late', COUNT(*) FILTER (WHERE status = 'Late')
    )
    INTO v_attendance_summary
    FROM public.attendance
    WHERE school_id = p_school_id AND date = CURRENT_DATE;

    -- 7. Struggling Students / Academic Performance Alert
    -- Detect students with average score < 50% across their subjects
    DECLARE
        v_struggling_students JSONB;
        v_top_students JSONB;
    BEGIN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'student_name', sub.name,
            'class', sub.class,
            'average_score', ROUND(sub.avg_score, 1),
            'subject_count', sub.subject_cnt
        )), '[]'::jsonb)
        INTO v_struggling_students
        FROM (
            SELECT 
                s.name, 
                s.class, 
                AVG(er.total) as avg_score,
                COUNT(er.id) as subject_cnt
            FROM public.students s
            JOIN public.exam_results er ON er.student_id = s.id
            WHERE s.school_id = p_school_id
              AND s.status = 'Active'
              AND er.term = v_school.current_term
              AND er.academic_year = v_school.academic_year
            GROUP BY s.id, s.name, s.class
            HAVING AVG(er.total) < 50.0
            ORDER BY avg_score ASC
            LIMIT 10
        ) sub;

        -- Top Performing Students
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'student_name', top_sub.name,
            'class', top_sub.class,
            'average_score', ROUND(top_sub.avg_score, 1)
        )), '[]'::jsonb)
        INTO v_top_students
        FROM (
            SELECT 
                s.name, 
                s.class, 
                AVG(er.total) as avg_score
            FROM public.students s
            JOIN public.exam_results er ON er.student_id = s.id
            WHERE s.school_id = p_school_id
              AND s.status = 'Active'
              AND er.term = v_school.current_term
              AND er.academic_year = v_school.academic_year
            GROUP BY s.id, s.name, s.class
            HAVING COUNT(er.id) >= 3
            ORDER BY avg_score DESC
            LIMIT 5
        ) top_sub;

        RETURN jsonb_build_object(
            'school_name', v_school.name,
            'current_term', v_school.current_term,
            'academic_year', v_school.academic_year,
            'sms_balance', v_school.sms_balance,
            'active_students', v_active_students,
            'financials', jsonb_build_object(
                'total_debtors', v_total_debtors,
                'total_outstanding_fees', v_total_debt_amount,
                'classes_owing_most', v_top_debtor_classes
            ),
            'academics', jsonb_build_object(
                'pending_mark_submissions', v_unsubmitted_marks,
                'struggling_students', v_struggling_students,
                'top_performing_students', v_top_students
            ),
            'attendance_today', v_attendance_summary
        );
    END;
END;
$$;

-- Dedicated Query RPC for Deep Academic Performance Questions
-- e.g. "Which students in JHS 1 scored below 40 in Science?", "Who are the weakest students?"
CREATE OR REPLACE FUNCTION public.get_academic_performance_intelligence(
    p_school_id UUID,
    p_class TEXT DEFAULT NULL,
    p_subject TEXT DEFAULT NULL,
    p_threshold_score NUMERIC DEFAULT 50.0,
    p_mode TEXT DEFAULT 'struggling' -- 'struggling' (< threshold) or 'top' (>= threshold)
)
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    class_name TEXT,
    subject_name TEXT,
    class_score NUMERIC,
    exam_score NUMERIC,
    total_score NUMERIC,
    parent_phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_term TEXT;
    v_year TEXT;
BEGIN
    SELECT current_term, academic_year INTO v_term, v_year
    FROM public.schools WHERE id = p_school_id;

    IF p_mode = 'struggling' THEN
        RETURN QUERY
        SELECT 
            s.id,
            s.name,
            s.class,
            er.subject,
            er.class_score,
            er.exam_score,
            er.total,
            s.parent_phone
        FROM public.students s
        JOIN public.exam_results er ON er.student_id = s.id
        WHERE s.school_id = p_school_id
          AND s.status = 'Active'
          AND er.term = v_term
          AND er.academic_year = v_year
          AND (p_class IS NULL OR s.class ILIKE trim(p_class))
          AND (p_subject IS NULL OR er.subject ILIKE trim(p_subject))
          AND er.total < p_threshold_score
        ORDER BY er.total ASC
        LIMIT 50;
    ELSE
        RETURN QUERY
        SELECT 
            s.id,
            s.name,
            s.class,
            er.subject,
            er.class_score,
            er.exam_score,
            er.total,
            s.parent_phone
        FROM public.students s
        JOIN public.exam_results er ON er.student_id = s.id
        WHERE s.school_id = p_school_id
          AND s.status = 'Active'
          AND er.term = v_term
          AND er.academic_year = v_year
          AND (p_class IS NULL OR s.class ILIKE trim(p_class))
          AND (p_subject IS NULL OR er.subject ILIKE trim(p_subject))
          AND er.total >= p_threshold_score
        ORDER BY er.total DESC
        LIMIT 50;
    END IF;
END;
$$;

-- ==============================================================================
-- 25. PERMISSIONS & GRANTS
-- ==============================================================================
GRANT EXECUTE ON FUNCTION public.admin_create_teacher TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_teacher TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_teacher_password TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_teacher_assignments TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_student_report TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_student_reports_bulk TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_fee_payment TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_switch_academic_term TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_school_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_school_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_update_school_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_school_admin_password TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_school_permanently TO authenticated;
GRANT EXECUTE ON FUNCTION public.top_up_school_sms TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_sms_credits TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_school_ai_context TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_academic_performance_intelligence TO authenticated;

-- Public / Anonymous parent access for app & portal lookup
GRANT EXECUTE ON FUNCTION public.save_student_report TO anon;
GRANT EXECUTE ON FUNCTION public.save_student_reports_bulk TO anon;
GRANT EXECUTE ON FUNCTION public.get_parent_portal_student_data TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_fee_payment TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_teacher_user TO authenticated;

-- ==============================================================================
-- 26. SEED INITIAL SUPER ADMIN ACCOUNT (Silas / Base16)
-- ==============================================================================
-- Automatically provisions the Super Admin account with full GoTrue auth identity.
-- Credentials:
--   Identifier: silas  OR  0240000000  OR  silas@base16.com
--   Password:   silas@222
-- ==============================================================================
DO $$
DECLARE
    v_user_id UUID := gen_random_uuid();
    v_target_email TEXT := 'silas@base16.com';
    v_target_password TEXT := 'silas@222';
    v_target_phone TEXT := '0240000000';
BEGIN
    -- 1. Remove previous auth & profile records for silas
    DELETE FROM public.profiles WHERE lower(email) = v_target_email;
    DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE lower(email) = v_target_email);
    DELETE FROM auth.users WHERE lower(email) = v_target_email;

    -- 2. Insert into auth.users (Pre-confirmed email & phone)
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        phone,
        encrypted_password,
        email_confirmed_at,
        phone_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_user_id,
        'authenticated',
        'authenticated',
        v_target_email,
        v_target_phone,
        crypt(v_target_password, gen_salt('bf')),
        now(),
        now(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        jsonb_build_object('full_name', 'Silas (Super Admin)', 'role', 'super_admin'),
        now(),
        now(),
        '',
        '',
        '',
        ''
    );

    -- 3. Insert into auth.identities (GoTrue requirement)
    INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_target_email, 'email_verified', true),
        'email',
        v_target_email,
        now(),
        now(),
        now()
    )
    ON CONFLICT (provider, provider_id) DO NOTHING;

    -- 4. Insert public profile
    INSERT INTO public.profiles (
        id,
        school_id,
        role,
        full_name,
        email,
        phone_number,
        status
    ) VALUES (
        v_user_id,
        NULL,
        'super_admin',
        'Silas (Super Admin)',
        v_target_email,
        v_target_phone,
        'Active'
    )
    ON CONFLICT (id) DO UPDATE SET
        role = 'super_admin',
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        phone_number = EXCLUDED.phone_number,
        status = 'Active';

    RAISE NOTICE 'Super Admin Silas initialized! Identifier: % or %, Password: %', v_target_email, v_target_phone, v_target_password;
END;
$$;

-- ==============================================================================
-- 28. BACKWARD COMPATIBILITY VIEWS (Supports external integrations and legacy queries)
-- ==============================================================================
CREATE OR REPLACE VIEW public.notices AS
SELECT 
    id,
    school_id,
    sender_id AS author_id,
    title,
    message,
    category AS priority,
    target_audience AS audience,
    target_class,
    created_at AS date,
    created_at
FROM public.app_notifications;

CREATE OR REPLACE VIEW public.teachers AS
SELECT 
    p.id,
    p.school_id,
    p.full_name AS name,
    p.email,
    p.phone_number AS phone,
    p.salary,
    p.status,
    p.created_at,
    (
        SELECT c.name 
        FROM public.teacher_assignments ta
        JOIN public.classes c ON c.id = ta.class_id
        WHERE ta.teacher_id = p.id AND ta.is_class_teacher = true
        LIMIT 1
    ) AS assigned_class,
    (
        SELECT s.name 
        FROM public.teacher_assignments ta
        JOIN public.subjects s ON s.id = ta.subject_id
        WHERE ta.teacher_id = p.id AND ta.subject_id IS NOT NULL
        LIMIT 1
    ) AS subject
FROM public.profiles p
WHERE p.role = 'teacher';

CREATE OR REPLACE VIEW public.subject_assignments AS
SELECT 
    id,
    school_id,
    subject_id,
    class_id,
    created_at
FROM public.teacher_assignments
WHERE subject_id IS NOT NULL;
-- ==============================================================================
-- 22B. SCHOOL PREPAID BASE WALLET & UNIFIED BILLING LEDGER
-- ==============================================================================
-- Allows schools to top up a single virtual wallet (via MoMo / Card / Bank)
-- and seamlessly spend that balance across:
-- 1. Software Term Subscriptions (Full Suite or Modular licenses)
-- 2. SMS Credit purchases
-- 3. Any upcoming add-ons or hardware
-- ==============================================================================

-- 1. Ensure wallet_balance column exists on schools
ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00;

-- 2. Create school_wallet_transactions table (Ledger)
CREATE TABLE IF NOT EXISTS public.school_wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL, -- Positive for deposits, negative for payments/deductions
    balance_after NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    type TEXT NOT NULL CHECK (type IN ('deposit', 'subscription', 'sms', 'adjustment', 'refund')),
    purpose TEXT,
    payment_method TEXT,
    payment_reference TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for school_wallet_transactions
ALTER TABLE public.school_wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Schools can view their own wallet transactions" ON public.school_wallet_transactions;
CREATE POLICY "Schools can view their own wallet transactions" 
ON public.school_wallet_transactions 
FOR SELECT 
USING (
    school_id IN (
        SELECT school_id FROM public.profiles WHERE id = auth.uid()
    )
);

-- 3. RPC: Top Up School Wallet (Deposit)
CREATE OR REPLACE FUNCTION public.top_up_school_wallet(
    p_school_id UUID,
    p_amount NUMERIC,
    p_payment_ref TEXT,
    p_payment_method TEXT DEFAULT 'Mobile Money'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_balance NUMERIC(12,2);
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Top-up amount must be strictly greater than 0';
    END IF;

    -- Update school balance atomically
    UPDATE public.schools
    SET wallet_balance = COALESCE(wallet_balance, 0.00) + p_amount
    WHERE id = p_school_id
    RETURNING wallet_balance INTO v_new_balance;

    -- Record transaction in ledger
    INSERT INTO public.school_wallet_transactions (
        school_id, amount, balance_after, type, purpose, payment_method, payment_reference, description
    ) VALUES (
        p_school_id, p_amount, v_new_balance, 'deposit', 'Wallet Deposit', p_payment_method, p_payment_ref, 
        'Wallet Top-Up of GH₵ ' || p_amount::TEXT || ' via ' || p_payment_method
    );

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_new_balance,
        'amount', p_amount,
        'reference', p_payment_ref
    );
END;
$$;

-- 4. RPC: Pay from School Wallet (Debit for Subscription or SMS)
CREATE OR REPLACE FUNCTION public.pay_from_school_wallet(
    p_school_id UUID,
    p_amount NUMERIC,
    p_purpose TEXT, -- 'subscription' or 'sms'
    p_description TEXT,
    p_plan_code TEXT DEFAULT NULL,
    p_sms_quantity INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance NUMERIC(12,2);
    v_new_balance NUMERIC(12,2);
    v_end_date DATE;
    v_inv_no TEXT;
    v_sms_current INTEGER;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than 0';
    END IF;

    -- Lock the school row to prevent double spending
    SELECT COALESCE(wallet_balance, 0.00), COALESCE(sms_balance, 0)
    INTO v_current_balance, v_sms_current
    FROM public.schools
    WHERE id = p_school_id
    FOR UPDATE;

    IF v_current_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient wallet balance. You have GH₵ %, but need GH₵ %', v_current_balance, p_amount;
    END IF;

    -- Deduct balance
    UPDATE public.schools
    SET wallet_balance = wallet_balance - p_amount
    WHERE id = p_school_id
    RETURNING wallet_balance INTO v_new_balance;

    -- Record ledger debit
    INSERT INTO public.school_wallet_transactions (
        school_id, amount, balance_after, type, purpose, payment_method, payment_reference, description
    ) VALUES (
        p_school_id, -p_amount, v_new_balance, p_purpose, p_purpose, 'Orbit Wallet', 'WALLET-DEBIT-' || floor(extract(epoch from now()))::text, p_description
    );

    -- Execute specific purpose action
    IF p_purpose = 'subscription' THEN
        v_end_date := CURRENT_DATE + INTERVAL '4 months';

        INSERT INTO public.school_subscriptions (
            school_id, plan_code, billing_cycle, status,
            student_count_billed, amount_billed, auto_renew,
            current_period_start, current_period_end, payment_method, payment_reference, updated_at
        ) VALUES (
            p_school_id, COALESCE(p_plan_code, 'full_suite'), 'Termly', 'active',
            0, p_amount, false,
            CURRENT_DATE, v_end_date, 'Orbit Wallet', 'WALLET-' || floor(extract(epoch from now()))::text, now()
        )
        ON CONFLICT (school_id)
        DO UPDATE SET
            plan_code = EXCLUDED.plan_code,
            billing_cycle = 'Termly',
            status = 'active',
            amount_billed = EXCLUDED.amount_billed,
            current_period_start = CURRENT_DATE,
            current_period_end = v_end_date,
            payment_method = 'Orbit Wallet',
            payment_reference = EXCLUDED.payment_reference,
            updated_at = now();

        UPDATE public.schools
        SET next_payment_due = v_end_date,
            last_payment_date = CURRENT_DATE,
            subscription_plan = COALESCE(p_plan_code, 'full_suite'),
            status = 'active'
        WHERE id = p_school_id;

        -- Invoice record
        v_inv_no := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || substr(p_school_id::text, 1, 4);
        INSERT INTO public.school_billing_invoices (
            school_id, invoice_number, description, billing_cycle,
            student_count, amount, status, payment_method, payment_ref,
            paid_at, period_start, period_end
        ) VALUES (
            p_school_id, v_inv_no, p_description, 'Termly',
            0, p_amount, 'Paid', 'Orbit Wallet', 'WALLET-' || floor(extract(epoch from now()))::text,
            now(), CURRENT_DATE, v_end_date
        );

    ELSIF p_purpose = 'sms' THEN
        UPDATE public.schools
        SET sms_balance = sms_balance + p_sms_quantity
        WHERE id = p_school_id;

        INSERT INTO public.sms_purchases (
            school_id, quantity, amount_paid, payment_reference, payment_method, status
        ) VALUES (
            p_school_id, p_sms_quantity, p_amount, 'WALLET-SMS-' || floor(extract(epoch from now()))::text, 'Orbit Wallet', 'Completed'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_new_balance,
        'amount_paid', p_amount,
        'purpose', p_purpose
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.top_up_school_wallet(UUID, NUMERIC, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pay_from_school_wallet(UUID, NUMERIC, TEXT, TEXT, TEXT, INTEGER) TO authenticated, service_role;

-- Ensure attendance and timetable_entries columns exist for existing databases
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS term TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS academic_year TEXT;
ALTER TABLE public.timetable_entries ADD COLUMN IF NOT EXISTS activity_name TEXT;
ALTER TABLE public.timetable_entries ADD COLUMN IF NOT EXISTS term TEXT;
ALTER TABLE public.timetable_entries ADD COLUMN IF NOT EXISTS academic_year TEXT;

-- 12. DEMO BOOKINGS TABLE (Landing Page Leads)
CREATE TABLE IF NOT EXISTS public.demo_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    school_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    role TEXT,
    email TEXT,
    message TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.demo_bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'demo_bookings' AND policyname = 'Allow public insert to demo_bookings'
    ) THEN
        CREATE POLICY "Allow public insert to demo_bookings"
        ON public.demo_bookings
        FOR INSERT
        TO anon, authenticated
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


