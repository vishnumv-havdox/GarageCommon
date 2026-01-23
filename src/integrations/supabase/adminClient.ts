// Admin client for user management operations
// This requires the SERVICE_ROLE_KEY from Supabase
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Check if service role key is configured
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "Warning: VITE_SUPABASE_SERVICE_ROLE_KEY is not configured. " +
    "User management features will not work properly. " +
    "Please add VITE_SUPABASE_SERVICE_ROLE_KEY to your .env file."
  );
}

export const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || 'dummy-key-for-development',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  }
);

