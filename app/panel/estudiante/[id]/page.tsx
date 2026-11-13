import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { LabFrame } from "@/components/lab-frame";
import { companyLabel, kindLabel } from "@/lib/lab/membership";
import { RUTA, reviewNav } from "@/lib/lab/nav";
import { TIPO_LABEL, rutaDone, tallyDocuments } from "@/lib/lab/progress";
import { pickCompany, routeCompany, studentCompanies } from "@/lib/lab/review";
import { money } from "@/lib/lab/seed";
import { requireViewer } from "@/lib/session";

const HISTORY_LABEL: Record<string, string> = {
  crear: "Creó el documento",
  corregir: "Corrigió el asiento",
  anular: "Anuló el documento",
};

async function StudentReview({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { id } = await params;
  const { empresa } = await searchParams;
  const { supabase, viewer } = await requireViewer();
  if (viewer.role !== "admin") redirect("/");

  const { data: student } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", id)
    .maybeSingle();

  if (!student || student.role !== "student") notFound();

  const companies = await studentCompanies(supabase, id);
  const selected = pickCompany(companies, empresa);
  const personal = routeCompany(companies, selected);
  const name = student.full_name || "Sin nombre";

  const roomQuery = selected
    ? supabase
        .from("classrooms")
        .select("name, semester")
        .eq("id", selected.classroom_id)
        .maybeSingle()
    : Promise.resolve({ data: null });

  const routeDocsQuery = personal
    ? supabase
        .from("documentos")
        .select("tipo, lineas_asiento!lineas_asiento_documento_id_fkey(cuenta, debito, credito)")
        .eq("company_id", personal.id)
    : Promise.resolve({ data: [] });

  const visibleDocsQuery = selected?.completed
    ? supabase
        .from("documentos")
        .select("id, tipo, num, fecha, anulado, created_by, cargo_id, lineas_asiento!lineas_asiento_documento_id_fkey(cuenta, debito, credito)")
        .eq("company_id", selected.id)
        .order("fecha", { ascending: false })
        .order("num", { ascending: false })
    : Promise.resolve({ data: [] });

  const [{ data: room }, { data: routeDocs }, { data: visibleDocs }] = await Promise.all([
    roomQuery,
    routeDocsQuery,
    visibleDocsQuery,
  ]);

  const rows = visibleDocs ?? [];
  const { counts } = tallyDocuments(routeDocs ?? []);
  const { balances } = tallyDocuments(rows);
  const done = rutaDone(counts, Boolean(personal));
  const finished = done.filter(Boolean).length;
  const companyIds = companies.map((company) => company.id);

  const [eventsResult, authoredResult] = await Promise.all([
    companyIds.length
      ? supabase
          .from("activity_events")
          .select("id, actor_id, cargo_id, company_id, document_id, action, at")
          .in("company_id", companyIds)
          .order("at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("documentos").select("id, tipo, num, created_by").eq("created_by", id),
  ]);

  const authoredIds = new Set((authoredResult.data ?? []).map((document) => document.id));
  const events = (eventsResult.data ?? []).filter(
    (event) => event.actor_id === id || (event.document_id && authoredIds.has(event.document_id)),
  );
  const actorIds = [...new Set(events.map((event) => event.actor_id).filter(Boolean))] as string[];
  const cargoIds = [...new Set(events.map((event) => event.cargo_id).filter(Boolean))] as string[];
  const [actorsResult, cargosResult] = await Promise.all([
    actorIds.length
      ? supabase.from("profiles").select("id, full_name, role").in("id", actorIds)
      : Promise.resolve({ data: [] }),
    cargoIds.length
      ? supabase.from("cargos").select("id, name").in("id", cargoIds)
      : Promise.resolve({ data: [] }),
  ]);
  const actorNames = new Map(
    (actorsResult.data ?? []).map((actor) => [
      actor.id,
      actor.role === "admin" ? "Docente" : actor.full_name || "Alumno",
    ]),
  );
  const cargoName = new Map((cargosResult.data ?? []).map((cargo) => [cargo.id, cargo.name]));
  const companyName = new Map(companies.map((company) => [company.id, companyLabel(company)]));
  const documentName = new Map(
    (authoredResult.data ?? []).map((document) => [
      document.id,
      `${TIPO_LABEL[document.tipo] ?? document.tipo}${document.num > 0 ? ` ${document.num}` : ""}`,
    ]),
  );

  return (
    <LabFrame
      title={name}
      subtitle={
        selected
          ? `${companyLabel(selected)} · ${kindLabel(selected.kind)}`
          : "Sin empresa personal"
      }
      badge="Docente"
      nav={reviewNav(student.id, selected?.id)}
    >
      <div className="stack">
        <div className="spread">
          <div>
            <p className="eyebrow">Avance del alumno</p>
            <h1>{name}</h1>
            <p className="muted small" style={{ marginTop: 6 }}>
              {room ? `${room.name} · ${room.semester}` : "Sin aula"}
              {selected?.work_date ? ` · Fecha de trabajo ${selected.work_date}` : ""}
            </p>
          </div>
          <Link className="btn quiet sm" href="/panel">
            Volver al panel
          </Link>
        </div>

        {companies.length > 1 ? (
          <div className="row">
            {companies.map((company) => (
              <Link
                key={company.id}
                className={`btn quiet sm${company.id === selected?.id ? "" : ""}`}
                href={`/panel/estudiante/${id}?empresa=${company.id}`}
                aria-current={company.id === selected?.id ? "page" : undefined}
              >
                {kindLabel(company.kind)} · {companyLabel(company)}
              </Link>
            ))}
          </div>
        ) : null}

        {selected && selected.kind === "equipo" ? (
          <p className="note">
            La ruta cuenta la empresa personal
            {personal ? ` (${companyLabel(personal)})` : ""}. Los documentos de esta empresa de equipo no la suben.
          </p>
        ) : null}

        {selected ? (
          <>
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
                  {RUTA.map(([label], index) => (
                    <li key={label} className={done[index] ? "done" : undefined}>
                      <span className="ck">{done[index] ? "✓" : index + 1}</span>
                      <span className="t">{label}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="card stack">
                <h3>Documentos de {companyLabel(selected)}</h3>
                {!selected.completed ? (
                  <p className="empty">Esta empresa todavía está vacía.</p>
                ) : rows.length === 0 ? (
                  <p className="empty">Todavía no hay comprobantes en esta empresa.</p>
                ) : (
                  <div className="tbl-wrap">
                    <table className="t">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Documento</th>
                          <th>Número</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((document) => (
                          <tr key={document.id}>
                            <td>{document.fecha}</td>
                            <td>{TIPO_LABEL[document.tipo] ?? document.tipo}</td>
                            <td>{document.num > 0 ? document.num : "—"}</td>
                            <td>{document.anulado ? "Anulado" : "Vigente"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="empty">
            Este alumno todavía no tiene empresa personal. Créala vacía desde el aula y él la completa.
          </p>
        )}

        <div className="card stack" id="historial">
          <h3>Historial</h3>
          {events.length === 0 ? (
            <p className="empty">Todavía no hay actividad de este alumno.</p>
          ) : (
            <div className="tbl-wrap">
              <table className="t">
                <thead>
                  <tr>
                    <th>Cuándo</th>
                    <th>Quién</th>
                    <th>Cargo</th>
                    <th>Qué hizo</th>
                    <th>Empresa</th>
                    <th>Documento</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td>{new Date(event.at).toLocaleString("es-CO")}</td>
                      <td>{event.actor_id ? actorNames.get(event.actor_id) ?? "Alumno" : "—"}</td>
                      <td>{event.cargo_id ? cargoName.get(event.cargo_id) ?? "—" : "—"}</td>
                      <td>{HISTORY_LABEL[event.action] ?? event.action}</td>
                      <td>{event.company_id ? companyName.get(event.company_id) ?? "—" : "—"}</td>
                      <td>
                        {event.document_id
                          ? documentName.get(event.document_id) ?? "Documento"
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </LabFrame>
  );
}

export default function StudentReviewPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ empresa?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="gate">
          <p className="muted">Cargando…</p>
        </div>
      }
    >
      <StudentReview params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
