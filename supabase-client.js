// Supabase Client - ES Module for GitHub Pages
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://aggqmjxhnsbmsymwblqg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnZ3FtanhobnNibXN5bXdibHFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNjQ0NTgsImV4cCI6MjA3ODk0MDQ1OH0.YZmrw7-LtIjlvTkU0c7G8qZ2VDNO8PeHudkGVo1PQ8Q";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("Supabase initialized");
