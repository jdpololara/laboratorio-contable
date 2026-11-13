import type { SupabaseClient } from "@supabase/supabase-js";

const COMPANY_COLUMNS =
  "id, classroom_id, kind, completed, razon, nit, work_date, student_id, ciudad, direccion, accounting_start, resol_numero, resol_prefijo, banco_nombre, banco_cuenta";

export type ReviewCompany = {
  id: string;
  classroom_id: string;
  kind: "personal" | "equipo";
  completed: boolean;
  razon: string | null;
  nit: string | null;
  work_date: string | null;
  student_id: string | null;
  ciudad: string;
  direccion: string;
  accounting_start: string | null;
  resol_numero: string | null;
  resol_prefijo: string;
  banco_nombre: string | null;
  banco_cuenta: string | null;
};

function asCompany(row: ReviewCompany): ReviewCompany {
  return {
    ...row,
    kind: row.kind === "equipo" ? "equipo" : "personal",
    ciudad: row.ciudad ?? "",
    direccion: row.direccion ?? "",
    resol_prefijo: row.resol_prefijo ?? "FE",
  };
}

export async function studentCompanies(supabase: SupabaseClient, studentId: string) {
  const { data: memberships } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", studentId);
  const ids = [...new Set((memberships ?? []).map((row) => row.company_id as string))];

  const [personalResult, memberResult] = await Promise.all([
    supabase
      .from("companies")
      .select(COMPANY_COLUMNS)
      .eq("student_id", studentId)
      .eq("kind", "personal"),
    ids.length
      ? supabase.from("companies").select(COMPANY_COLUMNS).in("id", ids)
      : Promise.resolve({ data: [] }),
  ]);

  const map = new Map<string, ReviewCompany>();
  for (const row of [...(personalResult.data ?? []), ...(memberResult.data ?? [])]) {
    map.set(row.id, asCompany(row as ReviewCompany));
  }
  return [...map.values()].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "personal" ? -1 : 1;
    return (a.razon ?? "").localeCompare(b.razon ?? "", "es");
  });
}

export function pickCompany(companies: ReviewCompany[], companyId?: string | null) {
  const wanted = companies.find((company) => company.id === companyId);
  if (wanted) return wanted;
  return (
    companies.find((company) => company.kind === "personal" && company.completed) ??
    companies.find((company) => company.kind === "personal") ??
    companies[0] ??
    null
  );
}

export function routeCompany(companies: ReviewCompany[], selected: ReviewCompany | null) {
  const personal = companies.filter((company) => company.kind === "personal" && company.completed);
  if (!personal.length) return null;
  return (
    personal.find((company) => company.classroom_id === selected?.classroom_id) ?? personal[0]
  );
}
