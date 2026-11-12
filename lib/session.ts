import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "student";

export type Viewer = {
  id: string;
  email: string;
  role: Role;
  fullName: string;
  classroomId: string | null;
};

export async function getViewer() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;

  if (!id) return { supabase, viewer: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, classroom_id")
    .eq("id", id)
    .maybeSingle();

  if (!profile || (profile.role !== "admin" && profile.role !== "student")) {
    return { supabase, viewer: null };
  }

  const viewer: Viewer = {
    id,
    email: typeof data.claims.email === "string" ? data.claims.email : "",
    role: profile.role,
    fullName: profile.full_name ?? "",
    classroomId: profile.classroom_id,
  };

  return { supabase, viewer };
}

export async function requireViewer() {
  const result = await getViewer();
  if (!result.viewer) redirect("/ingreso");
  return { supabase: result.supabase, viewer: result.viewer };
}
