// Client-side function middleware: attaches the signed-in Supabase access token
// to every server-function call so requireSupabaseAuth middleware can verify it.
import { createStart, createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

const attachSupabaseAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  if (typeof window === "undefined") return next();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return next();
  return next({ headers: { Authorization: `Bearer ${token}` } });
});

export const startInstance = createStart(() => ({
  requestMiddleware: [],
  functionMiddleware: [attachSupabaseAuth],
}));
