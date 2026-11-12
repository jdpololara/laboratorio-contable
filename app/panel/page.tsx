import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LabFrame } from "@/components/lab-frame";
import {
  ClassroomEditor,
  CreateClassroomForm,
  StudentRow,
} from "@/components/panel-forms";
import { requireViewer } from "@/lib/session";

async function Panel() {
  const { supabase, viewer } = await requireViewer();
  if (viewer.role !== "admin") redirect("/");

  const [roomsResult, studentsResult, companiesResult] = await Promise.all([
    supabase
      .from("classrooms")
      .select("id, name, semester, active, arqueo_dif, mensaje")
      .order("semester")
      .order("name"),
    supabase
      .from("profiles")
      .select("id, full_name, classroom_id")
      .eq("role", "student")
      .order("full_name"),
    supabase.from("companies").select("id, owner_id, razon"),
  ]);

  const rooms = roomsResult.data ?? [];
  const students = studentsResult.data ?? [];
  const companies = new Map(
    (companiesResult.data ?? []).map((company) => [company.owner_id, company]),
  );

  return (
    <LabFrame
      title="Panel del docente"
      subtitle={viewer.email || "Cuentas, aulas y empresas"}
      badge="Docente"
      navigation={false}
    >
      <div className="stack">
        <div>
          <p className="eyebrow">Docente</p>
          <h1>Aulas y estudiantes</h1>
          <p className="lead" style={{ marginTop: 6 }}>
            Crea las aulas activas. El estudiante elige una al registrarse y, dentro de ella, su empresa de práctica.
          </p>
        </div>
        <CreateClassroomForm />
        {rooms.length === 0 ? (
          <p className="empty">Todavía no hay aulas. Crea la primera para que los estudiantes puedan registrarse.</p>
        ) : (
          rooms.map((room) => <ClassroomEditor key={room.id} room={room} />)
        )}
        <h2>Estudiantes</h2>
        {students.length === 0 ? (
          <p className="empty">Cuando un estudiante cree su cuenta, aparece aquí.</p>
        ) : (
          students.map((student) => (
            <StudentRow
              key={student.id}
              student={student}
              classrooms={rooms}
              company={companies.get(student.id) ?? null}
            />
          ))
        )}
      </div>
    </LabFrame>
  );
}

export default function PanelPage() {
  return (
    <Suspense
      fallback={
        <div className="gate">
          <p className="muted">Cargando…</p>
        </div>
      }
    >
      <Panel />
    </Suspense>
  );
}
