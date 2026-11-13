export const ACTIONS = [
  ["company.edit", "Datos de la empresa"],
  ["terceros.write", "Terceros"],
  ["productos.write", "Productos e inventario"],
  ["pos.write", "Punto de venta"],
  ["fe.write", "Facturas de venta"],
  ["rc.write", "Recibos de caja"],
  ["fc.write", "Facturas de compra"],
  ["ce.write", "Comprobantes de egreso"],
  ["caja.write", "Arqueo y consignación"],
  ["banco.write", "Extracto y conciliación"],
  ["nc.write", "Notas de contabilidad"],
  ["books.read", "Libros y estados financieros"],
  ["files.write", "Soportes y correos"],
  ["document.void", "Anular un documento"],
  ["company.delete", "Borrar la empresa"],
] as const;

export type ActionKey = (typeof ACTIONS)[number][0];
export type ActionLevel = "do" | "view" | "hide";

export const SECTION_ACTION: Record<string, ActionKey> = {
  pos: "pos.write",
  facturas: "fe.write",
  recibos: "rc.write",
  compras: "fc.write",
  egresos: "ce.write",
  caja: "caja.write",
  bancos: "banco.write",
  conciliacion: "banco.write",
  diario: "books.read",
  mayor: "books.read",
  balance: "books.read",
  estados: "books.read",
  notas: "nc.write",
  repositorio: "files.write",
  correos: "files.write",
  terceros: "terceros.write",
  productos: "productos.write",
  empresa: "company.edit",
};

const LEVEL_RANK: Record<ActionLevel, number> = { hide: 0, view: 1, do: 2 };

export function isAction(value: string): value is ActionKey {
  return ACTIONS.some(([key]) => key === value);
}

export function isLevel(value: string): value is ActionLevel {
  return value === "do" || value === "view" || value === "hide";
}

export function mergeLevels(
  rows: { action: string; level: string }[],
): Partial<Record<ActionKey, ActionLevel>> {
  const merged: Partial<Record<ActionKey, ActionLevel>> = {};
  for (const row of rows) {
    if (!isAction(row.action) || !isLevel(row.level)) continue;
    const current = merged[row.action];
    if (!current || LEVEL_RANK[row.level] > LEVEL_RANK[current]) {
      merged[row.action] = row.level;
    }
  }
  return merged;
}

export function companyLabel(company: {
  kind: "personal" | "equipo";
  razon: string | null;
}) {
  if (company.razon) return company.razon;
  return company.kind === "personal" ? "Empresa personal" : "Empresa de equipo";
}

export function kindLabel(kind: "personal" | "equipo") {
  return kind === "personal" ? "Personal" : "De equipo";
}
