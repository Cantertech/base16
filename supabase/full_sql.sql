-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid,
  student_id uuid,
  date date NOT NULL DEFAULT CURRENT_DATE,
  status text CHECK (status = ANY (ARRAY['Present'::text, 'Absent'::text, 'Late'::text])),
  class text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT attendance_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT attendance_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.billing_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid,
  date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Paid'::text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT billing_history_pkey PRIMARY KEY (id),
  CONSTRAINT billing_history_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.classes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  name text NOT NULL,
  section text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT classes_pkey PRIMARY KEY (id),
  CONSTRAINT classes_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.exam_config (
  school_id uuid NOT NULL,
  mark_entry_enabled boolean DEFAULT false,
  current_term text DEFAULT 'Term 1 2026'::text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT exam_config_pkey PRIMARY KEY (school_id),
  CONSTRAINT exam_config_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.exam_report_status (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  class_name text NOT NULL,
  term text NOT NULL DEFAULT 'Term 1 2026'::text,
  status text DEFAULT 'Draft'::text CHECK (status = ANY (ARRAY['Draft'::text, 'Approved'::text, 'Released'::text])),
  released_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT exam_report_status_pkey PRIMARY KEY (id),
  CONSTRAINT exam_report_status_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.exam_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  class text NOT NULL,
  subject text NOT NULL,
  class_score numeric DEFAULT 0,
  exam_score numeric DEFAULT 0,
  total numeric DEFAULT (class_score + exam_score),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  term text NOT NULL DEFAULT 'First Term'::text,
  academic_year text NOT NULL DEFAULT '2024/2025'::text,
  CONSTRAINT exam_results_pkey PRIMARY KEY (id),
  CONSTRAINT exam_results_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT exam_results_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.exam_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  class text NOT NULL,
  subject text NOT NULL,
  teacher_id uuid,
  status text DEFAULT 'Pending'::text CHECK (status = ANY (ARRAY['Pending'::text, 'Submitted'::text, 'Approved'::text, 'Rejected'::text])),
  submitted_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT exam_submissions_pkey PRIMARY KEY (id),
  CONSTRAINT exam_submissions_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id),
  CONSTRAINT exam_submissions_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.fee_structure (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid,
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  target_class text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fee_structure_pkey PRIMARY KEY (id),
  CONSTRAINT fee_structure_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.feeding_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  school_id uuid,
  student_id uuid,
  date date NOT NULL,
  status text DEFAULT 'PAID'::text,
  amount numeric DEFAULT 0.00,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT feeding_logs_pkey PRIMARY KEY (id),
  CONSTRAINT feeding_logs_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT feeding_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);
CREATE TABLE public.message_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  date date DEFAULT CURRENT_DATE,
  type text NOT NULL,
  recipient text NOT NULL,
  content text NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['Delivered'::text, 'Failed'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT message_logs_pkey PRIMARY KEY (id),
  CONSTRAINT message_logs_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.notices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  audience text NOT NULL CHECK (audience = ANY (ARRAY['All Staff'::text, 'Teaching Staff'::text, 'Admins Only'::text, 'Parents'::text])),
  priority text NOT NULL CHECK (priority = ANY (ARRAY['Normal'::text, 'Urgent'::text])),
  date date DEFAULT CURRENT_DATE,
  author_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notices_pkey PRIMARY KEY (id),
  CONSTRAINT notices_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id),
  CONSTRAINT notices_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  full_name text,
  role text CHECK (role = ANY (ARRAY['admin'::text, 'teacher'::text, 'super_admin'::text])),
  school_id uuid,
  email text,
  phone_number text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  referrer_name text NOT NULL,
  referee_school_name text NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['Pending'::text, 'Paid'::text, 'Completed'::text, 'Applied'::text])),
  reward_amount numeric DEFAULT 0,
  date date DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT referrals_pkey PRIMARY KEY (id),
  CONSTRAINT referrals_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.schools (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  name text NOT NULL,
  motto text,
  phone text,
  brand_color text,
  logo_url text,
  admin_id uuid NOT NULL,
  referral_code_used text,
  referral_code_owned text,
  status text DEFAULT 'pending'::text,
  theme_color text DEFAULT 'blue'::text,
  referral_code text,
  referral_preference text DEFAULT 'CASH'::text CHECK (referral_preference = ANY (ARRAY['CASH'::text, 'CREDIT'::text])),
  sms_balance integer DEFAULT 0,
  currency text DEFAULT 'GHS'::text,
  subscription_plan text DEFAULT 'Small School'::text,
  next_payment_due date DEFAULT (CURRENT_DATE + '30 days'::interval),
  last_payment_date date DEFAULT CURRENT_DATE,
  exam_config jsonb DEFAULT '{"grading": [{"max": 100, "min": 80, "grade": "A", "remark": "Excellent"}, {"max": 79, "min": 70, "grade": "B", "remark": "Very Good"}, {"max": 69, "min": 60, "grade": "C", "remark": "Good"}, {"max": 59, "min": 50, "grade": "D", "remark": "Credit"}, {"max": 49, "min": 40, "grade": "E", "remark": "Pass"}, {"max": 39, "min": 0, "grade": "F", "remark": "Fail"}], "weights": {"exam": 70, "class": 30}, "current_term": "First Term", "academic_year": "2024/2025"}'::jsonb,
  payment_config jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT schools_pkey PRIMARY KEY (id),
  CONSTRAINT schools_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES auth.users(id)
);
CREATE TABLE public.sms_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid,
  quantity integer NOT NULL,
  amount numeric NOT NULL,
  rate numeric DEFAULT 0.035,
  status text DEFAULT 'Pending'::text,
  payment_ref text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sms_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT sms_transactions_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.student_report_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  class text NOT NULL,
  term text NOT NULL,
  academic_year text NOT NULL,
  teacher_remark text,
  principal_remark text,
  promotion_status text,
  position_in_class integer,
  total_students integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT student_report_cards_pkey PRIMARY KEY (id),
  CONSTRAINT student_report_cards_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);
