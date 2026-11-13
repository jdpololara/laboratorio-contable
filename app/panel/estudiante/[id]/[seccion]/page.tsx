import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { CorrectLineForm } from "@/components/correct-line";
import { LabFrame } from "@/components/lab-frame";
import { companyLabel, kindLabel } from "@/lib/lab/membership";
import { SECTIONS, reviewNav } from "@/lib/lab/nav";
import { TIPO_LABEL, tallyDocuments } from "@/lib/lab/progress";
import { pickCompany, studentCompanies, type ReviewCompany } from "@/lib/lab/review";
import { money } from "@/lib/lab/seed";
import { requireViewer } from "@/lib/session";

const SECTION_TIPOS: Record<string, string[]> = {
  pos: ["POS"],
  facturas: ["FE"],
  recibos: ["RC"],
  compras: ["FC"],
  egresos: ["CE"],
  caja: ["AQ", "CG"],
  bancos: ["EXT"],
  conciliacion: ["CON"],
  notas: ["NC"],
  repositorio: ["ARC"],
  correos: ["MAIL"],
};

const LIBROS = new Set(["diario", "mayor", "balance", "estados"]);

async function StudentSection({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; seccion: string }>;
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { id, seccion } = await params;
  const { empresa } = await searchParams;
  const section = SECTIONS[seccion];
  if (!section) notFound();

  const { supabase, viewer } = await requireViewer();
  if (viewer.role !== "admin") redirect("/");

  const { data: student } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", id)
    .maybeSingle();

  if (!student || student.role !== "student") notFound();

  const companies = await studentCompanies(supabase, id);
  const company = pickCompany(companies, empresa);
  const name = student.full_name || "Sin nombre";

  return (
    <LabFrame
      title={company ? companyLabel(company) : name}
      subtitle={company ? `${kindLabel(company.kind)} · ${name}` : "Sin empresa"}
      badge="Docente"
      nav={reviewNav(student.id, company?.id)}
    >
      <div className="stack" style={{ maxWidth: 960 }}>
        <div className="spread">
          <div>
            <p className="eyebrow">{name}</p>
            <h1>{section.title}</h1>
            <p className="muted small" style={{ marginTop: 6 }}>
              {section.description}
            </p>
          </div>
          <Link className="btn quiet sm" href={`/panel/estudiante/${id}${company ? `?empresa=${company.id}` : ""}`}>
            Volver al avance
          </Link>
        </div>
        {companies.length > 1 ? (
          <div className="row">
            {companies.map((item) => (
              <Link
                key={item.id}
                className="btn quiet sm"
                href={`/panel/estudiante/${id}/${seccion}?empresa=${item.id}`}
                aria-current={item.id === company?.id ? "page" : undefined}
              >
                {kindLabel(item.kind)} · {companyLabel(item)}
              </Link>
            ))}
          </div>
        ) : null}
        {company?.completed ? (
          <SectionBody
            supabase={supabase}
            company={company}
            seccion={seccion}
            studentId={id}
          />
        ) : (
          <p className="empty">
            {company
              ? "Esta empresa todavía está vacía."
              : "Este alumno todavía no tiene empresa. Créala vacía desde el aula."}
          </p>
        )}
      </div>
    </LabFrame>
  );
}

