-- Create teachers table
create table if not exists public.teachers (
  id uuid default gen_random_uuid() primary key,
  school_id uuid references public.schools(id) on delete cascade not null,
  name text not null,
  email text not null,
  phone text not null,
  subject text not null,
  assigned_class text,
  status text default 'Active' check (status in ('Active', 'On Leave')),
  password text default 'password123',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.teachers enable row level security;

-- Create policies
create policy "Users can view teachers from their school"
  on public.teachers for select
  using (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
    )
  );

create policy "Admins can insert teachers for their school"
  on public.teachers for insert
  with check (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

create policy "Admins can update teachers from their school"
  on public.teachers for update
  using (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

create policy "Admins can delete teachers from their school"
  on public.teachers for delete
  using (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );
