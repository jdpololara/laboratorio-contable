import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { mergeLevels, type ActionKey, type ActionLevel } from "@/lib/lab/membership";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "student";

export type ViewerClassroom = {
  id: string;
  name: string;
  semester: string;
  mensaje: string;
};

export type ViewerCompany = {
  id: string;
  classroomId: string;
  kind: "personal" | "equipo";
  completed: boolean;
  razon: string | null;
  nit: string | null;
  workDate: string | null;
  studentId: string | null;
};

export type ViewerMembership = {
  id: string;
  companyId: string;
  cargoId: string;
  cargoName: string;
};

export type Viewer = {
  id: string;
  email: string;
  role: Role;
  fullName: string;
  classrooms: ViewerClassroom[];
  companies: ViewerCompany[];
  memberships: ViewerMembership[];
  activeClassroomId: string | null;
  activeCompanyId: string | null;
  levels: Partial<Record<ActionKey, ActionLevel>>;
};

const COMPANY_COLUMNS =
  "id, classroom_id, kind, completed, razon, nit, work_date, student_id";

function asKind(value: string): "personal" | "equipo" {
  return value === "equipo" ? "equipo" : "personal";
}

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

  const base = {
    id,
    email: typeof data.claims.email === "string" ? data.claims.email : "",
    role: profile.role as Role,
    fullName: profile.full_name ?? "",
  };

  if (profile.role === "admin") {
    const viewer: Viewer = {
      ...base,
      classrooms: [],
      companies: [],
      memberships: [],
      activeClassroomId: null,
      activeCompanyId: null,
      levels: {},
    };
    return { supabase, viewer };
  }

  const cookieStore = await cookies();
  const [membersResult, roomsResult] = await Promise.all([
    supabase
      .from("company_members")
      .select("id, cargo_id, company_id")
      .eq("user_id", id),
    supabase.from("classroom_members").select("classroom_id").eq("user_id", id),
  ]);

  if (membersResult.error) throw new Error(membersResult.error.message);
  if (roomsResult.error) throw new Error(roomsResult.error.message);

  const memberRows = membersResult.data ?? [];
  const roomIds = [...new Set((roomsResult.data ?? []).map((row) => row.classroom_id))];
  const companyIds = [...new Set(memberRows.map((row) => row.company_id))];
  const cargoIds = [...new Set(memberRows.map((row) => row.cargo_id))];
  const memberIds = memberRows.map((row) => row.id);

  const [classroomsResult, companiesResult, cargosResult, actionsResult] = await Promise.all([
    roomIds.length
      ? supabase
          .from("classrooms")
          .select("id, name, semester, mensaje")
          .in("id", roomIds)
          .order("semester")
          .order("name")
      : Promise.resolve({ data: [], error: null }),
    companyIds.length
      ? supabase.from("companies").select(COMPANY_COLUMNS).in("id", companyIds)
      : Promise.resolve({ data: [], error: null }),
    cargoIds.length
      ? supabase.from("cargos").select("id, name").in("id", cargoIds)
      : Promise.resolve({ data: [], error: null }),
    memberIds.length
      ? supabase
          .from("company_member_actions")
          .select("member_id, action, level")
          .in("member_id", memberIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (classroomsResult.error) throw new Error(classroomsResult.error.message);
  if (companiesResult.error) throw new Error(companiesResult.error.message);
  if (cargosResult.error) throw new Error(cargosResult.error.message);
  if (actionsResult.error) throw new Error(actionsResult.error.message);

  const classrooms: ViewerClassroom[] = (classroomsResult.data ?? []).map((room) => ({
    id: room.id,
    name: room.name,
    semester: room.semester,
    mensaje: room.mensaje ?? "",
  }));
  const knownRooms = new Set(classrooms.map((room) => room.id));
  const wantedRoom = cookieStore.get("lab_aula")?.value;
  const profileRoom = profile.classroom_id;
  const activeClassroomId =
    (wantedRoom && knownRooms.has(wantedRoom) ? wantedRoom : null) ??
    (profileRoom && knownRooms.has(profileRoom) ? profileRoom : null) ??
    classrooms[0]?.id ??
    null;

  const companies: ViewerCompany[] = (companiesResult.data ?? [])
    .map((company) => ({
      id: company.id,
      classroomId: company.classroom_id,
      kind: asKind(company.kind),
      completed: company.completed,
      razon: company.razon,
      nit: company.nit,
      workDate: company.work_date,
      studentId: company.student_id,
    }))
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "personal" ? -1 : 1;
      return (a.razon ?? "").localeCompare(b.razon ?? "", "es");
    });

  const here = companies.filter((company) => company.classroomId === activeClassroomId);
  const wantedCompany = cookieStore.get("lab_empresa")?.value;
  const personal = here.find(
    (company) => company.kind === "personal" && company.studentId === id,
  );
  const activeCompanyId =
    (wantedCompany && here.some((company) => company.id === wantedCompany)
      ? wantedCompany
      : null) ??
    personal?.id ??
    here[0]?.id ??
    null;

  const cargoNames = new Map((cargosResult.data ?? []).map((cargo) => [cargo.id, cargo.name]));
  const memberships: ViewerMembership[] = memberRows.map((member) => ({
    id: member.id,
    companyId: member.company_id,
    cargoId: member.cargo_id,
    cargoName: cargoNames.get(member.cargo_id) ?? "Cargo",
  }));

  const activeMemberIds = new Set(
    memberships
      .filter((member) => member.companyId === activeCompanyId)
      .map((member) => member.id),
  );
  const levels = mergeLevels(
    (actionsResult.data ?? []).filter((row) => activeMemberIds.has(row.member_id)),
  );

  const viewer: Viewer = {
    ...base,
    classrooms,
    companies,
    memberships,
    activeClassroomId,
    activeCompanyId,
    levels,
  };

  return { supabase, viewer };
}

export async function requireViewer() {
  const result = await getViewer();
  if (!result.viewer) redirect("/ingreso");
  return { supabase: result.supabase, viewer: result.viewer };
}

export function activeCompany(viewer: Viewer) {
  return viewer.companies.find((company) => company.id === viewer.activeCompanyId) ?? null;
}
