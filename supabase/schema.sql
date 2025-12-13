-- Create students table
create table if not exists public.students (
  id uuid default gen_random_uuid() primary key,
  school_id uuid references public.schools(id) on delete cascade not null,
  name text not null,
  class text not null,
  gender text check (gender in ('Male', 'Female')) not null,
  parent_name text not null,
  parent_phone text not null,
  date_of_birth date,
  enrollment_date date default now(),
  status text default 'Active' check (status in ('Active', 'Suspended', 'Graduated')),
  balance numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.students enable row level security;

-- Create policies
create policy "Users can view students from their school"
  on public.students for select
  using (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
    )
  );

create policy "Admins can insert students for their school"
  on public.students for insert
  with check (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

create policy "Admins can update students from their school"
  on public.students for update
  using (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

create policy "Admins can delete students from their school"
  on public.students for delete
  using (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );
