-- Add new columns to students table
alter table public.students 
add column if not exists admission_no text,
add column if not exists pin text,
add column if not exists photo_url text;

-- Create constraint to ensure admission_no is unique per school (optional but good practice)
-- alter table public.students add constraint students_admission_no_school_unique unique (school_id, admission_no);

-- Create storage bucket for student photos
insert into storage.buckets (id, name, public)
values ('student-photos', 'student-photos', true)
on conflict (id) do nothing;

-- Set up storage policies for student-photos bucket

-- Allow authenticated users to view photos
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'student-photos' );

-- Allow authenticated users (likely school admins) to upload photos
create policy "Authenticated users can upload photos"
on storage.objects for insert
with check (
  bucket_id = 'student-photos' 
  and auth.role() = 'authenticated'
);

-- Allow users to update their own uploads (or admins to update any)
create policy "Authenticated users can update photos"
on storage.objects for update
using (
  bucket_id = 'student-photos'
  and auth.role() = 'authenticated'
);

-- Allow users to delete photos
create policy "Authenticated users can delete photos"
on storage.objects for delete
using (
  bucket_id = 'student-photos'
  and auth.role() = 'authenticated'
);
