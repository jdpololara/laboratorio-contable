export function authError(message: string) {
  const text = message.toLowerCase();
  if (text.includes("invalid login") || text.includes("invalid credentials")) {
    return "Correo o contraseña incorrectos.";
  }
  if (text.includes("already registered") || text.includes("already been registered")) {
    return "Ese correo ya tiene una cuenta. Ingresa con tu contraseña.";
  }
  if (text.includes("password")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  if (text.includes("email")) return "El correo no es válido.";
  if (text.includes("rate")) return "Espera un momento e inténtalo de nuevo.";
  return "No se pudo completar. Inténtalo de nuevo.";
}

export function dbError(message: string) {
  const cleaned = message.replace(/^.*ERROR:\s*/, "").split("\n")[0]?.trim() ?? "";
  if (/[áéíóúñ¿¡]/i.test(cleaned)) return cleaned;
  return "No se pudo guardar. Inténtalo de nuevo.";
}
