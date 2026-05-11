import { EvaluationModel } from '@prisma/client';

function prettyDim(key: string): string {
  if (!key) return 'Dimensão';
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildAutoFeedback(
  scores: Record<string, unknown>,
  model: EvaluationModel,
): string {
  const parts: string[] = [];

  if (model === EvaluationModel.STARS) {
    for (const [k, v] of Object.entries(scores)) {
      if (typeof v !== 'number') continue;
      const dim = prettyDim(k);
      const n = Math.round(v);
      if (n >= 5) {
        parts.push(`Desempenho excepcional em ${dim} (${n}/5).`);
      } else if (n === 4) {
        parts.push(`Muito bom em ${dim} (${n}/5); seguir evoluindo.`);
      } else if (n === 3) {
        parts.push(
          `Bom ritmo em ${dim} (${n}/5); há espaço para subir mais um nível.`,
        );
      } else if (n === 2) {
        parts.push(
          `Em ${dim} (${n}/5), vamos reforçar com exercícios específicos nas próximas sessões.`,
        );
      } else {
        parts.push(
          `Em ${dim} (${n}/5), precisamos de foco e repetição; conte com o staff para evoluir.`,
        );
      }
    }
    return parts.join(' ') || 'Continue treinando com dedicação!';
  }

  for (const [k, v] of Object.entries(scores)) {
    if (typeof v !== 'string') continue;
    const dim = prettyDim(k);
    const label = v.trim();
    if (label === 'Excelente') {
      parts.push(`Destaque em ${dim}: excelente participação e atitude.`);
    } else if (label === 'Muito bom') {
      parts.push(
        `${dim} em ótimo caminho; pequenos ajustes podem elevar ainda mais.`,
      );
    } else if (label === 'Bom') {
      parts.push(
        `Bom nível em ${dim}; vamos buscar consistência para subir de patamar.`,
      );
    } else if (label === 'Precisa melhorar') {
      parts.push(
        `Em ${dim}, há margem para crescer — vamos trabalhar isso com calma nas próximas atividades.`,
      );
    } else {
      parts.push(`${dim}: ${label}.`);
    }
  }

  return parts.join(' ') || 'Continue treinando com dedicação!';
}
