import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

// Gunakan Service Role Key agar bisa upload/delete tanpa auth Supabase
// JANGAN expose key ini ke client/FE
export const supabase = createClient(
  env.supabaseUrl,
  env.supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
