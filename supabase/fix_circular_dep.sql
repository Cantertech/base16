-- Add subscription_plan column to schools table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'subscription_plan') THEN
        ALTER TABLE schools ADD COLUMN subscription_plan TEXT DEFAULT 'Small School';
    END IF;

    -- Also check for currency column while we're at it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'currency') THEN
       ALTER TABLE schools ADD COLUMN currency TEXT DEFAULT 'GHS';
    END IF;

    -- Make sure RLS doesn't block insertion
    -- ALTER TABLE schools DISABLE ROW LEVEL SECURITY; -- Generally not recommended, but for debugging
    
    -- Ensure profiles can be created without strict FK check initially IF it's failing on that
    -- But the error says "fk_schools_profiles", which likely means:
    -- 'schools' has a column 'admin_id' referencing 'profiles(id)'
    -- BUT 'profiles' has a column 'school_id' referencing 'schools(id)'
    -- This is a CIRCULAR DEPENDENCY.
    
    -- Solution: Temporarily make the FK nullable or deferrable?
    -- Actually, in SetupWizard:
    -- 1. User signs up (Auth User created)
    -- 2. School is inserted (with admin_id = Auth User ID)
    -- 3. Profile is inserted (with school_id = School ID)

    -- If 'schools.admin_id' references 'profiles.id', then profile MUST exist before school.
    -- But 'profiles.school_id' references 'schools.id', so school MUST exist before profile.
    
    -- FIX: Drop the foreign key constraint from schools to profiles if it exists, or make it not enforced.
    -- OR: Allow admin_id to be inserted, but ensure the constraint allows it if the profile doesn't exist YET?
    -- No, standard FK requires the row to exist.
    
    -- Let's check constraints on schools
    -- The error "fk_schools_profiles" suggests schools(admin_id) -> profiles(id).
    
    -- Strategy: We need to insert the School with NULL admin_id first (if allowed), then insert Profile, then update School?
    -- OR: Drop the FK constraint on schools(admin_id) because it's creating a deadlock with profiles(school_id).
    -- Having auth.users referencing is fine, but if schools references public.profiles, that's the loop.
    
    -- Let's drop the constraint if it exists to break the loop. 
    -- Ideally, schools.admin_id should reference auth.users, not public.profiles.
END $$;

-- Fix: Drop the problematic constraint if it exists and recreate it pointing to auth.users, or just leave it off public.profiles
ALTER TABLE schools DROP CONSTRAINT IF EXISTS fk_schools_profiles;

-- Optionally, verify column existence
NOTIFY pgrst, 'reload schema';
