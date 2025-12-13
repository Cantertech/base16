-- Create classes table
create table if not exists public.classes (
  id uuid default gen_random_uuid() primary key,
  school_id uuid references public.schools(id) on delete cascade not null,
  name text not null,
  section text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(school_id, name, section)
);

-- Create subjects table
create table if not exists public.subjects (
  id uuid default gen_random_uuid() primary key,
  school_id uuid references public.schools(id) on delete cascade not null,
  name text not null,
  code text not null,
  type text check (type in ('Core', 'Elective')) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(school_id, code)
);

-- Create subject_assignments table (Many-to-Many)
create table if not exists public.subject_assignments (
  id uuid default gen_random_uuid() primary key,
  school_id uuid references public.schools(id) on delete cascade not null,
  subject_id uuid references public.subjects(id) on delete cascade not null,
  class_id uuid references public.classes(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(subject_id, class_id)
);

-- Enable RLS
alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.subject_assignments enable row level security;

-- Policies for classes

create policy "Users can view classes from their school"
  on public.classes for select
  using (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
    )
  );

create policy "Admins can insert classes for their school"
  on public.classes for insert
  with check (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

create policy "Admins can update classes from their school"
  on public.classes for update
  using (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

create policy "Admins can delete classes from their school"
  on public.classes for delete
  using (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

-- Policies for subjects

create policy "Users can view subjects from their school"
  on public.subjects for select
  using (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
    )
  );

create policy "Admins can insert subjects for their school"
  on public.subjects for insert
  with check (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

create policy "Admins can update subjects from their school"
  on public.subjects for update
  using (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

create policy "Admins can delete subjects from their school"
  on public.subjects for delete
  using (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

-- Policies for subject_assignments

create policy "Users can view subject assignments from their school"
  on public.subject_assignments for select
  using (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
    )
  );

create policy "Admins can insert subject assignments for their school"
  on public.subject_assignments for insert
  with check (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

create policy "Admins can delete subject assignments from their school"
  on public.subject_assignments for delete
  using (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );
