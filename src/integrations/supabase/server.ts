// Server-only Supabase client using the service role key
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY as string;

export function createServerSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error('Missing Supabase server env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY');
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
    },
  });
}

export default createServerSupabase;
