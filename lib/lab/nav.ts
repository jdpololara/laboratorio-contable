export const NAV = [
  {
    group: "Inicio",
    items: [{ href: "/", id: "inicio", label: "Inicio y ruta del taller" }],
  },
  {
    group: "Ventas",
    items: [
      { href: "/s/pos", id: "pos", label: "Punto de venta (POS)" },
      { href: "/s/facturas", id: "facturas", label: "Facturas de venta" },
      { href: "/s/recibos", id: "recibos", label: "Recibos de caja" },
    ],
  },
  {
    group: "Compras",
    items: [
      { href: "/s/compras", id: "compras", label: "Facturas de compra" },
      { href: "/s/egresos", id: "egresos", label: "Comprobantes de egreso" },
    ],
  },
  {
    group: "Tesorería",
    items: [
      { href: "/s/caja", id: "caja", label: "Caja y arqueo" },
      { href: "/s/bancos", id: "bancos", label: "Bancos y extractos" },
      { href: "/s/conciliacion", id: "conciliacion", label: "Conciliación bancaria" },
    ],
  },
  {
    group: "Contabilidad",
    items: [
      { href: "/s/diario", id: "diario", label: "Libro diario" },
      { href: "/s/mayor", id: "mayor", label: "Libro mayor" },
      { href: "/s/balance", id: "balance", label: "Balance de prueba" },
      { href: "/s/estados", id: "estados", label: "Estados financieros" },
      { href: "/s/notas", id: "notas", label: "Notas de contabilidad" },
    ],
  },
  {
    group: "Documentos",
    items: [
      { href: "/s/repositorio", id: "repositorio", label: "Repositorio de documentos" },
      { href: "/s/correos", id: "correos", label: "Correos enviados" },
    ],
  },
  {
    group: "Configuración",
    items: [
      { href: "/s/terceros", id: "terceros", label: "Terceros" },
      { href: "/s/productos", id: "productos", label: "Productos e inventario" },
      { href: "/s/empresa", id: "empresa", label: "Mi empresa" },
    ],
  },
] as const;

export const SECTIONS: Record<string, { title: string; description: string }> = {
  pos: {
    title: "Punto de venta (POS)",
    description:
      "Ventas de mostrador al consumidor final. Cada venta genera un documento equivalente POS y su asiento.",
  },
  facturas: {
    title: "Facturas de venta",
    description: "Facturas electrónicas de venta, de contado o a crédito.",
  },
  recibos: {
    title: "Recibos de caja",
    description: "Recaudo de facturas de venta a crédito.",
  },
  compras: {
    title: "Facturas de compra",
    description: "Compras de mercancía y gastos a proveedores.",
  },
  egresos: {
    title: "Comprobantes de egreso",
    description: "Pagos a proveedores, en efectivo, transferencia o cheque.",
  },
  caja: {
    title: "Caja y arqueo",
    description: "Arqueo del efectivo y consignación al banco.",
  },
  bancos: {
    title: "Bancos y extractos",
    description: "Movimientos de la cuenta y extracto del mes.",
  },
  conciliacion: {
    title: "Conciliación bancaria",
    description: "Cruce del extracto con el libro auxiliar de bancos.",
  },
  diario: {
    title: "Libro diario",
    description: "Los asientos en orden de fecha.",
  },
  mayor: {
    title: "Libro mayor",
    description: "Los movimientos de una cuenta.",
  },
  balance: {
    title: "Balance de prueba",
    description: "Sumas y saldos de las cuentas a la fecha de trabajo.",
  },
  estados: {
    title: "Estados financieros",
    description: "Estado de resultados y situación financiera.",
  },
  notas: {
    title: "Notas de contabilidad",
    description: "Ajustes que no salen de un documento operativo.",
  },
  repositorio: {
    title: "Repositorio de documentos",
    description: "Soportes de la empresa.",
  },
  correos: {
    title: "Correos enviados",
    description: "Mensajes registrados desde un documento.",
  },
  terceros: {
    title: "Terceros",
    description: "Clientes y proveedores de la empresa.",
  },
  productos: {
    title: "Productos e inventario",
    description: "Catálogo y existencias.",
  },
  empresa: {
    title: "Mi empresa",
    description: "Datos de la comercializadora y de la facturación.",
  },
};

export const RUTA = [
  ["Crear la empresa y revisar los saldos iniciales", "empresa"],
  ["Registrar al menos 5 ventas en el punto de venta", "pos"],
  ["Emitir 2 facturas de venta, una de ellas a crédito", "facturas"],
  ["Registrar una compra de mercancía a un proveedor", "compras"],
  ["Pagar a un proveedor con cheque", "egresos"],
  ["Recaudar una factura con recibo de caja", "recibos"],
  ["Hacer un arqueo de caja", "caja"],
  ["Consignar el efectivo en el banco", "caja"],
  ["Solicitar el extracto bancario del mes", "bancos"],
  ["Elaborar la conciliación bancaria", "conciliacion"],
  ["Revisar que el balance de prueba cuadre", "balance"],
] as const;
