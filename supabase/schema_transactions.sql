-- Create transactions table
create table if not exists public.transactions (
  id uuid default gen_random_uuid() primary key,
  school_id uuid references public.schools(id) on delete cascade not null,
  student_id uuid references public.students(id) on delete cascade not null,
  amount numeric not null,
  type text not null,
  method text,
  reference text,
  date date default now(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.transactions enable row level security;

-- Create policies
create policy "Users can view transactions from their school"
  on public.transactions for select
  using (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
    )
  );

create policy "Admins can insert transactions for their school"
  on public.transactions for insert
  with check (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

create policy "Admins can update transactions from their school"
  on public.transactions for update
  using (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

create policy "Admins can delete transactions from their school"
  on public.transactions for delete
  using (
    school_id in (
      select school_id from public.profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );
