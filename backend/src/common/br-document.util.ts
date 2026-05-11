import { StudentDocumentType } from '@prisma/client';

export class StudentDocumentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StudentDocumentValidationError';
  }
}

function isValidCpfDigits(d: string): boolean {
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number.parseInt(d[i]!, 10) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number.parseInt(d[9]!, 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number.parseInt(d[i]!, 10) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number.parseInt(d[10]!, 10);
}

export function normalizeStudentDocumentPair(
  documentType: StudentDocumentType,
  rawNumber: string,
): { documentType: StudentDocumentType; documentNumber: string } {
  const trimmed = rawNumber.trim();
  if (!trimmed) {
    throw new StudentDocumentValidationError(
      'Informe o número do documento ou deixe tipo e número em branco.',
    );
  }

  switch (documentType) {
    case StudentDocumentType.CPF: {
      const digits = trimmed.replace(/\D/g, '');
      if (!isValidCpfDigits(digits)) {
        throw new StudentDocumentValidationError('CPF inválido.');
      }
      return { documentType, documentNumber: digits };
    }
    case StudentDocumentType.RG:
    case StudentDocumentType.RNE:
    case StudentDocumentType.OUTRO: {
      if (trimmed.length < 2 || trimmed.length > 32) {
        throw new StudentDocumentValidationError(
          'Documento deve ter entre 2 e 32 caracteres.',
        );
      }
      return { documentType, documentNumber: trimmed };
    }
    default:
      throw new StudentDocumentValidationError(
        'Tipo de documento não suportado.',
      );
  }
}

/** Para create (existing=null) ou update: número vazio limpa documento; número preenchido exige tipo. */
export function resolveStudentDocumentForUpsert(
  existing: {
    documentType: StudentDocumentType | null;
    documentNumber: string | null;
  } | null,
  dto: {
    documentType?: StudentDocumentType | null;
    documentNumber?: string | null;
  },
): { documentType: StudentDocumentType | null; documentNumber: string | null } {
  const exType = existing?.documentType ?? null;
  const exNum = existing?.documentNumber ?? null;
  const type = dto.documentType !== undefined ? dto.documentType : exType;
  const raw = dto.documentNumber !== undefined ? dto.documentNumber : exNum;
  const num = raw === null || raw === undefined ? '' : String(raw).trim();

  if (!num) {
    return { documentType: null, documentNumber: null };
  }

  const effType = type ?? null;
  if (!effType) {
    throw new StudentDocumentValidationError('Selecione o tipo de documento.');
  }
  return normalizeStudentDocumentPair(effType, num);
}
