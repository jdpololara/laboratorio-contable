export const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

export const TERCEROS_EJEMPLO = [
  { tipo_doc: "CC", doc: "222222222222", nombre: "Consumidor final", rol: "cliente", correo: "" },
  { tipo_doc: "NIT", doc: "890.904.112-3", nombre: "Colegio San José del Valle", rol: "cliente", correo: "compras@colegiosanjose.example" },
  { tipo_doc: "NIT", doc: "901.233.450-8", nombre: "Almacén Villa Real S.A.S.", rol: "cliente", correo: "cartera@villareal.example" },
  { tipo_doc: "CC", doc: "43.512.887", nombre: "Marta Lucía Ospina", rol: "cliente", correo: "marta.ospina@correo.example" },
  { tipo_doc: "NIT", doc: "900.118.774-1", nombre: "Distribuidora Papelera Nacional S.A.S.", rol: "proveedor", correo: "facturacion@papeleranacional.example" },
  { tipo_doc: "NIT", doc: "890.980.551-0", nombre: "Servicios Públicos Municipales E.S.P.", rol: "proveedor", correo: "atencion@serviciosmunicipales.example" },
  { tipo_doc: "NIT", doc: "811.045.902-6", nombre: "Inmobiliaria La Floresta S.A.S.", rol: "proveedor", correo: "pagos@inmolafloresta.example" },
] as const;

export const CATALOGO_EJEMPLO = [
  ["P01", "Cuaderno argollado 100 hojas", 9000, 5600, 19, 60],
  ["P02", "Bolígrafo negro (caja x 12)", 18000, 11000, 19, 30],
  ["P03", "Resma papel carta 75 g", 22000, 15500, 19, 40],
  ["P04", "Calculadora científica", 65000, 41000, 19, 12],
  ["P05", "Carpeta AZ oficio", 12000, 7200, 19, 35],
  ["P06", "Marcadores borrables (x 4)", 14000, 8400, 19, 30],
  ["P07", "Libro contable de registro", 25000, 15800, 19, 20],
  ["P08", "Texto escolar de matemáticas", 48000, 33000, 0, 15],
].map(([cod, nombre, precio, costo0, iva, stock0]) => ({
  cod,
  nombre,
  precio,
  costo0,
  iva,
  stock0,
}));

export const CONSUMIDOR_FINAL = [TERCEROS_EJEMPLO[0]];

export function monthOptions() {
  const options: { value: string; label: string }[] = [];
  for (let year = 2026; year <= 2027; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const value = `${year}-${String(month).padStart(2, "0")}`;
      options.push({ value, label: `${MESES[month - 1]} de ${year}` });
    }
  }
  return options;
}

function hashStr(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeRng(seed: string) {
  let state = hashStr(seed);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next;
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function openingIdentity(nit: string, razon: string) {
  const random = makeRng(`${nit}${razon}${Date.now()}`);
  return {
    resolNumero: `18764${String(Math.floor(random() * 1e8)).padStart(8, "0")}`,
    bancoCuenta: `${100 + Math.floor(random() * 899)}-${100000 + Math.floor(random() * 899999)}-${10 + Math.floor(random() * 89)}`,
    chequeIni: (12 + Math.floor(random() * 70)) * 100 + 1,
  };
}

export function money(value: number) {
  const amount = Math.round(value || 0);
  const formatted = new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
  return `${amount < 0 ? "−" : ""}$ ${formatted}`;
}
