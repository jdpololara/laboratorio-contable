export const TIPO_LABEL: Record<string, string> = {
  INI: "Saldos iniciales",
  FE: "Factura de venta",
  POS: "Punto de venta",
  RC: "Recibo de caja",
  FC: "Factura de compra",
  CE: "Comprobante de egreso",
  CG: "Consignación",
  NC: "Nota de contabilidad",
  AQ: "Arqueo",
  EXT: "Extracto",
  CON: "Conciliación",
  MAIL: "Correo",
  ARC: "Archivo",
};

type Line = { cuenta: string; debito: number; credito: number };

export function tallyDocuments<T extends { tipo: string; lineas_asiento?: Line[] | null }>(
  documents: T[],
) {
  const balances = new Map<string, number>();
  const counts = new Map<string, number>();

  for (const document of documents) {
    counts.set(document.tipo, (counts.get(document.tipo) ?? 0) + 1);
    for (const line of document.lineas_asiento ?? []) {
      balances.set(
        line.cuenta,
        (balances.get(line.cuenta) ?? 0) + line.debito - line.credito,
      );
    }
  }

  return { balances, counts };
}

/** Cuenta la ruta de una empresa personal. Los documentos de una empresa de equipo no entran. */
export function rutaDone(counts: Map<string, number>, hasCompany: boolean) {
  const count = (tipo: string) => counts.get(tipo) ?? 0;
  return [
    hasCompany,
    count("POS") >= 5,
    count("FE") >= 2,
    count("FC") >= 1,
    count("CE") >= 1,
    count("RC") >= 1,
    count("AQ") >= 1,
    count("CG") >= 1,
    count("EXT") >= 1,
    count("CON") >= 1,
    count("CON") >= 1,
  ];
}
