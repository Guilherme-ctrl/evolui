/** Formata 11 dígitos como 000.000.000-00; devolve o texto se não for CPF só numérico. */
export function formatCpfBr(digits: string): string {
  if (!/^\d{11}$/.test(digits)) return digits;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

const DOC_TYPE_LABEL: Record<string, string> = {
  CPF: 'CPF',
  RG: 'RG',
  RNE: 'RNE / passaporte',
  OUTRO: 'Outro documento',
};

export function labelStudentDocumentType(t: string): string {
  return DOC_TYPE_LABEL[t] ?? t;
}
