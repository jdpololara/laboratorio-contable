import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { LabFrame } from "@/components/lab-frame";
import { SECTIONS } from "@/lib/lab/nav";
import { requireViewer } from "@/lib/session";

async function Section({
  params,
}: {
  params: Promise<{ seccion: string }>;
}) {
  const { seccion } = await params;
  const section = SECTIONS[seccion];
  if (!section) notFound();

  const { supabase, viewer } = await requireViewer();
  if (viewer.role === "admin") redirect("/panel");

  const { data: company } = await supabase
    .from("companies")
    .select("razon, nit")
    .eq("owner_id", viewer.id)
    .maybeSingle();

  return (
    <LabFrame
      title={company?.razon ?? "Laboratorio Contable"}
      subtitle={company ? `NIT ${company.nit}` : "Crea tu empresa para empezar"}
    >
      <div className="stack" style={{ maxWidth: 720 }}>
        <div>
          <h2>{section.title}</h2>
          <p className="muted small" style={{ marginTop: 4 }}>
            {section.description}
          </p>
        </div>
        {company ? (
          <p className="empty">
            Esta pantalla todavía se está pasando a un componente de React. Los datos de {company.razon} ya están en Supabase.
          </p>
        ) : (
          <p className="empty">
            Primero crea la empresa en el <Link href="/">inicio</Link>.
          </p>
        )}
      </div>
    </LabFrame>
  );
}

export default function SectionPage(props: {
  params: Promise<{ seccion: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="gate">
          <p className="muted">Cargando…</p>
        </div>
      }
    >
      <Section params={props.params} />
    </Suspense>
  );
}
