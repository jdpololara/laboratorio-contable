"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authError } from "@/lib/auth-error";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; notice?: string } | null;

async function destination(userId: string) {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return profile?.role === "admin" ? "/panel" : "/";
}

export async function authenticate(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const intent = String(formData.get("intent") ?? "in");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();

  if (intent === "up") {
    const fullName = String(formData.get("full_name") ?? "").trim();
    const classroomId = String(formData.get("classroom_id") ?? "");
    if (!fullName) return { error: "Escribe tu nombre." };
    if (!classroomId) return { error: "Elige el aula en la que estás." };

    const origin = (await headers()).get("origin") ?? "http://localhost:3000";
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, classroom_id: classroomId },
        emailRedirectTo: `${origin}/auth/confirm`,
      },
    });

    if (error) return { error: authError(error.message) };
    if (!data.session || !data.user) {
      return {
        notice:
          "Cuenta creada. Revisa tu correo para confirmarla y luego ingresa.",
      };
    }
    redirect(await destination(data.user.id));
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user) {
    return { error: authError(error?.message ?? "invalid login") };
  }
  redirect(await destination(data.user.id));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/ingreso");
}

export async function chooseClassroom(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const classroomId = String(formData.get("classroom_id") ?? "");
  if (!classroomId) return { error: "Elige un aula." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) redirect("/ingreso");

  const { error } = await supabase
    .from("profiles")
    .update({ classroom_id: classroomId })
    .eq("id", id);

  if (error) return { error: "No se pudo guardar el aula." };
  redirect("/");
}
