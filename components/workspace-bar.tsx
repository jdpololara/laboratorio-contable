"use client";

import { useActionState } from "react";
import {
  chooseClassroomWork,
  chooseCompanyWork,
  type WorkspaceState,
} from "@/app/workspace/actions";
import { companyLabel, kindLabel } from "@/lib/lab/membership";

export function WorkspaceBar({
  classrooms,
  companies,
  activeClassroomId,
  activeCompanyId,
}: {
  classrooms: { id: string; name: string; semester: string }[];
  companies: {
    id: string;
    kind: "personal" | "equipo";
    razon: string | null;
  }[];
  activeClassroomId: string | null;
  activeCompanyId: string | null;
}) {
  const [roomState, chooseRoom, roomPending] = useActionState<WorkspaceState, FormData>(
    chooseClassroomWork,
    null,
  );
  const [companyState, chooseCompany, companyPending] = useActionState<WorkspaceState, FormData>(
    chooseCompanyWork,
    null,
  );
  const room = classrooms.find((item) => item.id === activeClassroomId);
  const company = companies.find((item) => item.id === activeCompanyId);

  if (classrooms.length <= 1 && companies.length <= 1) {
    if (!room && !company) return null;
    return (
      <p className="small muted">
        {room ? `${room.name} · ${room.semester}` : "Sin aula"}
        {company ? ` · ${kindLabel(company.kind)} · ${companyLabel(company)}` : ""}
      </p>
    );
  }

  return (
    <div className="card stack">
      {classrooms.length > 1 ? (
        <form className="row" action={chooseRoom}>
          <label className="f" style={{ flex: "1 1 220px" }}>
            Aula
            <select className="in" name="classroom_id" defaultValue={activeClassroomId ?? ""}>
              {classrooms.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.semester}
                </option>
              ))}
            </select>
          </label>
          <button className="btn quiet sm" type="submit" disabled={roomPending}>
            Trabajar en esta aula
          </button>
        </form>
      ) : room ? (
        <p className="small muted">{room.name} · {room.semester}</p>
      ) : null}
      {companies.length > 1 ? (
        <form className="row" action={chooseCompany}>
          <label className="f" style={{ flex: "1 1 220px" }}>
            Empresa
            <select className="in" name="company_id" defaultValue={activeCompanyId ?? ""}>
              {companies.map((item) => (
                <option key={item.id} value={item.id}>
                  {kindLabel(item.kind)} · {companyLabel(item)}
                </option>
              ))}
            </select>
          </label>
          <button className="btn quiet sm" type="submit" disabled={companyPending}>
            Trabajar en esta empresa
          </button>
        </form>
      ) : null}
      {roomState?.error || companyState?.error ? (
        <p className="note bad" role="alert">
          {roomState?.error ?? companyState?.error}
        </p>
      ) : null}
    </div>
  );
}
