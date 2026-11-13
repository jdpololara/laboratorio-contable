import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CargoForm } from "@/components/cargo-form";
import { ClassroomPicker } from "@/components/classroom-picker";
import { LabFrame } from "@/components/lab-frame";
import { SetupForm } from "@/components/setup-form";
import { WorkspaceBar } from "@/components/workspace-bar";
import { companyLabel, kindLabel } from "@/lib/lab/membership";
import { RUTA, sectionAccess, visibleNav } from "@/lib/lab/nav";
import { rutaDone, tallyDocuments } from "@/lib/lab/progress";
import { money } from "@/lib/lab/seed";
import { activeCompany, requireViewer } from "@/lib/session";

async function Home() {
  const { supabase, viewer } = await requireViewer();
  if (viewer.role === "admin") redirect("/panel");

  const room = viewer.classrooms.find((item) => item.id === viewer.activeClassroomId) ?? null;
  const here = viewer.companies.filter((company) => company.classroomId === viewer.activeClassroomId);
  const company = activeCompany(viewer);
  const personal = here.find(
    (item) => item.kind === "personal" && item.studentId === viewer.id && item.completed,
  );
  const nav = visibleNav(viewer.levels, viewer.role);

  if (viewer.classrooms.length === 0) {
    const { data: classrooms } = await supabase
      .from("classroom_directory")
      .select("id, name, semester")
      .order("semester")
      .order("name");

    return (
      <LabFrame title="Laboratorio Contable" subtitle="Elige un aula para empezar" navigation={false}>
        <ClassroomPicker classrooms={classrooms ?? []} />
      </LabFrame>
    );
  }

  const { data: cargos } = viewer.activeClassroomId
    ? await supabase
        .from("cargos")
        .select("id, name")
        .eq("classroom_id", viewer.activeClassroomId)
        .order("name")
    : { data: [] };

  const memberships = viewer.memberships.filter((member) => member.companyId === company?.id);
  const subtitle = company
    ? `${kindLabel(company.kind)}${company.nit ? ` · NIT ${company.nit}` : ""}`
    : room
      ? `${room.name} · ${room.semester}`
      : "Laboratorio Contable";

  if (!company) {
    return (
      <LabFrame title="Laboratorio Contable" subtitle={subtitle} nav={nav}>
        <div className="stack">
          <WorkspaceBar
            classrooms={viewer.classrooms}
            companies={here}
            activeClassroomId={viewer.activeClassroomId}
            activeCompanyId={null}
          />
          <p className="empty">
            El docente todavía no te mete en una empresa de esta aula.
          </p>
        </div>
      </LabFrame>
    );
  }

  if (!company.completed) {
    const canEdit = viewer.levels["company.edit"] === "do";
    const ownsPersonal = company.kind === "equipo" || company.studentId === viewer.id;
    return (
      <LabFrame title={companyLabel(company)} subtitle={subtitle} nav={nav}>
        <div className="stack">
          <WorkspaceBar
            classrooms={viewer.classrooms}
            companies={here}
            activeClassroomId={viewer.activeClassroomId}
            activeCompanyId={company.id}
          />
          <CargoForm memberships={memberships} cargos={cargos ?? []} />
          {canEdit && ownsPersonal ? (
            <SetupForm fullName={viewer.fullName} companyId={company.id} kind={company.kind} />
          ) : (
            <p className="empty">
              Esta empresa está vacía. La completa quien tenga permiso de editarla.
            </p>
          )}
        </div>
      </LabFrame>
    );
  }

  const { data: documents } = personal
    ? await supabase
        .from("documentos")
        .select("tipo, lineas_asiento!lineas_asiento_documento_id_fkey(cuenta, debito, credito)")
        .eq("company_id", personal.id)
    : { data: [] };
  const { data: activeDocuments } = await supabase
    .from("documentos")
    .select("tipo, lineas_asiento!lineas_asiento_documento_id_fkey(cuenta, debito, credito)")
    .eq("company_id", company.id);

  const route = tallyDocuments(documents ?? []);
  const activeBooks = tallyDocuments(activeDocuments ?? []);
  const done = rutaDone(route.counts, Boolean(personal));
  const finished = done.filter(Boolean).length;
  const firstName = viewer.fullName.split(" ")[0] || "estudiante";
  const cargo = memberships.map((member) => member.cargoName).join(", ");

  return (
    <LabFrame
      title={companyLabel(company)}
      subtitle={`${subtitle}${viewer.fullName ? ` · ${viewer.fullName}` : ""}${cargo ? ` · ${cargo}` : ""}`}
      nav={nav}
    >
      <div className="stack">
        <WorkspaceBar
          classrooms={viewer.classrooms}
          companies={here}
          activeClassroomId={viewer.activeClassroomId}
          activeCompanyId={company.id}
        />
        <CargoForm memberships={memberships} cargos={cargos ?? []} />
        <div>
          <h2>Hola, {firstName}</h2>
          <p className="muted small" style={{ marginTop: 4 }}>
            Fecha de trabajo: {company.workDate}. Esta empresa está en el aula
            {room ? ` ${room.name}` : ""}.
          </p>
        </div>
        {room?.mensaje ? (
          <p className="note">
            <b>Mensaje del docente: </b>
            {room.mensaje}
          </p>
        ) : null}
        {company.kind === "equipo" ? (
          <p className="note">
            La ruta del taller cuenta tu empresa personal
            {personal ? ` (${companyLabel(personal)})` : ""}. Un documento de esta empresa de equipo no la adelanta.
          </p>
        ) : null}
        <div className="tiles">
          <div className="tile"><span>Caja (1105)</span><b>{money(activeBooks.balances.get("1105") ?? 0)}</b></div>
          <div className="tile"><span>Bancos (1110)</span><b>{money(activeBooks.balances.get("1110") ?? 0)}</b></div>
          <div className="tile"><span>Inventario (1435)</span><b>{money(activeBooks.balances.get("1435") ?? 0)}</b></div>
        </div>
        <div className="grid2">
          <div className="card stack" style={{ gap: 12 }}>
            <div className="spread">
              <h3>Ruta del taller</h3>
              <span className={`chip ${finished === RUTA.length ? "ok" : "acc"}`}>
                {finished} de {RUTA.length}
              </span>
            </div>
            <ol className="checklist">
              {RUTA.map(([label, section], index) => {
                const access = sectionAccess(section, viewer.role, viewer.levels);
                return (
                  <li key={label} className={done[index] ? "done" : undefined}>
                    <span className="ck">{done[index] ? "✓" : index + 1}</span>
                    <span className="t">{label}</span>
                    {access === "hide" ? null : (
                      <Link className="small" href={section === "empresa" ? "/s/empresa" : `/s/${section}`}>
                        {access === "view" ? "Ver" : "Ir"}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="card stack">
            <h3>Cómo se conecta todo</h3>
            <p className="small">
              Las ventas en efectivo del POS entran a <b>Caja</b>. Al final del día haces el <b>arqueo</b> y luego lo <b>consignas</b> en el banco.
            </p>
            <p className="small">
              Las ventas con tarjeta, las transferencias y los cheques mueven <b>Bancos</b>. Al cerrar el mes solicitas el extracto y elaboras la conciliación.
            </p>
            <p className="note">
              El punto de venta, las facturas y los libros se están pasando a componentes de React. La empresa y estos saldos ya viven en Supabase.
            </p>
          </div>
        </div>
      </div>
    </LabFrame>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="gate">
          <p className="muted">Cargando…</p>
        </div>
      }
    >
      <Home />
    </Suspense>
  );
}
