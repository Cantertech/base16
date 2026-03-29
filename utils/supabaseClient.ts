import { createClient } from '@supabase/supabase-js';

// These should be in a .env file in a real production app
// For now, we'll use placeholders that the user needs to replace
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
