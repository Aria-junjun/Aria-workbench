import { createClient } from "@supabase/supabase-js";

// 硬编码保底：确保即使 Vercel 环境变量配置有误，应用也能正常连接 Supabase
const FALLBACK_URL = "https://ggdhgpklhwuwcgeqysho.supabase.co";
const FALLBACK_KEY = "sb_publishable_-or7ucKU_7AqKvDlM0umlA_p5Xyxl9T";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);
