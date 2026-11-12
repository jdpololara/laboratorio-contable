import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getViewer } from "@/lib/session";

async function Ingreso({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  const { aviso } = await searchParams;
  const { supabase, viewer } = await getViewer();
  if (viewer?.role === "admin") redirect("/panel");
  if (viewer) redirect("/");

  const { data: classrooms } = await supabase
    .from("classroom_directory")
    .select("id, name, semester")
    .order("semester")
    .order("name");

  return (
    <AuthForm
      classrooms={classrooms ?? []}
      notice={
        aviso === "enlace"
          ? "Ese enlace ya no sirve. Pide uno nuevo o ingresa con tu contraseña."
          : undefined
      }
    />
  );
}

export default function IngresoPage(props: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="gate">
          <p className="muted">Cargando…</p>
        </div>
      }
    >
      <Ingreso searchParams={props.searchParams} />
    </Suspense>
  );
}
