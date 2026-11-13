import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LabFrame } from "@/components/lab-frame";
import {
  CargoRow,
  ClassroomEditor,
  CompanyCard,
  CreateCargoForm,
  CreateClassroomForm,
  CreatePersonalCompanyForm,
  CreateTeamCompanyForm,
  StudentRow,
} from "@/components/panel-forms";
import { companyLabel } from "@/lib/lab/membership";
import { DOCENTE_NAV, RUTA } from "@/lib/lab/nav";
import { rutaDone } from "@/lib/lab/progress";
import { requireViewer } from "@/lib/session";

async function Panel() {
  const { supabase, viewer } = await requireViewer();
  if (viewer.role !== "admin") redirect("/");

  const [roomsResult, studentsResult, companiesResult, cargosResult, roomMembersResult, membersResult] =
    await Promise.all([
      supabase
        .from("classrooms")
        .select("id, name, semester, active, arqueo_dif, mensaje")
        .order("semester")
        .order("name"),
      supabase.from("profiles").select("id, full_name").eq("role", "student").order("full_name"),
      supabase
        .from("companies")
        .select("id, classroom_id, student_id, kind, completed, razon"),
      supabase.from("cargos").select("id, classroom_id, name, label_only").order("name"),
      supabase.from("classroom_members").select("user_id, classroom_id"),
      supabase.from("company_members").select("id, company_id, user_id, cargo_id"),
    ]);

  const rooms = roomsResult.data ?? [];
  const students = studentsResult.data ?? [];
  const companies = (companiesResult.data ?? []).map((company) => ({
    ...company,
    kind: company.kind === "equipo" ? "equipo" as const : "personal" as const,
  }));
  const cargos = cargosResult.data ?? [];
  const roomMembers = roomMembersResult.data ?? [];
  const members = membersResult.data ?? [];
  const memberIds = members.map((member) => member.id);
  const personalIds = companies
    .filter((company) => company.kind === "personal" && company.completed)
    .map((company) => company.id);

  const [actionsResult, documentsResult] = await Promise.all([
    memberIds.length
      ? supabase
          .from("company_member_actions")
          .select("member_id, action, level")
          .in("member_id", memberIds)
      : Promise.resolve({ data: [] }),
    personalIds.length
      ? supabase.from("documentos").select("company_id, tipo").in("company_id", personalIds)
      : Promise.resolve({ data: [] }),
  ]);

  const countsByCompany = new Map<string, Map<string, number>>();
  for (const document of documentsResult.data ?? []) {
    const counts = countsByCompany.get(document.company_id) ?? new Map<string, number>();
    counts.set(document.tipo, (counts.get(document.tipo) ?? 0) + 1);
    countsByCompany.set(document.company_id, counts);
  }

  const names = new Map(students.map((student) => [student.id, student.full_name || "Sin nombre"]));
  const cargoNames = new Map(cargos.map((cargo) => [cargo.id, cargo.name]));

  return (
    <LabFrame
      title="Panel del docente"
      subtitle={viewer.email || "Aulas, empresas y cargos"}
      badge="Docente"
      nav={DOCENTE_NAV}
    >
      <div className="stack">
        <div>
          <p className="eyebrow">Docente</p>
          <h1>Aulas, empresas y cargos</h1>
          <p className="lead" style={{ marginTop: 6 }}>
            Creas el aula y las empresas vacías. El alumno se registra, entra al aula y elige su cargo. En cada membresía marcas hacer, ver o no ver. La ruta sigue la empresa personal.
          </p>
        </div>
        <CreateClassroomForm />
        {rooms.length === 0 ? (
          <p className="empty">Todavía no hay aulas. Crea la primera para que los alumnos puedan registrarse.</p>
        ) : (
          rooms.map((room) => {
            const roomCargos = cargos.filter((cargo) => cargo.classroom_id === room.id);
            const roomStudents = students.filter((student) =>
              roomMembers.some(
                (member) => member.user_id === student.id && member.classroom_id === room.id,
              ),
            );
            const roomCompanies = companies.filter((company) => company.classroom_id === room.id);

            return (
              <section className="stack" key={room.id}>
                <ClassroomEditor room={room} />
                <div className="card stack">
                  <h3>Cargos del aula</h3>
                  {roomCargos.map((cargo) => (
                    <CargoRow key={cargo.id} cargo={cargo} />
                  ))}
                  <CreateCargoForm classroomId={room.id} />
                </div>
                <div className="card stack">
                  <CreatePersonalCompanyForm
                    classroomId={room.id}
                    students={roomStudents}
                    cargos={roomCargos}
                  />
                  <CreateTeamCompanyForm classroomId={room.id} />
                </div>
                {roomCompanies.map((company) => (
                  <CompanyCard
                    key={company.id}
                    company={company}
                    students={roomStudents}
                    cargos={roomCargos}
                    members={members
                      .filter((member) => member.company_id === company.id)
                      .map((member) => ({
                        id: member.id,
                        userId: member.user_id,
                        name: names.get(member.user_id) ?? "Alumno",
                        cargoName: cargoNames.get(member.cargo_id) ?? "Cargo",
                      }))}
                    actions={(actionsResult.data ?? [])
                      .filter((row) =>
                        members.some(
                          (member) => member.id === row.member_id && member.company_id === company.id,
                        ),
                      )
                      .map((row) => ({
                        memberId: row.member_id,
                        action: row.action,
                        level: row.level,
                      }))}
                  />
                ))}
              </section>
            );
          })
        )}
        <h2>Alumnos</h2>
        {students.length === 0 ? (
          <p className="empty">Cuando un alumno cree su cuenta, aparece aquí.</p>
        ) : (
          students.map((student) => (
            <StudentRow
              key={student.id}
              student={student}
              classrooms={rooms}
              memberships={roomMembers
                .filter((member) => member.user_id === student.id)
                .map((member) => ({ classroomId: member.classroom_id }))}
              companies={companies
                .filter((company) => company.kind === "personal" && company.student_id === student.id)
                .map((company) => ({
                  id: company.id,
                  classroomId: company.classroom_id,
                  razon: company.completed ? companyLabel(company) : "Empresa personal vacía",
                  finished: rutaDone(
                    company.completed
                      ? (countsByCompany.get(company.id) ?? new Map())
                      : new Map(),
                    company.completed,
                  ).filter(Boolean).length,
                  total: RUTA.length,
                }))}
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
