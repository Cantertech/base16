-- Fix foreign key constraint on exam_submissions table to allow teacher deletion

-- First drop the existing constraint
alter table public.exam_submissions
drop constraint if exists exam_submissions_teacher_id_fkey;

-- Re-add the constraint with ON DELETE SET NULL
alter table public.exam_submissions
add constraint exam_submissions_teacher_id_fkey
foreign key (teacher_id)
references public.profiles(id)
on delete set null;
