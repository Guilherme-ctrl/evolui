/** RN-204: alerta não bloqueante quando categorias do aluno e da turma divergem. */
export function enrollmentCategoryWarnings(
  studentCategory: string | null | undefined,
  turmaCategory: string | null | undefined,
): string[] {
  const norm = (v: string) =>
    v.trim().toLowerCase().replace(/\s+/g, ' ').replace(/−/g, '-');
  const s = norm(studentCategory ?? '');
  const t = norm(turmaCategory ?? '');
  if (!s || !t) return [];
  if (s === t) return [];
  return ['categoria divergente'];
}
