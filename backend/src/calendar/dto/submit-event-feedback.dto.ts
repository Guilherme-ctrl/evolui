import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Submissão de feedback físico do ATLETA para um evento do calendário. `scores`
 * é um objeto `{ <dimensionKey>: 1..5 }` — chaves desconhecidas (não nas dims
 * efetivas) retornam 400; chaves omitidas ficam como "não respondeu".
 */
export class SubmitEventFeedbackDto {
  @IsObject()
  scores!: Record<string, number>;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  notes?: string;
}