async function SectionBody({
  supabase,
  company,
  seccion,
  studentId,
}: {
  supabase: Awaited<ReturnType<typeof requireViewer>>["supabase"];
  company: ReviewCompany;
  seccion: string;
  studentId: string;
}) {
  if (seccion === "empresa") {
    return (
      <div className="card stack">
        <p><b>{company.razon}</b> · NIT {company.nit}</p>
        <p className="small">{company.direccion}{company.ciudad ? ` · ${company.ciudad}` : ""}</p>
        <p className="small">Inicio contable {company.accounting_start} · Fecha de trabajo {company.work_date}</p>
        <p className="small">Resolución {company.resol_numero} · Prefijo {company.resol_prefijo}</p>
        <p className="small">{company.banco_nombre} · Cuenta {company.banco_cuenta}</p>
      </div>
    );
  }

  if (seccion === "terceros") {
    const { data } = await supabase
      .from("terceros")
      .select("id, tipo_doc, doc, nombre, rol, correo")
      .eq("company_id", company.id)
      .order("nombre");
    const rows = data ?? [];
    if (rows.length === 0) return <p className="empty">No hay terceros en esta empresa.</p>;
    return (
      <div className="tbl-wrap">
        <table className="t">
          <thead>
            <tr><th>Nombre</th><th>Documento</th><th>Rol</th><th>Correo</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.nombre}</td>
                <td>{row.tipo_doc} {row.doc}</td>
                <td>{row.rol}</td>
                <td>{row.correo || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (seccion === "productos") {
    const { data } = await supabase
      .from("productos")
      .select("id, cod, nombre, precio, iva, stock0")
      .eq("company_id", company.id)
      .order("cod");
    const rows = data ?? [];
    if (rows.length === 0) return <p className="empty">No hay productos en esta empresa.</p>;
    return (
      <div className="tbl-wrap">
        <table className="t">
          <thead>
            <tr><th>Código</th><th>Nombre</th><th>Precio</th><th>IVA</th><th>Stock inicial</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.cod}</td>
                <td>{row.nombre}</td>
                <td>{money(row.precio)}</td>
                <td>{row.iva}%</td>
                <td>{row.stock0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const { data: documents } = await supabase
    .from("documentos")
    .select("id, tipo, num, fecha, anulado, created_by, cargo_id, lineas_asiento!lineas_asiento_documento_id_fkey(id, orden, cuenta, debito, credito, detalle)")
    .eq("company_id", company.id)
    .order("fecha", { ascending: true })
    .order("num", { ascending: true });

  const rows = documents ?? [];
  const tipos = SECTION_TIPOS[seccion];
  const visible = tipos ? rows.filter((document) => tipos.includes(document.tipo)) : rows;

  if (LIBROS.has(seccion)) {
    return (
      <Books
        seccion={seccion}
        documents={rows}
        supabase={supabase}
        studentId={studentId}
        companyId={company.id}
      />
    );
  }

  if (visible.length === 0) return <p className="empty">Este alumno no tiene documentos en esta sección.</p>;

  return <DocumentTable documents={visible} />;
}

function DocumentTable({
  documents,
}: {
  documents: { id: string; tipo: string; num: number; fecha: string; anulado: boolean }[];
}) {
  return (
    <div className="tbl-wrap">
      <table className="t">
        <thead>
          <tr><th>Fecha</th><th>Documento</th><th>Número</th><th>Estado</th></tr>
        </thead>
        <tbody>
          {documents.map((document) => (
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
  );
}

type DocLine = {
  id: string;
  tipo: string;
  num: number;
  fecha: string;
  anulado: boolean;
  created_by: string | null;
  cargo_id: string | null;
  lineas_asiento: {
    id: string;
    orden: number;
    cuenta: string;
    debito: number;
    credito: number;
    detalle: string;
  }[] | null;
};

async function Books({
  seccion,
  documents,
  supabase,
  studentId,
  companyId,
}: {
  seccion: string;
  documents: DocLine[];
  supabase: Awaited<ReturnType<typeof requireViewer>>["supabase"];
  studentId: string;
  companyId: string;
}) {
  const books = documents.filter((document) => document.tipo !== "ARC" && document.tipo !== "MAIL");
  const authorIds = [...new Set(books.map((document) => document.created_by).filter(Boolean))] as string[];
  const cargoIds = [...new Set(books.map((document) => document.cargo_id).filter(Boolean))] as string[];
  const [{ data: accounts }, { data: authors }, { data: cargos }] = await Promise.all([
    supabase.from("cuentas").select("codigo, nombre").order("codigo"),
    authorIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", authorIds)
      : Promise.resolve({ data: [] }),
    cargoIds.length
      ? supabase.from("cargos").select("id, name").in("id", cargoIds)
      : Promise.resolve({ data: [] }),
  ]);
  const names = new Map((accounts ?? []).map((account) => [account.codigo, account.nombre]));
  const authorName = new Map((authors ?? []).map((author) => [author.id, author.full_name || "Alumno"]));
  const cargoName = new Map((cargos ?? []).map((cargo) => [cargo.id, cargo.name]));
  const label = (code: string) => names.get(code) ?? code;
  const signature = (document: DocLine) => {
    const person = document.created_by ? authorName.get(document.created_by) ?? "Alumno" : "Sin autor";
    const cargo = document.cargo_id ? cargoName.get(document.cargo_id) : null;
    return cargo ? `${person} · ${cargo}` : person;
  };

  if (seccion === "diario") {
    if (books.length === 0) return <p className="empty">El libro diario todavía no tiene asientos.</p>;
    return (
      <div className="stack">
        {books.map((document) => (
          <div className="card stack" key={document.id} style={{ gap: 8 }}>
            <div className="spread">
              <b>{document.fecha} · {TIPO_LABEL[document.tipo] ?? document.tipo} {document.num > 0 ? document.num : ""}</b>
              {document.anulado ? <span className="chip">Anulado</span> : null}
            </div>
            <p className="small muted">Firmado por {signature(document)}</p>
            {(document.lineas_asiento ?? [])
              .slice()
              .sort((a, b) => a.orden - b.orden)
              .map((line) => (
                <div key={line.id} className="stack" style={{ gap: 6 }}>
                  <p className="small">
                    {line.cuenta} {label(line.cuenta)}
                    {line.detalle ? ` · ${line.detalle}` : ""}
                    {line.debito ? ` · débito ${money(line.debito)}` : ""}
                    {line.credito ? ` · crédito ${money(line.credito)}` : ""}
                  </p>
                  <CorrectLineForm
                    line={line}
                    accounts={accounts ?? []}
                    studentId={studentId}
                    companyId={companyId}
                  />
                </div>
              ))}
          </div>
        ))}
      </div>
    );
  }

  const { balances } = tallyDocuments(books);
  const totals = new Map<string, { debito: number; credito: number }>();
  for (const document of books) {
    for (const line of document.lineas_asiento ?? []) {
      const total = totals.get(line.cuenta) ?? { debito: 0, credito: 0 };
      total.debito += line.debito;
      total.credito += line.credito;
      totals.set(line.cuenta, total);
    }
  }
  const codes = [...totals.keys()].sort();

  if (seccion === "estados") {
    return (
      <div className="tiles">
        <div className="tile"><span>Caja (1105)</span><b>{money(balances.get("1105") ?? 0)}</b></div>
        <div className="tile"><span>Bancos (1110)</span><b>{money(balances.get("1110") ?? 0)}</b></div>
        <div className="tile"><span>Inventario (1435)</span><b>{money(balances.get("1435") ?? 0)}</b></div>
      </div>
    );
  }

  if (codes.length === 0) return <p className="empty">Todavía no hay movimientos para armar este libro.</p>;

  return (
    <div className="tbl-wrap">
      <table className="t">
        <thead>
          <tr>
            <th>Cuenta</th>
            <th>Débitos</th>
            <th>Créditos</th>
            <th>Saldo</th>
          </tr>
        </thead>
        <tbody>
          {codes.map((code) => {
            const total = totals.get(code)!;
            return (
              <tr key={code}>
                <td>{code} {label(code)}</td>
                <td>{money(total.debito)}</td>
                <td>{money(total.credito)}</td>
                <td>{money(total.debito - total.credito)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function StudentSectionPage(props: {
  params: Promise<{ id: string; seccion: string }>;
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
      <StudentSection params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
