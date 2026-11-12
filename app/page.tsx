import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ClassroomPicker } from "@/components/classroom-picker";
import { LabFrame } from "@/components/lab-frame";
import { SetupForm } from "@/components/setup-form";
import { money } from "@/lib/lab/seed";
import { RUTA } from "@/lib/lab/nav";
import { requireViewer } from "@/lib/session";

async function Home() {
  const { supabase, viewer } = await requireViewer();
  if (viewer.role === "admin") redirect("/panel");

  const { data: company } = await supabase
    .from("companies")
    .select("id, razon, nit, work_date, classroom_id")
    .eq("owner_id", viewer.id)
    .maybeSingle();

  const roomQuery = viewer.classroomId
    ? supabase
        .from("classrooms")
        .select("name, semester, mensaje")
        .eq("id", viewer.classroomId)
        .maybeSingle()
    : Promise.resolve({ data: null });

  const { data: room } = await roomQuery;

  if (!company) {
    const { data: classrooms } = await supabase
      .from("classroom_directory")
      .select("id, name, semester")
      .order("semester")
      .order("name");

    return (
      <LabFrame
        title="Laboratorio Contable"
        subtitle={room ? `${room.name} · ${room.semester}` : "Elige un aula para empezar"}
      >
        {viewer.classroomId ? (
          <SetupForm fullName={viewer.fullName} />
        ) : (
          <ClassroomPicker classrooms={classrooms ?? []} />
        )}
      </LabFrame>
    );
  }

  const { data: documents } = await supabase
    .from("documentos")
    .select("tipo, lineas_asiento!lineas_asiento_documento_id_fkey(cuenta, debito, credito)")
    .eq("company_id", company.id);

  const balances = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const document of documents ?? []) {
    counts.set(document.tipo, (counts.get(document.tipo) ?? 0) + 1);
    for (const line of document.lineas_asiento ?? []) {
      balances.set(
        line.cuenta,
        (balances.get(line.cuenta) ?? 0) + line.debito - line.credito,
      );
    }
  }

  const done = [
    true,
    (counts.get("POS") ?? 0) >= 5,
    (counts.get("FE") ?? 0) >= 2,
    (counts.get("FC") ?? 0) >= 1,
    (counts.get("CE") ?? 0) >= 1,
    (counts.get("RC") ?? 0) >= 1,
    (counts.get("AQ") ?? 0) >= 1,
    (counts.get("CG") ?? 0) >= 1,
    (counts.get("EXT") ?? 0) >= 1,
    (counts.get("CON") ?? 0) >= 1,
    (counts.get("CON") ?? 0) >= 1,
  ];
  const finished = done.filter(Boolean).length;
  const firstName = viewer.fullName.split(" ")[0] || "estudiante";

  return (
    <LabFrame
      title={company.razon}
      subtitle={`NIT ${company.nit}${viewer.fullName ? ` · ${viewer.fullName}` : ""}`}
    >
      <div className="stack">
        <div className="spread">
          <div>
            <h2>Hola, {firstName}</h2>
            <p className="muted small" style={{ marginTop: 4 }}>
              Fecha de trabajo: {company.work_date}. Tu empresa queda guardada en el aula
              {room ? ` ${room.name}` : ""}.
            </p>
          </div>
        </div>
        {room?.mensaje ? (
          <p className="note">
            <b>Mensaje del docente: </b>
            {room.mensaje}
          </p>
        ) : null}
        <div className="tiles">
          <div className="tile"><span>Caja (1105)</span><b>{money(balances.get("1105") ?? 0)}</b></div>
          <div className="tile"><span>Bancos (1110)</span><b>{money(balances.get("1110") ?? 0)}</b></div>
          <div className="tile"><span>Inventario (1435)</span><b>{money(balances.get("1435") ?? 0)}</b></div>
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
              {RUTA.map(([label, section], index) => (
                <li key={label} className={done[index] ? "done" : undefined}>
                  <span className="ck">{done[index] ? "✓" : index + 1}</span>
                  <span className="t">{label}</span>
                  <Link className="small" href={section === "empresa" ? "/s/empresa" : `/s/${section}`}>
                    Ir
                  </Link>
                </li>
              ))}
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
