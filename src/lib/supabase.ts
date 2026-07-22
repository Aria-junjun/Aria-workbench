import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ggdhgpklhwuwcgeqysho.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_-or7ucKU_7AqKvDlM0umlA_p5Xyxl9T";

export const supabase = createClient(supabaseUrl, supabaseKey);
