import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a browser-side Supabase client.
 * Returns null if Supabase environment variables have not been configured yet.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("your-project-id")) {
    return null;
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
