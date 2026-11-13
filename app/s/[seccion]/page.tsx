import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { LabFrame } from "@/components/lab-frame";
import { WorkspaceBar } from "@/components/workspace-bar";
import { companyLabel } from "@/lib/lab/membership";
import { SECTIONS, sectionAccess, visibleNav } from "@/lib/lab/nav";
import { activeCompany, requireViewer } from "@/lib/session";

async function Section({
  params,
}: {
  params: Promise<{ seccion: string }>;
}) {
  const { seccion } = await params;
  const section = SECTIONS[seccion];
  if (!section) notFound();

  const { viewer } = await requireViewer();
  if (viewer.role === "admin") redirect("/panel");

  const access = sectionAccess(seccion, viewer.role, viewer.levels);
  if (access === "hide") notFound();

  const company = activeCompany(viewer);
  const here = viewer.companies.filter(
    (item) => item.classroomId === viewer.activeClassroomId,
  );
  const readOnly = access === "view";

  return (
    <LabFrame
      title={company ? companyLabel(company) : "Laboratorio Contable"}
      subtitle={company?.nit ? `NIT ${company.nit}` : "Empresa de esta aula"}
      nav={visibleNav(viewer.levels, viewer.role)}
    >
      <div className="stack" style={{ maxWidth: 720 }}>
        <WorkspaceBar
          classrooms={viewer.classrooms}
          companies={here}
          activeClassroomId={viewer.activeClassroomId}
          activeCompanyId={company?.id ?? null}
        />
        <div>
          <h2>{section.title}</h2>
          <p className="muted small" style={{ marginTop: 4 }}>
            {section.description}
          </p>
        </div>
        {readOnly ? (
          <p className="note">Solo puedes ver esta sección.</p>
        ) : null}
        {company?.completed ? (
          <p className="empty">
            Esta pantalla todavía se está pasando a un componente de React. Los datos de {companyLabel(company)} ya están en Supabase.
          </p>
        ) : company ? (
          <p className="empty">
            Primero completa la empresa en el <Link href="/">inicio</Link>.
          </p>
        ) : (
          <p className="empty">
            El docente todavía no te mete en una empresa. Vuelve al <Link href="/">inicio</Link>.
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