CREATE TABLE public.students (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  name text NOT NULL,
  class text NOT NULL,
  gender text NOT NULL CHECK (gender = ANY (ARRAY['Male'::text, 'Female'::text])),
  parent_name text NOT NULL,
  parent_phone text NOT NULL,
  date_of_birth date,
  enrollment_date date DEFAULT now(),
  status text DEFAULT 'Active'::text CHECK (status = ANY (ARRAY['Active'::text, 'Suspended'::text, 'Graduated'::text])),
  balance numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  feeding_credit numeric DEFAULT 0.00,
  admission_no text,
  pin text,
  photo_url text,
  CONSTRAINT students_pkey PRIMARY KEY (id),
  CONSTRAINT students_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.subject_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  class_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT subject_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT subject_assignments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT subject_assignments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT subject_assignments_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.subjects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  name text NOT NULL,
  code text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['Core'::text, 'Elective'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT subjects_pkey PRIMARY KEY (id),
  CONSTRAINT subjects_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.support_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  user_id uuid,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'Open'::text CHECK (status = ANY (ARRAY['Open'::text, 'In Progress'::text, 'Resolved'::text, 'Closed'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT support_tickets_pkey PRIMARY KEY (id),
  CONSTRAINT support_tickets_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.teacher_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  teacher_id uuid,
  school_id uuid,
  class_id uuid,
  subject_id uuid,
  is_class_teacher boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT teacher_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT teacher_assignments_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id),
  CONSTRAINT teacher_assignments_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT teacher_assignments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT teacher_assignments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);
CREATE TABLE public.teachers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  subject text NOT NULL,
  assigned_class text,
  status text DEFAULT 'Active'::text CHECK (status = ANY (ARRAY['Active'::text, 'On Leave'::text])),
  password text DEFAULT 'password123'::text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  salary numeric DEFAULT 0,
  CONSTRAINT teachers_pkey PRIMARY KEY (id),
  CONSTRAINT teachers_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.timetable_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  class_id uuid NOT NULL,
  subject_id uuid,
  teacher_id uuid,
  day_of_week text NOT NULL CHECK (day_of_week = ANY (ARRAY['Monday'::text, 'Tuesday'::text, 'Wednesday'::text, 'Thursday'::text, 'Friday'::text, 'Saturday'::text, 'Sunday'::text])),
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  type text DEFAULT 'Lesson'::text CHECK (type = ANY (ARRAY['Lesson'::text, 'Break'::text, 'Assembly'::text, 'Other'::text])),
  room_number text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  activity_name text,
  CONSTRAINT timetable_entries_pkey PRIMARY KEY (id),
  CONSTRAINT timetable_entries_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT timetable_entries_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT timetable_entries_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT timetable_entries_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  amount numeric NOT NULL,
  type text NOT NULL,
  method text,
  reference text,
  date date DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  status text DEFAULT 'Completed'::text CHECK (status = ANY (ARRAY['Completed'::text, 'Pending'::text, 'Failed'::text, 'Cancelled'::text])),
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT transactions_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);