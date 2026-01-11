-- Fix Exam Config Persistence
-- 1. Ensure schools table has the JSONB column
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS exam_config JSONB DEFAULT '{}'::jsonb;

-- 2. Ensure exam_config table exists (for Mark Entry toggle sync)
CREATE TABLE IF NOT EXISTS public.exam_config (
    school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
    mark_entry_enabled boolean DEFAULT false,
    current_term text DEFAULT 'Term 1 2026',
    updated_at timestamptz DEFAULT NOW()
);

-- 3. Create RPC to save config to BOTH places
CREATE OR REPLACE FUNCTION save_exam_config(
    p_school_id UUID,
    p_config JSONB
) RETURNS VOID AS $$
BEGIN
    -- Update the main JSON store
    UPDATE public.schools
    SET exam_config = p_config
    WHERE id = p_school_id;
    
    -- Sync key fields to the dedicated table (for other RPCs)
    INSERT INTO public.exam_config (school_id, mark_entry_enabled, current_term, updated_at)
    VALUES (
        p_school_id, 
        COALESCE((p_config->>'mark_entry_enabled')::boolean, false),
        COALESCE(p_config->>'current_term', 'Term 1'),
        NOW()
    )
    ON CONFLICT (school_id)
    DO UPDATE SET 
        mark_entry_enabled = EXCLUDED.mark_entry_enabled, 
        current_term = EXCLUDED.current_term,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION save_exam_config TO authenticated;
GRANT EXECUTE ON FUNCTION save_exam_config TO anon;
