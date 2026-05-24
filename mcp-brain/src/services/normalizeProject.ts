/**
 * Normaliza un nombre de proyecto a un slug consistente.
 * - Convierte a minúsculas
 * - Elimina caracteres especiales (solo permite a-z, 0-9, guiones)
 * - Elimina guiones múltiples consecutivos y leading/trailing
 * - Es genérico: funciona para CUALQUIER nombre de proyecto
 */
export function normalizeProject(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')   // reemplaza especiales con guión
    .replace(/-+/g, '-')              // guiones múltiples → uno solo
    .replace(/^-+|-+$/g, '')          // quita leading/trailing
    .trim();
}
