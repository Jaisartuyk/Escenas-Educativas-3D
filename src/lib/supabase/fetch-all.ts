// src/lib/supabase/fetch-all.ts
// Utilidad para paginar consultas de Supabase que pueden superar el límite
// de Max Rows (por defecto 1000). Itera automáticamente hasta traer TODAS
// las filas, sin importar cuántas sean.

export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => Promise<T[] | null | undefined>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = []

  for (let from = 0; ; from += pageSize) {
    const page = (await fetchPage(from, from + pageSize - 1)) || []
    rows.push(...page)

    if (page.length < pageSize) break // última página → listo
  }

  return rows
}
