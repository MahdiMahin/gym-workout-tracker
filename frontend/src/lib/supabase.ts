import { createClient } from '@supabase/supabase-js'

// Only initialize when local environment values are supplied.
// This PR uses demo mode; database reads/writes remain backend-team work.
const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase =
  url && publishableKey ? createClient(url, publishableKey) : null

export const isSupabaseConfigured = Boolean(supabase)
