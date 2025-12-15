-- Create Timetable Entries Table
create table if not exists public.timetable_entries (
  id uuid default gen_random_uuid() primary key,
  school_id uuid references public.schools(id) on delete cascade not null,
  class_id uuid references public.classes(id) on delete cascade not null,
  subject_id uuid references public.subjects(id) on delete cascade, 
  teacher_id uuid references public.profiles(id) on delete set null,
  day_of_week text not null check (day_of_week in ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  start_time time not null,
  end_time time not null,
  type text default 'Lesson' check (type in ('Lesson', 'Break', 'Assembly', 'Other')),
  room_number text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.timetable_entries enable row level security;

-- Policies
drop policy if exists "Users can view timetable entries from their school" on public.timetable_entries;
create policy "Users can view timetable entries from their school"
  on public.timetable_entries for select
  using (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
    )
  );

drop policy if exists "Admins can manage timetable entries" on public.timetable_entries;
create policy "Admins can manage timetable entries"
  on public.timetable_entries for all
  using (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

-- Indexes for performance
create index if not exists idx_timetable_school on public.timetable_entries(school_id);
create index if not exists idx_timetable_class on public.timetable_entries(class_id);
create index if not exists idx_timetable_teacher on public.timetable_entries(teacher_id);
