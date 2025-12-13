-- Create exam_results table
create table if not exists public.exam_results (
  id uuid default gen_random_uuid() primary key,
  school_id uuid references public.schools(id) on delete cascade not null,
  student_id uuid references public.students(id) on delete cascade not null,
  class text not null,
  subject text not null,
  class_score numeric default 0,
  exam_score numeric default 0,
  total numeric generated always as (class_score + exam_score) stored,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(student_id, class, subject)
);

-- Create exam_submissions table
create table if not exists public.exam_submissions (
  id uuid default gen_random_uuid() primary key,
  school_id uuid references public.schools(id) on delete cascade not null,
  class text not null,
  subject text not null,
  teacher_id uuid references public.profiles(id),
  status text default 'Pending' check (status in ('Pending', 'Submitted', 'Approved', 'Rejected')),
  submitted_at timestamp with time zone,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(school_id, class, subject)
);

-- Enable RLS
alter table public.exam_results enable row level security;
alter table public.exam_submissions enable row level security;

-- Policies for exam_results

-- 1. View results
create policy "Users can view exam results from their school"
  on public.exam_results for select
  using (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
    )
  );

-- 2. Insert/Update results (Teachers & Admins)
create policy "Users can insert exam results for their school"
  on public.exam_results for insert
  with check (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
    )
  );

create policy "Users can update exam results for their school"
  on public.exam_results for update
  using (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
    )
  );

-- Policies for exam_submissions

-- 1. View submissions
create policy "Users can view exam submissions from their school"
  on public.exam_submissions for select
  using (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
    )
  );

-- 2. Insert/Update submissions
create policy "Users can insert exam submissions for their school"
  on public.exam_submissions for insert
  with check (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
    )
  );

create policy "Users can update exam submissions for their school"
  on public.exam_submissions for update
  using (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
    )
  );
